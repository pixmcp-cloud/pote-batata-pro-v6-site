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
 const metrics={queryDocs:0,queries:0,batchGets:0};
 const measuredFetch=async(url,opts)=>{const response=await fetch(url,opts);if(url.endsWith(":runQuery")&&response.ok){const rows=await response.clone().json();metrics.queries++;metrics.queryDocs+=rows.filter(x=>x.document).length;}if(url.endsWith(":batchGet"))metrics.batchGets++;return response};
 const repository=createFirestoreRepository({FIREBASE_PROJECT_ID:projectId},{apiBaseUrl:"http://"+host+"/v1/projects/"+projectId+"/databases/(default)",accessToken:async()=>"owner",requestFetch:measuredFetch});
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
  await set(root,profile);await set(root+"/appState/v5",{schemaVersion:5,state:{data:{businessType:universe,settings,orderSequenceLast:28}}});
  await set(root+"/appState/v5InventoryGuard",{revision:0});await set(root+"/appState/v5Pulse",{eventId:"seed"});
  await set(stockPath,rec("ingredients",ingredient));await set(root+"/recordsV5/"+key("recipes",recipe.id),rec("recipes",recipe));
  await set(root+"/recordsV5/"+key("expenses",expense.id),rec("expenses",expense));
  await set("checkoutLabStores/"+storeId,manifest);await set("checkoutLabStores/"+storeId+"/meta/sequence",{value:0});
  const batch=sdk.writeBatch(db);
  for(let i=0;i<200;i++){const item={id:"unpublished"+i,name:"Não publicado"};batch.set(sdk.doc(db,root+"/recordsV5/"+key("recipes",item.id)),rec("recipes",item))}
  await batch.commit();
  const whole=await repository.transaction();
  try{const rows=await whole.listRecords({collection:root+"/recordsV5",universe,groups:["recipes","ingredients","beverages","addons","expenses"],limit:241});assert.equal(rows.length,203)}finally{await whole.rollback()}
  metrics.queryDocs=0;metrics.queries=0;metrics.batchGets=0;
  assert.equal((await quote(1)).totalCents,1450);
  assert.equal(metrics.queryDocs,3);assert.equal(metrics.queries,3);
  console.log("B02.8 comparison: full 203 records, selective 3 records; "+metrics.batchGets+" other batchGet calls (not billed-read measurement).");
  const check=await repository.transaction();
  try{await check.listCatalogRecords({collection:root+"/recordsV5",universe,selection:{recipes:["meal"],ingredients:["potato"],beverages:[],addons:[]},limit:241});
   const before=metrics.batchGets;const a=await check.get(stockPath);assert.equal(a.data.record.item.stock,500);a.data.record.item.stock=999;assert.equal((await check.get(stockPath)).data.record.item.stock,500);assert.equal(metrics.batchGets,before);
  }finally{await check.rollback()}
  // Duplicate logical record at a different physical key must be rejected.
  const dup=root+"/recordsV5/free~base~recipes";
  await set(dup,rec("recipes",recipe));await assert.rejects(()=>submit(2,1),e=>e.code==="catalog_record_invalid");await sdk.deleteDoc(sdk.doc(db,dup));
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
  const firstNumber=outcomes[0].status==="fulfilled"?29:28;
  assert.equal((await read(root+"/appState/v5")).state.data.orderSequenceLast,firstNumber);
  // Replenish synthetic stock; two storefronts share the existing V5 number.
  await set(stockPath,rec("ingredients",{...ingredient,stock:1000}));
  const store2="authorityshop2";
  await set("checkoutLabStores/"+store2,manifest);await set("checkoutLabStores/"+store2+"/meta/sequence",{value:0});
  const qa=await quote(10);
  const qb=await api.execute({token:"buyer2",storeId:store2,kind:"quote",operationId:op(11),input});
  const secondSubmit=()=>api.execute({token:"buyer2",storeId:store2,kind:"submit",operationId:op(13),quoteId:op(11),input,expectedRevision:"rev1",expectedTotalCents:1450});
  const a=await submit(12,10),b=await secondSubmit();
  assert.equal(a.id,"P"+String(firstNumber+1).padStart(7,"0"));assert.equal(b.id,"P"+String(firstNumber+2).padStart(7,"0"));
  assert.equal((await secondSubmit()).duplicate,true);
  assert.equal((await read(root+"/appState/v5")).state.data.orderSequenceLast,firstNumber+2);
  assert.equal((await read(root+"/appState/v5Pulse")).metaChanged,true);
  assert.equal((await read(stockPath)).record.item.stock,0);
  const meta=await read(root+"/appState/v5");
  await set(root+"/appState/v5",{...meta,state:{...meta.state,data:{...meta.state.data,kitchenStock:{mode:"shared",inventory:{}}}}});
  await assert.rejects(()=>quote(14),e=>e.code==="shared_kitchen_requires_reconciliation");
  // B02.10: two universes, identical physical ingredient; one central stock.
  const pizza="pizzaria",pizzaStore="pizzashop",pizzaIngredient={...ingredient,id:"pizza-potato",stock:500},pizzaRecipe={...recipe,id:"pizza-meal",items:[{id:pizzaIngredient.id,g:400}]};
  const pizzaKey=keyFor(pizza,"ingredients",pizzaIngredient.id),pizzaPath=root+"/recordsV5/"+pizzaKey;
  const mainIngredient={...ingredient,stock:500};
  const sharedMeta={...meta,state:{...meta.state,data:{...meta.state.data,businessUniverses:{pizzaria:{settings,orderSequenceLast:12}},kitchenStock:{mode:"shared",inventory:{"batata|g":{...mainIngredient}}}}}};
  await set(root+"/appState/v5",sharedMeta);await set(stockPath,rec("ingredients",mainIngredient));
  await set(pizzaPath,{record:{universe:pizza,group:"ingredients",id:pizzaIngredient.id,item:pizzaIngredient,rank:1}});
  await set(root+"/recordsV5/"+keyFor(pizza,"recipes",pizzaRecipe.id),{record:{universe:pizza,group:"recipes",id:pizzaRecipe.id,item:pizzaRecipe,rank:1}});
  await set(root+"/recordsV5/"+keyFor(pizza,"expenses",expense.id),{record:{universe:pizza,group:"expenses",id:expense.id,item:expense,rank:1}});
  const pizzaManifest={...manifest,universe:pizza,sharedKitchenEnabled:true,recipeIds:[pizzaRecipe.id],stockMap:[{...stockMap[0],universe:pizza,itemId:pizzaIngredient.id,recordKey:pizzaKey}]};
  pizzaManifest.products=compileV5Catalog({finance,branch:{...branch,ingredients:[pizzaIngredient],recipes:[pizzaRecipe]},...pizzaManifest}).products;
  await set("checkoutLabStores/"+storeId,{...manifest,sharedKitchenEnabled:true});await set("checkoutLabStores/"+pizzaStore,pizzaManifest);await set("checkoutLabStores/"+pizzaStore+"/meta/sequence",{value:0});
  const pizzaInput={...input,lines:[{productId:pizzaRecipe.id,quantity:1,extras:[]}]};
  const pq=()=>api.execute({token:"buyer2",storeId:pizzaStore,kind:"quote",operationId:op(31),input:pizzaInput});
  const ps=()=>api.execute({token:"buyer2",storeId:pizzaStore,kind:"submit",operationId:op(33),quoteId:op(31),input:pizzaInput,expectedRevision:"rev1",expectedTotalCents:1450});
  await quote(30);await pq();
  const oldGuard=(await read(root+"/appState/v5InventoryGuard")).revision;
  const staleMeta=await repository.transaction();const stale=await staleMeta.get(root+"/appState/v5");await staleMeta.rollback();
  const race=await Promise.allSettled([submit(32,30),ps()]);
  assert.equal(race.filter(x=>x.status==="fulfilled").length,1);
  const winningIndex=race.findIndex(x=>x.status==="fulfilled"),winner=winningIndex===0?storeId:pizzaStore,winningOrder=race[winningIndex].value.id;
  const verifyStock=async value=>{assert.equal((await read(stockPath)).record.item.stock,value);assert.equal((await read(pizzaPath)).record.item.stock,value);assert.equal((await read(root+"/appState/v5")).state.data.kitchenStock.inventory["batata|g"].stock,value)};
  await verifyStock(0);assert.equal((await read(root+"/appState/v5InventoryGuard")).revision,oldGuard+1);
  const sharedPulse=await read(root+"/appState/v5Pulse");assert.equal(sharedPulse.metaChanged,true);assert.deepEqual(new Set(sharedPulse.changedKeys),new Set([stockKey,pizzaKey]));
  // A stale legacy meta replacement cannot commit after the online reservation.
  const staleWriter=await repository.transaction();try{await assert.rejects(()=>staleWriter.commit([{path:root+"/appState/v5",data:stale.data,precondition:{updateTime:stale.updateTime}}]))}finally{await staleWriter.rollback()}
  await verifyStock(0);
  const cancel=()=>api.execute({token:owner,storeId:winner,kind:"transition",operationId:op(34),orderId:winningOrder,action:"cancel"});
  assert.equal((await cancel()).status,"cancelled");await verifyStock(500);assert.equal((await cancel()).duplicate,true);await verifyStock(500);
  assert.equal((await read(root+"/appState/v5InventoryGuard")).revision,oldGuard+2);
  const next=await (winningIndex===0?ps():submit(32,30));assert.equal(next.status,"received");await verifyStock(0);
  const losingStore=winningIndex===0?pizzaStore:storeId;
  const prepare=()=>api.execute({token:owner,storeId:losingStore,kind:"transition",operationId:op(35),orderId:next.id,action:"prepare"});
  assert.equal((await prepare()).status,"preparing");await verifyStock(0);
  await set(pizzaPath,{record:{universe:pizza,group:"ingredients",id:pizzaIngredient.id,item:{...pizzaIngredient,stock:5},rank:1}});
  await assert.rejects(()=>quote(36),e=>e.code==="shared_kitchen_divergent");
  console.log("PASS B02.10 shared kitchen: one reservation, stale writer rejected, idempotent return, no second production debit, divergence rejected.");

 });
 console.log("PASS B02.7 REST emulator: complete catalog query, license revocation, stale price, shared stock vs legacy domain");
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
