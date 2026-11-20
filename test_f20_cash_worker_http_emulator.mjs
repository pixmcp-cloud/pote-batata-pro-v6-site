// F20 cash session lifecycle with real Firestore REST transactions in emulator.
// No real account, payment token, customer or commercial data is accessed.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("Demo Firestore Emulator required");
const uid="f20-emulator-tenant",universe="batataria";
const root="users/"+uid,base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const auth={"Authorization":"Bearer owner","Content-Type":"application/json"};
const open1="f20-open-emulator-000000000001",open2="f20-open-emulator-000000000002";
const close1="f20-close-emulator-00000000001",open3="f20-open-emulator-000000000003";
const control=root+"/appState/v2CashControl__"+universe;
const record=id=>recordPath(uid,universe,"cashSessions","cf-turn-"+id);
const paths=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",
 control,record(open1),record(open2),record(open3),
 ...[open1,open2,open3,close1].map(x=>root+"/workerEvents/"+x)];
const write=async(path,data)=>{
 const r=await fetch(base+"/documents/"+path,{method:"PATCH",headers:auth,
 body:JSON.stringify({fields:encodeFields(data)})});
 assert.equal(r.status,200,"seed "+path+" "+await r.text());
};
const read=async path=>{
 const r=await fetch(base+"/documents/"+path,{headers:auth});
 if(r.status===404)return null;
 assert.equal(r.status,200,"read "+path);return decodeFields((await r.json()).fields);
};
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false",
 ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({
 verify:async()=>({uid}),
 repository:()=>createFirestoreRepository(env,{accessToken:async()=>"owner",apiBaseUrl:base}),
 clock:()=>new Date("2026-11-20T10:00:00Z")
});
const invoke=(action,body)=>app.fetch(new Request("https://qa.example/v1/cash/"+action,{
 method:"POST",headers:{Origin:"https://qa.example",Authorization:"Bearer qa-session",
 "Content-Type":"application/json"},body:JSON.stringify({universe,...body})}),env);
const open=operationId=>invoke("open",{operationId,openingCashCents:3500,operator:"QA tenant"});
const close=(operationId,sessionId)=>invoke("close",{operationId,sessionId,declaredCashCents:4200});
try{
 await write(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 await write(root+"/appState/v2",{schemaVersion:2});
 await write(root+"/appState/v2InventoryGuard",{revision:0});
 await write(root+"/appState/v2Pulse",{eventId:"pulse-seed"});
 await write(control,{version:1,activeSessionId:null});
 // Two simultaneous openings against the same control revision: no double open.
 const candidates=await Promise.all([open(open1),open(open2)]);
 let successes=candidates.filter(r=>r.status===200);
 assert(candidates.every(r=>r.status===200||r.status===409),
  "Unexpected opener HTTP statuses "+candidates.map(x=>x.status));
 if(!successes.length){
  // Optimistic transactions may both abort in the emulator; a single
  // subsequent replay must open exactly one cash session.
  const retry=await open(open1);
  assert.equal(retry.status,200,"retry "+await retry.clone().text());
  successes=[retry];
 }
 assert.equal(successes.length,1,"At most one concurrent cash opening commits");
 const current=await read(control),sessionId=current.activeSessionId;
 assert([open1,open2].map(x=>"cf-turn-"+x).includes(sessionId),"Unexpected active shift ID");
 assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,1);
 const winnerId=sessionId.slice("cf-turn-".length);
 const session=await read(record(winnerId));
 assert.equal(session.record.item.status,"open");assert.equal(session.record.item.openingCash,35);
 assert.equal(session.record.item.bankReconciled,false);
 const duplicate=await open(winnerId);
 assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).alreadyApplied,true);
 assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,1);
 const blocked=await open(open3);
 assert.equal(blocked.status,409,"Cannot create a second shift while another is open");
 assert.equal((await read(control)).activeSessionId,sessionId);
 const mismatch=await close(close1,"cf-turn-not-your-session-000001");
 assert.equal(mismatch.status,409,"Wrong shift cannot be closed");
 const finish=await close(close1,sessionId);
 assert.equal(finish.status,200,await finish.clone().text());
 const report=await finish.json();assert.equal(report.status,"closed");
 assert.equal(report.reconciliationStatus,"pending");assert.equal(report.bankReconciled,false);
 assert.equal((await read(control)).activeSessionId,null);
 const after=await read(record(winnerId));
 assert.equal(after.record.item.status,"closed");
 assert.equal(after.record.item.declaredClosingCash,42);
 assert.equal(after.record.item.bankReconciled,false);
 const replay=await close(close1,sessionId);
 assert.equal(replay.status,200);assert.equal((await replay.json()).alreadyApplied,true);
 assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,2);
 const followup=await open(open3);
 assert.equal(followup.status,200,await followup.clone().text());
 assert.equal((await read(control)).activeSessionId,"cf-turn-"+open3);
 assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,3);
 console.log("PASS F20 REST EMULATOR: concurrent cash opening one winner, replay safe, mismatched close denied, bank pending, next shift open");
}finally{
 for(const path of paths.reverse())await fetch(base+"/documents/"+path,{method:"DELETE",headers:auth}).catch(()=>{});
}
