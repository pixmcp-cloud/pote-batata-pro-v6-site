'use strict';
// Teste isolado contra Firestore Emulator. Nunca acessa projeto real.
const test=require('node:test');
const assert=require('node:assert/strict');
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {doc,setDoc,getDoc,updateDoc,collection,getDocs,serverTimestamp}=sdk;
const google=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
const menu=(ownerUid,published=true)=>({
 schemaVersion:1,ownerUid,slug:'loja-cardapio-qa',published,title:'Minha Loja',
 subtitle:'Comida no pote',businessType:'batataria',color:'#e7b968',
 items:[{id:'r01',title:'Frango cremoso',category:'Salgados',description:'Delicioso',priceCents:2990,image:'../assets/generic/business-batataria.svg',addons:[]}],
 updatedAt:serverTimestamp()
});
test('Catálogo público: somente dono verificado publica, leitura pública só quando ativa',{timeout:90000},async()=>{
 const env=await initializeEmulator();
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),'users','owner-uid'),{email:'owner@example.test',displayName:'Dono'});
   await setDoc(doc(ctx.firestore(),'users','other-uid'),{email:'other@example.test',displayName:'Outro'});
  });
  const owner=env.authenticatedContext('owner-uid',google('owner@example.test')).firestore();
  const other=env.authenticatedContext('other-uid',google('other@example.test')).firestore();
  const anon=env.unauthenticatedContext().firestore();
  const fake=env.authenticatedContext('owner-uid',{email:'owner@example.test',email_verified:false,firebase:{sign_in_provider:'password'}}).firestore();
  const ref=db=>doc(db,'publicMenus','loja-cardapio-qa');
  await assertSucceeds(getDoc(ref(anon)));
  await assertFails(setDoc(ref(anon),menu('owner-uid')));
  await assertFails(setDoc(ref(fake),menu('owner-uid')));
  await assertFails(setDoc(ref(other),menu('owner-uid')));
  await assertFails(setDoc(ref(owner),{...menu('owner-uid'),clients:[{phone:'123'}]}));
  await assertFails(setDoc(ref(owner),{...menu('owner-uid'),items:[]}));
  await assertSucceeds(setDoc(ref(owner),menu('owner-uid')));
  assert.equal((await getDoc(ref(anon))).data().title,'Minha Loja');
  await assertFails(getDocs(collection(anon,'publicMenus')));
  await assertFails(updateDoc(ref(other),{title:'Invadido',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(owner),{ownerUid:'other-uid',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(owner),{orders:[{client:'secret'}],updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref(owner),{title:'Minha Loja Atualizada',updatedAt:serverTimestamp()}));
  assert.equal((await getDoc(ref(anon))).data().title,'Minha Loja Atualizada');
  await assertSucceeds(updateDoc(ref(owner),{published:false,updatedAt:serverTimestamp()}));
  await assertFails(getDoc(ref(anon)));
  await assertFails(getDoc(ref(other)));
  assert.equal((await getDoc(ref(owner))).data().published,false);
  await assertSucceeds(updateDoc(ref(owner),{published:true,updatedAt:serverTimestamp()}));
  await assertSucceeds(getDoc(ref(anon)));
  await assertFails(setDoc(doc(anon,'users','owner-uid','recordsV5','pedido-malicioso'),{record:{group:'orders'}}));
  await assertFails(setDoc(doc(anon,'publicOrders','fake'),{totalCents:1}));
  console.log('PASS: isolamento publicMenus, publicação explícita, despublicação, sem gravação de pedidos por clientes');
 }finally{await env.cleanup();}
});
