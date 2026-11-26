// Synthetic demo project ONLY. No service accounts or real Firebase auth.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("../qa/firestore/node_modules/@firebase/rules-unit-testing");
const sdk=require("../qa/firestore/node_modules/firebase/firestore");
const {createEmulatorRepository}=require("../qa/workers/emulator_repository.cjs");
(async()=>{
 const {createCheckoutLabRepository}=await import("./firestore_checkout_lab.mjs");
 const projectId="demo-nucleobit-checkout";
 if(!process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:"))throw Error("Local emulator required");
 const env=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync("checkout_backend/firestore.checkout.lab.rules","utf8")}});
 const claims={email_verified:true,firebase:{sign_in_provider:"google.com"}};
 const dbFor=(uid,extra=claims)=>env.authenticatedContext(uid,extra).firestore();
 const root="users/merchant1",stock=root+"/recordsV5/model~potato",guard=root+"/appState/v5InventoryGuard";
 const manifest={lab:true,enabled:true,ownerUid:"merchant1",universe:"batataria",revision:"rev1",deliveryEnabled:false,deliveryFeeCents:0,stockMap:[{stockId:"potato",universe:"batataria",group:"ingredients",itemId:"potato",recordKey:"model~potato",scale:1000}],products:[{id:"meal",title:"Batata",available:true,priceCents:3000,recipe:[{stockId:"potato",units:250}],extras:[]}]};
 const key=n=>"operation_"+String(n).padStart(8,"0"),input={lines:[{productId:"meal",quantity:2,extras:[]}],fulfillment:"pickup",paymentMethod:"pix"};
 let now=1000000;
 try{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore(),set=(p,x)=>sdk.setDoc(sdk.doc(db,p),x);
   for(const s of ["shop1","shop2"]){await set("checkoutLabStores/"+s,manifest);await set("checkoutLabStores/"+s+"/meta/sequence",{value:0})}
   await set(root+"/appState/v5",{schemaVersion:5});await set(guard,{revision:0});await set(root+"/appState/v5Pulse",{eventId:"seed"});await set(stock,{record:{universe:"batataria",group:"ingredients",id:"potato",item:{stock:.5,name:"Batata"},rank:7}});
   const api=createCheckoutLabRepository({projectId,enabled:true,repository:createEmulatorRepository(db,sdk),clock:()=>now,verifyToken:async t=>({uid:t,emailVerified:true,provider:"google.com"})});
   const q=(s,t,n)=>api.execute({storeId:s,token:t,kind:"quote",operationId:key(n),input});
   const submit=(s,t,n,qid)=>api.execute({storeId:s,token:t,kind:"submit",operationId:key(n),quoteId:key(qid),input,expectedRevision:"rev1",expectedTotalCents:6000});
   await q("shop1","buyer1",1);await q("shop2","buyer2",2);
   const outcomes=await Promise.allSettled([submit("shop1","buyer1",3,1),submit("shop2","buyer2",4,2)]);
   assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
   const failure=outcomes.find(x=>x.status==="rejected").reason;assert(failure.status===409||failure.code==="insufficient_stock",String(failure));
   const first=outcomes[0].status==="fulfilled",shop=first?"shop1":"shop2",buyer=first?"buyer1":"buyer2",other=first?"buyer2":"buyer1",op=first?3:4,qid=first?1:2;
   assert.equal((await sdk.getDoc(sdk.doc(db,stock))).data().record.item.stock,0);
   assert.equal((await sdk.getDoc(sdk.doc(db,guard))).data().revision,1);
   assert.equal((await submit(shop,buyer,op,qid)).duplicate,true);
   const view="checkoutLabStores/"+shop+"/customerViews/P0000001",order="checkoutLabStores/"+shop+"/orders/P0000001";
   const own=dbFor(buyer),stranger=dbFor(other),merchant=dbFor("merchant1"),anon=env.unauthenticatedContext().firestore();
   await assertSucceeds(sdk.getDoc(sdk.doc(own,view)));
   await assertFails(sdk.getDoc(sdk.doc(stranger,view)));
   await assertFails(sdk.getDoc(sdk.doc(anon,view)));
   await assertFails(sdk.getDoc(sdk.doc(dbFor(buyer,{email_verified:false,firebase:{sign_in_provider:"google.com"}}),view)));
   await assertFails(sdk.getDocs(sdk.collection(own,"checkoutLabStores/"+shop+"/customerViews")));
   await assertFails(sdk.getDoc(sdk.doc(own,order)));
   await assertSucceeds(sdk.getDocs(sdk.collection(merchant,"checkoutLabStores/"+shop+"/orders")));
   await assertFails(sdk.getDocs(sdk.collection(stranger,"checkoutLabStores/"+shop+"/orders")));
   await assertFails(sdk.updateDoc(sdk.doc(own,view),{"status.status":"delivered"}));
   await assertFails(sdk.updateDoc(sdk.doc(merchant,order),{status:"delivered"}));
   await assertFails(sdk.updateDoc(sdk.doc(merchant,stock),{"record.item.stock":100}));
   await assertFails(sdk.getDoc(sdk.doc(own,"checkoutLabStores/"+shop)));
   now+=1000;const cancel=()=>api.execute({storeId:shop,token:"merchant1",kind:"transition",operationId:key(5),orderId:"P0000001",action:"cancel"});
   assert.equal((await cancel()).status,"cancelled");assert.equal((await cancel()).duplicate,true);
   assert.equal((await sdk.getDoc(sdk.doc(db,stock))).data().record.item.stock,.5);
   assert.equal((await sdk.getDoc(sdk.doc(db,guard))).data().revision,2);
   assert.equal((await sdk.getDoc(sdk.doc(own,view))).data().status.status,"cancelled");
   // New order after cancellation, confirmation must commit cash and order together.
   const secondQuote=await q(shop,buyer,20);
   const second=await submit(shop,buyer,21,20);assert.equal(second.id,"P0000002");
   const cashRoot="checkoutLabCash/merchant1",sessionPath=cashRoot+"/sessions/shift1",receiptPath=cashRoot+"/receipts/"+shop.length+"_"+shop+"_P0000002";
   const confirm=()=>api.execute({storeId:shop,token:"merchant1",kind:"transition",operationId:key(22),orderId:second.id,action:"confirm_payment",paymentReference:"Extrato de teste"});
   await assert.rejects(confirm,e=>e.code==="cash_not_open");
   await set(cashRoot,{activeSessionId:"shift1"});await set(sessionPath,{id:"shift1",ownerUid:"merchant1",status:"open",openedAt:now,revision:0,totals:{cash:0,pix:0,card:0,count:0}});
   assert.equal((await confirm()).paymentStatus,"confirmed");assert.equal((await confirm()).duplicate,true);
   assert.equal((await sdk.getDoc(sdk.doc(db,receiptPath))).data().amountCents,6000);
   assert.equal((await sdk.getDoc(sdk.doc(db,sessionPath))).data().totals.pix,6000);
   await assertFails(sdk.getDoc(sdk.doc(own,receiptPath)));
   await assertFails(sdk.updateDoc(sdk.doc(merchant,sessionPath),{"totals.pix":0}));
   const close=()=>api.closeCash({token:"merchant1",sessionId:"shift1",operationId:key(23)});
   const closed=await close();assert.equal(closed.receivedCents,6000);assert.equal(closed.cashDrawerIncreaseCents,0);assert.deepEqual(await close(),closed);
   assert.equal((await sdk.getDoc(sdk.doc(db,cashRoot))).data().activeSessionId,null);
   assert.equal((await confirm()).duplicate,true);
   assert.deepEqual((await sdk.getDoc(sdk.doc(db,sessionPath))).data().closedSummary,closed);
  });
  console.log("PASS B02.2 Firestore SDK emulator: shared stock concurrency, idempotency, rules and cancellation.");
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
