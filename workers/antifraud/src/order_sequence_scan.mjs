/* F02: read-only, exhaustively paginated Firestore order-sequence preflight.
 * This module never writes. No service-account key or commercial data is logged.
 * A stable V2/guard/pulse/control anchor is required before declaring READY.
 */
import {decodeFields} from "./firestore.mjs";
import {auditOrderSequence} from "./order_sequence_audit.mjs";

const identifier=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(x);
const universeId=x=>typeof x==="string"&&/^[a-z0-9_-]{1,64}$/.test(x);
const fail=(code)=>{const e=new Error(code);e.code=code;throw e};
const stableDoc=doc=>doc==null?"missing":JSON.stringify({
 updateTime:doc.updateTime??null,fields:doc.fields??null
});
export async function scanOrderSequenceFirestore({
 uid,universe,projectId,accessToken,requestFetch=fetch,apiBaseUrl=null,
 pageSize=100,maxPages=1000
}={}){
 if(!identifier(uid)||!universeId(universe)||
    !/^[a-z][a-z0-9-]{2,50}$/.test(projectId||"")||
    typeof accessToken!=="string"||!accessToken||
    !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000||
    !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>2000)
  fail("invalid_scan_request");
 const base=apiBaseUrl||
  "https://firestore.googleapis.com/v1/projects/"+projectId+"/databases/(default)";
 const root="users/"+uid,collection=root+"/records";
 const read=async(path,query=null)=>{
  const url=new URL(base+"/documents/"+path);
  if(query)for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
  const res=await requestFetch(url.toString(),{
   headers:{"Authorization":"Bearer "+accessToken,"Accept":"application/json"},
   signal:AbortSignal.timeout(15000)
  });
  if(res.status===404)return null;
  if(!res.ok)fail("firestore_read_failed_"+res.status);
  const data=await res.json();
  if(!data||typeof data!=="object")fail("firestore_read_malformed");
  return data;
 };
 const paths=[root+"/appState/v2",root+"/appState/v2InventoryGuard",
  root+"/appState/v2Pulse",root+"/appState/v2OrderSequence__"+universe];
 const snapshot=async()=>Promise.all(paths.map(path=>read(path)));
 const before=await snapshot();
 if(!before[0]||!before[1]||!before[2])
  return Object.freeze({status:"blocked",reason:"v2_snapshot_missing"});
 const orders=[],seenDocNames=new Set(),pageTokens=new Set();
 let token="",pages=0,scanned=0,malformed=0;
 while(true){
  if(pages>=maxPages)fail("incomplete_order_listing_page_limit");
  if(pageTokens.has(token))fail("incomplete_order_listing_repeated_page_token");
  pageTokens.add(token);
  const data=await read(collection,{
   pageSize:String(pageSize),...(token?{pageToken:token}:{})
  });
  if(data==null)fail("records_collection_not_found_or_incomplete");
  if(!Array.isArray(data.documents)&&data.documents!==undefined)
   fail("incomplete_order_listing_malformed_page");
  pages++;
  for(const doc of data.documents||[]){
   scanned++;
   if(!doc||typeof doc.name!=="string"||
      !doc.name.endsWith("/records/"+doc.name.split("/").at(-1))||
      !doc.name.includes("/documents/"+collection+"/")||
      seenDocNames.has(doc.name))
    fail("incomplete_order_listing_duplicate_or_invalid_document");
   seenDocNames.add(doc.name);
   const record=decodeFields(doc.fields??{}).record;
   if(!record||typeof record!=="object"||!record.group||
      !record.universe||typeof record.id!=="string"){
    malformed++;continue;
   }
   if(record.group==="orders"&&record.universe===universe)orders.push({record});
  }
  const next=data.nextPageToken??"";
  if(typeof next!=="string"||next.length>8192)
   fail("incomplete_order_listing_invalid_page_token");
  if(!next)break;
  token=next;
 }
 const after=await snapshot();
 if(before.some((doc,i)=>stableDoc(doc)!==stableDoc(after[i])))
  return Object.freeze({status:"blocked",reason:"concurrent_firestore_change",
   pages,scanned});
 if(malformed>0)
  return Object.freeze({status:"blocked",reason:"malformed_firestore_records",
   pages,scanned,malformed});
 const meta=decodeFields(before[0].fields??{});
 const control=before[3]?decodeFields(before[3].fields??{}):null;
 const result=auditOrderSequence({
  universe,v2State:meta.state,orderRecords:orders,control,listingComplete:true
 });
 const guard=decodeFields(before[1].fields??{});
 const pulse=decodeFields(before[2].fields??{});
 const anchors=Object.freeze({
  metaUpdateTime:before[0].updateTime??null,
  guardUpdateTime:before[1].updateTime??null,
  pulseUpdateTime:before[2].updateTime??null,
  controlUpdateTime:before[3]?.updateTime??null,
  guardRevision:guard.revision??null,
  pulseEventId:pulse.eventId??null
 });
 return Object.freeze({...result,pages,scanned,orderDocuments:orders.length,
  listingComplete:true,snapshotStable:true,anchors});
}
