// Candidate rules, synthetic project only. No production rules deployment.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("../qa/firestore/node_modules/@firebase/rules-unit-testing");
const sdk=require("../qa/firestore/node_modules/firebase/firestore");
(async()=>{
 const projectId="demo-nucleobit-checkout",host=process.env.FIRESTORE_EMULATOR_HOST;
 if(!/^127\.0\.0\.1:\d+$/.test(host||""))throw Error("Local emulator required");
 const {candidateCutoverRules}=await import("./v5_cutover_rules_lab.mjs");
 const {createWorkerApp}=await import("../workers/antifraud/src/index.mjs");
 const {createFirestoreRepository}=await import("../workers/antifraud/src/firestore.mjs");
 const {createCheckoutLabRepository}=await import("./firestore_checkout_lab.mjs");
 const owner="cutoverowner",root="users/"+owner,storeId="cutovershop",epoch="checkout_epoch_001";
 const env=await initializeTestEnvironment({projectId,firestore:{rules:candidateCutoverRules(fs.readFileSync("firestore.rules","utf8"))}});
 const ownerDb=env.authenticatedContext(owner,{email_verified:true,email:"test@example.invalid",firebase:{sign_in_provider:"google.com"}}).firestore();
 const otherDb=env.authenticatedContext("otherowner",{email_verified:true,email:"other@example.invalid",firebase:{sign_in_provider:"google.com"}}).firestore();
 const repo=createFirestoreRepository({FIREBASE_PROJECT_ID:projectId},{apiBaseUrl:"http://"+host+"/v1/projects/"+projectId+"/databases/(default)",accessToken:async()=>"owner"});
 const now=Date.now(),stockKey="batataria~ingredients~potato",stockPath=root+"/recordsV5/"+stockKey;
 const profile={license:{status:"active",kind:"lifetime",term:"lifetime"},accessPolicy:{workerAuthoritative:true}};
 try{await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),set=(p,x)=>sdk.setDoc(sdk.doc(db,p),x),read=async p=>(await sdk.getDoc(sdk.doc(db,p))).data(),stamp=()=>sdk.serverTimestamp();
  const meta={schemaVersion:5,state:{data:{businessType:"batataria",orderSequenceLast:0}}};
  await set(root,profile);await set(root+"/appState/v5",meta);await set(root+"/appState/v5InventoryGuard",{revision:0});await set(root+"/appState/v5Pulse",{eventId:"seed"});
  await set("users/otherowner",profile);await set("users/otherowner/appState/v5",meta);
  await set(stockPath,{record:{universe:"batataria",group:"ingredients",id:"potato",item:{id:"potato",stock:1000},rank:1}});
  await set("checkoutLabStores/"+storeId,{lab:true,enabled:true,ownerUid:owner,universe:"batataria",revision:"rev1",cutoverEpoch:epoch,products:[{id:"meal",title:"Batata",available:true,priceCents:1450,recipe:[{stockId:"pot",units:500}],extras:[]}],stockMap:[{stockId:"pot",universe:"batataria",group:"ingredients",itemId:"potato",recordKey:stockKey,scale:1}]});
  await set("checkoutLabStores/"+storeId+"/meta/sequence",{value:0});
  const api=createCheckoutLabRepository({projectId,enabled:true,repository:repo,clock:()=>now,verifyToken:async t=>({uid:t,emailVerified:true,provider:"google.com"})});
  const input={lines:[{productId:"meal",quantity:1,extras:[]}],fulfillment:"pickup",paymentMethod:"pix"};
  const quote=()=>api.execute({token:"buyer1",storeId,kind:"quote",operationId:"cutover_operation_01",input});
  const submit=()=>api.execute({token:"buyer1",storeId,kind:"submit",operationId:"cutover_operation_02",quoteId:"cutover_operation_01",input,expectedRevision:"rev1",expectedTotalCents:1450});
  const writeMeta=(client,path)=>sdk.setDoc(sdk.doc(client,path),{...meta,updatedAt:stamp()});
  await assertSucceeds(writeMeta(ownerDb,root+"/appState/v5"));await assert.rejects(quote,e=>e.code==="cutover_not_ready");
  const change=mode=>set(root,{...profile,accessPolicy:{...profile.accessPolicy,checkoutAuthority:mode,checkoutEpoch:epoch}});
  await change("frozen");await assertFails(writeMeta(ownerDb,root+"/appState/v5"));await assert.rejects(quote,e=>e.code==="cutover_not_ready");
  await assertSucceeds(sdk.getDoc(sdk.doc(ownerDb,root+"/appState/v5")));
  await assertSucceeds(writeMeta(otherDb,"users/otherowner/appState/v5"));
  await change("server-only");
  await assertFails(sdk.updateDoc(sdk.doc(ownerDb,root),{"accessPolicy.checkoutAuthority":"legacy"}));
  await assertFails(writeMeta(ownerDb,root+"/appState/v5"));
  await assertFails(sdk.setDoc(sdk.doc(ownerDb,root+"/appState/v5Pulse"),{eventId:"fake",updatedAt:stamp()}));
  await assertFails(sdk.setDoc(sdk.doc(ownerDb,root+"/appState/v5InventoryGuard"),{revision:1,updatedAt:stamp()}));
  await assertFails(sdk.deleteDoc(sdk.doc(ownerDb,stockPath)));
  await assertFails(sdk.updateDoc(sdk.doc(ownerDb,stockPath),{"record.item.stock":999,updatedAt:stamp()}));
  // Stale client cannot bypass the freeze by using an old local snapshot.
  const batch=sdk.writeBatch(ownerDb);batch.set(sdk.doc(ownerDb,root+"/appState/v5"),{...meta,updatedAt:stamp()});batch.set(sdk.doc(ownerDb,root+"/appState/v5InventoryGuard"),{revision:1,updatedAt:stamp()});await assertFails(batch.commit());
  // Legacy Worker authorization reads the same protected profile.
  const worker=createWorkerApp({verify:async()=>({uid:owner,isAdmin:false}),repository:()=>repo});
  const response=await worker.fetch(new Request("http://localhost/v1/orders/produce",{method:"POST",headers:{Authorization:"Bearer fake","Content-Type":"application/json"},body:JSON.stringify({universe:"batataria",orderId:"oldorder",operationId:"cutover_legacy_001"})}),{ENABLE_WRITES:"true",CANARY_UIDS:owner,FIREBASE_PROJECT_ID:projectId});
  // Route name validated separately in actual source; expect authorization rejection, not 404.
  assert.equal(response.status,403);assert.equal((await response.json()).error,"not_allowed");
  assert.equal((await quote()).totalCents,1450);assert.equal((await submit()).status,"received");
  assert.equal((await read(stockPath)).record.item.stock,500);
  await change("frozen");assert.equal((await submit()).duplicate,true);
  const denied=()=>api.execute({token:owner,storeId,kind:"transition",operationId:"cutover_operation_03",orderId:"P0000001",action:"cancel"});
  await assert.rejects(denied,e=>e.code==="cutover_not_ready");
  await change("server-only");assert.equal((await denied()).status,"cancelled");assert.equal((await denied()).duplicate,true);
  assert.equal((await read(stockPath)).record.item.stock,1000);
  await change("legacy");await assertSucceeds(writeMeta(ownerDb,root+"/appState/v5"));
 });console.log("PASS B02.11 cutover emulator: rules, Worker fence, isolated checkout, retry and rollback mode.");
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
