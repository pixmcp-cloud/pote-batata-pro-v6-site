// Teste negativo contra gravações diretas via SDK no projeto demo Firebase Emulator.
// Não conecta ao banco de produção.
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {doc,setDoc,updateDoc,runTransaction,serverTimestamp}=sdk;
(async()=>{
 const env=await initializeEmulator({hardened:false});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'users','free-stock'),{email:'free-stock@example.com'});
   await setDoc(doc(db,'users','pro-stock'),{email:'pro-stock@example.com',license:{status:'active',kind:'lifetime',term:'lifetime'}});
   for(const uid of ['free-stock','pro-stock']){
    await setDoc(doc(db,'users',uid,'appState','v2InventoryGuard'),{revision:0,updatedAt:serverTimestamp()});
    await setDoc(doc(db,'users',uid,'appState','v2Pulse'),{eventId:'seed',origin:'server',updatedAt:serverTimestamp()});
   }
  });
  const owner=uid=>env.authenticatedContext(uid,{email:uid+'@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const free=owner('free-stock'),pro=owner('pro-stock');
  let sequence=0;
  const edit=(reference,changes)=>runTransaction(reference.firestore,async tx=>{
   const uid=reference.path.split('/')[1],db=reference.firestore;
   const guard=doc(db,'users',uid,'appState','v2InventoryGuard');
   const pulse=doc(db,'users',uid,'appState','v2Pulse');
   const [g,p]=await Promise.all([tx.get(guard),tx.get(pulse)]);
   tx.update(reference,{...changes,updatedAt:serverTimestamp()});
   tx.set(guard,{revision:g.data().revision+1,updatedAt:serverTimestamp()});
   tx.set(pulse,{eventId:'stock-'+(++sequence),previousEventId:p.data().eventId,
    origin:'test',changedKeys:[reference.id],sensitive:true,updatedAt:serverTimestamp()});
  });
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
  await assertFails(updateDoc(proIngredient,{'record.item.stock':4900,updatedAt:serverTimestamp()}));
  await assertSucceeds(edit(proIngredient,{'record.item.stock':0}));
  await assertSucceeds(edit(proBeverage,{'record.item.stock':1.5}));
  await assertSucceeds(edit(proIngredient,{'record.item.name':'Batata Inglesa'}));
  console.log('PASS F02/F20: Firestore Rules bloqueiam estoque negativo/não numérico via SDK; estoque >= 0 e demais campos legítimos aceitos.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F02 INVENTORY RULES FAILED',e.stack||e);process.exitCode=1});
