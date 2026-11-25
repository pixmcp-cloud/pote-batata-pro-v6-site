import test from "node:test";
import assert from "node:assert/strict";
import {firebaseProbe} from "../src/firebase_probe.mjs";
const now=Date.now(),proof="a".repeat(64);
const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(proof)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const env={FIREBASE_PROJECT_ID:"potobatata-b71f3",ENABLE_CHECKOUT:"false",ENABLE_TRACKING:"false",CHECKOUT_CANARY_UIDS:"",REQUIRE_LEGAL_TERMS:"true",FIREBASE_PROBE_HASH:hash,FIREBASE_PROBE_EXPIRES:String(now+60000),GCP_CLIENT_EMAIL:"multiversal-checkout@potobatata-b71f3.iam.gserviceaccount.com",GCP_PRIVATE_KEY:"synthetic"};
test("probe only authenticated, short-lived, checkout locked; no secret output",async()=>{
 let calls=0;
 const deps={clock:()=>now,token:async()=>{calls++;return "synthetic-bearer"},audit:async({expected})=>({indexes:expected.map(x=>({state:"READY"}))})};
 const call=(e=env,p=proof)=>firebaseProbe(new Request("https://test/internal/firebase-preflight",{method:"POST",headers:{"X-Firebase-Probe":p}}),e,deps);
 for(const e of [{...env,ENABLE_CHECKOUT:"true"},{...env,ENABLE_TRACKING:"true"},{...env,CHECKOUT_CANARY_UIDS:"uid"},{...env,FIREBASE_PROBE_EXPIRES:String(now-1)},{...env,FIREBASE_PROBE_EXPIRES:String(now+600001)},{}])assert.equal((await call(e)).status,404);
 assert.equal((await call(env,"b".repeat(64))).status,404);assert.equal(calls,0);
 const r=await (await call()).json();assert.equal(r.oauth,true);assert.equal(r.report.indexes.length,5);assert.equal(calls,1);assert(!JSON.stringify(r).includes("synthetic"));
});
