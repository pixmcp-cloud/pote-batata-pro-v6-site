// F10 integration: V1 retained, V2 staged; interruption is retryable.
const assert=require("node:assert/strict");
const {initializeEmulator,sdk}=require("./qa/firestore/environment.cjs");

const uid="migration-legacy";
const state={data:{businessType:"batataria",businessUniverses:{
 pizzaria:{recipes:[{id:"pizza-1",name:"Pizza"}],ingredients:[{id:"farinha",stock:1000}]}
},recipes:Array.from({length:14},(_,i)=>({id:"recipe-"+i,name:"Receita "+i,price:30})),
ingredients:[{id:"batata",stock:20000}],orders:[
 {id:"o1",status:"recebido",qty:2,price:30,createdAt:"2026-11-17T10:00:00Z"}],
stockMovements:[{id:"m1",ingredientId:"batata",quantity:-10,reason:"Produção",referenceId:"o1"}],
expenses:[{id:"e1",amount:50,at:"2026-11-17T10:00:00Z"}],
cashSessions:[{id:"shift-1",status:"closed",openedAt:"2026-11-17T08:00:00Z",
 openingCash:50,operator:"Caixa A",closedAt:"2026-11-17T18:00:00Z",
 countedCash:70,expectedCash:70,difference:0,closedSummary:{sales:20,expectedCash:70}}],
cashMovements:[{id:"shift-event-1",kind:"suprimento",sessionId:"shift-1",
 amount:20,reason:"Troco",at:"2026-11-17T08:30:00Z"}],
clients:[{id:"c1",name:"Cliente"}],settings:{tax:5},brand:{name:"Batataria original"}}};
(async()=>{
 const {prepareLegacyMigration,migrateLegacyV2}=await import("./legacy_migration_v2.mjs");
 const {createV2Store}=await import("./v2_storage.mjs");
 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==="1"});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await sdk.setDoc(sdk.doc(db,"users",uid),{email:"migration@example.com",
    license:{status:"active",kind:"lifetime",term:"lifetime"}});
   await sdk.setDoc(sdk.doc(db,"users",uid,"appState","main"),{state,updatedAt:sdk.serverTimestamp()});
  });
  const db=env.authenticatedContext(uid,{email:"migration@example.com",email_verified:true,
   firebase:{sign_in_provider:"google.com"}}).firestore();
  const plan=await prepareLegacyMigration(state);
  let txCount=0,failed=false;
  const broken={...sdk,runTransaction:async(...args)=>{
   txCount++;
   if(txCount===4){failed=true;throw Object.assign(Error("Connection simulated lost"),{code:"unavailable"})}
   return sdk.runTransaction(...args);
  }};
  const before=await sdk.getDoc(sdk.doc(db,"users",uid,"appState","main"));
  assert(before.exists());
  await assert.rejects(()=>migrateLegacyV2({uid,db,sdk:broken,planned:plan}),/Connection simulated lost/);
  assert(failed);
  const staged=await sdk.getDoc(sdk.doc(db,"users",uid,"appState","v2"));
  assert.equal(staged.data().migration.status,"copying");
  let stateApplied=false;
  const app=createV2Store({uid,db,sdk,fresh:()=>{},snapshot:()=>state,apply:()=>{stateApplied=true}});
  await assert.rejects(()=>app.load(),/incompleta/i);
  assert.equal(stateApplied,false,"In-progress migration must never expose partial data");
  app.dispose();
  const progress=[];
  const done=await migrateLegacyV2({uid,db,sdk,planned:plan,
   onProgress:p=>progress.push(p)});
  assert(done.ok&&done.sourcePreserved);
  assert.equal(done.records,plan.recordCount);
  assert.equal((await migrateLegacyV2({uid,db,sdk,planned:plan})).alreadyComplete,true);
  assert.deepEqual((await sdk.getDoc(sdk.doc(db,"users",uid,"appState","main"))).data().state,state,
   "V1 source remains intact");
  const applied=[];
  const v2=createV2Store({uid,db,sdk,fresh:()=>{},snapshot:()=>state,apply:s=>applied.push(s)});
  const loaded=await v2.load();
  assert.equal(loaded.records,plan.recordCount);
  assert.equal(applied[0].data.orders[0].id,"o1");
  assert.equal(applied[0].data.businessUniverses.pizzaria.recipes[0].id,"pizza-1");
  assert.equal(applied[0].data.ingredients[0].stock,20000);
  assert.equal(applied[0].data.cashSessions[0].status,"closed");
  assert.deepEqual(applied[0].data.cashSessions[0].closedSummary,{sales:20,expectedCash:70});
  assert.equal(applied[0].data.cashMovements[0].amount,20);
  v2.dispose();
  console.log("PASS F10 real emulator: V1 preserved, migration interrupted and resumed, legacy closed cash session + movements recovered, archived universes kept.");
 }finally{await env.cleanup()}
})().catch(e=>{console.error("F10 MIGRATION FAILED",e.stack||e);process.exitCode=1});
