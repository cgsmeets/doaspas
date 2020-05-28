import { Connection, SfdxError, Org } from '@salesforce/core';
import { IFRecordType, IFSAJ_Analyze_Result__c, IFSAJ_Release__c, IFSAJ_Release_Component__c, IFQuery, IFSummary, SAJ_Analyze_Job_Summary__c, IFJob } from './analyze_object_definition';
import { fnResultSuccess, fnResultErrorMsg, fnBuildSoql, fnResultMessage, fnGetAllId } from './analyze_util';
import { isNullOrUndefined } from 'util';

enum ResultTemplate {
    releasecomponent,
    buildsingle,
    buildmulti,
    environmentsingle,
    environmentmulti
}
abstract class DoaspasJob {
    public field: IFJob;
    public ref: string;

    constructor( job: IFJob) {
        this.field = job;
        this.ref = job.Name + '-' + Date.now() + '-' + Math.round(Math.random() * 1000000);
    }
}

abstract class DoaspasBuildJob extends DoaspasJob {
    public result: JobResultTemplate1|JobResultTemplate2;

    constructor(job: IFJob) {
        super(job);
     }

     public abstract run(): Promise<JobResultTemplate1|JobResultTemplate2>;

     public getSummary(): IFSummary {
         return this.result.summary;
    }
}

class DoaspasShared {
    public static acCon: Connection;
    public static envCon: Connection;
    public static local: boolean;
    public static resultRecordTypeId;
    public static build: IFSAJ_Release__c;
    public static buildcomp: IFSAJ_Release_Component__c[];
    protected conn: Connection;
    protected target: string;

     constructor(conn: Connection, target?: string) {
        this.conn = conn;
        this.target = target;
    }

    public async Init(): Promise<boolean> {
        DoaspasShared.local = this.target === null || this.target === undefined;

        DoaspasShared.acCon = this.conn;
        if (!DoaspasShared.local) {
            const env = await Org.create({
                aliasOrUsername: this.target
              });
            DoaspasShared.envCon = env.getConnection();
        }
        return DoaspasShared.local;
    }

    public async LoadRecordType(): Promise<void> {
        const q = 'SELECT Id, DeveloperName FROM RecordType where Sobjecttype = \'SAJ_Analyze_Result__c\'';
        const r = await this.conn.query<IFRecordType>(q);
        const res = new Array();
        for (const f of r.records) {
            res.push(f.DeveloperName, f.Id);
        }
        DoaspasShared.resultRecordTypeId = res;
    }

    public async LoadBuild(buildname: string): Promise<void> {
        let q = 'SELECT Id, SAJ_Application__c, SAJ_Application__r.Name, SAJ_Application__r.SAJ_Project_Dev_Prefix__c,SAJ_Application__r.Id, Name FROM SAJ_Release__c where ';
        q += 'Name = ' + '\'' + buildname + '\' limit 1';
        const r = await this.conn.query<IFSAJ_Release__c>(q);
        if (r.totalSize === 0) {
            throw new SfdxError('No Build Found!');
        }
        DoaspasShared.build = r.records[0];
    }

    public async LoadBuildComponent(): Promise<void> {
        if (isNullOrUndefined(DoaspasShared.build)) {
            throw new SfdxError('Must execute LoadBuild first');
        }
        const q: IFQuery = {conn: this.conn, object: 'SAJ_Release_Component__c', where: 'SAJ_Release__c' + '='  + '\'' + DoaspasShared.build.Id + '\''};
        const r = await this.conn.query<IFSAJ_Release_Component__c>(await fnBuildSoql(q));
        DoaspasShared.buildcomp = r.records;
    }
}

abstract class DoaspasResult {
    public summary: IFSummary;
    public data: IFSAJ_Analyze_Result__c;

    constructor() {
        this.summary = {completed: false, message: '', startTime: Date.now()};
    }
}

abstract class DoaspasBuildResult extends DoaspasResult {
    protected job: DoaspasBuildJob;

    constructor(job: DoaspasBuildJob) {
        super();
        this.job = job;
        this.summary.job = job.field;
    }
    public abstract async Insert(): Promise<string>;
    public abstract async Replace(): Promise<string>;
    public abstract async Upsert(): Promise<string>;

    public async Process(): Promise<IFSummary> {

        let message: string = '';
        this.setCommonLookups();

        switch (this.job.field.Operation) {
            case 'Insert':
                message = await this.Insert();
                break;
            case 'Replace':
                message = await this.Replace();
                break;
            case 'Upsert':
                message = await this.Upsert();
                break;
            default:
                throw new SfdxError('Unknown Job Operation');
                break;
        }
        await this.CreateSummary(message);

        return this.summary;
    }

    public async CreateSummary(message: string): Promise<void> {
        this.summary.completed = message.localeCompare('') === 0;
        this.summary.message += message;
        this.summary.endTime = Date.now();
        this.summary.execTime = this.summary.endTime - this.summary.startTime + 1;

        const summaryRec: SAJ_Analyze_Job_Summary__c = {};
        summaryRec.SAJ_Message__c = this.summary.message;
        summaryRec.SAJ_Short_Message__c = this.summary.message.substring(0, 255);
        summaryRec.SAJ_Exec_Time__c = this.summary.execTime;
        summaryRec.SAJ_Analyze_Job__c = this.job.field.JobId;
        summaryRec.SAJ_App_Analyze_Job__c = this.job.field.AppJobId;
        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Job_Summary__c', summaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Saving Job Summary');
        }
    }

    protected abstract setCommonLookups(): void;

    protected setCommonLookupFields(v: IFSAJ_Analyze_Result__c): void {
        v.SAJ_Analyze_Job__c = this.job.field.JobId;
        v.SAJ_App_Analyze_Job__c = this.job.field.AppJobId;
        v.SAJ_Release__c = DoaspasShared.build.Id;
        v.SAJ_App__c = DoaspasShared.build.SAJ_Application__r.Id;
    }
}

class JobResultTemplate1 extends DoaspasBuildResult {

    constructor(job: DoaspasBuildJob) {
        super(job);
        this.data = {};
    }

    public async Insert(): Promise<string> {
        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', this.data);
        return fnResultMessage(p);
    }

    public async Replace(): Promise<string> {

        const q: IFQuery = {conn: DoaspasShared.acCon, object: 'SAJ_Analyze_Result__c', field: ['Id'], where: 'SAJ_App_Analyze_Job__c' + '='  + '\'' + this.job.field.AppJobId + '\''};
        const r = await DoaspasShared.acCon.query<IFSAJ_Analyze_Result__c>(await fnBuildSoql(q));
        console.log ('DELETE:' + await fnBuildSoql(q));

        const p = await DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', fnGetAllId(r.records));
        console.log ('DELETE RES:' + fnGetAllId(r.records));
        return await this.Insert();
    }

    public async Upsert(): Promise<string> {
        const p = await DoaspasShared.acCon.upsert('SAJ_Analyze_Result__c', this.data, 'Id');
        return fnResultMessage(p);
    }

    public toJSON() {
        const ret = [{summary: this.summary, data: this.data}];
        return ret;
    }

    protected setCommonLookups(): void {
        this.setCommonLookupFields(this.data);
    }
}

class JobResultTemplate2 extends DoaspasBuildResult {

    constructor(job: DoaspasBuildJob) {
        super(job);
        this.data = {};
    }

    public async Insert(): Promise<string> {
        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', this.data);
        return fnResultMessage(p);
    }

    public async Replace(): Promise<string> {
        const q: IFQuery = {conn: DoaspasShared.acCon, object: 'SAJ_Analyze_Result__c', field: ['Id'], where: 'SAJ_App_Analyze_Job__c' + '='  + '\'' + this.job.field.AppJobId + '\''};
        const r = await DoaspasShared.acCon.query<IFSAJ_Release_Component__c>(await fnBuildSoql(q));

        console.log (r.records);
        console.log(fnGetAllId(r.records));

        const p = await DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', fnGetAllId(r.records));
        console.log ('DELETE:' + p);
        return await this.Insert();
    }

    public async Upsert(): Promise<string> {
        const p = await DoaspasShared.acCon.upsert('SAJ_Analyze_Result__c', this.data, 'Id');
        return fnResultMessage(p);
    }

    protected setCommonLookups(): void {
        this.setCommonLookupFields(this.data);
    }
}

export {DoaspasBuildJob, JobResultTemplate1, JobResultTemplate2, ResultTemplate, DoaspasShared };
