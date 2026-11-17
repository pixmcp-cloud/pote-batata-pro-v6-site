// Public API for the per-scope Free quota policy.
import {FREE_LIMITED_GROUPS,BASE_FREE_GROUPS,quotaScope,isFreeLimitedRecord,freeSlotKey,modelRecordKey} from "./free_id_policy.mjs";
export {FREE_LIMITED_GROUPS,BASE_FREE_GROUPS,quotaScope,isFreeLimitedRecord,freeSlotKey,modelRecordKey};
export function checkFreeUniverseDelta(before,after,universe){
 if(!universe)return {ok:true};
 const scope=quotaScope(universe);
 const groups=scope==="base"?BASE_FREE_GROUPS:Object.keys(FREE_LIMITED_GROUPS);
 const count=(records,group)=>{
  let n=0;
  for(const rec of records.values())
   if(quotaScope(rec.universe)===scope&&rec.group===group&&isFreeLimitedRecord(rec))n++;
  return n;
 };
 for(const group of groups){
  const old=count(before,group),next=count(after,group);
  if(next>1&&next>old)return {ok:false,group,count:next,limit:1,
   error:"FREE: máximo de 1 cadastro próprio para "+group+" nesse tipo de universo."};
 }
 return {ok:true};
}
