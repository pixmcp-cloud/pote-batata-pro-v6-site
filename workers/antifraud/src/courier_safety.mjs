import {uidOk} from "./geo_core.mjs";
const idOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const fail=(code,status=403)=>{throw Object.assign(Error(code),{code,status})};
export const SAFETY_LOCATION_TTL=86400000;
export function safetyPoint(point,now){
 if(!point||typeof point!=="object"||Object.keys(point).some(k=>!["lat","lon","accuracy","at"].includes(k))||!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lon)||Math.abs(point.lon)>180||!Number.isFinite(point.accuracy)||point.accuracy<0||point.accuracy>100||!Number.isSafeInteger(point.at)||point.at>now+5000||now-point.at>180000)return null;
 return {lat:point.lat,lon:point.lon,accuracy:point.accuracy,at:point.at};
}
export async function reportCourierSafety({repository,actorUid,id,kind,point,locationConsent=false,saveLocation=null,now=Date.now()}){
 if(!uidOk(actorUid)||!idOk(id)||!["possible_accident","help_requested"].includes(kind)||!Number.isSafeInteger(now)||now<0)fail("invalid_safety_alert",400);
 const tx=await repository.transaction();
 try{
  const o=(await tx.get("publicOrderReceipts/"+id))?.data;
  if(o?.id!==id||o.courierUid!==actorUid||!uidOk(o.ownerUid)||o.fulfillment!=="entrega"||o.deliveryStatus!=="saiu_entrega"||o.clockStoppedAt)fail("safety_alert_forbidden");
  const path="users/"+o.ownerUid+"/deliverySafetyAlertsV6/"+id+"-"+kind,prior=await tx.get(path);
  if(prior&&now-Number(prior.data.atMs)<300000)return {ok:true,duplicate:true};
  let hasLocation=false;const fix=locationConsent===true?safetyPoint(point,now):null;
  if(fix&&saveLocation){try{hasLocation=(await saveLocation({id,kind,atMs:now,ownerUid:o.ownerUid,point:fix})).stored===true;}catch{}}
  const data={hasLocation,orderId:id,orderCode:String(o.code||"").slice(0,24),kind,atMs:now,createdAt:new Date(now).toISOString()};
  await tx.commit([{path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}}]);
  return {ok:true,duplicate:false,hasLocation};
 }finally{await tx.rollback()}
}

export async function readCourierSafetyLocation({repository,actorUid,id,kind,atMs,loadLocation,now=Date.now()}){
 if(!uidOk(actorUid)||!idOk(id)||!["possible_accident","help_requested"].includes(kind)||!Number.isSafeInteger(atMs)||atMs>now||now-atMs>=SAFETY_LOCATION_TTL)fail("safety_location_unavailable");
 const tx=await repository.transaction();
 try{
  const o=(await tx.get("publicOrderReceipts/"+id))?.data;
  if(o?.id!==id||o.ownerUid!==actorUid)fail("safety_location_unavailable");
  const a=(await tx.get("users/"+actorUid+"/deliverySafetyAlertsV6/"+id+"-"+kind))?.data;
  if(a?.orderId!==id||a.kind!==kind||a.atMs!==atMs||a.hasLocation!==true)fail("safety_location_unavailable");
  return await loadLocation({id,kind,atMs,ownerUid:actorUid});
 }finally{await tx.rollback()}
}
