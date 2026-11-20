/* Teste transacional REAL do adaptador REST Cloudflare contra Firestore Emulator.
 * Somente projeto demo: nunca usa credenciais, estoque ou Firebase oficial.
 * Testa baixa, estorno e idempotência desde a rota HTTP até os documentos.
 */
'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const {initializeEmulator,sdk}=require('./qa/firestore/environment.cjs');
const URI='demo-pote-hardening',UID='qa-cloudflare-rest',UNIVERSE='batataria';
const op='ea2c547a-5ccb-4559-a73e-9da7d45b2af7';
const op2='99125c38-d9f2-437b-9745-dadd46a0c3c2';
const op3='7c285c3a-13a0-4678-b4da-c1c15e9488da';
const path=(group,id,keyFor)=>'users/'+UID+'/recordsV5/'+keyFor(UNIVERSE,group,id);
test('F05 Worker V5 REST: Firestore Emulator transacional com canário e sem dados reais',{timeout:60000},async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST==null)
  throw Error('Executar apenas dentro de firebase emulators:exec');
 const {createWorkerApp}=await import('./workers/antifraud/src/index.mjs');
 const {createFirestoreRepository}=await import('./workers/antifraud/src/firestore.mjs');
 const {keyFor}=await import('./workers/antifraud/src/domain.mjs');
 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==='1',
   cutover:process.env.POTE_F05_CUTOVER_RULES==='1'});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   const put=(p,v)=>sdk.setDoc(sdk.doc(db,p),v);
   await put('users/'+UID,{email:'cloudflare@example.test',
    license:{status:'active',kind:'lifetime',term:'lifetime'},
    accessPolicy:{workerAuthoritative:true}});
   await put('users/'+UID+'/appState/v5',{schemaVersion:5,
    state:{data:{businessType:UNIVERSE,businessUniverses:{},settings:{costBasis:'purchase'}}},
    updatedAt:sdk.serverTimestamp()});
   await put('users/'+UID+'/appState/v5InventoryGuard',{revision:0,updatedAt:sdk.serverTimestamp()});
   await put('users/'+UID+'/appState/v5Pulse',{eventId:'start',origin:'init',
    updatedAt:sdk.serverTimestamp()});
   const record=(group,id,item)=>({record:{universe:UNIVERSE,group,id,item,rank:1},
    updatedAt:sdk.serverTimestamp()});
   await put(path('ingredients','batata',keyFor),record('ingredients','batata',
    {id:'batata',name:'Batata',stock:2000,measureUnit:'g',
     purchaseQuantity:2,purchaseUnit:'kg',purchasePrice:12}));
   await put(path('orders','o1',keyFor),record('orders','o1',{
    id:'o1',status:'recebido',stockDeducted:false,qty:1,price:30,
    items:[{id:'batata',g:400,yieldPct:100}],beverageItems:[]}));
  });
  const config={ENABLE_WRITES:'true',CANARY_UIDS:UID,FIREBASE_PROJECT_ID:URI,
   ALLOWED_ORIGINS:'https://pdv.livresom.com'};
  const repository=()=>createFirestoreRepository(config,{
   accessToken:async()=> 'owner',
   apiBaseUrl:'http://'+process.env.FIRESTORE_EMULATOR_HOST+
    '/v1/projects/'+URI+'/databases/(default)',
   requestFetch:async(url,init)=>{
    const started=Date.now();
    try{
     const resp=await fetch(url,init);
     const endpoint=new URL(url).pathname.split('/').slice(-2).join('/');
     if(!resp.ok){
      console.log('QA_REST_ERROR',endpoint,'status',resp.status,'ms',Date.now()-started);
      const details=await resp.clone().text().catch(()=> '');
      console.log('QA_REST_FAILURE',details.slice(0,1200));
     }
     return resp;
    }catch(e){
     console.log('QA_REST_TRANSPORT_ERROR',e.name,String(e.message).slice(0,200),
      Date.now()-started);
     throw e;
    }
   }
  });
  const app=createWorkerApp({
   verify:async token=>{if(token!=='qa-token')throw Error('token inválido');
    return {uid:UID,email:'cloudflare@example.test',isAdmin:false}},
   repository,clock:()=>new Date('2026-11-20T22:30:00Z')
  });
  const call=async(route,body,override={})=>{
   const req=new Request('https://test.example'+route,{
    method:'POST',headers:{Origin:'https://pdv.livresom.com',Authorization:'Bearer qa-token',
     'Content-Type':'application/json'},body:JSON.stringify(body)});
   const res=await app.fetch(req,{...config,...override});
   const bodyOut=await res.json();
   return {status:res.status,body:bodyOut};
  };
  const loss={universe:UNIVERSE,group:'ingredients',itemId:'batata',delta:-100,
   lossReason:'higiene',note:'Lote descartado',reason:'loss',operationId:op};
  const deny=await call('/v1/inventory/adjust',loss,{CANARY_UIDS:''});
  assert.equal(deny.status,423);
  const first=await call('/v1/inventory/adjust',loss);
  assert.equal(first.status,200,JSON.stringify(first));
  assert.equal(first.body.afterStock,1900);
  const again=await call('/v1/inventory/adjust',loss);
  assert.equal(again.status,200);assert.equal(again.body.alreadyApplied,true);
  const produced=await call('/v1/orders/produce',{
   universe:UNIVERSE,orderId:'o1',operationId:op2});
  assert.equal(produced.status,200,JSON.stringify(produced));
  const cancelled=await call('/v1/orders/cancel',{
   universe:UNIVERSE,orderId:'o1',operationId:op3,decision:'return'});
  assert.equal(cancelled.status,200,JSON.stringify(cancelled));
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   const get=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
   const potato=await get(path('ingredients','batata',keyFor));
   const order=await get(path('orders','o1',keyFor));
   const lossDoc=await get(path('losses','cf-loss-'+op,keyFor));
   const guard=await get('users/'+UID+'/appState/v5InventoryGuard');
   const pulse=await get('users/'+UID+'/appState/v5Pulse');
   assert.equal(potato.record.item.stock,1900,'Produção estornada e perda mantida');
   assert.equal(order.record.item.status,'cancelado');
   assert.equal(lossDoc.record.item.costLost,0.6);
   assert.equal(guard.revision,3);
   assert.equal(pulse.sensitive,true);
  });
  // Dois clientes tentam dar baixa que não cabe duas vezes no mesmo estoque.
  const competing=[{...loss,operationId:'a0f50c7b-33fa-4307-85d4-3d7fb3e7ab10',delta:-1500},
   {...loss,operationId:'b0f50c7b-33fa-4307-85d4-3d7fb3e7ab11',delta:-1500}];
  const race=await Promise.all(competing.map(p=>call('/v1/inventory/adjust',p)));
  assert.deepEqual(race.map(x=>x.status).sort(),[200,409],
   'Estoque não pode ser descontado duas vezes por sessões concorrentes');
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   const potato=(await sdk.getDoc(sdk.doc(db,path('ingredients','batata',keyFor)))).data();
   const guard=(await sdk.getDoc(sdk.doc(db,'users/'+UID+'/appState/v5InventoryGuard'))).data();
   assert.equal(potato.record.item.stock,400);
   assert.equal(guard.revision,4);
  });
  const purchaseId='c0f52026-87ab-42d8-85b8-bc5dfb6e1140';
  const purchase={universe:UNIVERSE,group:'ingredients',itemId:'batata',
   delta:100,reason:'purchase',paidTotal:2,enteredQuantity:0.1,
   enteredUnit:'kg',supplier:'Fornecedor de homologação',operationId:purchaseId};
  const bought=await call('/v1/inventory/adjust',purchase);
  assert.equal(bought.status,200,JSON.stringify(bought));
  assert.equal(bought.body.afterStock,500);
  const duplicate=await call('/v1/inventory/adjust',purchase);
  assert.equal(duplicate.status,200);
  assert.equal(duplicate.body.alreadyApplied,true);
  const reused=await call('/v1/inventory/adjust',{...purchase,paidTotal:99});
  assert.equal(reused.status,409);
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   const get=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
   const potato=await get(path('ingredients','batata',keyFor));
   const receipt=await get(path('purchases','cf-purchase-'+purchaseId,keyFor));
   const movement=await get(path('stockMovements','cf-move-'+purchaseId,keyFor));
   const guard=await get('users/'+UID+'/appState/v5InventoryGuard');
   assert.equal(potato.record.item.stock,500);
   assert.equal(potato.record.item.averageUnitCost,0.0088);
   assert.equal(receipt.record.item.totalPaid,2);
   assert.equal(receipt.record.item.added,100);
   assert.equal(movement.record.item.referenceId,receipt.record.item.id);
   assert.equal(movement.record.item.quantity,100);
   assert.equal(guard.revision,5);
  });
  const recountId='d0f52026-87ab-42d8-85b8-bc5dfb6e1141';
  const recount={universe:UNIVERSE,group:'ingredients',itemId:'batata',
   reason:'recount',previousStock:500,countedStock:350,
   note:'Conferência no estoque físico',operationId:recountId};
  const recountResult=await call('/v1/inventory/adjust',recount);
  assert.equal(recountResult.status,200,JSON.stringify(recountResult));
  assert.equal(recountResult.body.afterStock,350);
  const repeatedRecount=await call('/v1/inventory/adjust',recount);
  assert.equal(repeatedRecount.status,200);
  assert.equal(repeatedRecount.body.alreadyApplied,true);
  const staleRecount=await call('/v1/inventory/adjust',{...recount,
   operationId:'d0f52026-87ab-42d8-85b8-bc5dfb6e1142',countedStock:100});
  assert.equal(staleRecount.status,409,"Tela desatualizada não pode sobrescrever estoque");
  const higherId='d0f52026-87ab-42d8-85b8-bc5dfb6e1143';
  const higher=await call('/v1/inventory/adjust',{
   ...recount,operationId:higherId,previousStock:350,countedStock:375,
   note:'Unidades encontradas em conferência'});
  assert.equal(higher.status,200,JSON.stringify(higher));
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   const get=async p=>(await sdk.getDoc(sdk.doc(db,p))).data();
   const potato=await get(path('ingredients','batata',keyFor));
   const physicalLoss=await get(path('losses','cf-recount-'+recountId,keyFor));
   const negativeMove=await get(path('stockMovements','cf-move-'+recountId,keyFor));
   const positiveMove=await get(path('stockMovements','cf-move-'+higherId,keyFor));
   const positiveLoss=await sdk.getDoc(sdk.doc(db,path('losses','cf-recount-'+higherId,keyFor)));
   const guard=await get('users/'+UID+'/appState/v5InventoryGuard');
   assert.equal(potato.record.item.stock,375);
   assert.equal(physicalLoss.record.item.quantityBase,150);
   assert.equal(physicalLoss.record.item.costLost,3);
   assert.equal(negativeMove.record.item.quantity,-150);
   assert.equal(positiveMove.record.item.quantity,25);
   assert.equal(positiveLoss.exists(),false,"Saldo encontrado não cria perda");
   assert.equal(guard.revision,7);
  });
  console.log('F05_REAL_EMULATOR_REST_PASS loss=-100g production=-400g return=400g purchase=100g recount=-150g+25g revision=7 concurrent=idempotent');
 }finally{await env.cleanup()}
});
