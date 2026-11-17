// Firebase Emulator only. No live database credentials, no network production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const toolsPath=process.env.POTE_RULES_TOOLING||'C:/Users/LIVRESOM/Documents/GitHub/_POTE_OFFLINE_TEST_TOOLS';
const externalRequire=createRequire(path.join(toolsPath,'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=externalRequire('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,Timestamp,serverTimestamp}=externalRequire('firebase/firestore');
const hardened=process.env.POTE_HARDENED_RULES==='1';
const rules=fs.readFileSync(path.join(__dirname,hardened?'firestore.hardened.rules':'firestore.rules'),'utf8');
const projectId='demo-pote-hardening';
let env;
(async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8787,rules}});
 const owner=(id,email,verified=true)=>env.authenticatedContext(id,{
   email,email_verified:verified,firebase:{sign_in_provider:'google.com'}
 }).firestore();
 const free=owner('free-uid','free@example.com');
 const premium=owner('pro-uid','pro@example.com');
 const other=owner('other-uid','other@example.com');
 const unverified=owner('free-uid','free@example.com',false);
 const admin=owner('admin-uid','pixmcp@gmail.com');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'users','free-uid'),{email:'free@example.com',displayName:'Free',createdAt:Timestamp.now()});
  await setDoc(doc(db,'users','pro-uid'),{email:'pro@example.com',displayName:'Pro',license:{status:'active',kind:'pro',expiresAt:Timestamp.fromMillis(Date.now()+3600e3)}});
  await setDoc(doc(db,'users','other-uid'),{email:'other@example.com'});
 });
 await assertSucceeds(getDoc(doc(free,'users','free-uid')));
 await assertFails(getDoc(doc(free,'users','other-uid')));
 await assertFails(getDoc(doc(unverified,'users','free-uid')));
 await assertFails(updateDoc(doc(free,'users','free-uid'),{license:{status:'active',kind:'lifetime',term:'lifetime'}}));
 const ingredientRecord=(id)=>({record:{universe:'batataria',group:'ingredients',id,item:{id,name:'Item '+id},rank:0},updatedAt:serverTimestamp()});
 await assertSucceeds(setDoc(doc(free,'users','free-uid','records','free-record-a'),ingredientRecord('a')));
 await assertSucceeds(setDoc(doc(free,'users','free-uid','records','free-record-b'),ingredientRecord('b')));
 console.log('CONFIRMED_F19: Free can write two ingredients directly to V2 Firestore; UI quotas are not enforced by rules.');
 if(hardened){
  await assertFails(setDoc(doc(free,'users','free-uid','orders','order-direct'),{status:'created',price:10}));
  await assertSucceeds(setDoc(doc(premium,'users','pro-uid','orders','legacy-pro-order'),{status:'created',price:10}));
  await assertSucceeds(setDoc(doc(free,'users','free-uid','appState','v2Pulse'),{eventId:'test',origin:'test'}));
  await assertFails(setDoc(doc(free,'users','free-uid','appState','main'),{state:{orders:[]}}));
  console.log('F18 FIX VERIFIED: Free cannot write legacy records, Pro legacy and Free V2 appState remain available.');
 }else{
  await assertSucceeds(setDoc(doc(free,'users','free-uid','orders','order-direct'),{status:'created',price:10}));
  console.log('CONFIRMED_F18: Free can directly write a legacy orders document.');
 }
 await assertFails(setDoc(doc(other,'users','free-uid','orders','evil'),{status:'created'}));
 const cash=(id)=>({record:{universe:'batataria',group:'cashMovements',id,item:{id,kind:'suprimento',amount:100,sessionId:'cash-1'},rank:0},updatedAt:serverTimestamp()});
 await assertFails(setDoc(doc(free,'users','free-uid','records','cash-1'),cash('cash-1')));
 await assertSucceeds(setDoc(doc(premium,'users','pro-uid','records','cash-2'),cash('cash-2')));
 await assertFails(updateDoc(doc(premium,'users','pro-uid','records','cash-2'),{'record.item.amount':200}));
 await assertFails(deleteDoc(doc(premium,'users','pro-uid','records','cash-2')));
 await assertSucceeds(getDoc(doc(admin,'users','free-uid')));
 console.log('PASS firebase emulator: Google verification, tenant isolation, license protection, financial immutability, legacy rule checks. F19 remains unresolved.');
})().catch(e=>{console.error('EMULATOR TEST FAILED',e.stack||String(e));process.exitCode=1}).finally(async()=>{if(env)await env.cleanup()});
