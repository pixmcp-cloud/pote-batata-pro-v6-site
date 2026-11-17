const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire('C:/Users/LIVRESOM/Documents/GitHub/_POTE_OFFLINE_TEST_TOOLS/package.json');
const {initializeTestEnvironment}=req('@firebase/rules-unit-testing');
const sdk=req('firebase/firestore');
const {doc,setDoc,getDocs,collection,Timestamp}=sdk;
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({data:{businessType:'batataria',businessUniverses:{},recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[],settings:{},brand:{name:'Teste'}}});
(async()=>{
 const {createV2Store}=await import('./v2_storage.mjs');
 const env=await initializeTestEnvironment({projectId:'demo-pote-hardening',firestore:{host:'127.0.0.1',port:8793,rules:fs.readFileSync(path.join(__dirname,'firestore.hardened.rules'),'utf8')}});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),'users','free-client'),{email:'free-client@example.com'});
   await setDoc(doc(ctx.firestore(),'users','pro-client'),{email:'pro-client@example.com',license:{status:'active',kind:'pro',expiresAt:Timestamp.fromMillis(Date.now()+7200000)}});
  });
  function actor(uid,isFree){
   const db=env.authenticatedContext(uid,{email:uid+'@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
   global.window={POTE_AUTH:{uid,proActive:!isFree}};
   let state=initial();
   const store=createV2Store({uid,db,sdk,fresh:()=>{state=initial()},snapshot:()=>clone(state),apply:s=>{state=clone(s)},status:()=>{}});
   return {store,db,mutate:f=>f(state),read:()=>clone(state)};
  }
  const free=actor('free-client',true);
  assert((await free.store.load()).created);
  free.mutate(s=>s.data.recipes.push({id:'mine1',name:'Meu primeiro'}));
  assert((await free.store.save()).ok,'Free first custom recipe must save');
  assert.equal((await getDocs(collection(free.db,'users','free-client','records'))).size,1);
  free.mutate(s=>s.data.recipes[0].name='Meu primeiro atualizado');
  assert((await free.store.save()).ok,'Free can edit existing card');
  free.mutate(s=>s.data.recipes.push({id:'mine2',name:'Segundo não autorizado'}));
  assert(!(await free.store.save()).ok,'Free cannot add a second custom recipe');
  free.mutate(s=>s.data.recipes.splice(0,1));
  assert((await free.store.save()).ok,'Free can replace the single record');
  assert.equal((await getDocs(collection(free.db,'users','free-client','records'))).size,1);
  const restored=actor('free-client',true);
  await restored.store.load();
  assert.equal(restored.read().data.recipes.length,1);
  assert.equal(restored.read().data.recipes[0].id,'mine2');
  const premium=actor('pro-client',false);
  assert((await premium.store.load()).created);
  premium.mutate(s=>s.data.recipes.push({id:'p1',name:'A'},{id:'p2',name:'B'}));
  assert((await premium.store.save()).ok,'Pro must save two custom recipes');
  assert.equal((await getDocs(collection(premium.db,'users','pro-client','records'))).size,2);
  [free,restored,premium].forEach(a=>a.store.dispose());
  console.log('PASS F19 Firestore Emulator V2 client: new Free account, first recipe, edit, second blocked, replace, reload, Pro two allowed.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F19 CLIENT INTEGRATION FAILED',e.stack||e);process.exitCode=1});
