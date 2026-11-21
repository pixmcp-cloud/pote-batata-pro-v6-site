/* Validação segura e SOMENTE leitura de credencial Google QA.
 * Não imprime email, chave privada, access token ou documentos do Firestore.
 * Executar com POTE_F05_QA_CREDENTIAL_FILE apontando para arquivo local
 * autorizado, nunca incluir esse arquivo no GitHub nem em logs.
 */
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {serviceAccessToken} from "./workers/antifraud/src/auth.mjs";
const file=process.env.POTE_F05_QA_CREDENTIAL_FILE;
if(!file)throw Error("POTE_F05_QA_CREDENTIAL_FILE ausente");
const account=JSON.parse(readFileSync(file,"utf8"));
assert.equal(account.type,"service_account");
assert.equal(account.project_id,"pote-batata-qa-worker",
 "Teste deve usar exclusivamente a conta Google do projeto QA");
assert.match(account.client_email,/\.gserviceaccount\.com$/);
assert.match(account.private_key,/BEGIN PRIVATE KEY/);
const token=await serviceAccessToken({
 GCP_CLIENT_EMAIL:account.client_email,
 GCP_PRIVATE_KEY:account.private_key
});
assert.ok(typeof token==="string"&&token.length>30,"Google não concedeu access token");
console.log("GOOGLE_QA_SERVICE_OAUTH=PASS");

const root="https://firestore.googleapis.com/v1/projects/pote-batata-qa-worker/databases/(default)";
const probes=[
 {name:"DATABASE_METADATA",url:root,method:"GET"},
 {name:"ROOT_COLLECTIONS",url:root+"/documents:listCollectionIds",
  method:"POST",body:JSON.stringify({pageSize:1})}
];
let metadataOK=false,listOK=false;
for(const p of probes){
 const res=await fetch(p.url,{
  method:p.method,
  headers:{"Authorization":"Bearer "+token,...(p.body?{"Content-Type":"application/json"}:{})},
  ...(p.body?{body:p.body}:{}),signal:AbortSignal.timeout(15000)
 });
 const body=await res.json().catch(()=>({}));
 const code=String(body?.error?.status||"none");
 console.log("GOOGLE_QA_"+p.name+"_HTTP="+res.status+" STATUS="+code);
 if(p.name==="DATABASE_METADATA")metadataOK=res.ok;
 if(p.name==="ROOT_COLLECTIONS")listOK=res.ok;
}
console.log("GOOGLE_QA_FIRESTORE_READ_AUTHORIZED="+listOK);
if(!listOK){
 console.log("NEXT_ACTION="+(metadataOK?
  "IAM_DOCUMENT_LIST_ACCESS_REQUIRED":"CHECK_QA_DATABASE_EXISTENCE_OR_IAM"));
 process.exitCode=2;
}
