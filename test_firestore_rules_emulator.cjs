// Firebase Emulator only. No live database credentials, no network production writes.
const { initializeEmulator, assertSucceeds, assertFails, sdk } = require('./qa/firestore/environment.cjs');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, serverTimestamp } = sdk;
const selectCandidate=process.env.POTE_HARDENED_RULES==='1';
// Both the public Firestore rules and the regression candidate now enforce quotas.
const hardened=true;
let env;
(async()=>{
 env=await initializeEmulator({ hardened: selectCandidate });
 const owner=(id,email,verified=true,claims={})=>env.authenticatedContext(id,{
   email,email_verified:verified,firebase:{sign_in_provider:'google.com'},...claims
 }).firestore();
 const free=owner('free-uid','free@example.com');
 const premium=owner('pro-uid','pro@example.com');
 const other=owner('other-uid','other@example.com');
 const unverified=owner('free-uid','free@example.com',false);
 const admin=owner('admin-uid','pixmcp@gmail.com',true,{potebatataAdmin:true});
 const claimedEmailOnly=owner('admin-fake-email','pixmcp@gmail.com');
 const claimedWrongEmail=owner('admin-wrong-email','other-admin@example.com',true,{potebatataAdmin:true});
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
 if(hardened){
  await assertFails(setDoc(doc(free,'users','free-uid','orders','order-direct'),{status:'created',price:10}));
  await assertSucceeds(setDoc(doc(premium,'users','pro-uid','orders','legacy-pro-order'),{status:'created',price:10}));
  await assertSucceeds(setDoc(doc(free,'users','free-uid','appState','v2Pulse'),{eventId:'test',origin:'test'}));
  await assertFails(setDoc(doc(free,'users','free-uid','appState','main'),{state:{orders:[]}}));
  const guard=doc(free,'users','free-uid','appState','v2InventoryGuard');
  const revision=value=>({revision:value,updatedAt:serverTimestamp()});
  await assertFails(setDoc(guard,revision(5)));
  await assertSucceeds(setDoc(guard,revision(0)));
  await assertFails(setDoc(guard,revision(2)));
  await assertSucceeds(setDoc(guard,revision(1)));
  await assertFails(setDoc(guard,revision(0)));
  await assertFails(deleteDoc(guard));
  console.log('PASS candidate rules F18: Free legacy writes denied, Pro legacy and Free V2 appState remain available.');
 }
 await assertFails(setDoc(doc(other,'users','free-uid','orders','evil'),{status:'created'}));
 const cash=(id)=>({record:{universe:'batataria',group:'cashMovements',id,item:{id,kind:'suprimento',amount:100,sessionId:'cash-1'},rank:0},updatedAt:serverTimestamp()});
 await assertFails(setDoc(doc(free,'users','free-uid','records','cash-1'),cash('cash-1')));
 await assertSucceeds(setDoc(doc(premium,'users','pro-uid','records','cash-2'),cash('cash-2')));
 await assertFails(updateDoc(doc(premium,'users','pro-uid','records','cash-2'),{'record.item.amount':200}));
 await assertFails(deleteDoc(doc(premium,'users','pro-uid','records','cash-2')));
 // F02 server-approved selling prices are not writable or readable by
 // tenant/Free/Pro/Admin browser SDK, including same-account owner sessions.
 const pricePath=['users','pro-uid','serverPrices','price-qa'];
 const approved={version:1,universe:'batataria',recipeId:'r1',
  salePriceCents:3990,minimumGainPct:100,revision:1,
  items:[{id:'batata',g:120}]};
 await assertFails(setDoc(doc(premium,...pricePath),approved));
 await assertFails(setDoc(doc(admin,...pricePath),approved));
 await env.withSecurityRulesDisabled(async ctx=>{
  await setDoc(doc(ctx.firestore(),...pricePath),approved);
 });
 await assertFails(getDoc(doc(premium,...pricePath)));
 await assertFails(updateDoc(doc(premium,...pricePath),{salePriceCents:1}));
 await assertFails(deleteDoc(doc(admin,...pricePath)));
 console.log('PASS F02 price approval isolation: only privileged server can write or read.');
 const paidAudit={action:'promover',at:serverTimestamp(),actorUid:'admin-uid',actorEmail:'pixmcp@gmail.com',
  targetUid:'free-uid',targetEmail:'free@example.com',fromTerm:'free',toTerm:'month1',expiresAt:null,
  paymentMethod:'pix_manual',paymentAmountCents:3990,paymentReference:'Pix-Piloto-001',paymentConfirmedAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(admin,'licenseAudit','pilot-pix-ok'),paidAudit));
 await assertFails(setDoc(doc(free,'licenseAudit','pilot-evil'),paidAudit));
 await assertFails(setDoc(doc(admin,'licenseAudit','pilot-amount-wrong'),{...paidAudit,paymentAmountCents:-50}));
 await assertFails(setDoc(doc(admin,'licenseAudit','pilot-fake-method'),{...paidAudit,paymentMethod:'bank_auto'}));
 await assertSucceeds(setDoc(doc(admin,'licenseAudit','pilot-courtesy'),{...paidAudit,
  paymentMethod:'courtesy',paymentAmountCents:0,paymentReference:'Cliente piloto'}));
 await assertSucceeds(getDoc(doc(admin,'users','free-uid')));
 await assertFails(getDoc(doc(claimedEmailOnly,'users','free-uid')));
 await assertFails(getDoc(doc(claimedWrongEmail,'users','free-uid')));
 console.log('PASS Firebase Emulator: Google verification, tenant isolation, license protection and financial immutability.');
})().catch(e=>{console.error('EMULATOR TEST FAILED',e.stack||String(e));process.exitCode=1}).finally(async()=>{if(env)await env.cleanup()});
