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
 const digest=x=>crypto.createHash("sha256").update(JSON.stringify(canonical(x))).digest("hex");
 // Bounded fixture manifest: includes every collection written by this scenario.
 // This is NOT a general Firestore exporter; no real account or unknown collections.
 const roots=[root,cash,store(online),store(counter)];
 const collections=[root+"/appState",root+"/recordsV5",cash+"/sessions",cash+"/receipts",cash+"/refunds",...[online,counter].flatMap(s=>["meta","orders","customerViews","quotes","operations","schedulerOperations","stockLedger","losses"].map(k=>store(s)+"/"+k))];
 async function snapshot(db){
  const rows=[];
  for(const p of roots){const d=await sdk.getDoc(sdk.doc(db,p));assert(d.exists());rows.push({path:p,data:d.data()})}
  for(const p of collections){const docs=await sdk.getDocs(sdk.query(sdk.collection(db,p),sdk.limit(91)));assert(docs.size<=90);for(const d of docs.docs)rows.push({path:d.ref.path,data:d.data()})}
  assert(rows.length<=90);return rows.sort((a,b)=>a.path.localeCompare(b.path));
 }
 try{await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),set=(p,x)=>sdk.setDoc(sdk.doc(db,p),x),read=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
  await set(root,{license:{status:"active",kind:"lifetime",term:"lifetime"},accessPolicy:{checkoutAuthority:"server-only",checkoutEpoch:epoch}});
  await set(root+"/appState/v5",{schemaVersion:5,state:{data:{businessType:universe,settings,orderSequenceLast:40}}});
  await set(root+"/appState/v5InventoryGuard",{revision:0});await set(root+"/appState/v5Pulse",{eventId:"seed"});
  for(const [g,item] of [["ingredients",ingredient],["recipes",recipe],["expenses",expense]])await set(root+"/recordsV5/"+keyFor(universe,g,item.id),rec(g,item));
  for(const id of [online,counter]){await set(store(id),{...manifest,channel:id===counter?"counter":"online"});await set(store(id)+"/meta/sequence",{value:0})}
  await set(cash,{activeSessionId:"shift1"});await set(cash+"/sessions/shift1",{id:"shift1",ownerUid:owner,status:"open",openedAt:now-1000,revision:0,totals:{cash:0,pix:0,card:0,count:0}});
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
  assert.match(orderPrintText(await read(salePath)),/Tempo total:/);
  const beforeClose=await read(cash+"/sessions/shift1");assert.deepEqual(beforeClose.totals,{cash:1450,pix:1450,card:0,count:2});
  const close=()=>api.closeCash({token:owner,sessionId:"shift1",operationId:op(20)});
  const closed=await close();assert.equal(closed.receivedCents,2900);assert.equal(closed.cashDrawerIncreaseCents,1450);assert.deepEqual(await close(),closed);
  assert.equal((await read(cash)).activeSessionId,null);
  // Export the quiescent synthetic fixture with all written collection paths.
  const rows=await snapshot(db),serialized=JSON.stringify({version:1,rows,sha256:digest(rows)});
  const parsed=JSON.parse(serialized);assert.equal(digest(parsed.rows),parsed.sha256);
  const tampered=JSON.parse(serialized);tampered.rows[0].data={changed:true};assert.notEqual(digest(tampered.rows),parsed.sha256);
  restored=await initializeTestEnvironment({projectId:restoreProject,firestore:{rules}});
  await restored.withSecurityRulesDisabled(async rctx=>{
   const target=rctx.firestore();for(const row of parsed.rows){const existing=await sdk.getDoc(sdk.doc(target,row.path));assert(!existing.exists(),"restore target not empty")}
   const batch=sdk.writeBatch(target);for(const row of parsed.rows)batch.set(sdk.doc(target,row.path),row.data);await batch.commit();
   const restoredRows=await snapshot(target);assert.equal(digest(restoredRows),parsed.sha256);
   assert.equal((await sdk.getDoc(sdk.doc(target,stockPath))).data().record.item.stock,0);
   assert.deepEqual((await sdk.getDoc(sdk.doc(target,cash+"/sessions/shift1"))).data().closedSummary,closed);
   assert.equal((await sdk.getDoc(sdk.doc(target,root+"/appState/v5"))).data().state.data.orderSequenceLast,42);
  });
  console.log("PASS B02.12 integrated: 2 sales, 2900 cents gross, 1450 cents cash, stock 0, lost-reply replay, private views, receipt, "+rows.length+" documents restored SHA-256 "+parsed.sha256);
 });
 }finally{if(restored)await restored.cleanup();await env.cleanup()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
