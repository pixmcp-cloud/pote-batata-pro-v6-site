// B02.7: synthetic project only; real REST transaction/query against local emulator.
const assert=require("node:assert/strict");
const {initializeTestEnvironment}=require("../qa/firestore/node_modules/@firebase/rules-unit-testing");
const sdk=require("../qa/firestore/node_modules/firebase/firestore");
(async()=>{
 const projectId="demo-nucleobit-checkout",host=process.env.FIRESTORE_EMULATOR_HOST;
 if(!/^127\.0\.0\.1:\d+$/.test(host||""))throw Error("Local emulator required");
 const {createFirestoreRepository}=await import("../workers/antifraud/src/firestore.mjs");
 const {keyFor,planOperation}=await import("../workers/antifraud/src/domain.mjs");
 const {modelRecordKey,freeSlotKey}=await import("../free_id_policy.mjs");
 const {createCheckoutLabRepository}=await import("./firestore_checkout_lab.mjs");
 const {compileV5Catalog}=await import("./v5_checkout_catalog_lab.mjs");
 const {loadV5CheckoutAuthority}=await import("./v5_checkout_authority_lab.mjs");
 await import("../finance_core.js");
 const finance=globalThis.POTE_FINANCE,owner="authmerchant",universe="batataria",root="users/"+owner,storeId="authorityshop",now=1700000000000;
 const env=await initializeTestEnvironment({projectId});
 const repository=createFirestoreRepository({FIREBASE_PROJECT_ID:projectId},{apiBaseUrl:"http://"+host+"/v1/projects/"+projectId+"/databases/(default)",accessToken:async()=>"owner"});
 const settings={fee:0,tax:0,packageCost:1,otherCost:0,estimatedMonthlyUnits:100,margin:50};
 const ingredient={id:"potato",name:"Batata",yield:80,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",stock:500};
 const recipe={id:"meal",name:"Batata",items:[{id:"potato",g:400}],pricingMode:"gain",targetGainPct:100};
 const expense={id:"expense1",enabled:true,mode:"mensal",amount:100,repeat:1};
 const key=(group,id)=>keyFor(universe,group,id),stockKey=key("ingredients","potato"),stockPath=root+"/recordsV5/"+stockKey;
 const stockMap=[{stockId:"pot",universe,group:"ingredients",itemId:"potato",recordKey:stockKey,scale:1}];
 const branch={settings,ingredients:[ingredient],recipes:[recipe],expenses:[expense],beverages:[],addons:[]};
 const manifest={lab:true,enabled:true,ownerUid:owner,universe,revision:"rev1",catalogMode:"v5-authoritative",recipeIds:["meal"],beverageIds:[],addonIds:[],stockMap,deliveryEnabled:false,deliveryFeeCents:0};
 manifest.products=compileV5Catalog({finance,branch,...manifest}).products;
 const profile={license:{status:"active",kind:"pro",expiresAt:sdk.Timestamp.fromMillis(now+60000)}};
 const rec=(group,item)=>({record:{universe,group,id:item.id,item,rank:1}});
 const recordKeyAllowed=(k,r)=>[keyFor(r.universe,r.group,r.id),modelRecordKey(r),freeSlotKey(r)].includes(k);
 const api=createCheckoutLabRepository({projectId,enabled:true,repository,clock:()=>now,verifyToken:async t=>({uid:t,emailVerified:true,provider:"google.com"}),loadAuthoritativeCatalog:args=>loadV5CheckoutAuthority({...args,finance,recordKeyAllowed})});
 const input={lines:[{productId:"meal",quantity:1,extras:[]}],fulfillment:"pickup",paymentMethod:"pix"},op=n=>"authority_operation_"+String(n).padStart(4,"0");
 const quote=n=>api.execute({token:"buyer1",storeId,kind:"quote",operationId:op(n),input});
 const submit=(n,q)=>api.execute({token:"buyer1",storeId,kind:"submit",operationId:op(n),quoteId:op(q),input,expectedRevision:"rev1",expectedTotalCents:1450});
 try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),set=(p,x)=>sdk.setDoc(sdk.doc(db,p),x),read=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
  await set(root,profile);await set(root+"/appState/v5",{schemaVersion:5,state:{data:{businessType:universe,settings}}});
  await set(root+"/appState/v5InventoryGuard",{revision:0});await set(root+"/appState/v5Pulse",{eventId:"seed"});
  await set(stockPath,rec("ingredients",ingredient));await set(root+"/recordsV5/"+key("recipes",recipe.id),rec("recipes",recipe));
  await set(root+"/recordsV5/"+key("expenses",expense.id),rec("expenses",expense));
  await set("checkoutLabStores/"+storeId,manifest);await set("checkoutLabStores/"+storeId+"/meta/sequence",{value:0});
  assert.equal((await quote(1)).totalCents,1450);
  const expense2={...expense,id:"expense2"};
  await set(root+"/recordsV5/"+key("expenses",expense2.id),rec("expenses",expense2));
  await assert.rejects(()=>submit(2,1),e=>e.code==="catalog_stale");
  await sdk.deleteDoc(sdk.doc(db,root+"/recordsV5/"+key("expenses",expense2.id)));
  await set(root,{license:{status:"revoked"}});await assert.rejects(()=>submit(2,1),e=>e.code==="license_required");await set(root,profile);
  // Legacy domain operation, sharing the identical physical document + guard.
  const legacy=async()=>{const tx=await repository.transaction();try{
   const s=await tx.get(stockPath),g=await tx.get(root+"/appState/v5InventoryGuard"),p=await tx.get(root+"/appState/v5Pulse");
   const plan=planOperation({action:"produce",order:{id:"legacy1",qty:1,status:"recebido",stockDeducted:false,items:[{id:"potato",g:400,yieldPct:80}]},stock:new Map([["ingredients:potato",s.data.record.item]]),universe,operationId:"legacy1",at:new Date(now).toISOString()});
   await tx.commit([{path:stockPath,data:{record:{...s.data.record,item:plan.stockUpdates[0].item}},precondition:{updateTime:s.updateTime}},{path:root+"/appState/v5InventoryGuard",data:{revision:g.data.revision+1},precondition:{updateTime:g.updateTime}},{path:root+"/appState/v5Pulse",data:{eventId:"legacy1",previousEventId:p.data.eventId,origin:"legacy-test",changedKeys:[stockKey],sensitive:true},precondition:{updateTime:p.updateTime}}]);
   return true;
  }finally{await tx.rollback()}};
  const outcomes=await Promise.allSettled([submit(2,1),legacy()]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
  assert.equal((await read(stockPath)).record.item.stock,0);assert.equal((await read(root+"/appState/v5InventoryGuard")).revision,1);
 });
 console.log("PASS B02.7 REST emulator: complete catalog query, license revocation, stale price, shared stock vs legacy domain");
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
