import test from "node:test";
import assert from "node:assert/strict";
import {createFirestoreRepository, FirestoreError} from "../src/firestore.mjs";

// Contract-level REST test. Does not replace concurrency testing in Firestore Emulator.
const env={FIREBASE_PROJECT_ID:"demo-pote-hardening"};
const doc="users/qa/appState/v2InventoryGuard";
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
function harness({conflict=false}={}){
 const calls=[];
 const requestFetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;
  calls.push({url,method:options.method,body});
  if(url.endsWith(":beginTransaction"))return response(200,{transaction:"demo-transaction"});
  if(url.includes("/documents/"+doc+"?transaction="))
   return response(200,{fields:{revision:{integerValue:"4"}},updateTime:"2026-11-19T20:00:00Z"});
  if(url.endsWith(":commit"))
   return conflict?response(409,{error:{status:"ABORTED"}}):response(200,{writeResults:[{}]});
  if(url.endsWith(":rollback"))return response(200,{});
  throw Error("Unexpected REST request: "+url);
 };
 return {calls,repository:createFirestoreRepository(env,{requestFetch,accessToken:async()=>"synthetic-token",
  apiBaseUrl:"http://127.0.0.1:8080/v1/projects/demo-pote-hardening/databases/(default)"})};
}
test("F02 REST adapter carries read transaction and guarded write precondition",async()=>{
 const {calls,repository}=harness();
 const tx=await repository.transaction();
 const snapshot=await tx.get(doc);
 assert.equal(snapshot.data.revision,4);
 await tx.commit([{path:doc,data:{revision:5},precondition:{updateTime:snapshot.updateTime}}]);
 assert.equal(calls.length,3);
 assert.equal(calls[1].url.includes("transaction=demo-transaction"),true);
 assert.equal(calls[2].body.transaction,"demo-transaction");
 assert.equal(calls[2].body.writes[0].currentDocument.updateTime,snapshot.updateTime);
 assert.equal(calls[2].body.writes[0].update.fields.revision.integerValue,"5");
});
test("F02 REST adapter propagates aborted commit without silent success",async()=>{
 const {calls,repository}=harness({conflict:true});
 const tx=await repository.transaction();
 const snapshot=await tx.get(doc);
 await assert.rejects(()=>tx.commit([{path:doc,data:{revision:5},
  precondition:{updateTime:snapshot.updateTime}}]),error=>
  error instanceof FirestoreError&&error.status===409&&error.message==="ABORTED");
 assert.equal(calls.filter(x=>x.url.endsWith(":commit")).length,1);
 await tx.rollback();
 assert.equal(calls.filter(x=>x.url.endsWith(":rollback")).length,1);
});
