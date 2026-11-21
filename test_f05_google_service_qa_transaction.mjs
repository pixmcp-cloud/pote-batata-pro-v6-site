/* HOMOLOGAÇÃO REAL, ISOLADA, do Firestore QA.
 * Só pode gravar em pote-batata-qa-worker e cria um documento efêmero
 * na coleção f05_qa_smoke. Apaga após confirmar leitura. Não toca produção.
 * NÃO incluir chave/token no stdout, GitHub, histórico do navegador.
 */
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {serviceAccessToken} from "./workers/antifraud/src/auth.mjs";
import {createFirestoreRepository} from "./workers/antifraud/src/firestore.mjs";
const project="pote-batata-qa-worker";
const file=process.env.POTE_F05_QA_CREDENTIAL_FILE;
if(!file)throw Error("POTE_F05_QA_CREDENTIAL_FILE ausente");
const account=JSON.parse(readFileSync(file,"utf8"));
assert.equal(account.type,"service_account");
assert.equal(account.project_id,project);
assert.match(account.private_key,/BEGIN PRIVATE KEY/);
const env={GCP_CLIENT_EMAIL:account.client_email,
 GCP_PRIVATE_KEY:account.private_key,FIREBASE_PROJECT_ID:project};
const docPath="f05_qa_smoke/"+randomUUID();
const value={scope:"qa-only",schemaVersion:5,at:new Date().toISOString(),
 marker:randomUUID()};
const datastore=createFirestoreRepository(env);
let created=false,cleanupOK=false;
try{
 const tx=await datastore.transaction();
 try{
  const existing=await tx.get(docPath);
  assert.equal(existing,null,"Identificador QA já existente");
  await tx.commit([{path:docPath,data:value,precondition:{exists:false}}]);
  created=true;
  console.log("F05_QA_FIRESTORE_TRANSACTION_CREATE=PASS");
 }finally{await tx.rollback()}
 const confirm=await datastore.transaction();
 try{
  const found=await confirm.get(docPath);
  assert.equal(found?.data?.marker,value.marker);
  assert.equal(found?.data?.schemaVersion,5);
  console.log("F05_QA_FIRESTORE_TRANSACTION_READBACK=PASS");
 }finally{await confirm.rollback()}
}finally{
 if(created){
  const token=await serviceAccessToken(env);
  const url="https://firestore.googleapis.com/v1/projects/"+project+
   "/databases/(default)/documents/"+docPath;
  const res=await fetch(url,{method:"DELETE",
   headers:{"Authorization":"Bearer "+token},signal:AbortSignal.timeout(15000)});
  cleanupOK=res.status===200||res.status===204;
  console.log("F05_QA_FIRESTORE_TRANSACTION_CLEANUP="+
   (cleanupOK?"PASS":"FAIL_HTTP_"+res.status));
 }
}
if(!created||!cleanupOK)process.exitCode=2;
else console.log("F05_QA_GOOGLE_REAL_DB_E2E_PASS no-production-documents-touched");
