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
 const h=gateHarness(),order={id,ownerUid:"owner",buyerUid:"buyer",courierUid:"courier",deliveryStatus:"saiu_entrega",fulfillment:"entrega",deliveryUpdatedAt:new Date(now-10000).toISOString(),deliveryRevision:3};
 assert.equal((await h.call("open",{order})).status,200);
 const point={lat:-29.17,lon:-51.18,accuracy:5};
 assert.equal((await h.call("publish",{actorUid:"other",point,consent:true})).status,403);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:false})).status,403);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:true})).body.accepted,true);
 assert.equal((await h.call("publish",{actorUid:"courier",point,consent:true})).body.accepted,false);
 assert.equal((await h.call("read",{actorUid:"owner"})).status,403);
 assert.equal((await h.call("merchant-read",{actorUid:"owner"})).status,403);
 assert.equal((await h.call("merchant-consent",{actorUid:"owner",consent:true})).status,403);
 assert.equal((await h.call("merchant-consent",{actorUid:"courier",consent:true})).status,200);
 assert.equal((await h.call("merchant-read",{actorUid:"owner"})).body.point.lat,point.lat);
 assert.equal((await h.call("merchant-read",{actorUid:"other"})).status,403);
 assert.equal((await h.call("merchant-consent",{actorUid:"courier",consent:false})).status,200);
 assert.equal((await h.call("merchant-read",{actorUid:"owner"})).status,403);
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

test("emergency point is isolated, owner only, expires independently",async()=>{
 const h=gateHarness(),atMs=Date.now(),kind="possible_accident",point={lat:-29.17,lon:-51.18,accuracy:5,at:atMs};
 assert.equal((await h.call("safety-store",{ownerUid:"owner",atMs,kind,point})).body.stored,true);
 assert.equal((await h.call("safety-read",{ownerUid:"other",atMs,kind})).status,403);
 assert.deepEqual((await h.call("safety-read",{ownerUid:"owner",atMs,kind})).body.point,point);
 assert.equal((await h.call("read",{actorUid:"owner"})).status,410);
 h.map.set("emergency",{...h.map.get("emergency"),expiresAt:Date.now()-1});await h.alarm();
 assert.equal(h.map.has("emergency"),false);
});
test("merchant tracking checks current license before consulting gate",async()=>{
 const profile={license:{kind:"lifetime",term:"lifetime",status:"active"}};
 let activeProfile=profile,called=0;
 const app=createCheckoutWorker({verify:async t=>({uid:t}),repository:()=>({transaction:async()=>({get:async p=>({data:p.startsWith("users/")?activeProfile:{id,ownerUid:"owner",deliveryStatus:"saiu_entrega",fulfillment:"entrega",businessType:"batataria"}}),rollback:async()=>{}})}),gate:async()=>{called++;return {point:null}}});
 const env={ENABLE_CHECKOUT:"true",ENABLE_TRACKING:"true",CHECKOUT_CANARY_UIDS:"owner"};
 const call=()=>app.fetch(new Request("https://worker.test/v1/tracking/merchant-read",{method:"POST",headers:{Authorization:"Bearer owner","Content-Type":"application/json"},body:JSON.stringify({id})}),env);
 assert.equal((await call()).status,200);activeProfile={};assert.equal((await call()).status,403);assert.equal(called,1);
});
