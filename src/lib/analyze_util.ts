import { isNullOrUndefined } from 'util';
import { IFerror, IFQuery, IFSObject } from './analyze_object_definition';

export async function fnBuildSoql(v: IFQuery): Promise <string> {

  let q: string = 'select ';
  if (isNullOrUndefined(v.field)) {
    v.field = new Array<string>();
    const des = await v.conn.describe(v.object);
    for (const ff of des['fields']) {
      v.field.push(ff.name);
    }
    if (v.field.length === 0) v.field.push('Id');
  }

  q += v.field.join(',') + ' from ' + v.object;
  if (v.where != null ) q += ' where ' + v.where;
  if (v.limit != null) q += ' limit ' + v.limit.toString();

  return q;
}

export function fnGetAllId(v: IFSObject[]): string[] {
  const r = new Array<string>();
  for (const f of v) {
    r.push(f.Id);
  }
  return r;
}

// tslint:disable-next-line: no-any
export function fnResultMessage(v: any): string {
  let message = '';
  if (!fnResultSuccess(v)) {
    for (const f of fnResultErrorMsg(v)) {
        message += ( '\n' + 'index: ' + f.idx + ' - ' + f.statusCode + ':' + f.message);
    }
  }
  return message;
}

export function fnResultSuccess(v): boolean {
    let res: boolean = true;
    if ( isNullOrUndefined(v[0])) {
      res = v['success'];
    } else {
      for (const f of v) {
       res = res && f['success'];
      }
    }
    return res;
  }

export function fnResultErrorMsg(v): IFerror[] {
    let idx: number = 0;
    const res: IFerror[] = new Array();
    if ( isNullOrUndefined(v[0])) {
        res.push({idx, message: v['message'], statusCode: v['statusCode'], fields: v['fields']});
    } else {
        for (const f of v) {
         if (!f['success']) {
             for (const f2 of f['errors']) {
                res.push({idx, message: f2['message'], statusCode: f2['statusCode'], fields: f2['fields']});
             }
         }
         idx++;
        }
    }
    return res;
  }
