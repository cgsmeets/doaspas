import { DoaspasBuildJob, DoaspasBuildResult, DoaspasShared } from './analyze_definition';
import { IFProcessResult, IFQuery, IFSAJ_Analyze_Result__c } from './analyze_object_definition';
import { fnBuildSoql, fnGetAllId, fnResultMessage } from './analyze_util';

export default class JobResultTemplate1 extends DoaspasBuildResult {
    public data: IFSAJ_Analyze_Result__c;

    constructor(job: DoaspasBuildJob) {
        super(job);
        this.data = {SAJ_Passed__c : false};
        this.recordtypeid = DoaspasShared.resultRecordTypeId.get('Job_Result_1');
    }

    public async Insert(): Promise<IFProcessResult> {
        const r: IFProcessResult = {};
        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', this.data);
        r.passed = this.data.SAJ_Passed__c;
        r.message = fnResultMessage(p);
        return r;
    }

    public async Replace(): Promise<IFProcessResult> {

        const q: IFQuery = {conn: DoaspasShared.acCon,
                            object: 'SAJ_Analyze_Result__c',
                            field: ['Id'],
                            where: 'OwnerId = \'' + DoaspasShared.user.Id + '\' AND SAJ_Analyze_Job_Assignment__c' + '='  + '\'' + this.job.field.AppJobId + '\'' + ' AND recordtypeid = ' + '\'' + this.recordtypeid + '\''};
        const r = await DoaspasShared.acCon.query<IFSAJ_Analyze_Result__c>(await fnBuildSoql(q));

        await DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', fnGetAllId(r.records));
        return await this.Insert();
    }

    public async Upsert(): Promise<IFProcessResult> {
        const r: IFProcessResult = {};
        const p = await DoaspasShared.acCon.upsert('SAJ_Analyze_Result__c', this.data, 'Id');
        r.passed = this.data.SAJ_Passed__c;
        r.message = fnResultMessage(p);
        return r;
    }

    public toJSON() {
        const ret = [{summary: this.summary, data: this.data}];
        return ret;
    }

    protected setCommonFields(): void {
        this.setFields(this.data);
    }
}
