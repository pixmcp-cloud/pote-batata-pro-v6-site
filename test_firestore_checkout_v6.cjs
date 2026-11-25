/* Synthetic Firestore Emulator only. No real customers, payments or credentials. */
'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const {initializeEmulator,sdk}=require('./qa/firestore/environment.cjs');
const project='demo-pote-hardening',uid='qa-web-merchant-v6',universe='batataria',slug='qa-checkout-v6';
const now=Date.parse('2026-11-25T12:00:00Z');
test('D01: multi-item basket, one reservation, same guard and pulse, quote redemption and concurrent checkout',{timeout:120000},async()=>{
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
 const {commitPublicCheckout}=await import('./workers/antifraud/src/checkout_transaction.mjs');
 const {createFirestoreRepository}=await import('./workers/antifraud/src/firestore.mjs');
 const {recordPath,quantities}=await import('./workers/antifraud/src/domain.mjs');
 const {confirmPaymentOnSaleCompletion,orderAmountCents}=await import('./pdv_cash_core.mjs');
 const {buyerOrderView}=await import('./workers/antifraud/src/public_delivery_view.mjs');
 const env=await initializeEmulator();
 const root='users/'+uid,meta=root+'/appState/v5',guard=root+'/appState/v5InventoryGuard',pulse=root+'/appState/v5Pulse';
 const rp=(g,id)=>recordPath(uid,universe,g,id);
 const repository=createFirestoreRepository({FIREBASE_PROJECT_ID:project},{
  accessToken:async()=> 'owner',apiBaseUrl:'http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/'+project+'/databases/(default)'
 });
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore(),put=(p,v)=>sdk.setDoc(sdk.doc(db,p),v);
   const rec=(g,id,item,rank=0)=>put(rp(g,id),{record:{universe,group:g,id,item:{id,...item},rank},updatedAt:sdk.serverTimestamp()});
   await put(root,{license:{kind:'lifetime',term:'lifetime',status:'active'},accessPolicy:{workerAuthoritative:true,publicCheckout:true}});
   await put(meta,{schemaVersion:5,state:{data:{businessType:universe,orderSequenceLast:0,settings:{usePackagingStock:true}}},updatedAt:sdk.serverTimestamp()});
   await put(guard,{revision:0,updatedAt:sdk.serverTimestamp()});await put(pulse,{eventId:'start',updatedAt:sdk.serverTimestamp()});
   await put('publicMenus/'+slug,{slug,ownerUid:uid,published:true,businessType:universe,items:[{id:'batata',title:'Batata',priceCents:3000},{id:'bev-refri',title:'Refri',priceCents:700}]});
   await rec('recipes','batata',{items:[{id:'base',g:200}],packagingIngredientIds:['pote']});
   await rec('ingredients','base',{stock:750,yield:80,name:'Batata',measureUnit:'g',purchaseQuantity:1,purchasePrice:6,purchaseUnit:'kg'});
   await rec('ingredients','pote',{stock:10,name:'Pote',category:'Embalagem',measureUnit:'un',purchaseQuantity:10,purchasePrice:10,purchaseUnit:'un'});
   await rec('beverages','refri',{stock:10,name:'Refri',purchaseQuantity:12,purchasePrice:36,purchaseUnit:'un'});
   await rec('orders','balcao',{status:'recebido',stockDeducted:false,qty:1,items:[{id:'base',g:200,yieldPct:80}],beverageItems:[],orderNumber:1},-10);
  });
  const request={slug,operationId:'checkout-aaaa-00000000000001',lines:[{id:'batata',quantity:2,addonIds:[],note:''},{id:'bev-refri',quantity:1,addonIds:[],note:'Gelado'}],fulfillment:'entrega',payment:'pix',customerName:'Cliente QA',customerPhone:'48999999999',quoteId:'quote-00000000000000000001',totalCents:1};
  const quote={id:request.quoteId,uid:'buyer-a',slug,version:'v1',expiresAt:now+60000,feeCents:600,destination:{lat:-29,lon:-51},address:'Rua QA 10'};
  const run=(req=request,buyerUid='buyer-a',q=quote)=>commitPublicCheckout({repository,buyerUid,request:req,quote:q,deliveryConfigVersion:'v1',now});
  const first=await run();assert.equal(first.totalCents,7300);assert.equal(first.code,'#P0000002');assert.equal(first.alreadyApplied,false);
  assert.equal((await run()).alreadyApplied,true);
  await assert.rejects(()=>run({...request,customerName:'Outro'}),/idempotency_conflict/);
  await assert.rejects(()=>run({...request,operationId:'checkout-bbbb-00000000000002'}),/quote_already_used/);
  await assert.rejects(()=>run({...request,operationId:'checkout-cccc-00000000000003',fulfillment:'retirada',quoteId:null},'buyer-b',null),/insufficient_stock/);
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore(),get=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
   const o=(await get(rp('orders',first.orderId))).record.item;
   assert.equal(orderAmountCents(o),7300);assert.equal(o.qty,1);assert.equal(o.stockDeducted,false);
   assert.equal(quantities(o).get('ingredients:base'),500);
   assert.equal(quantities(o).get('ingredients:pote'),2);assert.equal(quantities(o).get('beverages:refri'),1);
   assert.equal(o.paymentStatus,'nao_pago');assert.equal(confirmPaymentOnSaleCompletion({orders:[{...o,status:'entregue'}],cashSessions:[]},{orderId:o.id}).recorded,false);
   assert.equal((await get(guard)).revision,1);assert.equal((await get(meta)).state.data.orderSequenceLast,2);assert.equal((await get(pulse)).sensitive,true);
   assert.equal((await get(rp('ingredients','base'))).record.item.stock,750);
   const receipt=await get('publicOrderReceipts/'+first.id);assert.equal(buyerOrderView(receipt,'buyer-a',now).totalCents,7300);
   assert.throws(()=>buyerOrderView(receipt,'buyer-b',now),/order_forbidden/);
   assert.equal((await get(root+'/deliveryUsageV6/2026-11')).count,1);
   // Replenish only for a synthetic race: 250g remain unreserved.
   await sdk.updateDoc(sdk.doc(db,rp('ingredients','base')),{'record.item.stock':1000});
  });
  const small={...request,lines:[{id:'batata',quantity:1,addonIds:[],note:''}],fulfillment:'retirada',quoteId:null};
  const races=await Promise.allSettled([run({...small,operationId:'checkout-race-00000000000001'},'buyer-c',null),run({...small,operationId:'checkout-race-00000000000002'},'buyer-d',null)]);
  assert.equal(races.filter(x=>x.status==='fulfilled').length,1,'Only one competing reservation may succeed');
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();const doc=await sdk.getDoc(sdk.doc(db,guard));assert.equal(doc.data().revision,2);
  });
  console.log('D01_EMULATOR_CHECKOUT_ATOMIC_PASS basket=7300 reserve=500g concurrent=1of2 duplicate=blocked payment=pending');
 }finally{await env.cleanup()}
});
