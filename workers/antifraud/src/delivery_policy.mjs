// V6 delivery policy. Limits are candidate defaults, not a commercial cutover.
import {uidOk,brPoint,airMeters} from "./geo_core.mjs";
export const PLAN_DEFAULTS=Object.freeze({freeMonthly:10,proMonthly:600});
const fail=code=>{throw Object.assign(Error(code),{code})};
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
export function merchantPlan(profile,now=Date.now()){
 if(!profile||profile.disabled===true||profile.blocked===true)return "blocked";
 const l=profile.license||{},p=profile.accessPolicy||{};
 if(p.blockedServices?.includes("delivery")||p.blockedServices?.includes("orders"))return "blocked";
 if(profile.franchise?.status==="active"&&profile.franchise?.brandId==="potebatata")return "pro";
 if(l.status==="active"&&(l.kind==="lifetime"&&l.term==="lifetime"||["pro","trial"].includes(l.kind)&&Date.parse(l.expiresAt||"")>now))return "pro";
 return "free";
}
export function deliveryEntitlement({profile,universe,used=0,limits=PLAN_DEFAULTS,now=Date.now()}){
 if(typeof universe!=="string"||!integer(used,0,100000000)||!integer(limits.freeMonthly,0,100000)||!integer(limits.proMonthly,0,100000))fail("invalid_policy");
 let plan=merchantPlan(profile,now);
 const p=profile?.accessPolicy||{};
 if(p.blockedUniverses?.includes(universe)||p.blockedServices?.some(x=>[universe+":orders",universe+":stock",universe+":delivery"].includes(x)))plan="blocked";
 const limit=plan==="pro"?limits.proMonthly:plan==="free"?limits.freeMonthly:0;
 return {plan,limit,used,remaining:Math.max(0,limit-used),canStartDelivery:used<limit&&plan!=="blocked",advanced:plan==="pro"};
}
const active=o=>o?.fulfillment==="entrega"&&o.deliveryStatus==="saiu_entrega"&&!o.clockStoppedAt;
export function trackingAccess(order,actorUid,operation){
 if(!uidOk(actorUid)||!active(order))return false;
 if(operation==="publish")return uidOk(order.courierUid)&&actorUid===order.courierUid;
 if(operation==="read")return actorUid===order.buyerUid;
 return false; // Merchant may see logistics status but not personal live location.
}
export function nextTrackingPoint({order,actorUid,previous,point,now=Date.now(),consent}){
 if(!trackingAccess(order,actorUid,"publish")||consent!==true)fail("tracking_forbidden");
 if(!brPoint(point)||!integer(now,0,Number.MAX_SAFE_INTEGER)||!Number.isFinite(point.accuracy)||point.accuracy<0||point.accuracy>100)fail("invalid_position");
 const started=Date.parse(order.deliveryUpdatedAt||order.createdAt);
 if(!Number.isFinite(started)||now<started)fail("invalid_clock");
 if(previous){
  if(!brPoint(previous)||!integer(previous.at,0,now))fail("invalid_previous_position");
  const age=now-previous.at,distance=airMeters(previous,point);
  if(age<15000||distance<30&&age<60000)return {accepted:false,retryAfterMs:Math.max(1000,age<15000?15000-age:60000-age)};
 }
 // Latest point only. Freshness is presentation, not retention. No Geoapify call.
 return {accepted:true,point:{lat:point.lat,lon:point.lon,accuracy:Math.ceil(point.accuracy),at:now}};
}
export function visibleTrackingPoint({order,actorUid,point,now=Date.now()}){
 if(!trackingAccess(order,actorUid,"read"))fail("tracking_forbidden");
 if(!point||!brPoint(point)||!integer(point.at,0,now)||!Number.isFinite(point.accuracy)||point.accuracy<0||point.accuracy>100)return null;
 const ageMs=now-point.at;
 const freshness=ageMs<=180000?"live":ageMs<=300000?"unstable":ageMs<=900000?"stale":"lost";
 return {lat:point.lat,lon:point.lon,accuracy:point.accuracy,at:point.at,ageSeconds:Math.floor(ageMs/1000),freshness};
}
export function buyerDestination({order,actorUid,point,consent}){
 if(!uidOk(actorUid)||actorUid!==order?.buyerUid||order.fulfillment!=="entrega"||order.deliveryStatus!=="recebido"||consent!==true||!brPoint(point))fail("destination_forbidden");
 return {lat:point.lat,lon:point.lon};
}
