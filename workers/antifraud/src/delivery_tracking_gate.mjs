// Dedicated ephemeral tracking Durable Object. Never stores a route history.
// Only the verified checkout service can call internal actions on this binding.
import {uidOk} from "./geo_core.mjs";
import {safetyPoint,SAFETY_LOCATION_TTL} from "./courier_safety.mjs";
import {nextTrackingPoint,visibleTrackingPoint,trackingAccess} from "./delivery_policy.mjs";
const reply=(x,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
const idOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const fail=(code,status=403)=>{throw Object.assign(Error(code),{code,status})};
export class DeliveryTrackingGate {
 constructor(state){this.storage=state.storage}
 async alarm(){
  const next=await this.storage.transaction(async tx=>{
   const s=await tx.get("session"),closed=await tx.get("closed"),emergency=await tx.get("emergency");
   const now=Date.now();
   if(!s||s.expiresAt<=now){await tx.delete("latest");await tx.delete("session");}
   if(closed&&closed.until<=now)await tx.delete("closed");
   if(emergency&&emergency.expiresAt<=now)await tx.delete("emergency");
   const due=[s?.expiresAt,closed?.until,emergency?.expiresAt].filter(v=>Number.isFinite(v)&&v>now);
   return due.length?Math.min(...due):null;
  });
  if(next)await this.storage.setAlarm(next);
 }
 async fetch(req){
  try{
   if(req.method!=="POST")return reply({error:"not_found"},404);
   const action=new URL(req.url).pathname.slice(1),b=await req.json(),now=Date.now();
   if(!idOk(b?.id))fail("invalid_order",400);
   const result=await this.storage.transaction(async tx=>{
    if(action==="safety-store"||action==="safety-read"){
     if(!uidOk(b.ownerUid)||!int(b.atMs)||b.atMs>now||now-b.atMs>=SAFETY_LOCATION_TTL||!["possible_accident","help_requested"].includes(b.kind))fail("safety_location_unavailable");
     const old=await tx.get("emergency");
     if(action==="safety-store"){
      const point=safetyPoint(b.point,now);if(!point)fail("invalid_position",400);
      if(old&&(old.ownerUid!==b.ownerUid||old.id!==b.id||old.atMs!==b.atMs||old.kind!==b.kind))fail("safety_location_unavailable");
      const expiresAt=b.atMs+SAFETY_LOCATION_TTL;
      if(!old)await tx.put("emergency",{id:b.id,kind:b.kind,atMs:b.atMs,ownerUid:b.ownerUid,point,expiresAt});
      return {stored:true,alarmAt:expiresAt};
     }
     if(!old||old.ownerUid!==b.ownerUid||old.id!==b.id||old.atMs!==b.atMs||old.kind!==b.kind||old.expiresAt<=now)fail("safety_location_unavailable");
     return {point:old.point,expiresAt:old.expiresAt};
    }
    const session=await tx.get("session"),closed=await tx.get("closed");
    if(action==="close"){
     if(!int(b.revision))fail("invalid_revision",400);
     await tx.delete("latest");await tx.delete("session");
     await tx.put("closed",{id:b.id,revision:Math.max(b.revision,closed?.revision||0),until:now+86400000});
     return {closed:true,alarmAt:now+86400000};
    }
    if(closed)fail("tracking_closed",410);
    if(action==="open"){
     const o=b.order;
     if(!o||o.id!==b.id||!uidOk(o.buyerUid)||!uidOk(o.courierUid)||o.buyerUid===o.courierUid||
      o.fulfillment!=="entrega"||o.deliveryStatus!=="saiu_entrega"||o.clockStoppedAt||
      !int(o.deliveryRevision)||!Number.isFinite(Date.parse(o.deliveryUpdatedAt)))fail("tracking_forbidden");
     const expiresAt=Date.parse(o.deliveryUpdatedAt)+6*3600000;
     if(expiresAt<=now)fail("tracking_expired",410);
     if(session&&(session.id!==b.id||session.buyerUid!==o.buyerUid||session.courierUid!==o.courierUid||session.deliveryRevision>o.deliveryRevision))fail("tracking_scope_changed",409);
     await tx.put("session",{id:b.id,ownerUid:uidOk(o.ownerUid)?o.ownerUid:null,merchantConsent:session?.merchantConsent===true,buyerUid:o.buyerUid,courierUid:o.courierUid,fulfillment:"entrega",deliveryStatus:"saiu_entrega",deliveryUpdatedAt:o.deliveryUpdatedAt,deliveryRevision:o.deliveryRevision,expiresAt});
     return {opened:true,alarmAt:expiresAt};
    }
    if(!session||session.id!==b.id||session.expiresAt<=now)fail("tracking_inactive",410);
    if(!uidOk(b.actorUid))fail("tracking_forbidden");
    if(action==="clear"){
     if(!trackingAccess(session,b.actorUid,"publish"))fail("tracking_forbidden");
     await tx.delete("latest");await tx.put("session",{...session,merchantConsent:false});return {cleared:true,alarmAt:session.expiresAt};
    }
    const previous=await tx.get("latest");
    if(action==="merchant-consent"){
     if(!trackingAccess(session,b.actorUid,"publish")||typeof b.consent!=="boolean")fail("tracking_forbidden");
     await tx.put("session",{...session,merchantConsent:b.consent});return {ok:true,alarmAt:session.expiresAt};
    }
    if(action==="merchant-read"){
     if(b.actorUid!==session.ownerUid||session.merchantConsent!==true)fail("tracking_forbidden");
     return {point:visibleTrackingPoint({order:session,actorUid:session.buyerUid,point:previous,now})};
    }
    if(action==="publish"){
     const plan=nextTrackingPoint({order:session,actorUid:b.actorUid,point:b.point,previous:previous||null,consent:b.consent,now});
     if(plan.accepted){await tx.put("latest",plan.point);return {accepted:true,alarmAt:session.expiresAt};}
     return {accepted:false,retryAfterMs:plan.retryAfterMs};
    }
    if(action==="read")return {point:visibleTrackingPoint({order:session,actorUid:b.actorUid,point:previous,now})};
    fail("not_found",404);
   });
   const {alarmAt,...out}=result;
   if(alarmAt)await this.storage.setAlarm(alarmAt);
   return reply(out);
  }catch(e){return reply({error:e?.code||"tracking_unavailable"},e?.status||(["tracking_forbidden","destination_forbidden"].includes(e?.code)?403:e?.code?422:503));}
 }
}
