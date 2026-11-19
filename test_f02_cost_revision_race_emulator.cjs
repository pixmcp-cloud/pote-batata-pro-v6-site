// F02 isolated SDK Emulator test: a cost revision between approval reads and commit must abort.
// This exercises the real Firestore transaction adapter; it does not enable commercial cutover.
const assert=require("node:assert/strict");
const {initializeEmulator,sdk}=require("./qa/firestore/environment.cjs");
const {createEmulatorRepository}=require("./qa/workers/emulator_repository.cjs");
(async()=>{
 const env=await initializeEmulator({hardened:false,cutover:false});
 const path="users/f02-cost-race/records/ingredient-potato";
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore(),ref=sdk.doc(db,...path.split("/"));
   await sdk.setDoc(ref,{record:{item:{purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"}}});
   const repository=createEmulatorRepository(db,sdk);
   const approval=await repository.transaction();
   const before=await approval.get(path);
   assert.equal(before.data.record.item.purchasePrice,10);
   // A competing cost editor commits after the approval has read the old price.
   await sdk.updateDoc(ref,{"record.item.purchasePrice":20});
   await assert.rejects(approval.commit([{
    path,data:{record:{item:{...before.data.record.item,approved:true}}},
    precondition:{updateTime:before.updateTime}
   }]),e=>e?.status===409||String(e?.message).includes("TRANSACTION_CONFLICT"));
   await approval.rollback();
   const after=(await sdk.getDoc(ref)).data();
   assert.equal(after.record.item.purchasePrice,20);
   assert.equal(after.record.item.approved,undefined);
   // A fresh transaction must see the current cost and may commit safely.
   const retry=await repository.transaction();
   const latest=await retry.get(path);
   assert.equal(latest.data.record.item.purchasePrice,20);
   await retry.commit([{path,data:{record:{item:{...latest.data.record.item,approved:true}}},
    precondition:{updateTime:latest.updateTime}}]);
   await retry.rollback();
   const final=(await sdk.getDoc(ref)).data();
   assert.equal(final.record.item.purchasePrice,20);
   assert.equal(final.record.item.approved,true);
  });
  console.log("PASS F02 SDK COST RACE: stale approval rejected, no partial write, fresh retry uses new cost");
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
