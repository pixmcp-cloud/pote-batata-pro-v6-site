// Teste exclusivo do Firestore Emulator: nenhum dado de producao e usado.
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {doc,getDoc,setDoc,updateDoc,serverTimestamp}=sdk;
let env;
(async()=>{
 env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==='1'});
 const actor=(uid,email,claims={})=>env.authenticatedContext(uid,{
  email,email_verified:true,firebase:{sign_in_provider:'google.com'},...claims}).firestore();
 const free=actor('free-uid','free@example.com');
 const pro=actor('pro-uid','pro@example.com');
 const wrong=actor('other-uid','other@example.com');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'users','free-uid'),{email:'free@example.com'});
  await setDoc(doc(db,'users','pro-uid'),{email:'pro@example.com',
   license:{kind:'lifetime',term:'lifetime',status:'active'}});
 });
 const at=()=>serverTimestamp();
 const path=(db,id)=>doc(db,'users','free-uid','appState',id);
 await assertSucceeds(setDoc(path(free,'v5'),{schemaVersion:5,state:{data:{businessType:'batataria'}},updatedAt:at()}));
 await assertSucceeds(setDoc(path(free,'v5InventoryGuard'),{revision:0,updatedAt:at()}));
 await assertSucceeds(setDoc(path(free,'v5Pulse'),{eventId:'init-v5',origin:'test',updatedAt:at()}));
 await assertSucceeds(getDoc(path(free,'v5')));
 await assertFails(getDoc(path(wrong,'v5')));
 await assertFails(setDoc(path(free,'main'),{state:{orders:[]}}));
 await assertFails(setDoc(path(free,'v2'),{schemaVersion:2,state:{},updatedAt:at()}));
 await assertFails(getDoc(path(free,'main')));
 await assertFails(setDoc(path(free,'v2Pulse'),{eventId:'legacy',updatedAt:at()}));
 await assertFails(setDoc(doc(free,'users','free-uid','orders','legacy-1'),{status:'created'}));
 await assertFails(setDoc(doc(free,'users','free-uid','records','legacy-1'),{record:{}}));
 await assertSucceeds(updateDoc(path(free,'v5InventoryGuard'),{revision:1,updatedAt:at()}));
 await assertFails(updateDoc(path(free,'v5InventoryGuard'),{revision:3,updatedAt:at()}));
 const ingredient={universe:'batataria',group:'ingredients',id:'custom-flour',
  item:{id:'custom-flour',name:'Farinha',stock:0,measureUnit:'g'},rank:1};
 await assertSucceeds(setDoc(doc(free,'users','free-uid','recordsV5','free~base~ingredients'),
  {record:ingredient,updatedAt:at()}));
 await assertFails(getDoc(doc(wrong,'users','free-uid','recordsV5','free~base~ingredients')));
 await assertFails(setDoc(doc(free,'users','free-uid','recordsV5','direct-order'),{
  record:{universe:'batataria',group:'orders',id:'direct-order',
   item:{id:'direct-order',status:'recebido',qty:1,price:29.9},rank:1},updatedAt:at()}));
 const cash=(status,additional={})=>({
  record:{universe:'batataria',group:'cashSessions',id:'caixa-1',
   item:{id:'caixa-1',status,openingCash:0,operator:'QA',
    ...(status==='closed'?{closedAt:'2026-11-20T19:00:00Z',
     closedSummary:{expectedCash:0,expectedCashCents:0},
     closedBy:'QA',countedCash:0,expectedCash:0,difference:0}:{}),...additional},
   rank:0},updatedAt:at()});
 const c=doc(pro,'users','pro-uid','recordsV5','caixa-1');
 await assertSucceeds(setDoc(c,cash('open')));
 await assertSucceeds(setDoc(c,cash('closed')));
 await assertFails(setDoc(c,cash('open')));
 console.log('PASS V5 Emulator: isolamento, dados legados bloqueados, cadastro Free, caixa Pro, guarda e pedido atomico.');
})().catch(e=>{console.error('V5 EMULATOR FAIL',e.stack||e);process.exitCode=1})
.finally(async()=>{if(env)await env.cleanup()});
