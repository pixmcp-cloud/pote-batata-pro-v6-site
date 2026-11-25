// D02 — One-time order invitation. Only the intended verified Google identity can accept.
import {uidOk} from "./geo_core.mjs";
import {recordPath} from "./domain.mjs";
import {canonical} from "./delivery_transaction.mjs";
const fail=(code,status=403)=>{throw Object.assign(Error(code),{code,status})};
const idOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const emailOf=x=>typeof x==="string"?x.trim().toLowerCase():"";
const emailOk=x=>x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
const allowed=o=>o?.fulfillment==="entrega"&&["recebido","em_producao","finalizado"].includes(o.deliveryStatus);
const put=(path,data,prior)=>({path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
const hash=async token=>hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
const profileOk=(p,u)=>p?.accessPolicy?.workerAuthoritative===true&&p.accessPolicy.publicCheckout===true&&!p.disabled&&!p.blocked&&!p.accessPolicy.blockedUniverses?.includes(u)&&!p.accessPolicy.blockedServices?.some(x=>["delivery","orders",u+":orders",u+":delivery",u+":stock"].includes(x));
export async function issueCourierInvite({repository,actorUid,id,email,now=Date.now()}){
 email=emailOf(email);
 if(!uidOk(actorUid)||!idOk(id)||!emailOk(email)||!Number.isSafeInteger(now))fail("invalid_invitation",400);
 const path="publicOrderReceipts/"+id,tx=await repository.transaction();
 try{
  const doc=await tx.get(path),o=doc?.data;
  if(o?.id!==id||o.ownerUid!==actorUid||!allowed(o))fail("invitation_unavailable");
  const profile=await tx.get("users/"+actorUid);
  if(!profileOk(profile?.data,o.businessType))fail("merchant_not_approved");
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),expiresAt=now+30*60000;
  await tx.commit([put(path,{...o,deliveryInvite:{hash:await hash(token),email,expiresAt}},doc)]);
  return {ok:true,token,expiresAt};
 }finally{await tx.rollback()}
}
export async function acceptCourierInvite({repository,actorUid,verifiedEmail,id,token,now=Date.now()}){
 const email=emailOf(verifiedEmail);
 if(!uidOk(actorUid)||!idOk(id)||!idOk(token)||!emailOk(email)||!Number.isSafeInteger(now))fail("invalid_invitation",400);
 const path="publicOrderReceipts/"+id,tx=await repository.transaction();
 try{
  const doc=await tx.get(path),o=doc?.data;
  if(o?.id!==id||!allowed(o)||!uidOk(o.ownerUid)||o.buyerUid===actorUid||o.ownerUid===actorUid)fail("invitation_unavailable");
  const i=o.deliveryInvite;
  if(!i||i.email!==email||i.expiresAt<=now||i.hash!==await hash(token))fail("invitation_unavailable");
  const u=o.businessType,root="users/"+o.ownerUid;
  if(typeof u!=="string"||!/^[a-z0-9_-]{1,64}$/.test(u))fail("invitation_unavailable");
  const orderPath=recordPath(o.ownerUid,u,"orders",o.pdvOrderId),guardPath=root+"/appState/v5InventoryGuard",pulsePath=root+"/appState/v5Pulse",linkPath=root+"/deliveryCouriersV6/"+actorUid;
  const [profile,ordered,guard,pulse,linked]=await Promise.all([tx.get(root),tx.get(orderPath),tx.get(guardPath),tx.get(pulsePath),tx.get(linkPath)]);
  if(!profileOk(profile?.data,u))fail("merchant_not_approved");
  if(linked&&linked.data.active!==true)fail("courier_inactive");
  if(!Number.isSafeInteger(guard?.data?.revision)||guard.data.revision<0||guard.data.revision>=Number.MAX_SAFE_INTEGER||!pulse?.data?.eventId||!Number.isSafeInteger(o.deliveryRevision)||o.deliveryRevision<0||o.deliveryRevision>=Number.MAX_SAFE_INTEGER)fail("merchant_not_ready");
  const record=canonical(o,ordered),revision=o.deliveryRevision+1,updated={...o,courierUid:actorUid,deliveryRevision:revision};
  delete updated.deliveryInvite;
  await tx.commit([
   put(path,updated,doc),
   put(orderPath,{record:{...record,item:{...record.item,deliveryCourierUid:actorUid,deliveryRevision:revision}}},ordered),
   put(linkPath,{...(linked?.data||{}),uid:actorUid,active:true,accepted:true,acceptedAt:new Date(now).toISOString()},linked),
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"courier-invite-"+crypto.randomUUID(),previousEventId:pulse.data.eventId,origin:"cloudflare-delivery-v6",affected:1,changedKeys:[orderPath.split("/").at(-1)],metaChanged:false,sensitive:true},pulse)
  ]);
  return {ok:true,assigned:true,revision};
 }finally{await tx.rollback()}
}
