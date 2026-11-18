/* F20: operator-declared receipt. Not proof of bank settlement. */
import {OperationalError,recordPath} from "./domain.mjs";
const fail=(code,message,status=409)=>{throw new OperationalError(message,status,code)};
const validId=s=>typeof s==="string"&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(s);
const change=(path,data,prior)=>({path,data,
 precondition:prior?{updateTime:prior.updateTime}:{exists:false}});
function methodFor(raw){
 const normalized=String(raw||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(normalized.includes("pix"))return "pix";
 if(normalized.includes("dinheiro"))return "cash";
 if(normalized.includes("cartao")||normalized.includes("credito")||
    normalized.includes("debito"))return "card";
 return null;
}
export async function confirmOperatorReceipt(body,{user,env,repository,clock,hasAccess}){
 if(!body||typeof body!=="object"||Array.isArray(body)||
  Object.keys(body).some(k=>!["universe","orderId","operationId","reference"].includes(k))||
  typeof body.universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(body.universe)||
  !validId(body.orderId)||typeof body.operationId!=="string"||
  !/^[a-zA-Z0-9_-]{20,80}$/.test(body.operationId)||
  (body.reference!==undefined&&(typeof body.reference!=="string"||body.reference.length>120)))
  fail("invalid_receipt","Dados de confirmação inválidos",400);
 const {universe,orderId,operationId}=body,reference=(body.reference||"").trim();
 const uid=user.uid,root="users/"+uid,orderPath=recordPath(uid,universe,"orders",orderId);
 const eventPath=root+"/workerEvents/"+operationId;
 const guardPath=root+"/appState/v2InventoryGuard",pulsePath=root+"/appState/v2Pulse";
 const tx=await repository(env).transaction();
 try{
  // F20_RECEIPT_TRANSACTION
 }finally{await tx.rollback()}
}
