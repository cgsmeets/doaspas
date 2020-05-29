import { DoaspasBuildJob, DoaspasBuildResult, DoaspasShared } from './analyze_definition';
import { IFQuery, IFSAJ_Analyze_Result__c } from './analyze_object_definition';
import { fnBuildSoql, fnGetAllId, fnResultMessage } from './analyze_util';

export default class JobResultTemplate1 extends DoaspasBuildResult {
    public data: IFSAJ_Analyze_Result__c;

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

        await DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', fnGetAllId(r.records));
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
