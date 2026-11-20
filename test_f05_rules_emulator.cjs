// F05 browser Firestore Rules regression: Pro physical losses must be server-only.
// Free legacy loss flow and non-payment/other V2 transactions remain compatible.
// Execute exclusively with Firebase Firestore Emulator on demo-pote-hardening.
const assert=require("node:assert/strict");
const {initializeEmulator,assertFails,assertSucceeds,sdk}=require("./qa/firestore/environment.cjs");
(async()=>{
 const {recordPath}=await import("./workers/antifraud/src/domain.mjs");
 const env=await initializeEmulator();
 const universe="batataria";
 const identity=uid=>env.authenticatedContext(uid,{email:uid+"@example.com",
  email_verified:true,firebase:{sign_in_provider:"google.com"}}).firestore();
 const path=(uid,group,id)=>recordPath(uid,universe,group,id).split("/");
 const key=(uid,group,id)=>path(uid,group,id).at(-1);
 const make=(group,id,type,reason)=>({record:{universe,group,id,rank:1,
  item:{id,type,reason,quantityBase:5,costLost:1}},updatedAt:sdk.serverTimestamp()});
 const createBatch=(db,uid,group,id,type,reason,rev,previous)=>{
  const batch=sdk.writeBatch(db),keyId=key(uid,group,id);
  batch.set(sdk.doc(db,...path(uid,group,id)),make(group,id,type,reason));
  batch.update(sdk.doc(db,"users",uid,"appState","v2InventoryGuard"),
   {revision:rev,updatedAt:sdk.serverTimestamp()});
  batch.update(sdk.doc(db,"users",uid,"appState","v2Pulse"),
   {eventId:"evt-"+rev,previousEventId:previous,origin:"client",
    changedKeys:[keyId],sensitive:true,updatedAt:sdk.serverTimestamp()});
  return batch.commit();
 };
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const [uid,pro] of [["f05-pro","pro"],["f05-free","free"]]){
    await sdk.setDoc(sdk.doc(db,"users",uid),{
     email:uid+"@example.com",
     ...(pro==="pro"?{license:{status:"active",kind:"lifetime",term:"lifetime"}}:{})
    });
    await sdk.setDoc(sdk.doc(db,"users",uid,"appState","v2"),{schemaVersion:2});
    await sdk.setDoc(sdk.doc(db,"users",uid,"appState","v2InventoryGuard"),
     {revision:0,updatedAt:sdk.serverTimestamp()});
    await sdk.setDoc(sdk.doc(db,"users",uid,"appState","v2Pulse"),
     {eventId:"evt-0",previousEventId:"",changedKeys:[],sensitive:false,
      updatedAt:sdk.serverTimestamp()});
   }
   await sdk.setDoc(sdk.doc(db,...path("f05-pro","losses","historical")),
    make("losses","historical","stock","queda"));
  });
  const pro=identity("f05-pro"),free=identity("f05-free");
  await assertFails(createBatch(pro,"f05-pro","losses","fake-stock","stock","queda",1,"evt-0"));
  assert.equal((await sdk.getDoc(sdk.doc(pro,"users","f05-pro","appState","v2InventoryGuard"))).data().revision,0);
  await assertSucceeds(createBatch(pro,"f05-pro","losses","unpaid","order","nao_pagamento",1,"evt-0"));
  await assertFails(createBatch(pro,"f05-pro","stockMovements","fake-movement","stock","Perda: descarte",2,"evt-1"));
  await assertSucceeds(createBatch(pro,"f05-pro","stockMovements","purchase-movement","stock","Entrada por compra",2,"evt-1"));
  await assertSucceeds(createBatch(free,"f05-free","losses","free-local-loss","stock","queda",1,"evt-0"));
  const old=sdk.doc(pro,...path("f05-pro","losses","historical"));
  await assertSucceeds(sdk.getDoc(old));
  await assertFails(sdk.updateDoc(old,{"record.item.costLost":99,updatedAt:sdk.serverTimestamp()}));
  await assertFails(sdk.deleteDoc(old));
  const other=env.authenticatedContext("intruder",{email:"intruder@example.com",email_verified:true,
   firebase:{sign_in_provider:"google.com"}}).firestore();
  await assertFails(sdk.getDoc(sdk.doc(other,...path("f05-pro","losses","historical"))));
  console.log("PASS F05 RULES: Pro stock losses server-only; order losses, legitimate movements and Free flow retained; no cross-tenant access");
 }finally{await env.cleanup()}
})().catch(e=>{console.error("F05_RULES_FAILED",e.stack||e);process.exitCode=1});
