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
const url="https://firestore.googleapis.com/v1/projects/pote-batata-qa-worker/databases/(default)/documents?pageSize=1";
const response=await fetch(url,{
 headers:{"Authorization":"Bearer "+token},
 signal:AbortSignal.timeout(15000)
});
const body=await response.json().catch(()=>({}));
const status=String(body?.error?.status||"none");
console.log("GOOGLE_QA_FIRESTORE_READ_HTTP="+response.status+" STATUS="+status);
console.log("GOOGLE_QA_FIRESTORE_READ_AUTHORIZED="+(response.ok?"true":"false"));
if(!response.ok){
 if(response.status===403){
  console.log("NEXT_ACTION=IAM_FIRESTORE_READER_ACCESS_REQUIRED");
 }else if(response.status===404){
  console.log("NEXT_ACTION=QA_FIRESTORE_DATABASE_NOT_FOUND_OR_NOT_READY");
 }else{
  console.log("NEXT_ACTION=INVESTIGATE_QA_FIRESTORE_READ_STATUS");
 }
 process.exitCode=2;
}
