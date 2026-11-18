// Integração Worker -> transações reais do Firestore SDK no Emulator, SEM dados de produção.
// REST OAuth/serialização de produção são validados nos testes mockados Firestore REST.
// Run with firebase emulators:exec --only firestore --project demo-pote-hardening.
const assert=require("node:assert/strict");
const {initializeEmulator,sdk}=require("./qa/firestore/environment.cjs");
const {createEmulatorRepository}=require("./qa/workers/emulator_repository.cjs");
(async()=>{
 const {recordPath}=await import("./workers/antifraud/src/domain.mjs");
 const {createWorkerApp}=await import("./workers/antifraud/src/index.mjs");

 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==="1"});
 const uid="worker-rest-owner";
 const universe="batataria";
 const orderId="order-f02";

 const projectId="demo-pote-hardening";

 const options={ENABLE_WRITES:"true",FIREBASE_PROJECT_ID:projectId,
  ALLOWED_ORIGINS:"https://pdv.livresom.com"};
 const key="cb1b159a-7019-4cd0-9f33-a2bb87575b1d";
 const retry="51c5d180-b702-4e83-b099-a7b5e2695506";
 const url="http://worker.local/v1/orders/produce";
 const newReq=(id,route=url,decision,target=orderId)=>new Request(route,{
  method:"POST",headers:{"Authorization":"Bearer emulator-owner",
   "Origin":"https://pdv.livresom.com","Content-Type":"application/json"},
  body:JSON.stringify({universe,orderId:target,operationId:id,...(decision?{decision}:{})})
 });
 let privilegedDb=null;
 const worker=createWorkerApp({
  verify:async token=>{
   if(token!=="emulator-owner")throw Error("Bad token");
   return {uid,email:"owner@example.com",isAdmin:false}
  },
  repository:()=>createEmulatorRepository(privilegedDb,sdk)
 });
 const fetchAsService=async(request,opts)=>{
  let reply;
  await env.withSecurityRulesDisabled(async ctx=>{
   privilegedDb=ctx.firestore();reply=await worker.fetch(request,opts);
  });
  return reply;
 };
 const record=(group,id,item)=>({
  record:{universe,group,id,rank:1,item},updatedAt:sdk.serverTimestamp()
 });
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore(),document=(...segments)=>sdk.doc(db,...segments);
   await sdk.setDoc(document("users",uid),{email:"owner@example.com",
    license:{status:"active",kind:"lifetime",term:"lifetime"}});
   await sdk.setDoc(document("users",uid,"appState","v2"),{
    schemaVersion:2,state:{data:{businessType:"batataria",businessUniverses:{}}}});
   await sdk.setDoc(document("users",uid,"appState","v2InventoryGuard"),{
    revision:0,updatedAt:sdk.serverTimestamp()});
   await sdk.setDoc(document("users",uid,"appState","v2Pulse"),{
    eventId:"event0",previousEventId:"",origin:"emulator",
    sensitive:false,changedKeys:[],updatedAt:sdk.serverTimestamp()});
   await sdk.setDoc(document("users",uid,"records",recordPath(uid,universe,"orders",orderId).split("/").at(-1)),
    record("orders",orderId,{
     id:orderId,status:"recebido",stockDeducted:false,
     qty:2,price:30,items:[{id:"potato",g:100,yieldPct:100}],
     beverageItems:[{id:"water",qty:1}]
    }));
   for(const [group,id,name,stock] of [
    ["ingredients","potato","Batata",1000],["beverages","water","Água",10]]){
    await sdk.setDoc(document("users",uid,"records",
     recordPath(uid,universe,group,id).split("/").at(-1)),
     record(group,id,{id,name,stock}));
   }
  });
  const response=await fetchAsService(newReq(key),options);
  const result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  assert.equal(result.stockMovements,2);
  const same=await (await fetchAsService(newReq(key),options)).json();
  assert.equal(same.alreadyApplied,true);
  const reexecution=await fetchAsService(newReq(retry),options);
  assert.equal(reexecution.status,409);
  const db=env.authenticatedContext(uid,{email:"owner@example.com",email_verified:true,
   firebase:{sign_in_provider:"google.com"}}).firestore();
  const get=async(group,id)=>(await sdk.getDoc(sdk.doc(db,"users",uid,"records",
   recordPath(uid,universe,group,id).split("/").at(-1)))).data()?.record?.item;
  assert.equal((await get("ingredients","potato")).stock,800);
  assert.equal((await get("beverages","water")).stock,8);
  assert.equal((await get("orders",orderId)).stockDeducted,true);
  assert.equal((await sdk.getDoc(sdk.doc(db,"users",uid,"appState","v2InventoryGuard"))).data().revision,1);
  const cancel=await fetchAsService(newReq(retry,"http://worker.local/v1/orders/cancel","return"),options);
  assert.equal(cancel.status,200,JSON.stringify(await cancel.json()));
  assert.equal((await get("ingredients","potato")).stock,1000);
  assert.equal((await get("beverages","water")).stock,10);
  assert.equal((await get("orders",orderId)).stockRestored,true);
  assert.equal((await sdk.getDoc(sdk.doc(db,"users",uid,"appState","v2InventoryGuard"))).data().revision,2);
  assert.equal((await fetchAsService(newReq(retry,
   "http://worker.local/v1/orders/cancel","return"),options)).status,200);
  const secondIds=["concurrent-1","concurrent-2"];
  await env.withSecurityRulesDisabled(async ctx=>{
   const privateDb=ctx.firestore();
   for(const id of secondIds){
    await sdk.setDoc(sdk.doc(privateDb,"users",uid,"records",
     recordPath(uid,universe,"orders",id).split("/").at(-1)),
     record("orders",id,{id,status:"recebido",stockDeducted:false,
      qty:2,price:25,items:[{id:"potato",g:400,yieldPct:100}],
      beverageItems:[]}));
   }
  });
  const ids=["7ddfcf6d-cf6a-4a20-beb7-e2af501d5b01",
   "7ddfcf6d-cf6a-4a20-beb7-e2af501d5b02"];
  const responses=await Promise.all(secondIds.map((id,i)=>
   fetchAsService(newReq(ids[i],url,undefined,id),options)));
  const codes=responses.map(x=>x.status);
  assert.equal(codes.filter(n=>n===200).length,1,
   "Only one concurrent order may consume an 800g share of 1000g stock");
  assert(codes.every(c=>c===200||c===409),"Unexpected network/permission failure: "+codes);
  assert.equal((await get("ingredients","potato")).stock,200);
  console.log("PASS WORKER SDK EMULATOR: transactions, 2-stock units, idempotency, cancellation, 2 devices with only one successful stock deduction.");
 }finally{await env.cleanup()}
})().catch(e=>{console.error("WORKER REST EMULATOR FAIL",e.stack||e);process.exitCode=1});
