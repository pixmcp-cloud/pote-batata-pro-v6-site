// F02/F20: candidate Rules only; NEVER deploy to commercial project.
const assert=require("node:assert/strict");
const {initializeEmulator,assertFails,assertSucceeds,sdk}
 =require("./qa/firestore/environment.cjs");

(async()=>{
 const {recordPath}=await import("./workers/antifraud/src/domain.mjs");
 const env=await initializeEmulator({cutover:true});
 const uid="qa-worker-cutover-owner",intruder="qa-worker-cutover-intruder";
 const universe="batataria";
 const route=(group,id)=>recordPath(uid,universe,group,id).split("/");
 const record=(group,id,item)=>({record:{universe,group,id,rank:1,item},
  updatedAt:sdk.serverTimestamp()});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await sdk.setDoc(sdk.doc(db,"users",uid),{
    email:"owner@invalid.example",
    license:{status:"active",kind:"lifetime",term:"lifetime"}
   });
   await sdk.setDoc(sdk.doc(db,"users",uid,"appState","v2"),{
    schemaVersion:2,migration:{status:"complete"}
   });
   await sdk.setDoc(sdk.doc(db,"users",uid,"appState","v2InventoryGuard"),{
    revision:0,updatedAt:sdk.serverTimestamp()
   });
   await sdk.setDoc(sdk.doc(db,"users",uid,"appState","v2CashControl__batataria"),{version:1,activeSessionId:null});
   await sdk.setDoc(sdk.doc(db,...route("ingredients","potato")),
    record("ingredients","potato",{id:"potato",name:"Batata",stock:300}));
   await sdk.setDoc(sdk.doc(db,...route("orders","o1")),
    record("orders","o1",{id:"o1",status:"recebido",stockDeducted:false}));
  });
  const user=env.authenticatedContext(uid,{
   email:"owner@invalid.example",email_verified:true,
   firebase:{sign_in_provider:"google.com"}
  }).firestore();
  const other=env.authenticatedContext(intruder,{
   email:"another@invalid.example",email_verified:true,
   firebase:{sign_in_provider:"google.com"}
  }).firestore();
  const ingredient=sdk.doc(user,...route("ingredients","potato"));
  const order=sdk.doc(user,...route("orders","o1"));
  const guard=sdk.doc(user,"users",uid,"appState","v2InventoryGuard");
  await assertSucceeds(sdk.getDoc(ingredient));
  await assertSucceeds(sdk.getDoc(order));
  await assertFails(sdk.getDoc(sdk.doc(other,...route("ingredients","potato"))));
  await assertFails(sdk.updateDoc(ingredient,{
   "record.item.stock":0,updatedAt:sdk.serverTimestamp()
  }));
  await assertFails(sdk.setDoc(sdk.doc(user,...route("ingredients","new")),
   record("ingredients","new",{id:"new",name:"Nova",stock:999})));
  await assertFails(sdk.setDoc(sdk.doc(user,...route("orders","o2")),
   record("orders","o2",{id:"o2",status:"recebido",stockDeducted:false})));
  await assertFails(sdk.updateDoc(order,{
   "record.item.status":"produzindo",updatedAt:sdk.serverTimestamp()
  }));
  const cashControl=sdk.doc(user,"users",uid,"appState","v2CashControl__batataria");
  await assertSucceeds(sdk.getDoc(cashControl));
  await assertFails(sdk.updateDoc(cashControl,{activeSessionId:"forged"}));
  await assertFails(sdk.deleteDoc(cashControl));
  await assertFails(sdk.updateDoc(guard,{
   revision:1,updatedAt:sdk.serverTimestamp()
  }));
  await assertFails(sdk.setDoc(sdk.doc(user,...route("cashMovements","x")),
   record("cashMovements","x",{id:"x",kind:"late_payment",amount:1,sessionId:"s"})));
  const recipe=sdk.doc(user,...route("recipes","recipe-qa"));
  await assertSucceeds(sdk.setDoc(recipe,record("recipes","recipe-qa",{
   id:"recipe-qa",name:"Receita de teste"
  })));
  const safe=await assertSucceeds(sdk.getDoc(recipe));
  assert.equal(safe.data()?.record?.group,"recipes");
  await env.withSecurityRulesDisabled(async ctx=>{
   await sdk.updateDoc(sdk.doc(ctx.firestore(),...route("ingredients","potato")),{
    "record.item.stock":200,updatedAt:sdk.serverTimestamp()
   });
  });
  const reloaded=await assertSucceeds(sdk.getDoc(ingredient));
  assert.equal(reloaded.data().record.item.stock,200);
  console.log("PASS F02/F20 CUTOVER RULES: client read, recipe edit, cross-tenant denial, guarded stock/order/cash mutation denial, guard revision denial, trusted server write.");
 }finally{await env.cleanup()}
})().catch(error=>{
 console.error("CUTOVER_QA_FAILED",error.stack||error);
 process.exitCode=1;
});
