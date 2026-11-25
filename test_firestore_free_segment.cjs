'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {initializeEmulator,assertSucceeds,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {doc,getDoc,getDocFromServer,setDoc,updateDoc,deleteField,runTransaction,serverTimestamp}=sdk;
test('F10: segmento FREE atômico, imutável e validado no servidor',{timeout:90000},async()=>{
 const hardened=process.env.POTE_HARDENED_RULES==='1',cutover=process.env.POTE_F05_CUTOVER_RULES==='1';
 const env=await initializeEmulator({hardened,cutover});
 try{
  const id='qa-f10-segment-'+(cutover?'cut':hardened?'hard':'base'),email=id+'@example.test';
  const auth=uid=>env.authenticatedContext(uid,{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const a=auth(id),b=auth(id),other=auth(id+'-other');
  const profile=db=>doc(db,'users',id);
  await assertFails(setDoc(profile(a),{email,displayName:'QA'}));
  await assertSucceeds(setDoc(profile(a),{email,displayName:'QA',freeUniverseRequired:true}));
  const record=(db,universe,key='free~extra~recipes')=>setDoc(doc(db,'users',id,'recordsV5',key),{record:{universe,group:'recipes',id:'receita-qa',item:{id:'receita-qa',name:'Receita QA'},rank:1},updatedAt:serverTimestamp()});
  await assertFails(record(a,'pizzaria'));
  await assertFails(updateDoc(profile(a),{freeUniverse:'lancheria'}));
  await assertFails(updateDoc(profile(a),{freeUniverseRequired:false}));
  await assertFails(updateDoc(profile(other),{freeUniverse:'hotdog'}));
  const bind=async(db,type)=>{try{return await runTransaction(db,async tx=>{
   const ref=profile(db),snap=await tx.get(ref),existing=snap.data().freeUniverse;
   if(existing)return existing;
   tx.update(ref,{freeUniverse:type,updatedAt:serverTimestamp()});return type;
  });}catch(error){const snap=await getDocFromServer(profile(db));const chosen=snap.data()?.freeUniverse;if(!['pizzaria','hamburgueria'].includes(chosen))throw error;return chosen;}};
  const result=await Promise.all([bind(a,'pizzaria'),bind(b,'hamburgueria')]);
  assert.equal(result[0],result[1],'As duas sessões devem convergir para uma única escolha');
  const selected=result[0],wrong=selected==='pizzaria'?'hamburgueria':'pizzaria';
  assert.equal((await getDoc(profile(a))).data().freeUniverse,selected);
  await assertFails(updateDoc(profile(a),{freeUniverse:wrong}));
  await assertFails(updateDoc(profile(a),{freeUniverse:deleteField()}));
  await assertSucceeds(record(a,selected));
  await assertFails(record(a,wrong));
  await assertFails(record(a,'batataria','free~base~recipes'));
  await assertFails(record(a,'kitchen','free~base~recipes'));
  await env.withSecurityRulesDisabled(async ctx=>updateDoc(profile(ctx.firestore()),{license:{kind:'lifetime',term:'lifetime',status:'active'}}));
  await assertSucceeds(record(a,'lancheria','pro-lancheria'));
  await env.withSecurityRulesDisabled(async ctx=>updateDoc(profile(ctx.firestore()),{license:{kind:'pro',term:'month',status:'expired'}}));
  await assertFails(record(a,'lancheria','pro-lancheria'));
  assert.equal((await getDoc(doc(a,'users',id,'recordsV5','pro-lancheria'))).exists(),true);
  if(!hardened&&!cutover){
   const menu=(slug,businessType)=>({schemaVersion:1,ownerUid:id,slug,published:true,title:'Loja QA',subtitle:'Teste',businessType,color:'#123456',items:[{id:'r1',title:'Receita QA',priceCents:1200}],updatedAt:serverTimestamp()});
   await assertFails(setDoc(doc(a,'publicMenus',id+'-wrong'),menu(id+'-wrong',wrong)));
   await assertSucceeds(setDoc(doc(a,'publicMenus',id+'-ok'),menu(id+'-ok',selected)));
  }
  console.log('PASS F10: primeira escolha única entre duas sessões, PRO, vencimento, ramo bloqueado e histórico preservado.');
 }finally{await env.cleanup()}
});
