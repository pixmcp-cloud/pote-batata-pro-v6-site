import assert from "node:assert/strict";
import {createWorkerBridge} from "./worker_bridge.mjs";
const uid="f20-qa-pro",user={uid,getIdToken:async()=> "signed-token".repeat(5)};
const mem=new Map(),storage={getItem:k=>mem.get(k)||null,
 setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
const uuid="f20-cash-uuid-0000000000000001",sessionId="cf-turn-"+uuid;
let attempts=0,refreshes=0;
const make=(options={})=>createWorkerBridge({
 enabled:true,endpoint:"https://staging.invalid",storage,uuid:()=>uuid,
 getSession:()=>({uid,user,ready:true,proActive:true,syncBlocked:false}),
 flush:async()=>true,refresh:async()=>{refreshes++},
 requestFetch:async(url,opts)=>{
  const body=JSON.parse(opts.body);
  assert.equal(body.operationId,uuid);
  assert.equal(body.universe,"batataria");
  if(url.endsWith("/v1/cash/open")){
   attempts++;
   assert.deepEqual(Object.keys(body).sort(),
    ["openingCashCents","operationId","operator","universe"]);
   assert.equal(body.openingCashCents,3500);
   if(attempts===1)throw Error("offline");
   return new Response(JSON.stringify({ok:true,operationId:uuid,sessionId,
    alreadyApplied:true}),{status:200});
  }
  assert(url.endsWith("/v1/cash/close"));
  assert.deepEqual(Object.keys(body).sort(),
   ["declaredCashCents","operationId","sessionId","universe"]);
  assert.equal(body.sessionId,sessionId);assert.equal(body.declaredCashCents,6200);
  return new Response(JSON.stringify({ok:true,operationId:uuid,sessionId,
   status:"closed",alreadyApplied:false,reconciliationStatus:"pending",
   bankReconciled:false}),{status:200});
 },...options
});
const bridge=make();
await assert.rejects(()=>bridge.openCash("batataria",3500,"Operador QA"),e=>e.code==="worker/network");
assert.equal(mem.size,1,"Lost open acknowledgement keeps idempotency key");
await assert.rejects(()=>bridge.openCash("batataria",9900,"Operador QA"),e=>e.code==="worker/pending");
assert.equal(attempts,1,"Different opening cash cannot replace uncertain open");
const open=await bridge.openCash("batataria",3500,"Operador QA");
assert.equal(open.sessionId,sessionId);assert.equal(attempts,2);assert.equal(mem.size,0);
const close=await bridge.closeCash("batataria",sessionId,6200);
assert.equal(close.reconciliationStatus,"pending");assert.equal(close.bankReconciled,false);
assert.equal(mem.size,0);assert.equal(refreshes,2);
await assert.rejects(()=>make({enabled:false}).openCash("batataria",0),e=>e.code==="worker/disabled");
await assert.rejects(()=>make().openCash("batataria",-100),e=>e.code==="worker/invalid");
await assert.rejects(()=>make().closeCash("batataria","arbitrary",10),e=>e.code==="worker/invalid");
const noMigration=make({requestFetch:async()=>new Response(JSON.stringify({
 error:"cash_migration_required",message:"Controle V2 ausente"}),{status:409})});
await assert.rejects(()=>noMigration.openCash("batataria",3500,"Operador QA"),
 e=>e.code==="cash_migration_required");
assert.equal(mem.size,0,"Definitive error releases pending key, no browser fallback");
const uncertain=make({requestFetch:async()=>new Response(JSON.stringify({
 error:"transaction_conflict",message:"Conflito"}),{status:409})});
await assert.rejects(()=>uncertain.openCash("batataria",3500,"Operador QA"),
 e=>e.code==="transaction_conflict");
assert.equal(mem.size,1,"Concurrent conflict retains stable pending id");
mem.clear();
const spoofed=make({requestFetch:async()=>new Response(JSON.stringify({
 ok:true,operationId:uuid,sessionId:"cf-turn-forged",status:"open"}),{status:200})});
await assert.rejects(()=>spoofed.openCash("batataria",3500,"Operador QA"),
 e=>e.code==="worker/invalid-response");
assert.equal(mem.size,1,"Unverified server reply preserves key");
mem.clear();
console.log("PASS F20 Worker cash bridge: atomic route, replay safe, bank status pending, fail-closed on migration/conflict/forgery");
