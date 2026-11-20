import test from "node:test";
import assert from "node:assert/strict";
import {scanOrderSequenceFirestore} from "../src/order_sequence_scan.mjs";
import {encodeFields} from "../src/firestore.mjs";
const universe="batataria",uid="scan-qa-tenant",projectId="demo-pote-hardening";
const base="http://127.0.0.1:8787/v1/projects/"+projectId+"/databases/(default)";
const root="users/"+uid;
const docs=(group,id,orderNumber,scope=universe)=>({
 name:base.replace("http://127.0.0.1:8787/v1/","")+"/documents/"+root+"/records/"+id,
 updateTime:"2026-11-20T15:00:00Z",
 fields:encodeFields({record:{group,id,universe:scope,item:orderNumber==null?{}:{orderNumber}}})
});
const response=(obj,status=200)=>new Response(JSON.stringify(obj),{status});
function fixture({numbers=[119,120,20],mutate=false,repeatToken=false,corrupt=false,
 malformedToken=false,failedPage=false,control=null}={}){
 let snapshotReads=0;
 const pages=[
  {documents:[docs("orders","o1",numbers[0]),docs("ingredients","potato",1)],nextPageToken:"token-a"},
  {documents:[docs("orders","o2",numbers[1]),docs("orders","other",5,"pizzaria")],nextPageToken:"token-b"},
  {documents:[corrupt?{...docs("orders","o3",numbers[2]),fields:{}}:docs("orders","o3",numbers[2])]}
 ];
 const requestFetch=async url=>{
  const u=new URL(url),path=u.pathname;
  if(path.endsWith("/records")){
   const token=u.searchParams.get("pageToken")||"";
   if(failedPage&&token==="token-a")return response({error:"denied"},403);
   if(repeatToken&&token==="token-a")return response({...pages[1],nextPageToken:"token-a"});
   if(malformedToken&&token==="token-a")return response({...pages[1],nextPageToken:123});
   return response(pages[{"":0,"token-a":1,"token-b":2}[token]]??{});
  }
  const v=mutate&&path.endsWith("/v2InventoryGuard")&&++snapshotReads>1;
  if(path.endsWith("/v2OrderSequence__"+universe))
   return control?response({fields:encodeFields(control),updateTime:"v1"}):response({missing:true},404);
  if(path.endsWith("/v2"))return response({fields:encodeFields({schemaVersion:2,
   state:{data:{businessType:universe,orderSequenceLast:120}}}),updateTime:"v1"});
  if(path.endsWith("/v2InventoryGuard"))return response({fields:encodeFields({revision:v?2:1}),
   updateTime:v?"v2":"v1"});
  if(path.endsWith("/v2Pulse"))return response({fields:encodeFields({eventId:"seed"}),updateTime:"v1"});
  throw Error("Unexpected URL: "+path);
 };
 return opts=>scanOrderSequenceFirestore({uid,universe,projectId,apiBaseUrl:base,
  accessToken:"owner",pageSize:2,requestFetch,...opts});
}
test("F02 scanner proves all pages and stable multi-group listing",async()=>{
 const result=await fixture()();
 assert.equal(result.status,"ready");
 assert.equal(result.action,"initialize_after_authorization");
 assert.equal(result.pages,3);assert.equal(result.scanned,5);assert.equal(result.orderDocuments,3);
 assert.equal(result.metadataLast,120);assert.equal(result.highest,120);
 assert.equal(result.snapshotStable,true);assert.equal(result.listingComplete,true);
});
test("F02 scanner detects duplicate numbers across page boundaries",async()=>{
 const result=await fixture({numbers:[119,120,120]})();
 assert.equal(result.status,"blocked");assert.equal(result.reason,"duplicate_public_numbers");
});
test("F02 scanner detects metadata lower than oldest history",async()=>{
 const result=await fixture({numbers:[119,120,121]})();
 assert.equal(result.status,"manual_review");assert.equal(result.proposedLast,121);
});
test("F02 scanner rejects concurrent Firestore guard update",async()=>{
 const result=await fixture({mutate:true})();
 assert.equal(result.status,"blocked");assert.equal(result.reason,"concurrent_firestore_change");
});
test("F02 scanner refuses broken repeated, invalid or missing pages",async()=>{
 await assert.rejects(fixture({repeatToken:true})(),/repeated_page_token/);
 await assert.rejects(fixture({malformedToken:true})(),/invalid_page_token/);
 await assert.rejects(fixture({failedPage:true})(),/firestore_read_failed_403/);
 await assert.rejects(fixture()({maxPages:2}),/page_limit/);
});
test("F02 scanner rejects malformed documents rather than silently ignoring them",async()=>{
 const result=await fixture({corrupt:true})();
 assert.equal(result.status,"blocked");assert.equal(result.reason,"malformed_firestore_records");
});
test("F02 scanner enforces existing control and invalid request",async()=>{
 const r=await fixture({control:{version:1,universe,last:119}})();
 assert.equal(r.status,"blocked");assert.equal(r.reason,"sequence_control_inconsistent");
 const ok=await fixture({control:{version:1,universe,last:121}})();
 assert.equal(ok.status,"ready");assert.equal(ok.action,"already_initialized");
 await assert.rejects(fixture()({uid:"../another"}),/invalid_scan_request/);
});
