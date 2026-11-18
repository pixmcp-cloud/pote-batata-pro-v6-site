/* Asaas inbox for sandbox: authenticate -> persist -> 200.
 * Never changes a customer's license, balance or receipt state.
 */
import {validateAsaasWebhookToken,interpretAsaasPaymentEvent} from "../../../integrations/asaas/webhook_guard.mjs";
import {OperationalError} from "./domain.mjs";

const deny=(code,status)=>{throw new OperationalError("Asaas webhook rejected",status,code)};
const hashId=async value=>{
 const raw=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest("SHA-256",raw);
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
};
const write=(path,data)=>({path,data,precondition:{exists:false}});
export async function ingestAsaasWebhook(request,{env,repository,clock}){
 // Must be independently enabled. The project-wide write cutover gate
 // is required in addition to the Asaas-specific sandbox flag.
 if(env.ENABLE_WRITES!=="true"||
    env.PRODUCTION_CUTOVER_APPROVED!=="true"||
    env.ASAAS_WEBHOOK_ENABLED!=="true"||
    env.ASAAS_MODE!=="sandbox")
   deny("webhook_not_activated",423);
 const token=env.ASAAS_WEBHOOK_TOKEN;
 if(typeof token!=="string"||token.length<32||token.length>255)
   deny("webhook_secret_unavailable",423);
 try{
  validateAsaasWebhookToken(request.headers.get("asaas-access-token"),token);
 }catch{deny("webhook_unauthorized",401)}
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
   deny("webhook_content_type",415);
 const contentLength=Number(request.headers.get("content-length")||"0");
 if(!Number.isFinite(contentLength)||contentLength>16384||contentLength<0)
   deny("webhook_oversize",413);
 let payload;
 try{
  const body=await request.text();
  if(body.length>16384)deny("webhook_oversize",413);
  payload=JSON.parse(body);
 }catch(error){
  if(error instanceof OperationalError)throw error;
  deny("invalid_webhook_json",400);
 }
 let event;
 try{event=interpretAsaasPaymentEvent(payload)}
 catch{deny("invalid_webhook_event",400)}
 // Hash untrusted Asaas event ID, no path injection, no PII retained.
 const eventPath="asaasWebhookInbox/"+await hashId(event.eventId);
 const safeRecord={
  eventId:event.eventId,action:event.action,
  paymentId:event.paymentId||null,
  subscriptionId:event.subscriptionId||null,
  amountCents:event.amountCents??null,
  disposition:event.action==="ignore"?"ignored":"pending_server_verification",
  licenseGranted:false,bankReconciled:false,receivedAt:clock().toISOString(),
  source:"asaas-sandbox",schemaVersion:1
 };
 const tx=await repository(env).transaction();
 try{
  const previous=await tx.get(eventPath);
  if(previous){
   const v=previous.data;
   const equals=["eventId","action","paymentId","subscriptionId","amountCents"]
    .every(k=>v?.[k]===safeRecord[k]);
   if(!equals)deny("webhook_event_collision",409);
   return {ok:true,alreadyReceived:true};
  }
  await tx.commit([write(eventPath,safeRecord)]);
  return {ok:true,alreadyReceived:false};
 }finally{await tx.rollback()}
}
