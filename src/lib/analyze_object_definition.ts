import { DoaspasBuildJob } from "./analyze_definition";
import { fnResultSuccess, fnResultErrorMsg } from "./analyze_util";
import { Connection } from "@salesforce/core";
import { string } from "@oclif/command/lib/flags";

interface IFSObject {
    attributes?: IFattributes;
    Id?: string;
    Name?: string;
    createddate?: number;
    createdby?: string;
    last_modifiedbydate?: number;
    last_modifiedby?: string;
    RecordTypeId?: string;
}
interface IFattributes {
    type: string;
    url: string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Release__c extends IFSObject {

    SAJ_Application__c: string;
    SAJ_Application__r: IFSAJ_App__c;
}

export interface IFSummary {
    completed: boolean;
    message: string;
    startTime: number;
    endTime?: number;
    execTime?: number;
    job?: IFJob;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Release_Component__c extends IFSObject {
    SAJ_Component_Type__c: string;
    SAJ_Component_Details__c: string;
    SAJ_API_Version__c: string;
    SAJ_Deployment_Sequence__c: string;
    SAJ_Reference__c: string;
    SAJ_Release__c: string;
    SAJ_Status__c: string;
    SAJ_Type__c: string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Analyze_Job__c extends IFSObject {
    dummy_DO_NOT_USE: string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Analyze_Job_Assignment__c extends IFSObject {
    SAJ_App__c: string;
    SAJ_Environment__c: string;
    SAJ_Analyze_Job__c: string;
    SAJ_Operation__c: string;

    SAJ_Analyze_Job__r: IFSAJ_Analyze_Job__c;
    SAJ_App__r: IFSAJ_App__c;
}

// tslint:disable-next-line: class-name
export interface SAJ_Analyze_Job_Summary__c extends IFSObject {
    SAJ_Analyze_Job__c?: string;
    SAJ_App_Analyze_Job__c?: string;
    SAJ_Exec_Time__c?: number;
    SAJ_Message__c?: string;
    SAJ_Short_Message__c?: string;

}

// tslint:disable-next-line: class-name
interface IFSAJ_Analyze_Result__c extends IFSObject {
    SAJ_Report__c?: boolean;
    SAJ_Release_Component__c?: string;
    SAJ_Release__c?: string;
    SAJ_App_Analyze_Job__c?: string;
    SAJ_Analyze_Job__c?: string;
    SAJ_App__c?: string;
    SAJ_Message__c?: string;
    SAJ_Total_Time__c?: string;
}

// tslint:disable-next-line: class-name
interface IFSAJ_App__c extends IFSObject {
    SAJ_Project_Dev_Prefix__c: string;
    SAJ_Project_Allowed_Prefix__c: string;
}

export interface IFJob {
    AppJobId: string;
    JobId: string;
    Name: string;
    Operation: string;
}
interface IFRecordType {
    Id: string;
    DeveloperName: string;
}
interface IFerror {
    idx: number;
    statusCode: string;
    message: string;
    fields: [];
}

export interface IFQuery {
    conn: Connection;
    object: string;
    field?: string[];
    where?: string;
    limit?: number;
    ids?: Set<string>;
  }

export { IFSObject, IFerror, IFSAJ_Analyze_Result__c, IFRecordType, IFSAJ_App__c};
