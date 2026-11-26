// B02.12: end-to-end synthetic emulator; no production endpoints or credentials.
const assert=require("node:assert/strict"),fs=require("node:fs"),crypto=require("node:crypto");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("../qa/firestore/node_modules/@firebase/rules-unit-testing");
const sdk=require("../qa/firestore/node_modules/firebase/firestore");
(async()=>{
 const projectId="demo-nucleobit-checkout",restoreProject="demo-nucleobit-restore",host=process.env.FIRESTORE_EMULATOR_HOST;
 if(!/^127\.0\.0\.1:\d+$/.test(host||""))throw Error("Local emulator required");
 const {candidateIntegratedRules}=await import("./v5_cutover_rules_lab.mjs");
 const {createFirestoreRepository}=await import("../workers/antifraud/src/firestore.mjs");
 const {keyFor}=await import("../workers/antifraud/src/domain.mjs");
 const {createCheckoutLabRepository}=await import("./firestore_checkout_lab.mjs");
 const {compileV5Catalog}=await import("./v5_checkout_catalog_lab.mjs");
 const {loadV5CheckoutAuthority}=await import("./v5_checkout_authority_lab.mjs");
 const {orderPrintText}=await import("./pdv_checkout_queue.mjs");
 await import("../finance_core.js");
 const rules=candidateIntegratedRules(fs.readFileSync("firestore.rules","utf8"));
 const env=await initializeTestEnvironment({projectId,firestore:{rules}});
 let restored;
 const owner="integratedowner",online="integratedonline",counter="integratedcounter",buyer="integratedbuyer",universe="batataria",epoch="integration_epoch_001",root="users/"+owner,cash="checkoutLabCash/"+owner;
 const store=id=>"checkoutLabStores/"+id;
 const cfg={FIREBASE_PROJECT_ID:projectId},options={apiBaseUrl:"http://"+host+"/v1/projects/"+projectId+"/databases/(default)",accessToken:async()=>"owner"};
 const repository=createFirestoreRepository(cfg,options);
 let now=1700000000000,loseReply=false;
 const lossy={async transaction(){const tx=await repository.transaction();return {...tx,async commit(writes){await tx.commit(writes);if(loseReply){loseReply=false;throw Object.assign(Error("reply lost after commit"),{code:"reply_lost"})}}}}};
 const finance=globalThis.POTE_FINANCE,settings={fee:0,tax:0,packageCost:1,otherCost:0,estimatedMonthlyUnits:100,margin:50};
 const ingredient={id:"potato",name:"Batata",yield:80,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",stock:1000},recipe={id:"meal",name:"Batata",items:[{id:"potato",g:400}],pricingMode:"gain",targetGainPct:100},expense={id:"expense1",enabled:true,mode:"mensal",amount:100,repeat:1};
 const stockKey=keyFor(universe,"ingredients",ingredient.id),stockPath=root+"/recordsV5/"+stockKey;
 const stockMap=[{stockId:"pot",universe,group:"ingredients",itemId:ingredient.id,recordKey:stockKey,scale:1}];
 const manifest={lab:true,enabled:true,ownerUid:owner,universe,revision:"rev1",catalogMode:"v5-authoritative",cutoverEpoch:epoch,recipeIds:[recipe.id],beverageIds:[],addonIds:[],stockMap,deliveryEnabled:false,deliveryFeeCents:0};
 manifest.products=compileV5Catalog({finance,branch:{settings,ingredients:[ingredient],recipes:[recipe],expenses:[expense],beverages:[],addons:[]},...manifest}).products;
 const api=createCheckoutLabRepository({projectId,enabled:true,repository:lossy,clock:()=>now,verifyToken:async t=>({uid:t,emailVerified:true,provider:"google.com"}),loadAuthoritativeCatalog:args=>loadV5CheckoutAuthority({...args,finance,recordKeyAllowed:(k,r)=>k===keyFor(r.universe,r.group,r.id)})});
 const claims={email_verified:true,firebase:{sign_in_provider:"google.com"}},buyerDb=env.authenticatedContext(buyer,claims).firestore(),ownerDb=env.authenticatedContext(owner,claims).firestore();
 const input=method=>({lines:[{productId:"meal",quantity:1,extras:[]}],fulfillment:"pickup",paymentMethod:method});
 const op=n=>"integrated_operation_"+String(n).padStart(4,"0");
 const quote=(id,token,method,n)=>api.execute({token,storeId:id,kind:"quote",operationId:op(n),input:input(method)});
 const submit=(id,token,method,n,q)=>api.execute({token,storeId:id,kind:"submit",operationId:op(n),quoteId:op(q),input:input(method),expectedRevision:"rev1",expectedTotalCents:1450});
 const act=(id,oid,action,n,extra={})=>api.execute({token:owner,storeId:id,kind:"transition",orderId:oid,action,operationId:op(n),...extra});
 const rec=(group,item)=>({record:{universe,group,id:item.id,item,rank:1}});
 const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 // Explicit typed encoding: SDK timestamps otherwise serialize with a different shape.
 const encode=x=>{if(x instanceof sdk.Timestamp)return ["timestamp",x.seconds,x.nanoseconds];if(x===null)return ["null"];if(Array.isArray(x))return ["array",x.map(encode)];if(typeof x==="object"&&Object.getPrototypeOf(x)===Object.prototype)return ["map",Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,encode(v)])];if(["string","boolean","number"].includes(typeof x)&&!(typeof x==="number"&&!Number.isFinite(x)))return [typeof x,x];throw Error("Unsupported fixture value")};
 const decode=x=>{switch(x[0]){case "timestamp":return new sdk.Timestamp(x[1],x[2]);case "null":return null;case "array":return x[1].map(decode);case "map":return Object.fromEntries(x[1].map(([k,v])=>[k,decode(v)]));case "string":case "number":case "boolean":return x[1];default:throw Error("Unsupported backup value")}};
 const digest=x=>crypto.createHash("sha256").update(JSON.stringify(canonical(x))).digest("hex");
 // Bounded fixture manifest: includes every collection written by this scenario.
 // This is NOT a general Firestore exporter; no real account or unknown collections.
 const roots=[root,cash,store(online),store(counter)];
 const collections=[root+"/appState",root+"/recordsV5",cash+"/sessions",cash+"/receipts",cash+"/refunds",cash+"/movements",cash+"/cashOperations",...[online,counter].flatMap(s=>["meta","orders","customerViews","quotes","operations","schedulerOperations","stockLedger","losses"].map(k=>store(s)+"/"+k))];
 async function snapshot(db){
  const rows=[];
  for(const p of roots){const d=await sdk.getDoc(sdk.doc(db,p));assert(d.exists());rows.push({path:p,data:encode(d.data())})}
  for(const p of collections){const docs=await sdk.getDocs(sdk.query(sdk.collection(db,p),sdk.limit(91)));assert(docs.size<=90);for(const d of docs.docs)rows.push({path:d.ref.path,data:encode(d.data())})}
  assert(rows.length<=90);return rows.sort((a,b)=>a.path.localeCompare(b.path));
 }
 try{await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),set=(p,x)=>sdk.setDoc(sdk.doc(db,p),x),read=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
  await set(root,{license:{status:"active",kind:"lifetime",term:"lifetime"},accessPolicy:{checkoutAuthority:"server-only",checkoutEpoch:epoch}});
  await set(root+"/appState/v5",{schemaVersion:5,state:{data:{businessType:universe,settings,orderSequenceLast:40}}});
  await set(root+"/appState/v5InventoryGuard",{revision:0});await set(root+"/appState/v5Pulse",{eventId:"seed"});
  for(const [g,item] of [["ingredients",ingredient],["recipes",recipe],["expenses",expense]])await set(root+"/recordsV5/"+keyFor(universe,g,item.id),rec(g,item));
  for(const id of [online,counter]){await set(store(id),{...manifest,channel:id===counter?"counter":"online"});await set(store(id)+"/meta/sequence",{value:0})}
  const open=(token=owner,id="shift1",n=30,value=5000)=>api.openCash({token,sessionId:id,operationId:op(n),openingCashCents:value,epoch});
  await assert.rejects(()=>open(buyer),e=>e.code==="cutover_not_ready");
  assert.equal((await open()).openingCashCents,5000);assert.equal((await open()).duplicate,true);
  await assert.rejects(()=>open(owner,"shift1",30,6000),e=>e.code==="idempotency_conflict");
  await assert.rejects(()=>open(owner,"shift2",31),e=>e.code==="cash_already_open");
  const move=(kind,amountCents,n,reason="Movimentação de teste")=>api.moveCash({token:owner,sessionId:"shift1",operationId:op(n),epoch,kind,amountCents,reason});
  await assert.rejects(()=>move("sangria",5001,32),e=>e.code==="insufficient_cash");
  await move("suprimento",2000,33);assert.equal((await move("suprimento",2000,33)).duplicate,true);
  await assert.rejects(()=>move("suprimento",2500,33),e=>e.code==="idempotency_conflict");
  await move("sangria",1000,34);
  await assertFails(sdk.getDoc(sdk.doc(buyerDb,cash+"/movements/"+op(33))));
  await assertFails(sdk.updateDoc(sdk.doc(ownerDb,cash+"/sessions/shift1"),{openingCashCents:99999}));
  await assert.rejects(()=>quote(counter,buyer,"cash",1),e=>e.code==="forbidden");
  assert.equal((await quote(online,buyer,"pix",2)).totalCents,1450);assert.equal((await quote(counter,owner,"cash",3)).totalCents,1450);
  const calls=[()=>submit(online,buyer,"pix",4,2),()=>submit(counter,owner,"cash",5,3)];
  const race=await Promise.allSettled(calls.map(fn=>fn()));assert(race.some(x=>x.status==="fulfilled"));
  const results=[];for(let i=0;i<2;i++)results.push(race[i].status==="fulfilled"?race[i].value:await calls[i]());
  const [web,sale]=results;assert.deepEqual(new Set(results.map(x=>x.id)),new Set(["P0000041","P0000042"]));
  assert.equal((await read(stockPath)).record.item.stock,0);assert.equal((await read(root+"/appState/v5")).state.data.orderSequenceLast,42);
  assert.equal((await read(root+"/appState/v5InventoryGuard")).revision,2);
  // Payment is a deliberate confirmation; simulate lost HTTP response after a committed transaction.
  now+=1000;loseReply=true;await assert.rejects(()=>act(online,web.id,"confirm_payment",6,{paymentReference:"PIX sintético"}),e=>e.code==="reply_lost");
  assert.equal((await act(online,web.id,"confirm_payment",6,{paymentReference:"PIX sintético"})).duplicate,true);
  await act(counter,sale.id,"confirm_payment",7,{paymentReference:"Dinheiro sintético"});
  for(const [i,id,oid] of [[0,online,web.id],[1,counter,sale.id]]){now+=1000;await act(id,oid,"prepare",10+i*3);now+=1000;await act(id,oid,"ready",11+i*3);now+=1000;await act(id,oid,"deliver",12+i*3)}
  assert.equal((await read(stockPath)).record.item.stock,0);
  const webPath=store(online)+"/orders/"+web.id,salePath=store(counter)+"/orders/"+sale.id;
  const webView=store(online)+"/customerViews/"+web.id;
  await assertSucceeds(sdk.getDoc(sdk.doc(buyerDb,webView)));
  await assertFails(sdk.getDoc(sdk.doc(buyerDb,salePath)));
  await assertFails(sdk.updateDoc(sdk.doc(ownerDb,stockPath),{"record.item.stock":999,updatedAt:sdk.serverTimestamp()}));
  await assertFails(sdk.updateDoc(sdk.doc(buyerDb,webView),{"status.status":"delivered"}));
  assert.equal((await read(salePath)).channel,"counter");
  assert.match(orderPrintText(await read(webPath)),/COMPROVANTE NÃO FISCAL/);
  assert.match(orderPrintText(await read(salePath)),/VENDA DE BALCÃO/);assert.match(orderPrintText(await read(salePath)),/Tempo total:/);
  const beforeClose=await read(cash+"/sessions/shift1");assert.deepEqual(beforeClose.totals,{cash:1450,pix:1450,card:0,count:2});
  const close=()=>api.closeCash({token:owner,sessionId:"shift1",operationId:op(20),epoch,countedCashCents:7400});
  const closed=await close();assert.equal(closed.receivedCents,2900);assert.equal(closed.cashDrawerIncreaseCents,1450);assert.deepEqual(await close(),closed);assert.equal(closed.expectedCashCents,7450);assert.equal(closed.countedCashCents,7400);assert.equal(closed.differenceCents,-50);assert.equal(closed.supplyCents,2000);assert.equal(closed.withdrawalCents,1000);
  await assert.rejects(()=>move("sangria",1,35),e=>e.code==="cash_not_open");
  await assert.rejects(()=>api.closeCash({token:owner,sessionId:"shift1",operationId:op(20),epoch,countedCashCents:7450}),e=>e.code==="idempotency_conflict");
  assert.equal((await read(cash)).activeSessionId,null);
  // Export the quiescent synthetic fixture with all written collection paths.
  const rows=await snapshot(db),serialized=JSON.stringify({version:1,rows,sha256:digest(rows)});
  const parsed=JSON.parse(serialized);assert.equal(digest(parsed.rows),parsed.sha256);
  const tampered=JSON.parse(serialized);tampered.rows[0].data={changed:true};assert.notEqual(digest(tampered.rows),parsed.sha256);
  restored=await initializeTestEnvironment({projectId:restoreProject,firestore:{rules}});
  await restored.withSecurityRulesDisabled(async rctx=>{
   const target=rctx.firestore();for(const row of parsed.rows){const existing=await sdk.getDoc(sdk.doc(target,row.path));assert(!existing.exists(),"restore target not empty")}
   const batch=sdk.writeBatch(target);for(const row of parsed.rows)batch.set(sdk.doc(target,row.path),decode(row.data));await batch.commit();
   const restoredRows=await snapshot(target);assert.equal(digest(restoredRows),parsed.sha256);
   assert.equal((await sdk.getDoc(sdk.doc(target,stockPath))).data().record.item.stock,0);
   assert.deepEqual((await sdk.getDoc(sdk.doc(target,cash+"/sessions/shift1"))).data().closedSummary,closed);
   assert.equal((await sdk.getDoc(sdk.doc(target,root+"/appState/v5"))).data().state.data.orderSequenceLast,42);
  });
  // Browser scenario runs AFTER the verified backup, using a fresh test turn.
  const supplier={id:"supplier1",name:"Fornecedor sintético"};const supplierKey=keyFor(universe,"suppliers",supplier.id);await set(root+"/recordsV5/"+supplierKey,rec("suppliers",supplier));
  const adjust=(kind,quantityUnits,expectedUnits,n,token=owner,extra={})=>api.adjustStock({token,storeId:counter,epoch,stockId:"pot",kind,quantityUnits,expectedUnits,operationId:op(n),reason:"Ajuste sintético",...extra});
  await assert.rejects(()=>adjust("purchase",1000,0,40,buyer),e=>e.code==="cutover_not_ready");
  const evidence={purchaseCostCents:1200,purchaseReference:"NF teste 001",supplierId:supplierKey};
  await assert.rejects(()=>adjust("purchase",1000,0,40,owner,{...evidence,supplierId:"missing"}),e=>e.code==="invalid_supplier");
  const purchased=await adjust("purchase",1000,0,40,owner,evidence);assert.equal(purchased.afterUnits,1000);assert.equal(purchased.purchase.totalCents,1200);assert.equal(purchased.purchase.supplierName,supplier.name);assert.equal((await adjust("purchase",1000,0,40,owner,evidence)).duplicate,true);await assert.rejects(()=>adjust("purchase",1000,0,40,owner,{...evidence,purchaseCostCents:1300}),e=>e.code==="idempotency_conflict");
  assert.equal((await read(stockPath)).record.item.purchasePrice,10);
  await assert.rejects(()=>adjust("count",900,0,41),e=>e.code==="stock_changed");await assert.rejects(()=>adjust("loss",1001,1000,42),e=>e.code==="insufficient_stock");
  assert.equal((await read(stockPath)).record.item.stock,1000);
  const recover=(token=buyer,quoteId=op(2),operationId=op(4))=>api.execute({token,storeId:online,kind:"recoverSubmit",quoteId,operationId});
  const known=await recover();assert.equal(known.state,"committed");assert.equal(known.order.id,web.id);
  assert.deepEqual(await recover("otherbuyer"),{state:"unconfirmed"});
  assert.deepEqual(await recover(buyer,op(90),op(91)),{state:"unconfirmed"});
  await assert.rejects(()=>recover(buyer,op(90),op(4)),e=>e.code==="not_found");
  await assert.rejects(()=>api.execute({token:buyer,storeId:counter,kind:"recoverSubmit",quoteId:op(3),operationId:op(5)}),e=>e.code==="forbidden");
  // Private quote cannot be submitted by another verified identity.
  const saved=await quote(online,buyer,"pix",92);
  const savedArgs={storeId:online,kind:"submitSaved",operationId:op(93),quoteId:saved.quoteId,expectedRevision:saved.revision,expectedTotalCents:saved.totalCents};
  await assert.rejects(()=>api.execute({...savedArgs,token:"otherbuyer"}),e=>e.code==="invalid_quote");
  assert.equal((await read(stockPath)).record.item.stock,1000);
  const addon={id:"extra",name:"Porção extra",ingredientId:ingredient.id,quantity:40,sellPrice:3};
  await set(root+"/recordsV5/"+keyFor(universe,"addons",addon.id),rec("addons",addon));
  const revised={...manifest,revision:"rev2",addonIds:[addon.id],deliveryEnabled:true,deliveryFeeCents:500};
  revised.products=compileV5Catalog({finance,branch:{settings,ingredients:[ingredient],recipes:[recipe],expenses:[expense],beverages:[],addons:[addon]},...revised}).products;
  for(const id of [online,counter])await set(store(id),{...revised,channel:id===counter?"counter":"online"});
  const {createV5CatalogApprovalLab}=await import("./v5_catalog_approval_lab.mjs");
  const {createV5QueueReadLab}=await import("./v5_queue_read_lab.mjs");
  const verifyToken=async t=>({uid:t,emailVerified:true,provider:"google.com"});
  const approval=createV5CatalogApprovalLab({projectId,repository,verifyToken,finance,recordKeyAllowed:(k,r)=>k===keyFor(r.universe,r.group,r.id),clock:()=>now});
  const readQueue=createV5QueueReadLab({projectId,repository,verifyToken,clock:()=>now});
  const catalog=()=>approval.execute({kind:"catalog",storeId:online});
  const approvalArgs={token:owner,storeId:online,epoch,operationId:op(95),revision:op(95)};
  await assert.rejects(()=>approval.execute({...approvalArgs,kind:"preview",token:buyer}),e=>e.code==="forbidden");
  const initialCatalog=await catalog();assert.equal(initialCatalog.products[0].extras[0].title,addon.name);assert.equal(initialCatalog.products[0].priceCents,1450);
  assert(!JSON.stringify(initialCatalog).includes("stockMap"));assert(!JSON.stringify(initialCatalog).includes("ownerUid"));
  const preview=await approval.execute({...approvalArgs,kind:"preview"});assert.equal(preview.revision,op(95));assert.equal((await catalog()).revision,"rev2");
  const expensePath=root+"/recordsV5/"+keyFor(universe,"expenses",expense.id);
  await set(expensePath,rec("expenses",{...expense,amount:200}));
  await assert.rejects(catalog,e=>e.code==="catalog_stale");
  await assert.rejects(()=>approval.execute({...approvalArgs,kind:"approve"}),e=>e.code==="catalog_stale");
  await set(expensePath,rec("expenses",expense));
  assert.equal((await approval.execute({...approvalArgs,kind:"approve"})).duplicate,false);
  assert.equal((await approval.execute({...approvalArgs,kind:"approve"})).duplicate,true);
  assert.equal((await catalog()).revision,op(95));
  const profile=await read(root);await set(root,{...profile,license:{status:"inactive"}});
  await assert.rejects(catalog,e=>e.code==="license_required");
  await set(root,profile);
  await assert.rejects(()=>readQueue({token:buyer,storeIds:[online]}),e=>e.code==="forbidden");
  await assert.rejects(()=>readQueue({token:owner,storeIds:[online,"unowned"]}),e=>e.code==="forbidden");
  const qread=await readQueue({token:owner,storeIds:[online,counter]});assert.equal(qread.orders.length,2);assert(qread.orders.every(o=>!Object.hasOwn(o,"required")&&!Object.hasOwn(o,"customerUid")));
  const choices=await approval.execute({kind:"choices",token:owner,storeId:online,epoch});assert(choices.choices.some(x=>x.id==="meal"&&x.selected));
  await assert.rejects(()=>approval.execute({kind:"choices",token:buyer,storeId:online,epoch}),e=>e.code==="forbidden");
  const selection={recipeIds:["meal"],beverageIds:[],addonIds:[],comboIds:[]},selArgs={token:owner,storeId:online,epoch,operationId:op(96),revision:op(96)};
  const selectionPreview=await approval.execute({...selArgs,kind:"preview",selection});assert.equal(selectionPreview.products[0].extras.length,0);
  await assert.rejects(()=>approval.execute({...selArgs,kind:"approve",selection}),e=>e.code==="invalid_selection");
  await approval.execute({...selArgs,kind:"approve"});assert.equal((await catalog()).products[0].extras.length,0);
  const restoreArgs={...selArgs,operationId:op(97),revision:op(97)};
  await approval.execute({...restoreArgs,kind:"preview",selection:{...selection,addonIds:[addon.id]}});await approval.execute({...restoreArgs,kind:"approve"});
  assert.equal((await catalog()).products[0].extras.length,1);
  assert.deepEqual((await read(store(online))).stockMap,stockMap);
  // Separate synthetic store for history pagination. No stock/finance writes.
  const pageStore="queuepagestore";await set(store(pageStore),{...revised,channel:"online"});
  const sample=await read(store(online)+"/orders/"+web.id);
  for(let i=1;i<=25;i++){const id="P"+String(i).padStart(7,"0");await set(store(pageStore)+"/orders/"+id,{...sample,id,storeId:pageStore,createdAt:sample.createdAt});}
  const first=await readQueue({token:owner,storeIds:[pageStore]});assert.equal(first.orders.length,20);assert(first.nextCursors[pageStore]);
  const second=await readQueue({token:owner,storeIds:[pageStore],cursors:first.nextCursors});assert.equal(second.orders.length,5);assert.deepEqual(second.nextCursors,{});assert.equal(new Set([...first.orders,...second.orders].map(o=>o.id)).size,25);
  await assert.rejects(()=>readQueue({token:buyer,storeIds:[pageStore],cursors:first.nextCursors}),e=>e.code==="forbidden");
  console.log("PASS B02-G4 selection approval and 25 orders paginated 20+5 on emulator; G3 approval retry corrected.");
  // G5: separate owner with a historical sequence but no checkout store.
  const {createV5StoreSetupLab}=await import("./v5_store_setup_lab.mjs");
  const setupOwner="setupowner",setupRoot="users/"+setupOwner,setupTarget={ownerUid:setupOwner,universe,online:"setuponline",counter:"setupcounter",epoch,deliveryEnabled:true,deliveryFeeCents:500};
  await set(setupRoot,{license:{status:"active",kind:"lifetime",term:"lifetime"},accessPolicy:{checkoutAuthority:"server-only",checkoutEpoch:epoch}});
  await set(setupRoot+"/appState/v5",{schemaVersion:5,state:{data:{businessType:universe,settings,orderSequenceLast:88}}});
  await set(setupRoot+"/appState/v5InventoryGuard",{revision:0});await set(setupRoot+"/appState/v5Pulse",{eventId:"seed"});
  for(const [g,item] of [["ingredients",ingredient],["recipes",recipe],["expenses",expense],["addons",addon]])await set(setupRoot+"/recordsV5/"+keyFor(universe,g,item.id),rec(g,item));
  const setup=createV5StoreSetupLab({projectId,repository,verifyToken,finance,recordKeyAllowed:(k,r)=>k===keyFor(r.universe,r.group,r.id),target:setupTarget,clock:()=>now});
  const setupArgs={token:setupOwner,operationId:op(100)},setupSelection={...selection,addonIds:[addon.id]};
  await assert.rejects(()=>setup.execute({...setupArgs,kind:"preview",token:buyer,selection:setupSelection}),e=>e.code==="forbidden");
  const planned=await setup.execute({...setupArgs,kind:"preview",selection:setupSelection});assert.equal(planned.baseline,88);assert.equal(planned.stockItems,1);assert.equal(planned.products[0].priceCents,1450);
  assert.equal((await sdk.getDoc(sdk.doc(db,store(setupTarget.online)))).exists(),false);
  const setupExpense=setupRoot+"/recordsV5/"+keyFor(universe,"expenses",expense.id);await set(setupExpense,rec("expenses",{...expense,amount:200}));
  await assert.rejects(()=>setup.execute({...setupArgs,kind:"approve"}),e=>e.code==="setup_stale");
  await set(setupExpense,rec("expenses",expense));
  assert.equal((await setup.execute({...setupArgs,kind:"approve"})).duplicate,false);
  assert.equal((await setup.execute({...setupArgs,kind:"approve"})).duplicate,true);
  const setupOnline=await read(store(setupTarget.online)),setupCounter=await read(store(setupTarget.counter));
  assert.deepEqual(setupOnline.stockMap,setupCounter.stockMap);
  assert.equal(setupOnline.stockMap[0].recordKey,keyFor(universe,"ingredients",ingredient.id));
  assert.equal(setupOnline.stockMap[0].scale,1000);assert.equal(setupOnline.products[0].recipe[0].units,500000);
  assert.equal(setupCounter.deliveryEnabled,false);assert.equal((await read(store(setupTarget.online)+"/meta/sequence")).value,88);
  assert.equal((await read(setupRoot+"/recordsV5/"+keyFor(universe,"ingredients",ingredient.id))).record.item.stock,ingredient.stock);
  const secondSetup=createV5StoreSetupLab({projectId,repository,verifyToken,finance,recordKeyAllowed:(k,r)=>k===keyFor(r.universe,r.group,r.id),target:{...setupTarget,online:"othernewonline",counter:"othernewcounter"},clock:()=>now});
  await assert.rejects(()=>secondSetup.execute({kind:"preview",token:setupOwner,operationId:op(101),selection:setupSelection}),e=>e.code==="setup_conflict");
  console.log("PASS B02-G5 initial store pair: verified stock map, preview stale rejection, atomic approval/replay and historical sequence preserved.");
  // G8: store separate from the main browser fixture. A quote alone grants no right to sell after expiry.
  const setupProfile=await read(setupRoot),trialEnd=now+1000,setupCash="checkoutLabCash/"+setupOwner;
  await set(setupRoot,{...setupProfile,license:{status:"active",kind:"trial",term:"trial7d",expiresAt:sdk.Timestamp.fromMillis(trialEnd)}});
  const opening={token:setupOwner,epoch,sessionId:"trialshift",operationId:op(110),openingCashCents:5000};
  await api.openCash(opening);
  const makeQuote=(n)=>api.execute({token:buyer,storeId:setupTarget.online,kind:"quote",operationId:op(n),input:input("cash")});
  for(const n of [111,112,113])await makeQuote(n);
  const makeSale=(n,q)=>api.execute({token:buyer,storeId:setupTarget.online,kind:"submitSaved",operationId:op(n),quoteId:op(q),expectedRevision:setupArgs.operationId,expectedTotalCents:1450});
  const firstAccepted=await makeSale(114,111),secondAccepted=await makeSale(115,112);
  const setupStock=setupRoot+"/recordsV5/"+stockKey,setupGuard=setupRoot+"/appState/v5InventoryGuard";
  assert.equal((await read(setupStock)).record.item.stock,0);const guardBefore=(await read(setupGuard)).revision;
  now=trialEnd;
  await assert.rejects(()=>makeQuote(116),e=>e.code==="license_required");
  await assert.rejects(()=>makeSale(117,113),e=>e.code==="license_required");
  await assert.rejects(()=>api.openCash({...opening,sessionId:"newshift",operationId:op(118)}),e=>e.code==="license_required");
  await assert.rejects(()=>api.adjustStock({token:setupOwner,storeId:setupTarget.counter,epoch,operationId:op(119),stockId:setupOnline.stockMap[0].stockId,kind:"purchase",quantityUnits:1000,expectedUnits:0,reason:"Reposição bloqueada"}),e=>e.code==="license_required");
  await assert.rejects(()=>api.configureReservation({token:setupOwner,storeId:setupTarget.online,minutes:60}),e=>e.code==="license_required");
  assert.equal((await read(setupGuard)).revision,guardBefore);
  assert.equal((await makeSale(114,111)).duplicate,true);assert.equal((await api.openCash(opening)).duplicate,true);
  const settle=(orderId,action,n,extra={})=>api.execute({token:setupOwner,storeId:setupTarget.online,kind:"transition",orderId,action,operationId:op(n),...extra});
  await settle(firstAccepted.id,"confirm_payment",120,{paymentReference:"Dinheiro sintético"});assert.equal((await settle(firstAccepted.id,"confirm_payment",120,{paymentReference:"Dinheiro sintético"})).duplicate,true);
  now+=1000;await settle(firstAccepted.id,"prepare",121);now+=1000;await settle(firstAccepted.id,"ready",122);now+=1000;await settle(firstAccepted.id,"deliver",123);
  const cancelled=await settle(secondAccepted.id,"cancel",124);assert.equal(cancelled.status,"cancelled");
  assert.equal((await settle(secondAccepted.id,"cancel",124)).duplicate,true);
  assert.equal((await read(setupStock)).record.item.stock,500);assert.equal((await read(setupGuard)).revision,guardBefore+1);
  const history=await readQueue({token:setupOwner,storeIds:[setupTarget.online,setupTarget.counter]});assert.equal(history.orders.length,2);
  const oldStatus=await api.execute({token:buyer,storeId:setupTarget.online,kind:"status",orderId:firstAccepted.id});assert.equal(oldStatus.status,"delivered");
  const withdrawal={token:setupOwner,epoch,sessionId:"trialshift",operationId:op(125),kind:"sangria",amountCents:450,reason:"Retirada para fechar"};
  await api.moveCash(withdrawal);assert.equal((await api.moveCash(withdrawal)).duplicate,true);
  const trialClose={token:setupOwner,epoch,sessionId:"trialshift",operationId:op(126),countedCashCents:6000};
  const trialSummary=await api.closeCash(trialClose);assert.equal(trialSummary.receivedCents,1450);assert.equal(trialSummary.expectedCashCents,6000);assert.equal(trialSummary.differenceCents,0);assert.deepEqual(await api.closeCash(trialClose),trialSummary);
  assert.equal((await read(setupCash)).activeSessionId,null);
  await assert.rejects(()=>api.openCash({...opening,sessionId:"newshift",operationId:op(127)}),e=>e.code==="license_required");
  await set(setupRoot,{...setupProfile,license:{status:"active",kind:"pro",term:"month1",expiresAt:sdk.Timestamp.fromMillis(now+86400000)}});
  assert.equal((await makeQuote(128)).totalCents,1450);assert.equal((await api.openCash({...opening,sessionId:"renewedshift",operationId:op(129)})).status,"open");
  console.log("PASS B02-G8 expiry during order: new quote/submit/cash/stock/config denied, existing payment/delivery/cancel/withdrawal/close and history allowed, no duplicate inventory, PRO renewal resumes.");
  const {runIntegratedBrowser}=require("./pdv_integrated_browser.cjs");
  const browserApi={...api,execute:args=>{now+=1000;return api.execute(args)},openCash:args=>{now+=1000;return api.openCash(args)},moveCash:args=>{now+=1000;return api.moveCash(args)},closeCash:args=>{now+=1000;return api.closeCash(args)}};
  await runIntegratedBrowser({api:browserApi,readCatalog:catalog,readQueue:(cursors={})=>readQueue({token:owner,storeIds:[online,counter],cursors}),catalogEditor:args=>approval.execute({...args,storeId:online,epoch}),setCatalogExpired:async expired=>set(root,expired?{...profile,license:{status:"active",kind:"trial",term:"trial7d",expiresAt:sdk.Timestamp.fromMillis(now)}}:profile),config:{ownerToken:owner,buyerToken:buyer,online,counter,epoch,products:revised.products.map(({id,title,priceCents,extras})=>({id,title,priceCents,extras:extras.map(e=>({id:e.id,title:addon.name,priceCents:e.priceCents}))}))},
   readSnapshot:async({includeOrders=true}={})=>{const orders=[];if(includeOrders)for(const id of [online,counter]){const docs=await sdk.getDocs(sdk.query(sdk.collection(db,store(id)+"/orders"),sdk.limit(50)));for(const d of docs.docs)orders.push(d.data())}
    const ptr=await read(cash),session=ptr.activeSessionId?await read(cash+"/sessions/"+ptr.activeSessionId):null;
    const shifts=await sdk.getDocs(sdk.collection(db,cash+"/sessions"));const lastClosed=shifts.docs.map(d=>d.data()).filter(x=>x.status==="closed").sort((a,b)=>b.closedAt-a.closedAt)[0]?.closedSummary??null;
    const stock=(await read(stockPath)).record.item.stock;return {orders,session,lastClosed,stock,inventory:[{id:"pot",title:"Batata",unit:"g",units:stock,scale:1}],now};
   },verifyAfter:async ({counter:counterOrder,online:onlineOrder,deliveryOrder})=>{
    assert.deepEqual(new Set([counterOrder,onlineOrder]),new Set(["P0000043","P0000044"]));
    assert.equal((await read(stockPath)).record.item.stock,800);
    const delivery=await read(store(online)+"/orders/"+deliveryOrder);assert.equal(delivery.status,"cancelled");assert.equal(delivery.totalCents,2550);assert.equal(delivery.fulfillment,"delivery");assert.equal(delivery.lines[0].extras[0].quantity,2);
    const events=await sdk.getDocs(sdk.collection(db,root+"/checkoutStockOperations"));assert.equal(events.size,4);const losses=events.docs.filter(d=>d.data().result.lossUnits>0).map(d=>d.data().result);assert.equal(losses.length,2);assert.equal(losses.reduce((n,x)=>n+x.lossCostCents,0),200);assert(losses.every(x=>x.costKnown&&x.costBasis==="replacement-at-adjustment"));assert.equal(events.docs.filter(d=>d.data().result.purchase?.totalCents===1200).length,1);
    assert.equal((await read(store(counter)+"/orders/"+counterOrder)).status,"delivered");
    assert.equal((await read(store(online)+"/orders/"+onlineOrder)).status,"delivered");
    const shifts=await sdk.getDocs(sdk.collection(db,cash+"/sessions"));const latest=shifts.docs.map(d=>d.data()).filter(x=>x.status==="closed").sort((a,b)=>b.closedAt-a.closedAt)[0];
    assert.equal(latest.closedSummary.expectedCashCents,7450);assert.equal(latest.closedSummary.differenceCents,-50);assert.equal(latest.closedSummary.receivedCents,2900);
    assert.deepEqual((await read(cash+"/sessions/shift1")).closedSummary,closed);
   }});
  console.log("PASS B02.13 integrated: 2 sales, 2900 cents gross, 1450 cents cash sales, 7450 expected drawer, -50 discrepancy, stock 0, lost-reply replay, private views, receipt, "+rows.length+" documents restored SHA-256 "+parsed.sha256);
 });
 }finally{if(restored)await restored.cleanup();await env.cleanup()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
