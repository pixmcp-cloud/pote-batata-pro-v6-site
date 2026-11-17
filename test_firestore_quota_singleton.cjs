// Firestore Emulator: one physical record ID per Free scope/group; no paid backend.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire('C:/Users/LIVRESOM/Documents/GitHub/_POTE_OFFLINE_TEST_TOOLS/package.json');
const {initializeTestEnvironment,assertFails,assertSucceeds}=req('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,Timestamp,serverTimestamp}=req('firebase/firestore');
(async()=>{
 const {recordId}=await import('./v2_store_core.mjs');
 const {freeSlotKey,modelRecordKey}=await import('./free_id_policy.mjs');
 const rules=fs.readFileSync(path.join(__dirname,'firestore.hardened.rules'),'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-pote-hardening',firestore:{host:'127.0.0.1',port:8793,rules}});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'users','free1'),{email:'free@example.com'});
   await setDoc(doc(db,'users','pro1'),{email:'pro@example.com',license:{status:'active',kind:'pro',expiresAt:Timestamp.fromMillis(Date.now()+7200000)}});
  });
  const free=env.authenticatedContext('free1',{email:'free@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const pro=env.authenticatedContext('pro1',{email:'pro@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const record=(id,universe='batataria')=>({universe,group:'recipes',id,item:{id,name:'Receita '+id,templateOrigin:'fake'},rank:0});
  const write=(db,uid,key,r)=>setDoc(doc(db,'users',uid,'records',key),{record:r,updatedAt:serverTimestamp()});
  const r1=record('first'),r2=record('second');
  const baseKey=freeSlotKey(r1);
  assert.equal(baseKey,'free~base~recipes');
  await assertFails(write(free,'free1',recordId(r1.universe,r1.group,r1.id),r1));
  await assertSucceeds(write(free,'free1',baseKey,r1));
  await assertFails(write(free,'free1',recordId(r2.universe,r2.group,r2.id),r2));
  await assertSucceeds(write(free,'free1',baseKey,r2));
  const snap=await getDocs((req('firebase/firestore')).collection(free,'users','free1','records'));
  assert.equal(snap.size,1,'one Free document survives replacement');
  assert.equal((await getDoc(doc(free,'users','free1','records',baseKey))).data().record.id,'second');
  const ex1=record('x1','pizzaria'),ex2=record('x2','pastelaria');
  const extraKey=freeSlotKey(ex1);
  assert.equal(extraKey,freeSlotKey(ex2));
  await assertSucceeds(write(free,'free1',extraKey,ex1));
  await assertFails(write(free,'free1',recordId(ex2.universe,ex2.group,ex2.id),ex2));
  await assertSucceeds(write(free,'free1',extraKey,ex2));
  // Legitimate built-in templates retain their ordinary document IDs.
  const model={universe:'batataria',group:'recipes',id:'r01',item:{id:'r01',name:'Frango Cremoso'},rank:0};
  await assertFails(write(free,'free1',recordId(model.universe,model.group,model.id),model));
  await assertSucceeds(write(free,'free1',modelRecordKey(model),model));
  await assertFails(write(free,'free1','clone-model-r01',model));
  const templateExamples=[
    {universe:'batataria',group:'ingredients',id:'batata'},
    {universe:'batataria',group:'expenses',id:'ex-gas'},
    {universe:'pastelaria',group:'recipes',id:'ps-01'},
    {universe:'pastelaria',group:'ingredients',id:'ps-in-massa-fresca-para-pastel'},
    {universe:'pizzaria',group:'recipes',id:'pz-01'},
    {universe:'pizzaria',group:'ingredients',id:'pz-in-massa-para-pizza-aberta'},
    {universe:'hamburgueria',group:'recipes',id:'hb-01'},
    {universe:'hotdog',group:'recipes',id:'hd-01'}
  ];
  for(const m of templateExamples){
    const record={...m,item:{id:m.id,name:m.id,templateOrigin:'model'},rank:0};
    await assertSucceeds(write(free,'free1',modelRecordKey(m),record));
  }
  const falseTemplate={universe:'pastelaria',group:'recipes',id:'ps-99',item:{id:'ps-99',templateOrigin:'pastelaria',modelRecipe:true},rank:0};
  await assertFails(write(free,'free1',recordId(falseTemplate.universe,falseTemplate.group,falseTemplate.id),falseTemplate));
  const forged=record('new-model');
  await assertFails(write(free,'free1',recordId(forged.universe,forged.group,forged.id),forged));
  await assertSucceeds(write(pro,'pro1',recordId('batataria','recipes','p1'),record('p1')));
  await assertSucceeds(write(pro,'pro1',recordId('batataria','recipes','p2'),record('p2')));
  await assertFails(write(free,'pro1',recordId('batataria','recipes','hack'),record('hack')));
  console.log('PASS F19 REAL FIRESTORE EMULATOR: one Free record per base/extra group, no second arbitrary ID, controlled replacement, bundled models, Pro unlimited, tenant isolation.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F19 FAIL',e.stack||e);process.exitCode=1});
