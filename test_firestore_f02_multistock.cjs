// F02: muitos ingredientes + bebidas e dois caixas concorrendo pelo mesmo saldo.
// Prova limite de regras por transação usando o projeto demo do Firestore Emulator.
const assert=require('node:assert/strict');
const {initializeEmulator,sdk}=require('./qa/firestore/environment.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({data:{businessType:'batataria',businessUniverses:{},
 recipes:[],ingredients:[],beverages:[],orders:[],stockMovements:[],clients:[],suppliers:[],
 expenses:[],settings:{},brand:{name:'Teste F02'}}});
(async()=>{
 const {createV2Store}=await import('./v2_storage.mjs');
 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==='1'});
 const uid='f02-multi';
 const actors=[];
 try{
  await env.withSecurityRulesDisabled(ctx=>sdk.setDoc(sdk.doc(ctx.firestore(),'users',uid),{
   email:'f02-multi@example.com',license:{status:'active',kind:'lifetime',term:'lifetime'}
  }));
  function actor(){
   let state=fresh();
   const db=env.authenticatedContext(uid,{email:'f02-multi@example.com',
    email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
   const store=createV2Store({uid,db,sdk,fresh:()=>{state=fresh()},
    snapshot:()=>clone(state),apply:x=>{state=clone(x)}});
   const a={store,mutate:f=>f(state),read:()=>clone(state)};actors.push(a);return a;
  }
  const seed=actor();await seed.store.load();
  seed.mutate(s=>{
   for(let i=0;i<20;i++)s.data.ingredients.push({id:'i-'+i,name:'Insumo '+i,stock:3,measureUnit:'g'});
   for(let i=0;i<4;i++)s.data.beverages.push({id:'b-'+i,name:'Bebida '+i,stock:3,measureUnit:'un'});
  });
  assert((await seed.store.save()).ok);
  const a=actor(),b=actor();
  await Promise.all([a.store.load(),b.store.load()]);
  function checkout(state,orderId){
   for(const ing of state.data.ingredients){
    ing.stock=1;
    state.data.stockMovements.push({id:'move-'+orderId+'-'+ing.id,
     ingredientId:ing.id,quantity:-2,previousStock:3,afterStock:1,
     reason:'Produção',referenceId:orderId});
   }
   for(const bev of state.data.beverages){
    bev.stock=1;
    state.data.stockMovements.push({id:'move-'+orderId+'-'+bev.id,
     ingredientId:'bev:'+bev.id,quantity:-2,previousStock:3,afterStock:1,
     reason:'Bebida vendida',referenceId:orderId});
   }
   state.data.orders.push({id:orderId,status:'em_producao',stockDeducted:true,qty:1,
    items:state.data.ingredients.map(i=>({id:i.id,g:2,yieldPct:100})),
    beverageItems:state.data.beverages.map(i=>({id:i.id,qty:2}))});
  }
  a.mutate(s=>checkout(s,'checkout-a'));b.mutate(s=>checkout(s,'checkout-b'));
  const results=await Promise.all([a.store.save(),b.store.save()]);
  assert.equal(results.filter(x=>x.ok).length,1,JSON.stringify(results));
  assert(results.some(x=>!x.ok&&['sync/conflict','permission-denied'].includes(x.code)),
   JSON.stringify(results));
  const verify=actor();await verify.store.load();
  assert.equal(verify.read().data.orders.length,1);
  assert(verify.read().data.ingredients.every(i=>i.stock===1));
  assert(verify.read().data.beverages.every(i=>i.stock===1));
  assert.equal(verify.read().data.stockMovements.length,24);
  console.log('PASS F02 multiestoque: 20 insumos + 4 bebidas + 24 movimentos + pedido em uma transação; só um checkout concorrente confirma.');
 }finally{actors.forEach(a=>a.store.dispose());await env.cleanup()}
})().catch(e=>{console.error('F02 MULTI-STOCK FAILED:',e.stack||e);process.exitCode=1});
