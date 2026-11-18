const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {initializeEmulator,sdk}=require('./qa/firestore/environment.cjs');
const {doc,setDoc,getDoc,getDocs,collection,Timestamp}=sdk;
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({data:{businessType:'batataria',businessUniverses:{},recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[],settings:{},brand:{name:'Teste'}}});
function installStarterModels(state){
 const read=file=>readFileSync(path.join(__dirname,file),'utf8');
 const source=read('source/pote_app_base.html');
 const model=JSON.parse(source.match(/<script id="backup" type="application\/json">([\s\S]+?)<\/script>/)[1]);
 const context=vm.createContext({window:{}});
 for(const module of ['universe_core.js','beverage_catalog.js'])vm.runInContext(read(module),context);
 context.window.POTE_UNIVERSES.switchTo(state,'batataria',model);
 context.window.POTE_DRINKS.ensure(state);
}
(async()=>{
 const {createV2Store}=await import('./v2_storage.mjs');
 const env=await initializeEmulator({hardened:true});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),'users','free-client'),{email:'free-client@example.com'});
   await setDoc(doc(ctx.firestore(),'users','free-with-models'),{email:'free-with-models@example.com'});
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
  const pulse=doc(free.db,'users','free-client','appState','v2Pulse');
  const priorEvent=(await getDoc(pulse)).data().eventId;
  free.mutate(s=>s.data.businessUniverses.pizzaria={recipes:[{id:'mine-extra',name:'Pizza teste'}]});
  assert.equal((await free.store.save()).ok,true);
  const remote=(await getDoc(pulse)).data();
  assert.equal((await restored.store.refresh(remote,priorEvent)).incremental,true,
   'A atualização incremental precisa reconhecer chaves Free');
  assert.equal(restored.read().data.businessUniverses.pizzaria.recipes[0].id,'mine-extra');
  const globalSlot=doc(free.db,'users','free-client','records','free~extra~recipes');
  free.mutate(s=>s.data.businessUniverses.pastelaria={recipes:[{id:'mine-extra2',name:'Pastel teste'}]});
  const collision=await free.store.save();
  assert.equal(collision.code,'free/limit');
  assert.equal((await getDoc(globalSlot)).data().record.id,'mine-extra',
   'Outra filial não pode substituir silenciosamente o cadastro existente');
  const starter=actor('free-with-models',true);
  assert((await starter.store.load()).created);
  starter.mutate(installStarterModels);
  const catalog=starter.read().data;
  assert(catalog.recipes.length>20&&catalog.ingredients.length>40);
  assert.equal(catalog.beverages.length,11);
  assert.equal(catalog.combos.length,1);
  const savedStarter=await starter.store.save();
  assert(savedStarter.ok,JSON.stringify(savedStarter));
  starter.mutate(s=>{
   s.data.ingredients.find(row=>row.id==='batata').stock=10000;
   s.data.beverages.find(row=>row.id==='preset-guarana-lata').stock=5;
  });
  assert((await starter.store.save()).ok,'A conta Free pode registrar saldo nos modelos existentes');
  starter.mutate(s=>{
   s.data.ingredients.find(row=>row.id==='batata').stock-=2000;
   s.data.beverages.find(row=>row.id==='preset-guarana-lata').stock-=2;
   s.data.orders.push({id:'starter-order',qty:2,status:'em_producao'});
   s.data.stockMovements.push({id:'m-starter-potato',ingredientId:'batata',quantity:-2000,previousStock:10000,afterStock:8000,reason:'Produção',referenceId:'starter-order'});
   s.data.stockMovements.push({id:'m-starter-cola',ingredientId:'bev:preset-guarana-lata',quantity:-2,previousStock:5,afterStock:3,reason:'Bebida vendida',referenceId:'starter-order'});
  });
  assert((await starter.store.save()).ok,'Pedido e baixas podem ser gravados numa transação V2');
  const reopenedStarter=actor('free-with-models',true);
  await reopenedStarter.store.load();
  const reopened=reopenedStarter.read().data;
  assert.equal(reopened.ingredients.find(row=>row.id==='batata').stock,8000);
  assert.equal(reopened.beverages.find(row=>row.id==='preset-guarana-lata').stock,3);
  assert.equal(reopened.orders[0].id,'starter-order');
  starter.mutate(s=>s.data.beverages.push({id:'personal-drink',name:'Bebida própria',stock:0}));
  assert((await starter.store.save()).ok,'Os modelos deixam livre a cota da primeira bebida própria');
  starter.mutate(s=>s.data.beverages.push({id:'second-drink',name:'Outra bebida',stock:0}));
  assert.equal((await starter.store.save()).code,'free/limit');
  const premium=actor('pro-client',false);
  assert((await premium.store.load()).created);
  premium.mutate(s=>s.data.recipes.push({id:'p1',name:'A'},{id:'p2',name:'B'}));
  assert((await premium.store.save()).ok,'Pro must save two custom recipes');
  assert.equal((await getDocs(collection(premium.db,'users','pro-client','records'))).size,2);
  [free,restored,starter,reopenedStarter,premium].forEach(a=>a.store.dispose());
  console.log('PASS F19 Firestore Emulator V2 client: cadastro e edição Free, segunda receita recusada, substituição explícita, atualização incremental, colisão entre universos segura e múltiplas Pro.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F19 CLIENT INTEGRATION FAILED',e.stack||e);process.exitCode=1});
