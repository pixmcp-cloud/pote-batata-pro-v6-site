// G7: server-time expiration and nonrotation, emulator only.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("../qa/firestore/node_modules/@firebase/rules-unit-testing");
const sdk=require("../qa/firestore/node_modules/firebase/firestore");
(async()=>{
 if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))throw Error("Local emulator required");
 const {candidateTrialRules}=await import("./v5_trial_rules_lab.mjs");
 const {recordId}=await import("../v5_store_core.mjs");
 const projectId="demo-nucleobit-checkout",uid="trialsevenowner",root="users/"+uid;
 const env=await initializeTestEnvironment({projectId,firestore:{rules:candidateTrialRules(fs.readFileSync("firestore.rules","utf8"))}});
 const db=env.authenticatedContext(uid,{email_verified:true,email:"trial@example.invalid",firebase:{sign_in_provider:"google.com"}}).firestore();
 const other=env.authenticatedContext("trialother",{email_verified:true,email:"other@example.invalid",firebase:{sign_in_provider:"google.com"}}).firestore();
 const key="free~base~recipes",extra=recordId("batataria","recipes","own2"),record=(id,name=id)=>({universe:"batataria",group:"recipes",id,item:{id,name},rank:0});
 const ref=(d,k)=>sdk.doc(d,root+"/recordsV5/"+k),write=(d,k,x)=>sdk.setDoc(ref(d,k),{record:x,updatedAt:sdk.serverTimestamp()});
 const license=(status,term,ms,kind="trial")=>({status,kind,term,expiresAt:sdk.Timestamp.fromMillis(ms)});
 try{
  await env.withSecurityRulesDisabled(ctx=>sdk.setDoc(sdk.doc(ctx.firestore(),root),{email:"trial@example.invalid"}));
  await assertSucceeds(write(db,key,record("own1")));
  const update=async l=>env.withSecurityRulesDisabled(ctx=>sdk.setDoc(sdk.doc(ctx.firestore(),root),{email:"trial@example.invalid",license:l}));
  await update(license("active","trial7d",Date.now()+604800000));
  for(let i=2;i<=20;i++)await assertSucceeds(write(db,recordId("batataria","recipes","own"+i),record("own"+i)));
  await update(license("active","trial7d",Date.now()-10000));
  const docs=await assertSucceeds(sdk.getDocs(sdk.collection(db,root+"/recordsV5")));assert.equal(docs.size,20);
  await assertSucceeds(write(db,key,record("own1","Original editável")));
  await assertFails(write(db,key,record("own2")));await assertFails(write(db,extra,record("own2","Alterado")));
  await assertFails(write(db,recordId("batataria","recipes","own21"),record("own21")));
  await assertFails(sdk.deleteDoc(ref(db,key)));await assertFails(sdk.deleteDoc(ref(db,extra)));
  await assertFails(sdk.getDoc(ref(other,extra)));
  await assertFails(sdk.updateDoc(sdk.doc(db,root),{"license.expiresAt":sdk.Timestamp.fromMillis(Date.now()+604800000)}));
  await update(license("active","invented",Date.now()+604800000));await assertFails(write(db,extra,record("own2","Inválido")));
  await update(license("active","month1",Date.now()+86400000,"pro"));await assertSucceeds(write(db,extra,record("own2","Renovado")));
  const renewed=await sdk.getDocs(sdk.collection(db,root+"/recordsV5"));assert.equal(renewed.size,20);
  assert.equal((await sdk.getDoc(ref(db,key))).data().record.id,"own1");
  console.log("PASS B02-G7 candidate rules: 20 retained, one canonical slot editable, no rotation/delete after expiration, renewed PRO access; server request.time.");
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
