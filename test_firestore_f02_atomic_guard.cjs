// F02 - O servidor exige revisão + notificação V2 atômicas, sem backend pago.
// Esses testes usam apenas um projeto demo no Firebase Emulator.
const assert=require('node:assert/strict');
const {initializeEmulator,assertFails,assertSucceeds,sdk}=require('./qa/firestore/environment.cjs');
const {doc,setDoc,updateDoc,deleteDoc,runTransaction,serverTimestamp}=sdk;

(async()=>{
 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==='1'});
 const uid='f02-atomic-user';
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'users',uid),{email:'f02-atomic@example.com',license:{status:'active',kind:'lifetime',term:'lifetime'}});
   await setDoc(doc(db,'users',uid,'appState','v2InventoryGuard'),{revision:0,updatedAt:serverTimestamp()});
   await setDoc(doc(db,'users',uid,'appState','v2Pulse'),{eventId:'seed',origin:'server',updatedAt:serverTimestamp()});
  });
  const db=env.authenticatedContext(uid,{
   email:'f02-atomic@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}
  }).firestore();
  const ref=(id)=>doc(db,'users',uid,'records',id);
  const guard=doc(db,'users',uid,'appState','v2InventoryGuard');
  const pulse=doc(db,'users',uid,'appState','v2Pulse');
  const ingredient=ref('ingredient-1');
  const order=ref('order-1');
  const record=(group,id,item)=>({record:{universe:'batataria',group,id,item:{id,...item},rank:0},
    updatedAt:serverTimestamp()});

  // Saldos de abertura são legítimos: estoque nunca pode ficar negativo.
  await assertSucceeds(setDoc(ingredient,record('ingredients','batata',{stock:10,measureUnit:'g'})));
  await assertFails(setDoc(order,record('orders','order-1',{status:'recebido',stockDeducted:false,qty:1})));
  // Pedido legado simulado; alterações seguintes devem seguir o novo protocolo.
  await env.withSecurityRulesDisabled(ctx=>setDoc(
   doc(ctx.firestore(),'users',uid,'records','order-1'),
   record('orders','order-1',{status:'recebido',stockDeducted:false,qty:1})));

  // A API direta não pode contornar a confirmação transacional do V2.
  await assertFails(updateDoc(ingredient,{'record.item.stock':8,updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(ingredient));
  const ledger=ref('movement-1');
  const movement=()=>record('stockMovements','movement-1',{
   ingredientId:'batata',quantity:-2,previousStock:10,afterStock:8,reason:'Produção',referenceId:'order-1'});
  await assertFails(setDoc(ledger,movement()));
  await assertFails(updateDoc(order,{'record.item.status':'em_producao','record.item.stockDeducted':true,updatedAt:serverTimestamp()}));
  await assertFails(setDoc(ref('fake-produced'),record('orders','fake-produced',{status:'em_producao',stockDeducted:true,qty:1})));

  async function commit({value=8,event='event-1',keys=['ingredient-1'],notify=true,moveOrder=false,ledgerWrite=false,chainWrong=false}={}){
   return runTransaction(db,async tx=>{
    const [g,prev]=await Promise.all([tx.get(guard),tx.get(pulse)]);
    const revision=g.data().revision+1;
    tx.update(ingredient,{'record.item.stock':value,updatedAt:serverTimestamp()});
    if(ledgerWrite)tx.set(ledger,movement());
    if(moveOrder)tx.update(order,{
     'record.item.status':'em_producao','record.item.stockDeducted':true,updatedAt:serverTimestamp()
    });
    tx.set(guard,{revision,updatedAt:serverTimestamp()});
    if(notify)tx.set(pulse,{
     eventId:event,previousEventId:chainWrong?'wrong':prev.data().eventId,origin:'test',updatedAt:serverTimestamp(),
     changedKeys:keys,sensitive:true,affected:keys.length,metaChanged:false
    });
   });
  }
  // Escrever guarda sem publicar o pulso deixa outros dispositivos desatualizados.
  await assertFails(commit({notify:false}));
  await assertFails(commit({event:'missing-key',keys:['another-record']}));
  await assertFails(commit({event:'broken-pulse',chainWrong:true}));
  await assertSucceeds(commit({event:'first-real',value:8,
   keys:['ingredient-1','movement-1'],ledgerWrite:true}));
  const stock=await sdk.getDoc(ingredient);
  assert.equal(stock.data().record.item.stock,8);
  await assertFails(updateDoc(ledger,{'record.item.quantity':-999,updatedAt:serverTimestamp()}));
  const guardAfter=await sdk.getDoc(guard);
  assert.equal(guardAfter.data().revision,1);
  // A transição de pedido também precisa de anúncio no pulso.
  await assertFails(commit({event:'wrong-order-key',value:8,keys:['ingredient-1'],moveOrder:true}));
  await assertSucceeds(commit({event:'order-produced',value:8,
   keys:['ingredient-1','order-1'],moveOrder:true}));
  assert.equal((await sdk.getDoc(order)).data().record.item.stockDeducted,true);
  assert.equal((await sdk.getDoc(guard)).data().revision,2);
  // Sem atualização de saldo ou status, mudanças administrativas não precisam do guard.
  await assertSucceeds(updateDoc(ingredient,{'record.item.name':'Batata verificada',updatedAt:serverTimestamp()}));
  // Conta V1 pode continuar operando; ao ativar V2, o caminho antigo é fechado.
  await assertSucceeds(setDoc(doc(db,'users',uid,'orders','legacy-before'),{status:'created'}));
  await env.withSecurityRulesDisabled(ctx=>setDoc(
   doc(ctx.firestore(),'users',uid,'appState','v2'),{schemaVersion:2,state:{data:{businessType:'batataria'}}}));
  await assertFails(setDoc(doc(db,'users',uid,'orders','legacy-bypass'),{status:'created'}));
  await assertFails(setDoc(doc(db,'users',uid,'inventory','legacy-stock'),{stock:100}));
  console.log('PASS F02: commits sensíveis exigem guard+pulso; bypass V1 fechado após ativar V2; estoque sincronizado sem duplicidade.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F02 ATOMIC GUARD FAILED:',e.stack||e);process.exitCode=1});
