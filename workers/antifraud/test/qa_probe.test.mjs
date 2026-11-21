import test from "node:test";
import assert from "node:assert/strict";
import {createQaProbe} from "../src/qa_probe.mjs";
const env={FIREBASE_PROJECT_ID:"pote-batata-qa-worker",
 ENABLE_WRITES:"false",F05_QA_PROBE_TOKEN:"x".repeat(64)};
const request=(key,method="POST",path="/v1/qa/oauth-probe")=>
 new Request("https://localhost"+path,{method,
 headers:{"X-F05-QA-Probe-Token":key||""}});
test("QA Cloudflare: unauthorized requests never trigger Google or Firestore",async()=>{
 let calls=0;
 const app=createQaProbe({auth:async()=>{calls++;return "token".repeat(10)},
  requestFetch:async()=>{calls++;return new Response("{}")}});
 for(const headers of ["","bad","x".repeat(63),"y".repeat(64)]){
  const res=await app.fetch(request(headers),env);
  assert.equal(res.status,403);
 }
 const noSecret=await app.fetch(request("x".repeat(64)),{...env,F05_QA_PROBE_TOKEN:""});
 assert.equal(noSecret.status,403);
 assert.equal(calls,0,"no credential exchange on unauthorized requests");
});
test("QA Cloudflare: never run with production Firebase or writes enabled",async()=>{
 let calls=0;
 const app=createQaProbe({auth:async()=>{calls++;throw Error("never")}});
 for(const invalid of [
  {...env,FIREBASE_PROJECT_ID:"potobatata-b71f3"},
  {...env,ENABLE_WRITES:"true"},
  {...env,FIREBASE_PROJECT_ID:undefined},
  {...env,ENABLE_WRITES:undefined}
 ]){
  const res=await app.fetch(request(env.F05_QA_PROBE_TOKEN),invalid);
  assert.equal(res.status,503);
 }
 assert.equal(calls,0);
});
test("QA Cloudflare: real runtime path calls only Google and QA read-only",async()=>{
 let tokenCalls=0,readCalls=0;
 const app=createQaProbe({
  auth:async()=>{tokenCalls++;return "validtoken".repeat(10)},
  requestFetch:async(url,opts)=>{
   readCalls++;
   assert.equal(opts.method,"POST");
   assert(url.includes("/projects/pote-batata-qa-worker/"));
   assert(url.endsWith("/documents:listCollectionIds"));
   assert(!url.includes("potobatata-b71f3"));
   assert.equal(opts.headers.Authorization,"Bearer "+"validtoken".repeat(10));
   return new Response(JSON.stringify({collectionIds:[]}),{status:200});
  }
 });
 const res=await app.fetch(request(env.F05_QA_PROBE_TOKEN),env);
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{
  status:"ok",oauth:true,firestoreQaRead:true,writesEnabled:false
 });
 assert.equal(tokenCalls,1);assert.equal(readCalls,1);
});
test("QA Cloudflare: fails closed on IAM error, no details in response",async()=>{
 const app=createQaProbe({auth:async()=> "a".repeat(50),
  requestFetch:async()=>new Response(JSON.stringify({error:{message:"SENSITIVE"}}),{status:403})
 });
 const res=await app.fetch(request(env.F05_QA_PROBE_TOKEN),env);
 assert.equal(res.status,502);
 assert(!JSON.stringify(await res.json()).includes("SENSITIVE"));
});
test("QA Cloudflare: health never authenticates and denies unknown routes",async()=>{
 const app=createQaProbe({auth:async()=>{throw Error("not called")}});
 const h=await app.fetch(request("", "GET","/health"),env);
 assert.equal(h.status,200);
 assert.equal((await h.json()).writesEnabled,false);
 assert.equal((await app.fetch(request("","GET","/v1/qa/oauth-probe"),env)).status,404);
});
