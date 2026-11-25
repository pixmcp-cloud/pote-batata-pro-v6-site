// Candidate public-order API. Independent of the published Geo Worker.
// Disabled unless explicit canary flags AND Firebase administrative approval.
import {requireLegalAcceptance} from "../../../legal_core.mjs";
import {verifyFirebaseToken} from "./auth.mjs";
import {createFirestoreRepository} from "./firestore.mjs";
import {commitPublicCheckout,resolvePublicCheckout} from "./checkout_transaction.mjs";
import {readDeliveryOrder,mutateDeliveryOrder} from "./delivery_transaction.mjs";
import {issueCourierInvite,acceptCourierInvite} from "./courier_invitation.mjs";
import {reportCourierSafety,readCourierSafetyLocation} from "./courier_safety.mjs";
import {deliveryEntitlement} from "./delivery_policy.mjs";
import {DeliveryTrackingGate} from "./delivery_tracking_gate.mjs";
import {uidOk,slugOk} from "./geo_core.mjs";
export {DeliveryTrackingGate};
const idOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const reply=(x,status=200,headers={})=>Response.json(x,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
const fail=(code,status=422)=>{throw Object.assign(Error(code),{code,status})};
const object=x=>x&&typeof x==="object"&&!Array.isArray(x);
async function readBody(req){
 if(!req.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))fail("invalid_content_type",415);
 const reader=req.body?.getReader();if(!reader)fail("invalid_json",400);
 let length=0,chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();fail("invalid_json",400)}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.byteLength}
 try{const b=JSON.parse(new TextDecoder().decode(bytes));if(!object(b))throw Error();return b}catch{fail("invalid_json",400)}
}
async function callBinding(binding,name,action,data){
 if(!binding)fail("not_configured",503);
 const r=await binding.get(binding.idFromName(name)).fetch("https://internal/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const b=await r.json().catch(()=>({}));
 if(!r.ok)fail(b.error||"service_unavailable",r.status);
 return b;
}
async function trustedQuote(env,{buyerUid,slug,quoteId}){
 const config=(await callBinding(env.GEO_GATE,"store:"+slug,"config-get",{})).config;
 if(!config?.enabled||!uidOk(config.ownerUid)||typeof config.version!=="string")fail("delivery_quote_invalid");
 const q=(await callBinding(env.GEO_GATE,"quote:"+quoteId,"quote-get",{id:quoteId,uid:buyerUid,slug})).quote;
 return {quote:q,version:config.version,ownerUid:config.ownerUid};
}
async function trackingStart(repository,actorUid,id){
 const tx=await repository.transaction();
 try{
  const o=(await tx.get("publicOrderReceipts/"+id))?.data;
  if(o?.id!==id||o.fulfillment!=="entrega"||o.deliveryStatus!=="saiu_entrega"||
   ![o.buyerUid,o.courierUid].includes(actorUid)||o.clockStoppedAt)fail("tracking_forbidden",403);
  return {id,ownerUid:o.ownerUid,buyerUid:o.buyerUid,courierUid:o.courierUid,fulfillment:o.fulfillment,deliveryStatus:o.deliveryStatus,deliveryUpdatedAt:o.deliveryUpdatedAt,deliveryRevision:o.deliveryRevision};
 }finally{await tx.rollback()}
}
const fields={
 "/v1/orders/create":["slug","operationId","lines","fulfillment","payment","customerName","customerPhone","quoteId","expectedTotalCents"],
 "/v1/orders/resolve":["slug","operationId"],
 "/v1/orders/read":["id"],
 "/v1/orders/safety-alert":["id","kind","point","locationConsent"],
 "/v1/orders/safety-location":["id","kind","atMs"],
 "/v1/tracking/merchant-consent":["id","consent"],
 "/v1/tracking/merchant-read":["id"],
 "/v1/orders/invite":["id","email"],
 "/v1/orders/accept-invite":["id","token"],
 "/v1/orders/assign":["id","operationId","courierUid"],
 "/v1/orders/transition":["id","operationId","next","decision","deliveryCode"],
 "/v1/orders/confirm-payment":["id","operationId","reference"],
 "/v1/tracking/start":["id"],
 "/v1/tracking/publish":["id","point","consent"],
 "/v1/tracking/read":["id"],
 "/v1/tracking/clear":["id"]
};
export function createCheckoutWorker({verify=verifyFirebaseToken,repository=createFirestoreRepository,quoteReader=trustedQuote,gate=callBinding,clock=()=>Date.now()}={}){
 return {async fetch(req,env){
  const origin=req.headers.get("Origin"),allowed=String(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(origin&&!allowed.includes(origin))return reply({error:"origin_not_allowed"},403);
  const cors=origin?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type","Vary":"Origin"}:{};
  const path=new URL(req.url).pathname;
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method==="GET"&&path==="/health")return reply({status:"ok",apiRevision:"v6-commercial-qa-20261125",checkoutEnabled:env.ENABLE_CHECKOUT==="true",trackingEnabled:env.ENABLE_TRACKING==="true"},200,cors);
  if(req.method!=="POST"||!Object.hasOwn(fields,path))return reply({error:"not_found"},404,cors);
  try{
   if(env.ENABLE_CHECKOUT!=="true")fail("checkout_disabled",423);
   const auth=req.headers.get("Authorization")||"";
   if(!/^Bearer [^\s]+$/.test(auth))fail("authentication_required",401);
   let user;try{user=await verify(auth.slice(7),env.FIREBASE_PROJECT_ID)}catch{fail("invalid_identity",401)}
   const canaries=String(env.CHECKOUT_CANARY_UIDS||"").split(",").map(x=>x.trim()).filter(uidOk);
   if(!uidOk(user?.uid)||!canaries.includes(user.uid))fail("canary_required",403);
   const b=await readBody(req);
   if(Object.keys(b).some(k=>!fields[path].includes(k)))fail("unexpected_field",400);
   const actorUid=user.uid,now=clock();
   // Do not prevent a safety report or retrieval during a legal version change.
   if(env.REQUIRE_LEGAL_TERMS==="true"&&!["/v1/orders/safety-alert","/v1/orders/safety-location","/v1/tracking/clear"].includes(path))await requireLegalAcceptance(repository(env),actorUid);
   if(path==="/v1/orders/create"){
    if(!slugOk(b.slug))fail("invalid_store",400);
    if(!Number.isSafeInteger(b.expectedTotalCents)||b.expectedTotalCents<1||b.expectedTotalCents>999999999)fail("invalid_expected_total",400);
    const r=await commitPublicCheckout({repository:repository(env),buyerUid:actorUid,request:b,loadQuote:args=>quoteReader(env,args),now});
    return reply(r,200,cors);
   }
   if(path==="/v1/orders/resolve")return reply(await resolvePublicCheckout({repository:repository(env),buyerUid:actorUid,slug:b.slug,operationId:b.operationId}),200,cors);
   if(!idOk(b.id))fail("invalid_order",400);
   const emergencyBinding=(action,args)=>gate(env.TRACKING_GATE,"safety:"+args.id+":"+args.kind+":"+args.atMs,action,args);
   if(path==="/v1/orders/safety-alert")return reply(await reportCourierSafety({repository:repository(env),actorUid,id:b.id,kind:b.kind,point:b.point,locationConsent:b.locationConsent,saveLocation:args=>emergencyBinding("safety-store",args),now}),200,cors);
   if(path==="/v1/orders/safety-location")return reply(await readCourierSafetyLocation({repository:repository(env),actorUid,id:b.id,kind:b.kind,atMs:b.atMs,loadLocation:args=>emergencyBinding("safety-read",args),now}),200,cors);
   if(path==="/v1/orders/invite")return reply(await issueCourierInvite({repository:repository(env),actorUid,id:b.id,email:b.email,now}),200,cors);
   if(path==="/v1/orders/accept-invite")return reply(await acceptCourierInvite({repository:repository(env),actorUid,verifiedEmail:user.email,id:b.id,token:b.token,now}),200,cors);
   if(path==="/v1/orders/read")return reply(await readDeliveryOrder({repository:repository(env),actorUid,id:b.id,now}),200,cors);
   if(path.startsWith("/v1/tracking/")){
    if(env.ENABLE_TRACKING!=="true")fail("tracking_disabled",423);
    const action=path.split("/").at(-1),name="delivery:"+b.id;
    if(action==="start"){
     const order=await trackingStart(repository(env),actorUid,b.id);
     return reply(await gate(env.TRACKING_GATE,name,"open",{id:b.id,order}),200,cors);
    }
    if(action==="merchant-read"){
     const tx=await repository(env).transaction();try{const o=(await tx.get("publicOrderReceipts/"+b.id))?.data;
      if(o?.id!==b.id||o.ownerUid!==actorUid||o.deliveryStatus!=="saiu_entrega"||o.fulfillment!=="entrega"||o.clockStoppedAt)fail("tracking_forbidden",403);
      const profile=(await tx.get("users/"+actorUid))?.data;
      if(deliveryEntitlement({profile,universe:o.businessType,now}).plan!=="pro")fail("tracking_pro_required",403);
     }finally{await tx.rollback()}
     return reply(await gate(env.TRACKING_GATE,name,action,{id:b.id,actorUid}),200,cors);
    }
    if(action==="merchant-consent")return reply(await gate(env.TRACKING_GATE,name,action,{id:b.id,actorUid,consent:b.consent}),200,cors);
    if(action==="publish"&&(!object(b.point)||Object.keys(b.point).some(k=>!["lat","lon","accuracy"].includes(k))))fail("invalid_position",400);
    return reply(await gate(env.TRACKING_GATE,name,action,{id:b.id,actorUid,...(action==="publish"?{point:b.point,consent:b.consent}:{})}),200,cors);
   }
   const action=path.endsWith("/assign")?"assign":path.endsWith("/confirm-payment")?"confirm_payment":"transition";
   const result=await mutateDeliveryOrder({repository:repository(env),actorUid,...b,action,now,
    beforeClose:env.ENABLE_TRACKING==="true"?({id,revision})=>gate(env.TRACKING_GATE,"delivery:"+id,"close",{id,revision}):null});
   return reply(result,200,cors);
  }catch(e){
   const code=typeof e?.code==="string"&&/^[a-z_]{1,64}$/.test(e.code)?e.code:"checkout_unavailable";
   const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<600?e.status:
    ["order_unavailable","store_unavailable","forbidden_transition","merchant_not_approved"].includes(code)?403:
    ["idempotency_conflict","quote_already_used","insufficient_stock","monthly_delivery_limit"].includes(code)?409:code==="checkout_unavailable"?503:422;
   return reply({error:code},status,cors);
  }
 }};
}
export default createCheckoutWorker();
