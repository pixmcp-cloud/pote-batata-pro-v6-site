import {uidOk} from "./geo_core.mjs";
const idOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const fail=(code,status=403)=>{throw Object.assign(Error(code),{code,status})};
export async function reportCourierSafety({repository,actorUid,id,kind,now=Date.now()}){
 if(!uidOk(actorUid)||!idOk(id)||!["possible_accident","help_requested"].includes(kind)||!Number.isSafeInteger(now)||now<0)fail("invalid_safety_alert",400);
 const tx=await repository.transaction();
 try{
  const o=(await tx.get("publicOrderReceipts/"+id))?.data;
  if(o?.id!==id||o.courierUid!==actorUid||!uidOk(o.ownerUid)||o.fulfillment!=="entrega"||o.deliveryStatus!=="saiu_entrega"||o.clockStoppedAt)fail("safety_alert_forbidden");
  const path="users/"+o.ownerUid+"/deliverySafetyAlertsV6/"+id+"-"+kind,prior=await tx.get(path);
  if(prior&&now-Number(prior.data.atMs)<300000)return {ok:true,duplicate:true};
  const data={orderId:id,orderCode:String(o.code||"").slice(0,24),kind,atMs:now,createdAt:new Date(now).toISOString()};
  await tx.commit([{path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}}]);
  return {ok:true,duplicate:false};
 }finally{await tx.rollback()}
}
