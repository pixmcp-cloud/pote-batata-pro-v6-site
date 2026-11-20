// F05 HTTP inventory loss E2E against the isolated Firestore Emulator.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("Isolated demo emulator required");
const uid="f05-qa-stock-owner",universe="qa",id="potato",op="f05-qa-stock-adjust-000000001";
const root="users/"+uid,base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const headers={"Authorization":"Bearer owner","Content-Type":"application/json"};
const stock=recordPath(uid,universe,"ingredients",id);
const loss=recordPath(uid,universe,"losses","cf-loss-"+op);
const movement=recordPath(uid,universe,"stockMovements","cf-adjust-"+op);
const journal=root+"/workerEvents/"+op;
const paths=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",stock,loss,movement,journal];
const write=async(path,data)=>{const r=await fetch(base+"/documents/"+path,{method:"PATCH",headers,body:JSON.stringify({fields:encodeFields(data)})});assert.equal(r.status,200,"seed "+path+" "+await r.text())};
const read=async path=>{const r=await fetch(base+"/documents/"+path,{headers});if(r.status===404)return null;assert.equal(r.status,200,"read "+path);return decodeFields((await r.json()).fields)};
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false",ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({verify:async()=>({uid}),repository:()=>createFirestoreRepository(env,{accessToken:async()=>"owner",apiBaseUrl:base}),clock:()=>new Date("2026-11-20T02:00:00Z")});
const call=(operationId,delta)=>app.fetch(new Request("https://qa.example/v1/inventory/adjust",{method:"POST",headers:{Origin:"https://qa.example",Authorization:"Bearer synthetic","Content-Type":"application/json"},body:JSON.stringify({universe,operationId,group:"ingredients",itemId:id,delta,reason:"loss",note:"QA synthetic loss"})}),env);
try{
 await write(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 await write(root+"/appState/v2",{schemaVersion:2});
 await write(root+"/appState/v2InventoryGuard",{revision:1});
 await write(root+"/appState/v2Pulse",{eventId:"seed"});
 await write(stock,{record:{id,group:"ingredients",universe,item:{name:"Batata QA",stock:100,measureUnit:"g",averageUnitCost:0.01,averageCostKnown:true}}});
 const first=await call(op,-7);assert.equal(first.status,200,await first.clone().text());assert.equal((await first.json()).alreadyApplied,false);
 assert.equal((await read(stock)).record.item.stock,93);
 assert.equal((await read(loss)).record.item.quantityBase,7);
 assert.equal((await read(movement)).record.item.quantity,-7);
 assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,2);
 const retry=await call(op,-7);assert.equal(retry.status,200,await retry.clone().text());assert.equal((await retry.json()).alreadyApplied,true);
 assert.equal((await read(stock)).record.item.stock,93);
 const conflict=await call(op,-8);assert.equal(conflict.status,409,await conflict.clone().text());
 const insufficient=await call("f05-qa-stock-adjust-000000002",-1000);assert.equal(insufficient.status,409,await insufficient.clone().text());
 assert.equal((await read(stock)).record.item.stock,93);
 console.log("PASS F05 REAL FIRESTORE EMULATOR: loss 100->93, journal, idempotency, conflict, insufficient stock");
}finally{
 paths.push(root+"/workerEvents/f05-qa-stock-adjust-000000002");
 for(const path of paths.reverse())await fetch(base+"/documents/"+path,{method:"DELETE",headers}).catch(()=>{});
}
