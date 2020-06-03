import { Connection, Org, SfdxError } from '@salesforce/core';
import { IFJob, IFProcessResult, IFQuery, IFRecordType, IFSAJ_Analyze_Result__c, IFSAJ_Release__c, IFSAJ_Release_Component__c, IFSummary } from './analyze_object_definition';
import JobResultTemplate1 from './analyze_result_template1';
import JobResultTemplate2 from './analyze_result_template2';
import { fnBuildSoql, fnResultErrorMsg, fnResultSuccess } from './analyze_util';

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
    public static buildSummaryRec: IFSAJ_Analyze_Result__c = {};
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
        const res = new Map();
        for (const f of r.records) {
            res.set(f.DeveloperName, f.Id);
        }
        DoaspasShared.resultRecordTypeId = res;
    }

    public async InitBuildSummary(): Promise<void> {
        DoaspasShared.buildSummaryRec.RecordTypeId =  DoaspasShared.resultRecordTypeId.get('Build_Summary');
        DoaspasShared.buildSummaryRec.Name = 'Build Summary';
        DoaspasShared.buildSummaryRec.SAJ_Passed__c = false;
        DoaspasShared.buildSummaryRec.SAJ_App__c = DoaspasShared.build.SAJ_Application__r.Id;
        DoaspasShared.buildSummaryRec.SAJ_Release__c = DoaspasShared.build.Id;

        const p = await this.conn.insert('SAJ_Analyze_Result__c', DoaspasShared.buildSummaryRec);
        if (!fnResultSuccess(p)) {
            for (const f of fnResultErrorMsg(p)) {
              console.log(f);
            }
            throw new SfdxError('Can not create build summary record');
        } else {
            console.log('Build Summary: ' + p['id']);
            DoaspasShared.buildSummaryRec.Id = p['id'];
        }

    }

    public async CompleteBuildSummary(): Promise<void> {

        const p = await this.conn.update('SAJ_Analyze_Result__c', DoaspasShared.buildSummaryRec);
        if (!fnResultSuccess(p)) {
            for (const f of fnResultErrorMsg(p)) {
              console.log(f);
            }
            throw new SfdxError('Can not update build summary record');
        }
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
        if (DoaspasShared.build === null || DoaspasShared.build === undefined) {
            throw new SfdxError('Must execute LoadBuild first');
        }
        const q: IFQuery = {conn: this.conn, object: 'SAJ_Release_Component__c', where: 'SAJ_Release__c' + '='  + '\'' + DoaspasShared.build.Id + '\''};
        const r = await this.conn.query<IFSAJ_Release_Component__c>(await fnBuildSoql(q));
        DoaspasShared.buildcomp = r.records;
    }
}

abstract class DoaspasResult {
    public summary: IFSummary;
    public recordtypeid: string;

    constructor() {
        this.summary = {completed: false, passed: false, message: '', startTime: Date.now()};
    }
}

export abstract class DoaspasBuildResult extends DoaspasResult {
    protected job: DoaspasBuildJob;

    constructor(job: DoaspasBuildJob) {
        super();
        this.job = job;
        this.summary.job = job.field;
    }
    public abstract async Insert(): Promise<IFProcessResult>;
    public abstract async Replace(): Promise<IFProcessResult>;
    public abstract async Upsert(): Promise<IFProcessResult>;

    public async Process(): Promise<IFSummary> {

        const rec: IFSAJ_Analyze_Result__c = await this.CreateJobSummary();
        let pResult: IFProcessResult;
        this.setCommonFields();

        switch (this.job.field.Operation) {
            case 'Insert':
                pResult = await this.Insert();
                break;
            case 'Replace':
                pResult = await this.Replace();
                break;
            case 'Upsert':
                pResult = await this.Upsert();
                break;
            default:
                throw new SfdxError('Unknown Job Operation');
                break;
        }

        await this.CompleteJobSummary(rec, pResult);

        return this.summary;
    }

    public async CreateJobSummary(): Promise<IFSAJ_Analyze_Result__c> {
        const jobSummaryRec: IFSAJ_Analyze_Result__c = {};

        jobSummaryRec.RecordTypeId = DoaspasShared.resultRecordTypeId['Job_Summary'];
        jobSummaryRec.Name = 'Job Summary - ' + this.job.ref;
        jobSummaryRec.SAJ_Analyze_Job__c = this.job.field.JobId;
        jobSummaryRec.SAJ_Analyze_Job_Assignment__c = this.job.field.AppJobId;

        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', jobSummaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Creating Job Summary');
        } else {
            jobSummaryRec.Id = p['id'];
        }
        return jobSummaryRec;
    }

    public async CompleteJobSummary(jobSummaryRec: IFSAJ_Analyze_Result__c, pResult: IFProcessResult): Promise<void> {

        this.summary.message += pResult.message;
        this.summary.completed = this.summary.message.localeCompare('') === 0;
        this.summary.passed = (pResult.passed ==  null ? false : pResult.passed) && this.summary.completed;
        this.summary.endTime = Date.now();
        this.summary.execTime = this.summary.endTime - this.summary.startTime + 1;

        jobSummaryRec.SAJ_Message__c = this.summary.message;
        jobSummaryRec.SAJ_Short_Message__c = this.summary.message.substring(0, 255);
        jobSummaryRec.SAJ_Exec_Time__c = this.summary.execTime;

        const p = await DoaspasShared.acCon.update('SAJ_Analyze_Result__c', jobSummaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Updating Job Summary');
        }
    }

    protected abstract setCommonFields(): void;

    protected setFields(v: IFSAJ_Analyze_Result__c): void {
        v.SAJ_Analyze_Job__c = this.job.field.JobId;
        v.SAJ_Analyze_Job_Assignment__c = this.job.field.AppJobId;
        v.SAJ_Release__c = DoaspasShared.build.Id;
        v.SAJ_App__c = DoaspasShared.build.SAJ_Application__r.Id;
        v.SAJ_Parent__c = DoaspasShared.buildSummaryRec.Id;
        v.RecordTypeId = this.recordtypeid;
    }
}

export {DoaspasBuildJob, ResultTemplate, DoaspasShared };
