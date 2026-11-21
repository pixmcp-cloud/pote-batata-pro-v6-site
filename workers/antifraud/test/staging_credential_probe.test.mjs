import test from "node:test";
import assert from "node:assert/strict";
import {verifyStagingCredential} from "../src/staging_credential_probe.mjs";
const base={FIREBASE_PROJECT_ID:"potobatata-b71f3",
 ENABLE_WRITES:"false",GCP_CLIENT_EMAIL:"pote-batata-f05-worker@potobatata-b71f3.iam.gserviceaccount.com",
 F05_STAGING_PROBE_TOKEN:"x".repeat(64)};
const req=secret=>new Request("https://staging.example/v1/internal/credential-probe",{
 method:"POST",headers:{"X-F05-Staging-Probe-Token":secret||""}});
test("Staging IAM: segredo ausente, truncado ou adulterado não chama Google",async()=>{
 let calls=0;
 const deps={token:async()=>{calls++;throw Error("must not call")}};
 for(const secret of ["","x".repeat(63),"z".repeat(64)]){
  const r=await verifyStagingCredential(req(secret),base,{},deps);
  assert.equal(r.status,403);
 }
 assert.equal((await verifyStagingCredential(req(base.F05_STAGING_PROBE_TOKEN),
  {...base,F05_STAGING_PROBE_TOKEN:""},{},deps)).status,403);
 assert.equal(calls,0);
});
test("Staging IAM: quebra de linha do stdin Wrangler não altera segredo",async()=>{
 let calls=0;
 const r=await verifyStagingCredential(req(base.F05_STAGING_PROBE_TOKEN),
  {...base,F05_STAGING_PROBE_TOKEN:base.F05_STAGING_PROBE_TOKEN+String.fromCharCode(13,10)},{
  },{token:async()=>{calls++;return "test_token".repeat(5)},
   requestFetch:async()=>new Response("{}",{status:200})});
 assert.equal(r.status,200);
 assert.equal(calls,1);
});
test("Staging IAM: recusar qualquer ambiente com gravação habilitada",async()=>{
 for(const config of [
  {...base,ENABLE_WRITES:"true"},
  {...base,FIREBASE_PROJECT_ID:"pote-batata-qa-worker"},
  {...base,FIREBASE_PROJECT_ID:undefined}
 ]){
  const r=await verifyStagingCredential(req(base.F05_STAGING_PROBE_TOKEN),config);
  assert.equal(r.status,503);
 }
});
test("Staging IAM: chave Google QA não passa como credencial comercial",async()=>{
 let calls=0;
 const r=await verifyStagingCredential(req(base.F05_STAGING_PROBE_TOKEN),
  {...base,GCP_CLIENT_EMAIL:"qa@pote-batata-qa-worker.iam.gserviceaccount.com"},
  {},{token:async()=>{calls++;throw Error("must not run")}});
 assert.equal(r.status,409);
 assert.deepEqual(await r.json(),{
  status:"identity_mismatch",identityMatched:false,oauthValidated:false,
  firestoreMetadataReadable:false,writesEnabled:false
 });
 assert.equal(calls,0);
});
test("Staging IAM: OAuth e leitura apenas dos metadados, nunca documentos",async()=>{
 let calls=0,authCalls=0;
 const r=await verifyStagingCredential(req(base.F05_STAGING_PROBE_TOKEN),base,{},{
  token:async()=>{authCalls++;return "secret-token".repeat(10)},
  requestFetch:async(url,options)=>{
   calls++;
   assert.equal(url,"https://firestore.googleapis.com/v1/projects/potobatata-b71f3/databases/(default)");
   assert.equal(options.method,"GET");
   assert.equal(options.headers.Authorization,"Bearer "+"secret-token".repeat(10));
   return new Response(JSON.stringify({name:"projects/.../databases/(default)"}),{status:200});
  }
 });
 assert.equal(r.status,200);
 assert.equal((await r.json()).identityMatched,true);
 assert.equal(calls,1);assert.equal(authCalls,1);
});
test("Staging IAM: falha Google fica opaca, sem token ou email no retorno",async()=>{
 const r=await verifyStagingCredential(req(base.F05_STAGING_PROBE_TOKEN),base,{},{
  token:async()=>{throw Error("SECRET_DO_NOT_EXPOSE")}
 });
 assert.equal(r.status,502);
 assert(!JSON.stringify(await r.json()).includes("SECRET"));
});
