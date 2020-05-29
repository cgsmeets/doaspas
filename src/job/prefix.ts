import { Connection, SfdxError } from '@salesforce/core';
import { DoaspasBuildJob } from '../lib/analyze_definition';
import {  IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';

export default class Prefix extends DoaspasBuildJob {

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate2> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate2(this);

        // ### perform the check

        this.result.data.push({Name : 'TESTING1'});
        this.result.data.push({Name : 'TESTING2'});

       // this.result.data.Name = 'TESTING';
      //  this.result.data.SAJ_Release_Component__c = 'abc';

        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }

}
