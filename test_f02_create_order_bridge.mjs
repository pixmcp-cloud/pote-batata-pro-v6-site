import assert from "node:assert/strict";
import {createWorkerBridge} from "./worker_bridge.mjs";
const store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const uid="tenant-pro",user={uid,getIdToken:async()=> "test-firebase-token".repeat(4)};
const input={universe:"batataria",recipeId:"recipe-1",qty:2,
 cashSessionId:"cash-open-1",paymentMethod:"pix"};
let responses=0,refreshes=0,flushes=0,idNum=0;
const ids=["f02-op-0000000000000000000001","f02-order-00000000000000001"];
const fake=()=>ids[idNum++]??"unexpected";
const make=(overrides={})=>createWorkerBridge({
 enabled:true,endpoint:"https://staging.example",storage,uuid:fake,
 getSession:()=>({uid,user,ready:true,proActive:true,syncBlocked:false}),
 flush:async()=>{flushes++;return true},
 refresh:async()=>{refreshes++},
 requestFetch:async(url,opts)=>{
  responses++;assert.equal(url,"https://staging.example/v1/orders/create");
  assert.equal(opts.method,"POST");
  const b=JSON.parse(opts.body);
  assert.deepEqual(Object.keys(b).sort(),
   ["cashSessionId","operationId","orderId","paymentMethod","qty","recipeId","universe"]);
  assert.equal(b.orderId,"f02-"+ids[1]);
  assert.equal(b.operationId,ids[0]);
  assert.equal(b.qty,2);
  if(responses===1)throw Error("simulated timeout");
  return new Response(JSON.stringify({ok:true,orderId:b.orderId,operationId:b.operationId,
   alreadyApplied:true,priceCents:3990}),{status:200});
 },...overrides});
const bridge=make();
await assert.rejects(()=>bridge.createOrder(input),e=>e.code==="worker/network");
assert.equal(store.size,1,"Timeout keeps stable order and operation identifiers");
await assert.rejects(()=>bridge.createOrder({...input,qty:3}),e=>e.code==="worker/pending");
assert.equal(responses,1,"Different order cannot replace uncertain order");
const result=await bridge.createOrder(input);
assert.equal(result.priceCents,3990);assert.equal(responses,2);
assert.equal(refreshes,1);assert.equal(store.size,0,"Only confirmed refresh retires pending order");
assert(flushes>=2);
await assert.rejects(()=>make({enabled:false}).createOrder(input),e=>e.code==="worker/disabled");
await assert.rejects(()=>make().createOrder({...input,qty:-1}),e=>e.code==="worker/invalid");
await assert.rejects(()=>make().createOrder({...input,paymentMethod:"card",cashSessionId:""}),e=>e.code==="worker/invalid");
const refusal=make({requestFetch:async()=>new Response(JSON.stringify({
 error:"cash_session_required",message:"Caixa fechado"}),{status:409})});
await assert.rejects(()=>refusal.createOrder(input),e=>e.code==="cash_session_required");
assert.equal(store.size,1,"Rejected order cannot trigger a local browser save");
store.clear();
const suspicious=make({requestFetch:async(url,opts)=>{
 const b=JSON.parse(opts.body);return new Response(JSON.stringify({
 ok:true,orderId:b.orderId,operationId:b.operationId,priceCents:3990,reservationStatus:"none"
 }),{status:200});
}});
await assert.rejects(()=>suspicious.createOrder(input),e=>e.code==="worker/invalid-response");
assert.equal(store.size,1,"Unverified reservation response preserves idempotency key");
store.clear();
console.log("PASS F02 create-order bridge: server price only; stable IDs, uncertain retry, no browser fallback, session/stock gates and refresh.");
