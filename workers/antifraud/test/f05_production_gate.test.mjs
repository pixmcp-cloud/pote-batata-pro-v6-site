import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerApp} from "../src/index.mjs";
const env={FIREBASE_PROJECT_ID:"potobatata-b71f3",ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false",F05_ONLY:"true",F05_PRODUCTION_APPROVED:"true",F05_CANARY_EMAIL:"pixmcp@gmail.com",ALLOWED_ORIGINS:"https://pdv.livresom.com"};
const bearer="Bearer "+"x".repeat(100);
const make=(route="/v1/inventory/adjust")=>new Request("https://guard.example"+route,{method:"POST",headers:{Authorization:bearer,"Content-Type":"application/json",Origin:"https://pdv.livresom.com"},body:"{}"});
test("F05 commercial canary denies all noninventory routes",async()=>{
 const app=createWorkerApp({verify:async()=>({uid:"owner",email:"pixmcp@gmail.com"})});
 const r=await app.fetch(make("/v1/orders/cancel"),env);
 assert.equal(r.status,423);
 assert.equal((await r.json()).error,"f05_route_restricted");
});
test("F05 commercial canary denies non-owner email before Firestore",async()=>{
 const app=createWorkerApp({verify:async()=>({uid:"other",email:"other@example.com"})});
 const r=await app.fetch(make(),env);
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,"f05_canary_restricted");
});
test("F05 commercial canary requires explicit write approval even for owner",async()=>{
 const app=createWorkerApp({verify:async()=>({uid:"owner",email:"pixmcp@gmail.com"})});
 const disabled=await app.fetch(make(),{...env,ENABLE_WRITES:"false"});
 assert.equal(disabled.status,423);
 const unapproved=await app.fetch(make(),{...env,F05_PRODUCTION_APPROVED:"false"});
 assert.equal(unapproved.status,423);
 const allowed=await app.fetch(make(),env);
 assert.equal(allowed.status,400,"owner reaches validation but no database writes");
 assert.equal((await allowed.json()).error,"invalid_stock_adjustment");
});
test("F05 health indicates narrowly approved inventory-only mode",async()=>{
 const app=createWorkerApp();
 const result=await app.fetch(new Request("https://guard.example/health"),env);
 assert.equal(result.status,200);
 const health=await result.json();
 assert.equal(health.writesEnabled,true);
 assert.equal(health.mode,"f05-inventory-only");
});
