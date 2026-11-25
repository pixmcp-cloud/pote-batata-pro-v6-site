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
  await assertFails(updateDoc(ownerDoc(owner),{freeUniverse:'lancheria',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ownerDoc(owner),{freeUniverse:'hamburgueria',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ownerDoc(owner),{freeUniverse:'pizzaria',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ownerDoc(master),{freeUniverse:'pizzaria',updatedAt:serverTimestamp()}));
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
