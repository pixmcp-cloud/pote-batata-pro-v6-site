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

// Only a persisted canonical slot grants a retained original. Never infer it
// from array order, a browser flag, or an expired premium record.
export function retainedFreeSlots(records){
 const result={};
 for(const [key,record] of records??[]){
  const slot=freeSlotKey(record);
  if(slot&&key===slot)result[slot]={universe:record.universe,group:record.group,id:record.id};
 }
 return result;
}
export function retainedOriginalAllowed(slots,record){
 const slot=freeSlotKey(record),selected=slot&&slots?.[slot];
 return Boolean(selected&&selected.universe===record.universe&&selected.group===record.group&&selected.id===record.id);
}
