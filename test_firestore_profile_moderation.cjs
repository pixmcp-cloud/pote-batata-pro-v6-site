'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {doc,collection,getDoc,setDoc,updateDoc,runTransaction,serverTimestamp}=sdk;
const verified=(email,extra={})=>({
 email,email_verified:true,firebase:{sign_in_provider:'google.com'},...extra
});
test('Moderação de nome: só ADM autorizado pode bloquear, corrigir e auditar',{timeout:90000},async()=>{
 const env=await initializeEmulator();
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'users','qa-owner'),{
    email:'owner@example.test',displayName:'Nome Original',nameLocked:false
   });
  });
  const owner=env.authenticatedContext('qa-owner',verified('owner@example.test')).firestore();
  const master=env.authenticatedContext('qa-admin',verified('pixmcp@gmail.com',{potebatataAdmin:true})).firestore();
  const emailOnly=env.authenticatedContext('qa-fake',verified('pixmcp@gmail.com')).firestore();
  const claimWrongEmail=env.authenticatedContext('qa-fake2',verified('other@example.test',{potebatataAdmin:true})).firestore();
  const ownerDoc=db=>doc(db,'users','qa-owner');
  await assertSucceeds(updateDoc(ownerDoc(owner),{displayName:'Meu Novo Nome',updatedAt:serverTimestamp()}));
  async function moderatedTransaction(db,name,lock,oldName,oldLocked,id,reason='nome_improprio'){
   return runTransaction(db,async tx=>{
    const ref=ownerDoc(db),latest=await tx.get(ref);
    assert(latest.exists());
    tx.update(ref,{displayName:name,nameLocked:lock,updatedAt:serverTimestamp()});
    tx.set(doc(db,'profileAudit',id),{
     action:'moderate_name',at:serverTimestamp(),
     actorUid:'qa-admin',actorEmail:'pixmcp@gmail.com',
     targetUid:'qa-owner',targetEmail:'owner@example.test',
     fromName:oldName,toName:name,fromLocked:oldLocked,toLocked:lock,reason
    });
   });
  }
  await assertFails(moderatedTransaction(emailOnly,'Nome Corrigido',true,'Meu Novo Nome',false,'forged-email'));
  await assertFails(moderatedTransaction(claimWrongEmail,'Nome Corrigido',true,'Meu Novo Nome',false,'forged-claim'));
  await assertFails(moderatedTransaction(owner,'Nome Corrigido',true,'Meu Novo Nome',false,'forged-owner'));
  await assertSucceeds(moderatedTransaction(master,'Nome Corrigido',true,'Meu Novo Nome',false,'approved'));
  assert.equal((await getDoc(ownerDoc(owner))).data().nameLocked,true);
  assert.equal((await getDoc(ownerDoc(owner))).data().displayName,'Nome Corrigido');
  await assertFails(updateDoc(ownerDoc(owner),{displayName:'Outro Nome',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ownerDoc(owner),{photoURL:'https://example.test/photo.png',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ownerDoc(owner),{nameLocked:false,updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(owner,'profileAudit','approved')));
  await assertSucceeds(getDoc(doc(master,'profileAudit','approved')));
  await assertFails(updateDoc(doc(master,'profileAudit','approved'),{toName:'Fraude'}));
  await assertFails(setDoc(doc(master,'profileAudit','without-profile-write'),{
   action:'moderate_name',at:serverTimestamp(),
   actorUid:'qa-admin',actorEmail:'pixmcp@gmail.com',
   targetUid:'qa-owner',targetEmail:'owner@example.test',
   fromName:'Nome Corrigido',toName:'Nome Falso',
   fromLocked:true,toLocked:true,reason:'correcao'
  }));
  await assertSucceeds(moderatedTransaction(master,'Nome Corrigido',false,'Nome Corrigido',true,'unlocked','solicitacao'));
  await assertSucceeds(updateDoc(ownerDoc(owner),{displayName:'Livre Novamente',updatedAt:serverTimestamp()}));
  assert.equal((await getDoc(ownerDoc(owner))).data().displayName,'Livre Novamente');
  console.log('PASS MODERACAO: nome corrigido por ADM, bloqueio real nas regras, foto permitida, auditoria imutável');
 }finally{await env.cleanup()}
});

test('IA COIN: ajuste próprio ADM real, histórico atômico, replay e negação ao cliente',{timeout:90000,skip:process.env.POTE_HARDENED_RULES==='1'},async()=>{
 const env=await initializeEmulator();
 try{
  const admin=env.authenticatedContext('qa-admin',verified('pixmcp@gmail.com',{potebatataAdmin:true})).firestore();
  const owner=env.authenticatedContext('qa-owner',verified('owner@example.test')).firestore();
  const fake=env.authenticatedContext('qa-fake',verified('pixmcp@gmail.com')).firestore();
  const uid='qa-admin',id='qa_wallet_event_00000001',reason='Crédito administrativo próprio · pacote 100 IA COIN';
  const wallet=db=>doc(db,'users',uid,'aiWallet','main');
  const entry=db=>doc(db,'users',uid,'aiWallet','main','entries',id);
  async function credit(db,actor){
   return runTransaction(db,async tx=>{
    const oldEvent=await tx.get(entry(db));if(oldEvent.exists())return oldEvent.data().after;
    const snap=await tx.get(wallet(db)),before=snap.exists()?snap.data().balance:0,after=before+100;
    tx.set(wallet(db),{balance:after,lastEventId:id,updatedAt:serverTimestamp()});
    tx.set(entry(db),{kind:'admin_adjustment',before,after,delta:100,reason,actorUid:actor,at:serverTimestamp()});
    return after;
   });
  }
  await assertFails(credit(fake,'qa-fake'));await assertFails(credit(owner,'qa-owner'));
  assert.equal(await assertSucceeds(credit(admin,uid)),100);
  assert.equal(await assertSucceeds(credit(admin,uid)),100);
  assert.equal((await getDoc(wallet(admin))).data().balance,100);
  assert.equal((await getDoc(entry(admin))).data().delta,100);
  await assertFails(updateDoc(entry(admin),{delta:500}));
  await assertFails(updateDoc(wallet(admin),{balance:500,updatedAt:serverTimestamp()}));
  await assertFails(getDoc(wallet(owner)));
  console.log('PASS IA COIN: carteira e histórico em transação, repetição não duplica e não ADM não ajusta');
 }finally{await env.cleanup()}
});
