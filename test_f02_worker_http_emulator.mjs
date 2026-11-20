// End-to-end Worker HTTP approval against isolated real Firestore Emulator.
// Never run with production credentials or project.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
import {serverPricePath} from "./workers/antifraud/src/server_price.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("demo-pote-hardening Emulator required");
const uid="f02-worker-http-real",universe="qa",recipeId="simple";
const root="users/"+uid,base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const headers={"Authorization":"Bearer owner","Content-Type":"application/json"};
const ingredient=recordPath(uid,universe,"ingredients","flour");
const recipe=recordPath(uid,universe,"recipes",recipeId);
const approval=serverPricePath(uid,universe,recipeId);
const paths=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",ingredient,recipe,approval];
const write=async(path,data)=>{const r=await fetch(base+"/documents/"+path,{method:"PATCH",headers,body:JSON.stringify({fields:encodeFields(data)})});if(!r.ok)throw Error("seed "+path+" "+r.status+" "+await r.text())};
const read=async path=>{const r=await fetch(base+"/documents/"+path,{headers});if(r.status===404)return null;if(!r.ok)throw Error("read "+r.status+" "+await r.text());return r.json()};
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false",ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({verify:async()=>({uid}),repository:()=>createFirestoreRepository(env,{accessToken:async()=>"owner",apiBaseUrl:base}),clock:()=>new Date("2026-11-19T20:00:00Z")});
const request=op=>new Request("https://qa.example/v1/catalog/approve-price",{method:"POST",headers:{Origin:"https://qa.example",Authorization:"Bearer synthetic","Content-Type":"application/json"},body:JSON.stringify({universe,recipeId,operationId:op,salePriceCents:2000})});
try{
 await write(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 await write(root+"/appState/v2",{schemaVersion:2});
 await write(root+"/appState/v2InventoryGuard",{revision:1});
 await write(root+"/appState/v2Pulse",{eventId:"seed"});
 await write(recipe,{record:{id:recipeId,group:"recipes",universe,item:{items:[{id:"flour",g:100}],targetGainPct:100}}});
 await write(ingredient,{record:{id:"flour",group:"ingredients",universe,item:{measureUnit:"g",purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}}});
 const ops=["f02-real-worker-http-approval-00001","f02-real-worker-http-approval-00002"];
 const responses=await Promise.all(ops.map(op=>app.fetch(request(op),env)));
 const results=await Promise.all(responses.map(async r=>({status:r.status,body:await r.json()})));
 console.log("CONCURRENT HTTP",JSON.stringify(results));
 assert(results.every(r=>[200,409].includes(r.status)),"unexpected HTTP status");
 let state=await read(approval);
 if(!state){
  assert(results.every(r=>r.status===409),"no approval only if both conflicted");
  const retry=await app.fetch(request(ops[0]),env);
  console.log("RETRY",retry.status,await retry.clone().text());
  assert.equal(retry.status,200,"fresh retry must succeed");
  state=await read(approval);
 }
 assert(state,"approval must be persisted");
 assert.equal(Number(state.fields.materialCostCents.integerValue),100,"100g at R$10/kg must cost R$1");
 assert.equal(Number(state.fields.salePriceCents.integerValue),2000);
 const revision=Number(state.fields.revision.integerValue);
 assert(revision>=1&&revision<=2);
 const guard=await read(root+"/appState/v2InventoryGuard");
 assert.equal(Number(guard.fields.revision.integerValue),1+revision);
 const idempotent=await app.fetch(request(ops[0]),env);
 console.log("IDEMPOTENT",idempotent.status,await idempotent.clone().text());
 assert.equal(idempotent.status,200);
 console.log("PASS F02 WORKER HTTP REAL EMULATOR approval",revision);
}finally{
 for(const op of ["f02-real-worker-http-approval-00001","f02-real-worker-http-approval-00002"])paths.push(root+"/workerEvents/"+op);
 for(const path of paths.reverse())await fetch(base+"/documents/"+path,{method:"DELETE",headers}).catch(()=>{});
}
