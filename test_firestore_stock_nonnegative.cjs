// Teste negativo contra gravações diretas via SDK no projeto demo Firebase Emulator.
// Não conecta ao banco de produção.
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {doc,setDoc,updateDoc,serverTimestamp}=sdk;
(async()=>{
 const env=await initializeEmulator({hardened:false});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'users','free-stock'),{email:'free-stock@example.com'});
   await setDoc(doc(db,'users','pro-stock'),{email:'pro-stock@example.com',license:{status:'active',kind:'lifetime',term:'lifetime'}});
  });
  const owner=uid=>env.authenticatedContext(uid,{email:uid+'@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const free=owner('free-stock'),pro=owner('pro-stock');
  const edit=(reference,changes)=>updateDoc(reference,{...changes,updatedAt:serverTimestamp()});
  const payload=(universe,group,id,item)=>({record:{universe,group,id,item:{id,...item},rank:0},updatedAt:serverTimestamp()});
  const freeIngredient=doc(free,'users','free-stock','records','model~batataria~ingredients~batata');
  const proIngredient=doc(pro,'users','pro-stock','records','custom-batata');
  const proBeverage=doc(pro,'users','pro-stock','records','custom-agua');
  await assertSucceeds(setDoc(freeIngredient,payload('batataria','ingredients','batata',{name:'Batata',stock:10000})));
  await assertSucceeds(setDoc(proIngredient,payload('batataria','ingredients','x1',{name:'Batata',stock:5000})));
  await assertSucceeds(setDoc(proBeverage,payload('batataria','beverages','drink1',{name:'Água',stock:10})));
  await assertFails(edit(freeIngredient,{'record.item.stock':-100}));
  await assertFails(edit(proIngredient,{'record.item.stock':-1}));
  await assertFails(edit(proBeverage,{'record.item.stock':-1}));
  await assertFails(edit(proIngredient,{'record.item.stock':'10000'}));
  await assertSucceeds(edit(proIngredient,{'record.item.stock':0}));
  await assertSucceeds(edit(proBeverage,{'record.item.stock':1.5}));
  await assertSucceeds(edit(proIngredient,{'record.item.name':'Batata Inglesa'}));
  console.log('PASS F02/F20: Firestore Rules bloqueiam estoque negativo/não numérico via SDK; estoque >= 0 e demais campos legítimos aceitos.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F02 INVENTORY RULES FAILED',e.stack||e);process.exitCode=1});
