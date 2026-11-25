import test from "node:test";
import assert from "node:assert/strict";
import {createCheckoutWorker} from "../src/checkout_worker.mjs";
import {DeliveryTrackingGate} from "../src/delivery_tracking_gate.mjs";
const id="a".repeat(64),now=Date.now();
function gateHarness(){
 const map=new Map(),alarms=[];
 const tx={get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k)};
 const gate=new DeliveryTrackingGate({storage:{...tx,transaction:async f=>f(tx),setAlarm:async at=>alarms.push(at)}});
 return {map,alarms,alarm:()=>gate.alarm(),call:async(action,body={})=>{const r=await gate.fetch(new Request("https://internal/"+action,{method:"POST",body:JSON.stringify({id,...body})}));return {status:r.status,body:await r.json()}}};
}
test("tracking storage only assigned courier and buyer, latest point only, terminal denies",async()=>{
 const h=gateHarness(),order={id,buyerUid:"buyer",courierUid:"courier",deliveryStatus:"saiu_entrega",fulfillment:"entrega",deliveryUpdatedAt:new Date(now-10000).toISOString(),deliveryRevision:3};
 assert.equal((await h.call("open",{order})).status,200);
 const point={lat:-29.17,lon:-51.18,accuracy:5};
 assert.equal((await h.call("publish",{actorUid:"other",point,consent:true})).status,403);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:false})).status,403);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:true})).body.accepted,true);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:true})).body.accepted,false);
 assert.equal((await h.call("read",{actorUid:"owner"})).status,403);
 assert.equal((await h.call("read",{actorUid:"buyer"})).body.point.lat,point.lat);
 assert.deepEqual([...h.map.keys()].sort(),["latest","session"]);
 // Simulate an old persisted point, including legacy expiresAt, and a legacy alarm.
 h.map.set("latest",{...h.map.get("latest"),at:Date.now()-20*60000,expiresAt:Date.now()-1000});
 await h.alarm();
 const old=(await h.call("read",{actorUid:"buyer"})).body.point;
 assert.equal(old.freshness,"lost");assert.equal(old.lat,point.lat);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:true})).body.accepted,true);
 assert.equal((await h.call("read",{actorUid:"buyer"})).body.point.freshness,"live");
 assert.equal((await h.call("close",{revision:4})).status,200);
 assert.equal((await h.call("read",{actorUid:"buyer"})).status,410);
 assert.equal((await h.call("open",{order})).status,410);
 assert.deepEqual([...h.map.keys()],["closed"]);
});
test("public API disabled by default, origin, auth, allowlist and request injection",async()=>{
 const app=createCheckoutWorker({verify:async t=>({uid:t}),repository:()=>{throw Error("repository must not be called")},gate:async(_binding,_name,action,b)=>({action,actorUid:b.actorUid})});
 const env={ENABLE_CHECKOUT:"true",ENABLE_TRACKING:"true",CHECKOUT_CANARY_UIDS:"buyer,courier",ALLOWED_ORIGINS:"https://pdv.livresom.com"};
 const call=(path,b,uid="buyer",e=env,origin="https://pdv.livresom.com")=>app.fetch(new Request("https://worker.test"+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...(uid?{Authorization:"Bearer "+uid}:{})},body:JSON.stringify(b)}),e);
 assert.equal((await call("/v1/orders/create",{},null,{},"")).status,423);
 assert.equal((await call("/v1/tracking/read",{id},null)).status,401);
 assert.equal((await call("/v1/tracking/read",{id},"other")).status,403);
 assert.equal((await call("/v1/tracking/read",{id},"buyer",env,"https://bad.example")).status,403);
 assert.equal((await call("/v1/tracking/read",{id,actorUid:"courier"})).status,400);
 assert.deepEqual(await (await call("/v1/tracking/read",{id})).json(),{action:"read",actorUid:"buyer"});
 assert.equal((await call("/v1/tracking/read",{id},"buyer",{...env,ENABLE_TRACKING:"false"})).status,423);
});
