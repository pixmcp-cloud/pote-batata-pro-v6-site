// Test real Firebase Firestore transaction semantics against local demo Emulator.
// Does not contact a production project or persist account data remotely.
const assert=require('node:assert/strict');
const { initializeEmulator, assertFails, sdk } = require('./qa/firestore/environment.cjs');
const initial=()=>({data:{businessType:'batataria',businessUniverses:{},recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[],purchases:[],stockMovements:[],losses:[],brand:{name:'Teste'},settings:{}}});
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const {createV2Store}=await import('./v2_storage.mjs');
 const testEnv=await initializeEmulator();
 const uid='virtual-checkout-user';
 const stores=[];
 try{
  await testEnv.withSecurityRulesDisabled(async context=>{
   await sdk.setDoc(sdk.doc(context.firestore(),'users',uid),{email:'teste@example.com',displayName:'Test User'});
  });
  const actor=()=>{
   const db=testEnv.authenticatedContext(uid,{email:'teste@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
   let state=initial();
   const store=createV2Store({uid,db,sdk,fresh:()=>{state=initial()},snapshot:()=>clone(state),apply:v=>{state=clone(v)},status:()=>{}});
   stores.push(store);
   return {store,mutate:fn=>fn(state),read:()=>clone(state)};
  };
  const seed=actor();await seed.store.load();
  seed.mutate(s=>s.data.ingredients.push({id:'batata',stock:10,measureUnit:'g'}));
  let r=await seed.store.save();assert(r.ok,JSON.stringify(r));
  const a=actor(),b=actor();await Promise.all([a.store.load(),b.store.load()]);
  a.mutate(s=>{s.data.orderSequenceLast=1;s.data.ingredients[0].stock=2;s.data.orders.push({id:'order-1',orderNumber:1,qty:8,status:'em_producao',stockDeducted:true});s.data.stockMovements.push({id:'m-1',ingredientId:'batata',quantity:-8,previousStock:10,afterStock:2,reason:'Produção',referenceId:'order-1'})});
  b.mutate(s=>{s.data.orderSequenceLast=1;s.data.ingredients[0].stock=2;s.data.orders.push({id:'order-2',orderNumber:1,qty:8,status:'em_producao',stockDeducted:true});s.data.stockMovements.push({id:'m-2',ingredientId:'batata',quantity:-8,previousStock:10,afterStock:2,reason:'Produção',referenceId:'order-2'})});
  const [ra,rb]=await Promise.all([a.store.save(),b.store.save()]);
  assert.equal(Number(ra.ok)+Number(rb.ok),1,'only one order may commit: '+JSON.stringify([ra,rb]));
  assert(['sync/conflict','permission-denied'].includes((ra.ok ? rb : ra).code),
    'the second checkout must be rejected by revision conflict or hardened server rules: '+JSON.stringify([ra,rb]));
  const readback=actor();await readback.store.load();
  assert.equal(readback.read().data.ingredients[0].stock,2);
  assert.equal(readback.read().data.orders.length,1);
  assert.equal(readback.read().data.orderSequenceLast,1);
  assert.equal(readback.read().data.orders[0].orderNumber,1);
  const duplicate=actor();await duplicate.store.load();
  duplicate.mutate(s=>{s.data.orders.push({id:'invalid-order',orderNumber:1,status:'recebido',qty:1})});
  const rejected=await duplicate.store.save();
  assert.equal(rejected.ok,false,'Duplicated sequence cannot be committed');
  const later=actor();await later.store.load();
  later.mutate(s=>{s.data.orderSequenceLast=2;s.data.orders.push({id:'order-next',orderNumber:2,status:'recebido',qty:1})});
  const saved=await later.store.save();
  assert(saved.ok,JSON.stringify(saved));
  const readFinal=actor();await readFinal.store.load();
  assert.deepEqual(readFinal.read().data.orders.map(x=>x.orderNumber).sort((x,y)=>x-y),[1,2]);
  assert.equal(readFinal.read().data.orderSequenceLast,2);
  const attemptReset=actor();await attemptReset.store.load();
  attemptReset.mutate(s=>{s.data.orderSequenceLast=0;s.data.orders=[]});
  const declined=await attemptReset.store.save();
  assert.equal(declined.ok,false,'Old backups must not reset business numbering');
  assert.equal(declined.code,'sync/invalid-state');
  const tenant2='virtual-other-user';
  const otherDb=testEnv.authenticatedContext(tenant2,{email:'other@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  await assertFails(sdk.getDoc(sdk.doc(otherDb,'users',uid,'records','anything')));
  console.log('PASS real Firestore Emulator: concurrent V2 checkout rejects second 8/10 order; one atomic stock record persists; other UID denied.');
 }finally{
  for(const store of stores)store.dispose();
  await testEnv.cleanup();
 }
})().catch(e=>{console.error('FIRESTORE REAL TRANSACTION TEST FAILED:',e.stack||e);process.exitCode=1});
