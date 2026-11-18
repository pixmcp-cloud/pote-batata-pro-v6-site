import assert from "node:assert/strict";
import {createWorkerBridge} from "./worker_bridge.mjs";
const uid="owner",orderId="order-1",universe="batataria";
const uuid="cb1b159a-7019-4cd0-9f33-a2bb87575b1d";
const storage=new Map();
const st={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
 removeItem:k=>storage.delete(k)};
const user={uid,getIdToken:async()=> "firebase-token".repeat(8)};
const active=()=>({uid,user,ready:true,proActive:true,syncBlocked:false});
let flushes=0,refreshes=0,requests=[];
const req=async(url,opts)=>{
 requests.push({url,opts});
 const sent=JSON.parse(opts.body);
 return new Response(JSON.stringify({ok:true,orderId:sent.orderId,operationId:sent.operationId,
  status:"em_producao"}),{status:200});
};
const make=(opts={})=>createWorkerBridge({enabled:true,
 endpoint:"https://pote-batata-guard-staging.pixmcp.workers.dev",
 getSession:active,flush:async()=>{flushes++;return true},
 refresh:async()=>{refreshes++},requestFetch:req,storage:st,uuid:()=>uuid,...opts
});
await assert.rejects(()=>createWorkerBridge({enabled:false,endpoint:"https://site.example",
 getSession:active,storage:st}).produce(orderId,universe),/desativado/);
assert.equal(requests.length,0);
const bridge=make();
const reply=await bridge.produce(orderId,universe);
assert(reply.ok);assert.equal(flushes,1);assert.equal(refreshes,1);
assert.equal(requests.length,1);
assert.equal(requests[0].url,"https://pote-batata-guard-staging.pixmcp.workers.dev/v1/orders/produce");
assert.equal(requests[0].opts.method,"POST");
const sent=JSON.parse(requests[0].opts.body);
assert.deepEqual(Object.keys(sent).sort(),["operationId","orderId","universe"]);
assert.equal(sent.operationId,uuid);
assert(!("uid" in sent)&&!("stock" in sent)&&!("cost" in sent));
assert(requests[0].opts.headers.Authorization.startsWith("Bearer firebase-token"));
assert.equal(storage.size,0);
await assert.rejects(()=>make({flush:async()=>false}).produce(orderId,universe),/pendentes/);
assert.equal(requests.length,1);
let n=0;
const retried=make({requestFetch:async(url,opt)=>{
 n++;requests.push({url,opt});if(n===1)throw Error("offline");
 return new Response(JSON.stringify({ok:true,orderId,operationId:uuid,alreadyApplied:true}),{status:200});
}});
await assert.rejects(()=>retried.produce(orderId,universe),/indisponível/);
assert.equal(storage.size,1,"Network outage must retain idempotency key");
const recovered=await retried.produce(orderId,universe);
assert.equal(recovered.alreadyApplied,true);assert.equal(storage.size,0);
const blocked=make({requestFetch:async()=>new Response(JSON.stringify({error:"not_activated"}),{status:423})});
await assert.rejects(()=>blocked.produce(orderId,universe),e=>e.code==="not_activated");
assert.equal(storage.size,1,"423 must never cause a direct-write fallback");
await make().produce(orderId,universe);assert.equal(storage.size,0);
const postDenied=make({refresh:async()=>{throw Error("offline")}});
await assert.rejects(()=>postDenied.produce(orderId,universe),/atualização local falhou/);
assert.equal(storage.size,1,"Refresh failure must preserve the idempotency key");
const cancel=make({requestFetch:async(url,opts)=>{
 const data=JSON.parse(opts.body);assert.equal(data.decision,"loss");
 assert(url.endsWith("/v1/orders/cancel"));
 return new Response(JSON.stringify({ok:true,orderId,operationId:uuid,status:"cancelado"}),{status:200});
}});
await cancel.cancel(orderId,universe,"loss");
assert.equal(storage.size,1,"Other action's pending ID must remain intact");
const finished=make({requestFetch:async(url,opts)=>{
 const sent=JSON.parse(opts.body);
 assert(url.endsWith("/v1/orders/finish"));
 assert.deepEqual(Object.keys(sent).sort(),["operationId","orderId","universe"]);
 return new Response(JSON.stringify({ok:true,orderId,operationId:uuid,
  status:"entregue",receiptRecorded:true,bankReconciled:false}),{status:200});
}});
const finishedResult=await finished.finish(orderId,universe);
assert.equal(finishedResult.receiptRecorded,true);
console.log("PASS Worker client: disabled default, auth, durable retries, finish, 423 fail-closed.");
