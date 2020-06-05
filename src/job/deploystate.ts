import { Connection } from '@salesforce/core';
import { DoaspasBuildJob, DoaspasShared } from '../lib/analyze_definition';
import {  IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';

export default class DeployState extends DoaspasBuildJob {

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate2> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate2(this);

        try {
            // ### perform the check

            const a = await DoaspasShared.envCon.metadata.read('CustomObject','Account');
            console.log(a);
            
            this.result.data.push({Name : 'TESTING1', SAJ_Passed__c : true});
            this.result.data.push({Name : 'TESTING2', SAJ_Passed__c : true});

            // ### use throw statements in case the job has to abort
            // throw new Error('something bad happened');

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }

        // this.result.data.Name = 'TESTING';
        //  this.result.data.SAJ_Release_Component__c = 'abc';

        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }

}
