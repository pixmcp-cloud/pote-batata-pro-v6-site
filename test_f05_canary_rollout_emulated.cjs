/* Simulação do ciclo COMPLETO de ativação canário F05 e reversão.
 * Firebase Emulator + adaptador REST real + regras de corte candidato.
 * PROIBIDO executar no projeto produtivo: exige FIRESTORE_EMULATOR_HOST.
 */
'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const {initializeEmulator,sdk,assertFails,assertSucceeds}=require('./qa/firestore/environment.cjs');
const {recordId}=require('./v5_store_core.mjs');
const UID='qa-f05-canary-rollout',OTHER='qa-f05-legacy',U='batataria';
const path=(uid,group,id)=>'users/'+uid+'/recordsV5/'+recordId(U,group,id);
const stamp=()=>sdk.serverTimestamp();
const row=(group,id,item)=>({record:{universe:U,group,id,item,rank:1},updatedAt:stamp()});
const claims=(uid)=>({email:uid+'@example.test',email_verified:true,
 firebase:{sign_in_provider:'google.com'}});
test('F05 full canary: legacy → admin activation → server-only → rollback → legacy',{timeout:80000},async()=>{
 assert(process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')||
  process.env.FIRESTORE_EMULATOR_HOST?.startsWith('localhost:'),
  'Somente Firestore Emulator local');
 const {createWorkerApp}=await import('./workers/antifraud/src/index.mjs');
 const {createFirestoreRepository}=await import('./workers/antifraud/src/firestore.mjs');
 const emulator=await initializeEmulator({cutover:true});
 try{
  await emulator.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const uid of [UID,OTHER]){
    const base='users/'+uid;
    await sdk.setDoc(sdk.doc(db,base),{email:uid+'@example.test',
     license:{status:'active',kind:'lifetime',term:'lifetime'},
     accessPolicy:{workerAuthoritative:false}});
    await sdk.setDoc(sdk.doc(db,base+'/appState/v5'),{schemaVersion:5,
     state:{data:{businessType:U,businessUniverses:{}}},updatedAt:stamp()});
    await sdk.setDoc(sdk.doc(db,base+'/appState/v5InventoryGuard'),{revision:0,updatedAt:stamp()});
    await sdk.setDoc(sdk.doc(db,base+'/appState/v5Pulse'),
     {eventId:'seed-'+uid,updatedAt:stamp()});
    await sdk.setDoc(sdk.doc(db,path(uid,'ingredients','batata')),
     row('ingredients','batata',{id:'batata',name:'Batata',stock:2000,
      purchaseQuantity:2,purchaseUnit:'kg',purchasePrice:12,measureUnit:'g'}));
    if(uid===UID)await sdk.setDoc(sdk.doc(db,path(uid,'orders','o1')),
     row('orders','o1',{id:'o1',status:'recebido',qty:1,price:30,
      stockDeducted:false,items:[{id:'batata',g:400,yieldPct:100}],
      beverageItems:[]}));
   }
  });
  const admin=emulator.authenticatedContext('qa-master',{email:'pixmcp@gmail.com',
   email_verified:true,potebatataAdmin:true,
   firebase:{sign_in_provider:'google.com'}}).firestore();
  const browser=emulator.authenticatedContext(UID,claims(UID)).firestore();
  const legacy=emulator.authenticatedContext(OTHER,claims(OTHER)).firestore();
  let counter=0;
  async function directStock(db,uid,amount){
   return sdk.runTransaction(db,async tx=>{
    const stock=sdk.doc(db,path(uid,'ingredients','batata'));
    const guard=sdk.doc(db,'users/'+uid+'/appState/v5InventoryGuard');
    const pulse=sdk.doc(db,'users/'+uid+'/appState/v5Pulse');
    const [s,g,p]=await Promise.all([tx.get(stock),tx.get(guard),tx.get(pulse)]);
    tx.set(stock,{...s.data(),record:{...s.data().record,
     item:{...s.data().record.item,stock:amount}},updatedAt:stamp()});
    tx.set(guard,{revision:g.data().revision+1,updatedAt:stamp()});
    tx.set(pulse,{eventId:'qa-client-'+(++counter),previousEventId:p.data().eventId,
     origin:'qa-client',changedKeys:[recordId(U,'ingredients','batata')],
     metaChanged:false,sensitive:true,updatedAt:stamp()});
   });
  }
  const config={ENABLE_WRITES:'true',CANARY_UIDS:UID,
   FIREBASE_PROJECT_ID:'demo-pote-hardening',
   ALLOWED_ORIGINS:'https://pdv.livresom.com'};
  const api=createWorkerApp({
   verify:async(token)=>{if(token!=='fake-test-verified-google')throw Error('Bad QA token');
    return {uid:UID,email:UID+'@example.test',isAdmin:false}},
   repository:()=>createFirestoreRepository(config,{
    accessToken:async()=> 'owner',
    apiBaseUrl:'http://'+process.env.FIRESTORE_EMULATOR_HOST+
     '/v1/projects/demo-pote-hardening/databases/(default)',
    requestFetch:fetch
   }),
   clock:()=>new Date('2026-11-21T01:25:00Z')
  });
  const call=async(route,payload,opts={})=>{
   const res=await api.fetch(new Request('https://qa.example'+route,{
    method:'POST',headers:{Origin:'https://pdv.livresom.com',
     Authorization:'Bearer fake-test-verified-google',
     'Content-Type':'application/json'},body:JSON.stringify(payload)
   }),{...config,...opts});
   return {status:res.status,body:await res.json()};
  };
  const readStock=async(uid)=>{
   const db=uid===UID?browser:legacy;
   return (await sdk.getDoc(sdk.doc(db,path(uid,'ingredients','batata')))).data().record.item.stock;
  };
  const readRev=async(uid)=>{
   const db=uid===UID?browser:legacy;
   return (await sdk.getDoc(sdk.doc(db,'users/'+uid+'/appState/v5InventoryGuard'))).data().revision;
  };

  // BEFORE: official V5 browser operations allowed; Worker still refuses
  // even with a matching canary UID secret, because admin flag is false.
  await assertSucceeds(directStock(browser,UID,1900));
  let r=await call('/v1/orders/produce',{universe:U,orderId:'o1',
   operationId:'ec7a40ab-20da-46dc-8879-a43ea4ece315'});
  assert.equal(r.status,403,'Worker without admin opt-in must refuse: '+JSON.stringify(r));
  assert.equal(await readStock(UID),1900);

  // CUTOVER: admin enables one canary, bypassing direct SDK is forbidden.
  const profile=sdk.doc(admin,'users/'+UID);
  await assertSucceeds(sdk.updateDoc(profile,{'accessPolicy.workerAuthoritative':true}));
  await assertFails(directStock(browser,UID,1800));
  const operate={universe:U,orderId:'o1',
   operationId:'ec7a40ab-20da-46dc-8879-a43ea4ece315'};
  r=await call('/v1/orders/produce',operate);
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(await readStock(UID),1500);
  const retry=await call('/v1/orders/produce',operate);
  assert.equal(retry.status,200);assert.equal(retry.body.alreadyApplied,true);
  assert.equal(await readStock(UID),1500);
  const forged=await call('/v1/inventory/adjust',{
   universe:U,group:'ingredients',itemId:'batata',reason:'loss',
   delta:-100,lossReason:'higiene',note:'QA',
   operationId:'ec7a40ab-20da-46dc-8879-a43ea4ece316',uid:OTHER
  });
  assert.equal(forged.status,400);
  const blocked=await call('/v1/inventory/adjust',{
   universe:U,group:'ingredients',itemId:'batata',reason:'loss',
   delta:-100,lossReason:'higiene',note:'QA',
   operationId:'ec7a40ab-20da-46dc-8879-a43ea4ece317'
  },{CANARY_UIDS:'unrelated-tenant'});
  assert.equal(blocked.status,423);
  assert.equal(await readStock(UID),1500);

  // Two smartphones attempting a simultaneous 1000g loss.
  const losses=[18,19].map(n=>call('/v1/inventory/adjust',{
   universe:U,group:'ingredients',itemId:'batata',reason:'loss',
   delta:-1000,lossReason:'higiene',note:'QA',operationId:
   'ec7a40ab-20da-46dc-8879-a43ea4ece3'+String(n).padStart(2,'0')
  }));
  const raced=await Promise.all(losses);
  assert.deepEqual(raced.map(x=>x.status).sort(),[200,409]);
  assert.equal(await readStock(UID),500);
  r=await call('/v1/orders/cancel',{universe:U,orderId:'o1',decision:'return',
   operationId:'ec7a40ab-20da-46dc-8879-a43ea4ece320'});
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(await readStock(UID),900);
  assert.equal(await readRev(UID),4);

  // ROLLBACK: revoke only this tenant's policy; browser functionality
  // resumes, while Worker immediately rejects new operations.
  await assertSucceeds(sdk.updateDoc(profile,{'accessPolicy.workerAuthoritative':false}));
  const after=await call('/v1/inventory/adjust',{
   universe:U,group:'ingredients',itemId:'batata',reason:'loss',
   delta:-100,lossReason:'higiene',note:'QA',
   operationId:'ec7a40ab-20da-46dc-8879-a43ea4ece321'
  });
  assert.equal(after.status,403);
  await assertSucceeds(directStock(browser,UID,800));
  await assertSucceeds(directStock(legacy,OTHER,1900));
  assert.equal(await readStock(UID),800);
  assert.equal(await readStock(OTHER),1900);
  assert.equal(await readRev(UID),5);
  console.log('F05_SIMULATED_CANARY_ROLLOUT_ROLLBACK_PASS browserAllowedBefore=true serverOnlyDuring=true duplicate=0 race=1of2 browserAllowedAfter=true tenantsIsolated=true');
 }finally{await emulator.cleanup()}
});
