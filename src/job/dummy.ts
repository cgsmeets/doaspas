import { Connection } from '@salesforce/core';
import { DoaspasBuildJob } from '../lib/analyze_definition';
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate1 from '../lib/analyze_result_template1';

export default class Dummy extends DoaspasBuildJob {

    public static runLocal: boolean = true;

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate1> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate1(this);

        try {

            // ### perform the check
            this.result.data.Name = 'DUMMY';
            this.result.data.SAJ_Passed__c = true;
            // this.result.data.SAJ_Release_Component__c = 'abc';

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }
        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }

}
