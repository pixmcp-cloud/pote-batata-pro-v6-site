import assert from "node:assert/strict";
import {createWorkerBridge} from "./worker_bridge.mjs";
const store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const user={uid:"owner",getIdToken:async()=>"x".repeat(40)};
let calls=0,refreshes=0,failOnce=true,operationId;
const bridge=createWorkerBridge({enabled:true,endpoint:"https://qa.invalid",storage,
 uuid:()=> "f05-loss-uuid-0000000000000001",
 getSession:()=>({uid:"owner",user,ready:true,proActive:true,syncBlocked:false}),
 flush:async()=>true,refresh:async()=>{refreshes++},
 requestFetch:async(url,opts)=>{
  calls++;
  assert.equal(url,"https://qa.invalid/v1/inventory/adjust");
  const body=JSON.parse(opts.body);
  assert.equal(body.delta,-2);
  assert.equal(body.reason,"loss");
  assert.equal(body.group,"ingredients");
  assert.equal(body.itemId,"pot");
  operationId=body.operationId;
  if(failOnce){failOnce=false;throw Error("network")}
  return {ok:true,json:async()=>({ok:true,group:body.group,itemId:body.itemId,
   operationId:body.operationId,stock:18})};
 }});
const payload={universe:"batataria",group:"ingredients",itemId:"pot",delta:-2,note:"Quebra"};
await assert.rejects(bridge.adjustStock(payload),e=>e.code==="worker/network");
assert.equal(store.size,1,"Pending operation ID survives network failure");
await assert.rejects(bridge.adjustStock({...payload,delta:-3}),e=>e.code==="worker/pending");
const result=await bridge.adjustStock(payload);
assert.equal(result.operationId,operationId);
assert.equal(calls,2,"Retry only; no second operation ID");
assert.equal(refreshes,1);
assert.equal(store.size,0,"Only successful refresh retires operation ID");
const disabled=createWorkerBridge({enabled:false,endpoint:"https://qa.invalid",storage,
 getSession:()=>({uid:"owner",user,ready:true,proActive:true})});
await assert.rejects(disabled.adjustStock(payload),e=>e.code==="worker/disabled");
console.log("PASS F05 UI Worker bridge: fail closed, durable retry, no duplicate, refresh, disabled");

const canaryUser={...user,email:"pixmcp@gmail.com"};
const canary=createWorkerBridge({enabled:false,inventoryEnabled:true,inventoryCanaryEmail:"pixmcp@gmail.com",
 endpoint:"https://core.invalid",inventoryEndpoint:"https://f05.invalid",storage,
 getSession:()=>({uid:"owner",user:canaryUser,ready:true,proActive:true,syncBlocked:false}),
 flush:async()=>true,refresh:async()=>{},uuid:()=>"f05-canary-uuid-0000000000000002",
 requestFetch:async(url,options)=>{assert.equal(url,"https://f05.invalid/v1/inventory/adjust");const b=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,operationId:b.operationId,group:b.group,itemId:b.itemId,stock:16})}}});
assert.equal(canary.enabled,false,"Other Worker routes must stay disabled");
assert.equal(canary.inventoryEnabled,true,"Owner canary sees inventory Worker");
await canary.adjustStock({...payload,lossReason:"avaria"});
const regular=createWorkerBridge({enabled:false,inventoryEnabled:true,inventoryCanaryEmail:"pixmcp@gmail.com",endpoint:"https://core.invalid",
 getSession:()=>({uid:"other",user:{uid:"other",email:"other@example.com"},ready:true,proActive:true})});
assert.equal(regular.inventoryEnabled,false,"Other tenants stay on existing flows");
await assert.rejects(regular.adjustStock(payload),e=>e.code==="worker/disabled");
console.log("PASS F05 owner-only inventory rollout, isolated endpoint, non-owner legacy safety");
