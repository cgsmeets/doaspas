import { Connection, SfdxError } from '@salesforce/core';
import { DoaspasBuildJob, JobResultTemplate1 } from '../lib/analyze_definition';
import { IFSAJ_Release__c, IFSummary, IFJob } from '../lib/analyze_object_definition';

export default class Dummy extends DoaspasBuildJob {

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate1> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate1(this);

        // ### perform the check
        this.result.data.Name = 'DUMMY';
       // this.result.data.SAJ_Release_Component__c = 'abc';

        // ### Store the results on App Central
        await this.result.Process();

        return this.result as JobResultTemplate1;
    }

}
