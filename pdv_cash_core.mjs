/* Potê Batata PDV — caixa operacional: regras puras, em centavos.
 * Não substitui adquirente, extrato bancário nem documento fiscal. */
export const PDV_VERSION=1;
const cents=value=>{
 const n=typeof value==="number"?value:Number(String(value??"").replace(",","."));
 if(!Number.isFinite(n)||n<0||n>100000000)return NaN;
 return Math.round(n*100);
};
const money=c=>Math.round(c)/100;
const fail=message=>{throw Error(message)};
const arr=(data,key)=>{if(!Array.isArray(data[key]))data[key]=[];return data[key]};
const asDate=at=>at||new Date().toISOString();
export const activeSession=data=>(data?.cashSessions||[]).find(s=>s.status==="open")||null;
export function validateCashData(data){
 if(!data||!Array.isArray(data.orders))fail("Dados comerciais indisponíveis");
 return data;
}
export function paymentKind(method){
 const s=String(method||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(s.includes("dinheiro"))return "cash";
 if(s.includes("pix"))return "pix";
 if(s.includes("cartao")||s.includes("credito")||s.includes("debito"))return "card";
 if(s.includes("entrega"))return "delivery";
 return "other";
}
export function orderAmountCents(order){
 return Math.max(0,Math.round((Number(order.qty)||0)*(Number(order.price)||0)*100)+
  Math.round((Number(order.deliveryFee)||0)*100));
}
export function paymentConfirmed(order){
 if(!order||order.paymentStatus==="nao_pago")return false;
 if(order.paymentConfirmedAt)return true;
 const s=String(order.paymentStatus||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return s==="pago"||s==="confirmado"||s==="pago em dinheiro";
}
export function openCash(data,{openingCash,operator,id,at}){
 validateCashData(data);
 if(activeSession(data))fail("Já existe um caixa aberto. Feche o turno atual primeiro.");
 const total=cents(openingCash);
 if(!Number.isFinite(total))fail("Fundo de caixa inválido");
 if(!id||typeof id!=="string")fail("ID de turno obrigatório");
 if(data.cashSessions?.some(x=>x.id===id))fail("Turno já existente");
 const session={id,status:"open",openedAt:asDate(at),openingCash:money(total),
  operator:String(operator||"Operador").slice(0,90),version:PDV_VERSION};
 arr(data,"cashSessions").unshift(session);
 arr(data,"cashMovements");
 return session;
}
export function registerCashMovement(data,{id,kind,amount,reason,orderId,at}){
 validateCashData(data);
 const session=activeSession(data);
 if(!session)fail("Abra o caixa antes de registrar movimentações");
 if(!["suprimento","sangria","reembolso"].includes(kind))fail("Movimentação não permitida");
 const total=cents(amount);if(!Number.isFinite(total)||total<=0)fail("Valor inválido");
 if(!id||data.cashMovements?.some(x=>x.id===id))fail("Movimentação duplicada");
 if(kind==="reembolso"){
  const order=data.orders.find(x=>x.id===orderId);
  if(!order||order.cashSessionId!==session.id||order.status!=="cancelado"||
     !paymentConfirmed(order)||paymentKind(order.paymentMethod)!=="cash")
   fail("Apenas pedidos cancelados e pagos em dinheiro neste turno permitem reembolso");
  if((data.cashMovements||[]).some(x=>x.kind==="reembolso"&&x.orderId===orderId))
   fail("Este pedido já recebeu reembolso registrado");
  if(total!==orderAmountCents(order))fail("O reembolso deve corresponder ao valor integral do pedido");
 }
 if(kind!=="reembolso"&&!String(reason||"").trim())fail("Informe o motivo da movimentação");
 const expected=calculateCash(data,session.id).expectedCashCents;
 if(kind!=="suprimento"&&total>expected)fail("Saldo de caixa insuficiente");
 const movement={id,sessionId:session.id,kind,amount:money(total),
  reason:String(reason||"Devolução ao cliente").trim().slice(0,220),
  orderId:kind==="reembolso"?String(orderId):null,
  at:asDate(at)};
 arr(data,"cashMovements").unshift(movement);
 return movement;
}
export function confirmRecordedPayment(data,{orderId,reference,at}){
 validateCashData(data);
 const order=data.orders.find(o=>o.id===orderId);
 if(!order||order.status==="cancelado")fail("Pedido inexistente ou cancelado");
 if(paymentConfirmed(order))fail("Pagamento já confirmado");
 const method=paymentKind(order.paymentMethod);
 if(method==="delivery"||method==="other")fail("Escolha a forma de pagamento no pedido antes de confirmar");
 const ref=String(reference||"").trim();
 if(!ref)fail("Confirme a conferência do comprovante ou extrato antes de registrar");
 order.paymentStatus="pago";order.paymentConfirmedAt=asDate(at);
 order.paymentConfirmationReference=ref.slice(0,120);
 return order;
}
export function settleDeliveryPayment(data,{orderId,method,reference,at}){
 validateCashData(data);
 const order=data.orders.find(o=>o.id===orderId);
 if(!order||order.status==="cancelado")fail("Pedido inexistente ou cancelado");
 if(paymentConfirmed(order))fail("Pagamento já registrado");
 if(paymentKind(order.paymentMethod)!=="delivery"&&paymentKind(order.paymentMethod)!=="other")
  fail("Este pedido não está marcado como pagamento na entrega");
 const kind=paymentKind(method);
 if(!["cash","pix","card"].includes(kind))fail("Selecione dinheiro, Pix ou cartão");
 const ref=String(reference||"").trim();
 if(kind!=="cash"&&!ref)fail("Confirme o comprovante antes de registrar");
 order.paymentMethod={cash:"Dinheiro",pix:"Pix",card:"Cartão"}[kind];
 order.paymentStatus=kind==="cash"?"Pago em dinheiro":"pago";
 order.paymentConfirmedAt=asDate(at);
 order.paymentConfirmationReference=(kind==="cash"?"Recebido pelo operador: ":"Comprovante conferido: ")+
  (ref||"Pagamento em espécie");
 return order;
}
export function calculateCash(data,sessionId){
 validateCashData(data);
 const session=(data.cashSessions||[]).find(x=>x.id===sessionId);
 if(!session)fail("Turno inexistente");
 const payments={cash:0,pix:0,card:0,delivery:0,other:0};
 let sales=0,unconfirmed=0,cancelledUnrefunded=0,confirmedCount=0,pendingCount=0;
 for(const order of data.orders){
  if(order.cashSessionId!==sessionId)continue;
  const total=orderAmountCents(order);
  const kind=paymentKind(order.paymentMethod);
  if(paymentConfirmed(order)){
   payments[kind]+=total;sales+=total;confirmedCount++;
   if(order.status==="cancelado"&&kind==="cash"&&
    !(data.cashMovements||[]).some(m=>m.kind==="reembolso"&&m.orderId===order.id))
     cancelledUnrefunded+=total;
  }else if(order.status!=="cancelado"){
   unconfirmed+=total;pendingCount++;
  }
 }
 let supply=0,withdraw=0,refunds=0;
 for(const m of data.cashMovements||[]){
  if(m.sessionId!==sessionId)continue;
  const c=cents(m.amount);
  if(!Number.isFinite(c))continue;
  if(m.kind==="suprimento")supply+=c;
  if(m.kind==="sangria")withdraw+=c;
  if(m.kind==="reembolso")refunds+=c;
 }
 const opening=cents(session.openingCash);
 const expected=opening+payments.cash+supply-withdraw-refunds;
 return {sessionId,expectedCashCents:expected,expectedCash:money(expected),
  openingCash:session.openingCash,
  sales:money(sales),pending:money(unconfirmed),pendingCount,
  confirmedCount,confirmedByMethod:Object.fromEntries(Object.entries(payments).map(([k,v])=>[k,money(v)])),
  supply:money(supply),withdraw:money(withdraw),refunds:money(refunds),
  cancelledCashAwaitingRefund:money(cancelledUnrefunded),
  movements:(data.cashMovements||[]).filter(x=>x.sessionId===sessionId).length};
}
export function closeCash(data,{countedCash,operator,at}){
 const session=activeSession(data);
 if(!session)fail("Não existe caixa aberto");
 const counted=cents(countedCash);
 if(!Number.isFinite(counted))fail("Digite o dinheiro efetivamente contado");
 const report=calculateCash(data,session.id);
 session.status="closed";
 session.closedAt=asDate(at);
 session.closedBy=String(operator||session.operator).slice(0,90);
 session.countedCash=money(counted);
 session.expectedCash=report.expectedCash;
 session.difference=money(counted-report.expectedCashCents);
 session.closedSummary=report;
 return session;
}
