// F10: multiple real Firestore Emulator tenants through Worker HTTP.
// Checks licensed Pro, franchise, expired, Free and blocked-universe isolation.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("Isolated Firestore Emulator is required");
const universe="batataria",itemId="identical-item";
const profiles=[
 ["f10-pro",{license:{status:"active",kind:"lifetime",term:"lifetime"}},200,90],
 ["f10-franchise",{franchise:{status:"active",brandId:"potebatata"}},200,90],
 ["f10-free",{displayName:"Free"},403,100],
 ["f10-expired",{license:{status:"active",kind:"pro",expiresAt:"2025-01-01T00:00:00Z"}},403,100],
 ["f10-blocked",{license:{status:"active",kind:"lifetime",term:"lifetime"},
   accessPolicy:{blockedServices:["batataria:stock"]}},403,100]
];
const base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const auth={"Authorization":"Bearer owner","Content-Type":"application/json"};
const write=async(path,data)=>{const r=await fetch(base+"/documents/"+path,{method:"PATCH",headers:auth,
 body:JSON.stringify({fields:encodeFields(data)})});assert.equal(r.status,200,"seed "+path+" "+await r.text())};
const read=async path=>{const r=await fetch(base+"/documents/"+path,{headers:auth});if(r.status===404)return null;
 assert.equal(r.status,200,"read "+path);return decodeFields((await r.json()).fields)};
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",
 PRODUCTION_CUTOVER_APPROVED:"false",ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({
 verify:async token=>{
  const uid=token.slice("tenant-".length);
  if(!token.startsWith("tenant-")||!profiles.some(x=>x[0]===uid))throw Error("unknown");
  return {uid,email:uid+"@qa.invalid",isAdmin:false};
 },
 repository:()=>createFirestoreRepository(env,{accessToken:async()=>"owner",apiBaseUrl:base}),
 clock:()=>new Date("2026-11-20T13:00:00Z")
});
const op="f10-shared-idempotency-000000001";
const paths=[];
try{
 for(const [uid,profile] of profiles){
  const root="users/"+uid,stock=recordPath(uid,universe,"ingredients",itemId);
  paths.push(root,root+"/appState/v2",root+"/appState/v2InventoryGuard",
   root+"/appState/v2Pulse",stock,root+"/workerEvents/"+op,
   recordPath(uid,universe,"losses","cf-loss-"+op),
   recordPath(uid,universe,"stockMovements","cf-adjust-"+op));
  await write(root,profile);
  await write(root+"/appState/v2",{schemaVersion:2});
  await write(root+"/appState/v2InventoryGuard",{revision:0});
  await write(root+"/appState/v2Pulse",{eventId:"seed"});
  await write(stock,{record:{universe,group:"ingredients",id:itemId,
   item:{id:itemId,name:"F10 fake stock",stock:100,measureUnit:"g"}}});
 }
 const post=(uid,overrides={})=>app.fetch(new Request("https://qa.example/v1/inventory/adjust",{
  method:"POST",headers:{Origin:"https://qa.example","Content-Type":"application/json",
   Authorization:"Bearer tenant-"+uid},
  body:JSON.stringify({universe,group:"ingredients",itemId,delta:-10,reason:"loss",
   lossReason:"avaria",note:"F10 QA role isolation",operationId:op,...overrides})
 }),env);
 for(const [uid,,expected,stockAfter] of profiles){
  const res=await post(uid);assert.equal(res.status,expected,uid+": "+await res.clone().text());
  const stock=await read(recordPath(uid,universe,"ingredients",itemId));
  assert.equal(stock.record.item.stock,stockAfter,uid+" stock isolated");
  const root="users/"+uid;
  assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,expected===200?1:0);
  assert.equal(Boolean(await read(root+"/workerEvents/"+op)),expected===200,uid+" journal");
  if(expected===200){
   const retry=await post(uid);assert.equal(retry.status,200);
   assert.equal((await retry.json()).alreadyApplied,true,uid+" idempotent");
  }
 }
 const forbiddenUid=await post("f10-pro",{uid:"f10-free"});
 assert.equal(forbiddenUid.status,400,"Client must not select tenant via body UID");
 assert.equal((await read(recordPath("f10-free",universe,"ingredients",itemId))).record.item.stock,100);
 console.log("PASS F10 ROLE WORKER REST EMULATOR: Pro and franchise isolated, Free/expired/blocked denied, no cross-tenant write or replay collision.");
}finally{
 for(const path of paths.reverse())await fetch(base+"/documents/"+path,{method:"DELETE",headers:auth}).catch(()=>{});
}
