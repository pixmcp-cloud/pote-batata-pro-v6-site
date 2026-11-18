import {OperationalError,recordPath} from "./domain.mjs";
const bad=(code,msg,status=409)=>{throw new OperationalError(msg,status,code)};
const put=(path,data,old)=>({path,data,precondition:old?{updateTime:old.updateTime}:{exists:false}});
const valid=x=>typeof x==="string"&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(x);
function method(raw){
 const p=String(raw||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(p.includes("entrega"))return null;
 if(p.includes("pix"))return "pix";
 if(p.includes("dinheiro"))return "cash";
 if(p.includes("cartao")||p.includes("credito")||p.includes("debito"))return "card";
 return null;
}
export async function finishSale(body,{user,env,repository,clock,hasAccess}){
 if(!body||typeof body!=="object"||Array.isArray(body)||
  Object.keys(body).some(k=>!["universe","orderId","operationId"].includes(k))||
  !/^[a-z0-9_-]{1,64}$/.test(body.universe||"")||
  !valid(body.orderId)||!/^[a-zA-Z0-9_-]{20,80}$/.test(body.operationId||""))
  bad("invalid_completion","Dados inv?lidos",400);
 const {universe,orderId,operationId}=body,uid=user.uid,root="users/"+uid;
 const orderPath=recordPath(uid,universe,"orders",orderId),
  eventPath=root+"/workerEvents/"+operationId,
  guardPath=root+"/appState/v2InventoryGuard",pulsePath=root+"/appState/v2Pulse";
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,stored,event]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(orderPath),tx.get(eventPath)
  ]);
  if(!profile||!hasAccess(profile.data,user,universe))
   bad("not_allowed","Sem permiss?o",403);
  if(event){
   const prev=event.data;
   if(prev.action!=="finish_sale"||prev.universe!==universe||prev.orderId!==orderId)
    bad("idempotency_conflict","Chave j? utilizada");
   return {ok:true,alreadyApplied:true,orderId,operationId,
    receiptRecorded:prev.receiptRecorded,bankReconciled:false};
  }
  if(!meta||meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying"||
     !guard||!Number.isInteger(guard.data?.revision)||!pulse?.data?.eventId)
   bad("not_ready","Sincroniza??o incompleta");
  const rec=stored?.data?.record,o=rec?.item;
  if(!rec||rec.group!=="orders"||rec.id!==orderId||rec.universe!==universe||!o)
   bad("order_missing","Pedido ausente",404);
  if(o.status!=="em_producao"||o.stockDeducted!==true)
   bad("order_state","Produ??o ainda n?o conclu?da");
  if(!valid(o.cashSessionId))bad("cash_required","Caixa obrigat?rio");
  const cash=await tx.get(recordPath(uid,universe,"cashSessions",o.cashSessionId));
  if(cash?.data?.record?.group!=="cashSessions"||
     cash.data.record.universe!==universe||cash.data.record.item?.status!=="open")
   bad("cash_closed","Caixa fechado");
  const qty=Number(o.qty),price=Number(o.price),fee=Number(o.deliveryFee||0);
  if(!Number.isFinite(qty)||qty<=0||qty>10000||!Number.isFinite(price)||
     price<0||price>1e8||!Number.isFinite(fee)||fee<0||fee>1e8)
   bad("invalid_amount","Valor inv?lido");
  const amountCents=Math.round(qty*price*100)+Math.round(fee*100);
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>1e10)
   bad("invalid_amount","Total inv?lido");
  const kind=method(o.paymentMethod);
  const paid=Boolean(o.paymentConfirmedAt)||["pago","confirmado","pago em dinheiro"]
   .includes(String(o.paymentStatus||"").toLowerCase());
  const receiptRecorded=Boolean(kind)&&!paid,at=clock().toISOString();
  const next={...o,status:"entregue",deliveredAt:at};
  if(receiptRecorded){
   next.paymentStatus=kind==="cash"?"Pago em dinheiro":"pago";
   next.paymentConfirmedAt=at;
   next.paymentDeclarationSource="operator";
   next.bankReconciled=false;
  }
  await tx.commit([
   put(orderPath,{record:{...rec,item:next}},stored),
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"cf-"+operationId,previousEventId:pulse.data.eventId,
    origin:"cloudflare-worker",affected:1,
    changedKeys:[orderPath.split("/").at(-1)],metaChanged:false,sensitive:true},pulse),
   put(eventPath,{action:"finish_sale",universe,orderId,operationId,
    receiptRecorded,amountCents,method:kind||"pending",
    actorUid:uid,bankReconciled:false},null)
  ]);
  return {ok:true,alreadyApplied:false,orderId,operationId,
   status:"entregue",receiptRecorded,amountCents,bankReconciled:false};
 }finally{await tx.rollback()}
}

