/* F05 cutover incremental no Firebase Emulator: nenhuma regra real é alterada.
 * Verifica que um canário não contorna o Worker pelo SDK, enquanto as outras
 * empresas continuam operando normalmente com a guarda de estoque V5.
 */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {recordId}=require('./v5_store_core.mjs');
const U='batataria';
const profile=uid=>'users/'+uid;
const docs=(uid,group,id)=>profile(uid)+'/recordsV5/'+recordId(U,group,id);
const record=(group,id,item)=>({record:{universe:U,group,id,item,rank:1},updatedAt:sdk.serverTimestamp()});
const claims=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
const stamp=()=>sdk.serverTimestamp();
const users=[{uid:'qa-cutover',protected:true},{uid:'qa-legacy',protected:false}];
let seq=0;
function next(){return 'qa-f05-event-'+(++seq)}
test('F05: Firestore canário protegido, cliente antigo intacto e rollout reversível',{timeout:60000},async()=>{
 const env=await initializeEmulator({cutover:true});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const user of users){
    const uid=user.uid,base=profile(uid);
    await sdk.setDoc(sdk.doc(db,base),{
     email:uid+'@example.test',license:{status:'active',kind:'lifetime',term:'lifetime'},
     ...(user.protected?{accessPolicy:{workerAuthoritative:true}}:{})
    });
    await sdk.setDoc(sdk.doc(db,base+'/appState/v5'),{schemaVersion:5,
     state:{data:{businessType:U,businessUniverses:{}}},updatedAt:stamp()});
    await sdk.setDoc(sdk.doc(db,base+'/appState/v5InventoryGuard'),{revision:0,updatedAt:stamp()});
    await sdk.setDoc(sdk.doc(db,base+'/appState/v5Pulse'),{
     eventId:'seed-'+uid,previousEventId:'',origin:'qa',sensitive:false,
     updatedAt:stamp(),changedKeys:[],metaChanged:false});
    await sdk.setDoc(sdk.doc(db,docs(uid,'ingredients','batata')),
     record('ingredients','batata',{id:'batata',name:'Batata',stock:2000,measureUnit:'g',purchasePrice:10}));
    await sdk.setDoc(sdk.doc(db,docs(uid,'orders','prepared')),
     record('orders','prepared',{id:'prepared',status:'em_producao',qty:1,price:25,
      stockDeducted:true,stockRestored:false,stockReturnDeclined:false}));
   }
  });
  const client=uid=>env.authenticatedContext(uid,claims(uid+'@example.test')).firestore();
  const cut=client('qa-cutover'),old=client('qa-legacy');
  async function txChange(db,uid,group,id,{item,create=false}){
   const base=profile(uid),ref=sdk.doc(db,docs(uid,group,id));
   const guard=sdk.doc(db,base+'/appState/v5InventoryGuard');
   const pulse=sdk.doc(db,base+'/appState/v5Pulse');
   return sdk.runTransaction(db,async tx=>{
    const [oldDoc,g,p]=await Promise.all([tx.get(ref),tx.get(guard),tx.get(pulse)]);
    const existing=oldDoc.data()?.record||null;
    const changed=item(existing?.item||{});
    tx.set(ref,{record:{universe:U,group,id,item:changed,rank:existing?.rank??1},
     updatedAt:stamp()});
    tx.set(guard,{revision:g.data().revision+1,updatedAt:stamp()});
    tx.set(pulse,{eventId:next(),previousEventId:p.data().eventId,
     changedKeys:[recordId(U,group,id)],sensitive:true,metaChanged:false,
     origin:'qa',updatedAt:stamp()});
   });
  }
  const stockOpts={item:old=>({...old,stock:1500})};
  await assertFails(txChange(cut,'qa-cutover','ingredients','batata',stockOpts));
  const cutStock=(await sdk.getDoc(sdk.doc(cut,docs('qa-cutover','ingredients','batata')))).data();
  assert.equal(cutStock.record.item.stock,2000);
  await assertSucceeds(txChange(old,'qa-legacy','ingredients','batata',stockOpts));
  const oldStock=(await sdk.getDoc(sdk.doc(old,docs('qa-legacy','ingredients','batata')))).data();
  assert.equal(oldStock.record.item.stock,1500);
  // Cadastramento da venda é permitido; mudança para produção/cancelamento não.
  await assertSucceeds(txChange(cut,'qa-cutover','orders','new-order',{
   item:()=>({id:'new-order',status:'recebido',stockDeducted:false,qty:1,price:30})
  }));
  await assertFails(txChange(cut,'qa-cutover','orders','new-order',{
   item:old=>({...old,status:'em_producao',stockDeducted:true})}));
  await assertFails(txChange(cut,'qa-cutover','orders','new-order',{
   item:old=>({...old,status:'cancelado'})}));
  // Finalizar venda já produzida pelo Worker continua permitido.
  await assertSucceeds(txChange(cut,'qa-cutover','orders','prepared',{
   item:old=>({...old,status:'entregue',finishedAt:'2026-11-20T22:50:00Z'})}));
  // Um evento falso, criado com guarda e pulso, continua bloqueado.
  await assertFails(txChange(cut,'qa-cutover','stockMovements','forged',{
   item:()=>({id:'forged',ingredientId:'batata',quantity:-500,reason:'Produção'})
  }));
  // Impedir criar ingrediente com saldo positivo para contornar a baixa.
  await assertFails(txChange(cut,'qa-cutover','ingredients','fake-potato',{
   item:()=>({id:'fake-potato',stock:20000,name:'Batata falsa'})}));
  // Atualizar descrição/preço sem mexer na quantidade continua permitido.
  const potatoRef=sdk.doc(cut,docs('qa-cutover','ingredients','batata'));
  const potato=(await sdk.getDoc(potatoRef)).data().record;
  await assertSucceeds(sdk.setDoc(potatoRef,{
   record:{...potato,item:{...potato.item,purchasePrice:12}},updatedAt:stamp()}));
  await assertFails(sdk.deleteDoc(potatoRef));
  // O titular nunca pode ativar ou desativar as regras no próprio perfil.
  await assertFails(sdk.updateDoc(sdk.doc(cut,profile('qa-cutover')),
   {'accessPolicy.workerAuthoritative':false}));
  // A conta sem opt-in mantém operação V5 de venda e inventário.
  await assertSucceeds(txChange(old,'qa-legacy','orders','legacy-order',{
   item:()=>({id:'legacy-order',status:'recebido',stockDeducted:false,qty:1,price:35})}));
  console.log('PASS_F05_RULES_CANARY: protectedStock=2000 legacyStock=1500 directProduceDenied=true directCancelDenied=true deliveriesAllowed=true');
 }finally{await env.cleanup()}
});
