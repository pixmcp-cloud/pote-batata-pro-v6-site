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
    const [profile,meta,guard,pulse,ordered,event]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(orderPath),tx.get(eventPath)
  ]);
  if(!profile||!hasAccess(profile.data,user,universe))
   fail("not_allowed","Conta sem permissão",403);
  if(event){
   const prev=event.data;
   if(prev.action!=="receipt"||prev.universe!==universe||
      prev.orderId!==orderId||prev.reference!==reference)
    fail("idempotency_conflict","Identificador já utilizado");
   return {ok:true,alreadyApplied:true,orderId,operationId,
    amountCents:prev.amountCents,method:prev.method,bankReconciled:false};
  }
  if(!meta||meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying"||
     !guard||!Number.isInteger(guard.data?.revision)||!pulse?.data?.eventId)
   fail("not_ready","Sincronização V2 não está pronta");
  const rec=ordered?.data?.record,order=rec?.item;
  if(!rec||rec.group!=="orders"||rec.id!==orderId||
     rec.universe!==universe||!order)
   fail("order_missing","Pedido não encontrado",404);
  if(order.status!=="entregue"||order.stockDeducted!==true)
   fail("order_state","Conclua a venda antes de registrar recebimento");
  if(order.paymentConfirmedAt||["pago","confirmado","pago em dinheiro"].includes(
    String(order.paymentStatus||"").toLowerCase()))
   fail("already_paid","Pagamento já registrado");
  const method=methodFor(order.paymentMethod);
  if(!method)fail("payment_method","Forma de pagamento não permitida");
  const qty=Number(order.qty),price=Number(order.price),fee=Number(order.deliveryFee||0);
  if(!Number.isFinite(qty)||qty<=0||qty>10000||!Number.isFinite(price)||
     price<0||price>1e8||!Number.isFinite(fee)||fee<0||fee>1e8)
   fail("invalid_amount","Valor armazenado inválido");
  const amountCents=Math.round(qty*price*100)+Math.round(fee*100);
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>1e10)
   fail("invalid_amount","Valor total fora dos limites");
    if(!validId(order.cashSessionId))
   fail("cash_session_required","Abra o caixa antes de receber");
  const sessionPath=recordPath(uid,universe,"cashSessions",order.cashSessionId);
  const session=await tx.get(sessionPath);
  if(session?.data?.record?.group!=="cashSessions"||
     session.data.record.universe!==universe||
     session.data.record.item?.status!=="open")
   fail("cash_session_closed","Turno de caixa inexistente ou fechado");
  const at=clock().toISOString();
  const next={...order,paymentStatus:method==="cash"?"Pago em dinheiro":"pago",
   paymentConfirmedAt:at,
   paymentConfirmationReference:reference||"Recebimento declarado pelo operador",
   paymentDeclarationSource:"operator",bankReconciled:false};
    const writes=[
   change(orderPath,{record:{...rec,item:next}},ordered),
   change(guardPath,{revision:guard.data.revision+1},guard),
   change(pulsePath,{eventId:"cf-"+operationId,
    previousEventId:pulse.data.eventId,origin:"cloudflare-worker",
    affected:1,changedKeys:[orderPath.split("/").at(-1)],
    metaChanged:false,sensitive:true},pulse),
   change(eventPath,{action:"receipt",universe,orderId,operationId,
    reference,method,amountCents,actorUid:uid,bankReconciled:false},null)
  ];
  await tx.commit(writes);
  return {ok:true,alreadyApplied:false,orderId,operationId,amountCents,
   method,bankReconciled:false};
 }finally{await tx.rollback()}
}
