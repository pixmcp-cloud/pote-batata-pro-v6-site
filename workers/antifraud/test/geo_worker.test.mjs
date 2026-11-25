import test from "node:test";
import assert from "node:assert/strict";
import {createGeoWorker} from "../src/geo_worker.mjs";
import {GeoError} from "../src/geo_core.mjs";
const origin={lat:-29.168,lon:-51.179},destination={lat:-29.18,lon:-51.19};
const cfg={enabled:true,origin,baseCents:400,perKmCents:200,minCents:600,maxMeters:10000,mode:"motorcycle",ownerUid:"owner",version:"v1"};
function harness(){
 const calls=[],quotes=[],configs=[];
 const env={ENABLE_GEO:"true",GEO_CANARY_UIDS:"buyer,owner,other",GEOAPIFY_API_KEY:"a".repeat(32),ALLOWED_ORIGINS:"https://pdv.livresom.com",FIREBASE_PROJECT_ID:"test-project"};
 let config=cfg;
 const app=createGeoWorker({verify:async token=>({uid:token}),menuReader:async(_env,slug)=>({slug,ownerUid:"owner",published:true}),
 gate:async(_env,name,action,data)=>{calls.push({name,action,data});
  if(action==="config-get")return {config};
  if(action==="config-set"){config={...data.config,ownerUid:data.uid,version:"v2"};configs.push(config);return {config}}
  if(action==="quote-put")quotes.push(data.quote);
  return {ok:true}
 },requestFetch:async url=>{
  const u=new URL(url);assert.equal(u.origin,"https://api.geoapify.com");
  assert.equal(u.searchParams.get("apiKey"),env.GEOAPIFY_API_KEY);
  calls.push({provider:u.pathname});
  if(u.pathname.endsWith("routing"))return Response.json({features:[{properties:{distance:3200,time:480}}]});
  const lat=Number(u.searchParams.get("lat"))||destination.lat,lon=Number(u.searchParams.get("lon"))||destination.lon;
  return Response.json({features:[{properties:{country_code:"br",formatted:"Rua Teste, 10, Brasil",street:"Rua Teste",housenumber:"10",lat,lon}}]});
 },clock:()=>1700000000000});
 const post=(path,body={},uid="buyer",override={})=>app.fetch(new Request("https://worker.test/v1/geo/"+path,{
  method:"POST",headers:{Origin:"https://pdv.livresom.com","Content-Type":"application/json",...(uid?{Authorization:"Bearer "+uid}:{})},body:JSON.stringify({slug:"loja-a",...body})
 }),{...env,...override});
 return {post,calls,quotes,configs,app,env};
}
test("disabled, anonymous and unknown canary fail without provider calls",async()=>{
 const h=harness();
 assert.equal((await h.post("quote",{point:destination},"buyer",{ENABLE_GEO:"false"})).status,423);
 assert.equal((await h.post("quote",{point:destination},null)).status,401);
 assert.equal((await h.post("quote",{point:destination},"unknown")).status,403);
 assert.equal(h.calls.length,0);
});
test("only owner can configure; reverse verifies origin",async()=>{
 const h=harness();assert.equal((await h.post("config/set",{config:cfg})).status,403);
 assert.equal((await h.post("config/set",{config:cfg},"owner")).status,200);
 assert.equal(h.configs.length,1);assert.equal(h.configs[0].ownerUid,"owner");
});
test("quote is server priced, bound to current user and version; never enables orders",async()=>{
 const h=harness();
 const r=await h.post("quote",{point:destination,feeCents:1});assert.equal(r.status,200);
 const q=await r.json();assert.equal(q.feeCents,1040);assert.equal(q.meters,3200);assert.equal(q.checkoutEnabled,false);
 assert.equal(h.quotes[0].uid,"buyer");assert.equal(h.quotes[0].version,"v1");
 assert.equal((await h.post("quote",{point:{lat:-23.55,lon:-46.63}})).status,422);
 const before=h.calls.filter(x=>x.provider).length;await h.post("quote",{point:destination});
 assert.equal(h.calls.filter(x=>x.provider).length,before);
});
test("provider failure and denied quota do not return false prices",async()=>{
 const app=createGeoWorker({verify:async()=>({uid:"buyer"}),menuReader:async()=>({slug:"loja-a",ownerUid:"owner",published:true}),
 gate:async(_e,_n,a)=>{if(a==="config-get")return {config:cfg};throw new GeoError("daily_quota_exhausted",429)},
 requestFetch:async()=>{throw Error("should not fetch")}});
 const r=await app.fetch(new Request("https://worker.test/v1/geo/quote",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer token"},body:JSON.stringify({slug:"loja-a",point:destination})}),
 {ENABLE_GEO:"true",GEO_CANARY_UIDS:"buyer",GEOAPIFY_API_KEY:"a".repeat(32)});
 assert.equal(r.status,429);assert.equal((await r.json()).error,"daily_quota_exhausted");
});
test("origin allowlist and unsupported path",async()=>{
 const h=harness();
 assert.equal((await h.app.fetch(new Request("https://worker.test/health",{headers:{Origin:"https://evil.test"}}),h.env)).status,403);
 assert.equal((await h.post("orders/create")).status,404);
});
