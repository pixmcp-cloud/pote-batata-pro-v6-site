// Real Firestore Emulator: F06 imports hundreds of nonfinancial documents
// in bounded transactions, preserving existing account data and quotas.
const assert=require("node:assert/strict");
const {initializeEmulator,sdk}=require("./qa/firestore/environment.cjs");
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({data:{businessType:"batataria",businessUniverses:{},brand:{name:"Teste"},
 settings:{},recipes:[],clients:[],suppliers:[],expenses:[],orders:[],ingredients:[],
 beverages:[],stockMovements:[]}});
(async()=>{
 const {createV2Store}=await import("./v2_storage.mjs");
 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==="1"});
 const uid="f06-bulk-user",actors=[];
 try{
  await env.withSecurityRulesDisabled(ctx=>sdk.setDoc(sdk.doc(ctx.firestore(),"users",uid),
   {email:"f06-bulk@example.com",license:{status:"active",kind:"lifetime",term:"lifetime"}}));
  const actor=()=>{
   let state=fresh();
   const db=env.authenticatedContext(uid,{
    email:"f06-bulk@example.com",email_verified:true,
    firebase:{sign_in_provider:"google.com"}
   }).firestore();
   const store=createV2Store({uid,db,sdk,fresh:()=>{state=fresh()},
    snapshot:()=>clone(state),apply:s=>{state=clone(s)}});
   const actor={store,mutate:fn=>fn(state),read:()=>clone(state)};
   actors.push(actor);return actor;
  };
  const a=actor();await a.store.load();
  a.mutate(s=>{
   for(let i=0;i<360;i++)s.data.clients.push({id:"client-"+i,name:"Cliente "+i});
  });
  const result=await a.store.save();
  assert(result.ok&&result.changed===360&&result.batches===3,JSON.stringify(result));
  const b=actor();await b.store.load();
  assert.equal(b.read().data.clients.length,360);
  assert.equal(new Set(b.read().data.clients.map(x=>x.id)).size,360);
  assert.equal(b.read().data.orders.length,0);
  console.log("PASS F06 REAL EMULATOR: 360 clients committed in 3 bounded V2 transactions; all records available to another authenticated session.");
 }finally{
  for(const actor of actors)actor.store.dispose();
  await env.cleanup();
 }
})().catch(error=>{console.error("F06 REAL EMULATOR FAILURE",error.stack||error);process.exitCode=1});
