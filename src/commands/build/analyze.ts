import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { DoaspasShared } from '../../lib/analyze_definition';
import { jobmap } from '../../lib/analyze_job_mapping';
import { IFJob, IFSAJ_Analyze_Job_Assignment__c, IFSummary } from '../../lib/analyze_object_definition';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('doaspas', 'org');

export default class Analyze extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ sfdx build:analyze -u AppCentralOrg -n -t ValidationOrg "Build A" '
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    targetorg: flags.string({char: 't', description: messages.getMessage('nameFlagDescription')}),
    deployid: flags.string({char: 'd', description: messages.getMessage('nameFlagDescription')}),
    name: flags.string({char: 'n', description: messages.getMessage('nameFlagDescription')}),
    force: flags.boolean({char: 'f', description: messages.getMessage('forceFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    const r = new Array();

    // ### check if we are connected to App Central
    const conn = this.org.getConnection();



    // ### Load defaults
    const shared = new DoaspasShared(conn, this.flags.targetorg, this.flags.name, this.flags.deployid);
    await shared.LoadRecordType();

    this.ux.log ('INIT: ' + await shared.Init());
    this.ux.log ('BUILD: ' + await shared.LoadBuild());
    this.ux.log ('BUILD COMPONENTS: ' + await shared.LoadBuildComponent());
    this.ux.log ('BUILD SUMMARY: ' + await shared.InitBuildSummary());

    this.ux.log ('DOASPAS RunMode: ' + DoaspasShared.runMode);

    return null;

    // ### Read the jobs for the corresponding App
    const appId = DoaspasShared.build.SAJ_Application__c;
    let q = 'select Id, SAJ_Operation__c, SAJ_App__c, SAJ_Analyze_Job__r.Id, SAJ_Analyze_Job__r.Name, name from SAJ_Analyze_Job_Assignment__c where ';
    q += 'SAJ_App__c = ' + '\'' + appId + '\'';
    const appJob = await conn.query<IFSAJ_Analyze_Job_Assignment__c>(q);
    // console.log (appJob.records);

    // ### Execute the jobs
    const oJobs = new Array();
    const pJobs = new Array();
    for (const f of appJob.records) {
      const job = jobmap[f.SAJ_Analyze_Job__r.Name];
      const jobField: IFJob = { AppJobId: f.Id,
        JobId: f.SAJ_Analyze_Job__r.Id,
        Name: f.SAJ_Analyze_Job__r.Name,
        Operation: f.SAJ_Operation__c};

      const ojob = new job(conn, jobField);
      oJobs.push(ojob);
      pJobs.push(ojob.run());
    }
    await Promise.all(pJobs);

    console.log ('All jobs completed');

    let message: string = '';
    let totalTime: number = 0;
    let jobMinTime = oJobs[0];
    let jobMaxTime = oJobs[0];
    let rpassed = true;
    const rsummary = new Array();

    for (const f of oJobs) {
      const summary: IFSummary = f.getSummary();

      rpassed = rpassed && summary.passed;
      rsummary.push({summary});

      if (!summary.passed) {
        message += 'Messages: ' + f.field.Name + ':' + summary.message + '\n';
      }
      totalTime += summary.execTime;
      jobMinTime = summary.execTime < jobMinTime.getSummary().execTime ? f : jobMinTime;
      jobMaxTime = summary.execTime > jobMaxTime.getSummary().execTime ? f : jobMaxTime;
    }
    let jobMinMaxTime: string;
    jobMinMaxTime = 'Fastest Job:' + jobMinTime.field.Name + ' (' + jobMinTime.getSummary().execTime + ')\n';
    jobMinMaxTime += 'Slowest Job:' + jobMaxTime.field.Name + ' (' + jobMaxTime.getSummary().execTime + ')\n';

    DoaspasShared.buildSummaryRec.SAJ_Passed__c = rpassed;
    DoaspasShared.buildSummaryRec.SAJ_Message__c = jobMinMaxTime + message;
    DoaspasShared.buildSummaryRec.SAJ_Total_Time__c = totalTime;
    DoaspasShared.buildSummaryRec.SAJ_Exec_Time__c = jobMaxTime.getSummary().execTime;

    await shared.CompleteBuildSummary();

    r.push({BuildSummary: DoaspasShared.buildSummaryRec, details : rsummary});
    return r;

/*

  this.summary.RecordTypeId = DoaspasShared.resultRecordTypeId['Execution_Summary'];
        this.summary.SAJ_Release__c = DoaspasShared.build.Id;

const h = jobmap['JobDummy'];
    const j = new h(conn, 'JobDummy', defaults);
    const r = await j.run();
    console.log(r);
 /*

    const p = await conn.insert('SAJ_Analyze_Result__c', t);
    console.log('hello' + p[0]);
    console.log(p);

    if (!fnResultSuccess(p)) {
      this.ux.log ('Error insert new DeployRequest Id');
      for (const f of fnResultErrorMsg(p)) {
        this.ux.log('index: ' + f.idx + ' - ' + f.message);
      }
    }
*/
    return null;

  }
}
