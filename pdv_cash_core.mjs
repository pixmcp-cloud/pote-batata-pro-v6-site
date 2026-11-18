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
  const originalSession=(data.cashSessions||[]).find(s=>s.id===order?.cashSessionId);
  if(!order||!originalSession||order.status!=="cancelado"||
     !paymentConfirmed(order)||paymentKind(order.paymentMethod)!=="cash")
   fail("Somente pedidos cancelados, pagos em dinheiro e vinculados a turno de origem permitem reembolso");
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
  originSessionId:kind==="reembolso"?data.orders.find(o=>o.id===orderId).cashSessionId:null,
  at:asDate(at)};
 arr(data,"cashMovements").unshift(movement);
 return movement;
}
export function confirmRecordedPayment(data,{orderId,reference,at}){
 validateCashData(data);
 const order=data.orders.find(o=>o.id===orderId);
 if(!order||order.status==="cancelado")fail("Pedido inexistente ou cancelado");
 if(paymentConfirmed(order))fail("Pagamento já confirmado");
 const origin=(data.cashSessions||[]).find(s=>s.id===order.cashSessionId);
 if(origin?.status==="closed")
  fail("Turno de origem encerrado. Não altere um fechamento: lance um ajuste conciliatório no turno atual.");
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
 const origin=(data.cashSessions||[]).find(s=>s.id===order.cashSessionId);
 if(origin?.status==="closed")
  fail("Turno de origem encerrado. Não altere um fechamento: lance um ajuste conciliatório no turno atual.");
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
/* Completing an operator-handled sale is their declaration that payment was received.
 * Only Cash/Pix/Card can be auto-booked; "Na entrega"/"Outro" remain pending.
 * If no session exists, the first completed sale starts a zero-float shift to
 * avoid losing its payment from PDV reports. Closed shifts are never rewritten. */
export function confirmPaymentOnSaleCompletion(data,{orderId,operator,id,at}={}){
 validateCashData(data);
 const order=data.orders.find(o=>o.id===orderId);
 if(!order||order.status!=="entregue")fail("Somente uma venda concluída pode registrar recebimento automático");
 const kind=paymentKind(order.paymentMethod);
 if(!["cash","pix","card"].includes(kind))
  return {recorded:false,reason:"Forma de recebimento não definida"};
 const previous=(data.cashSessions||[]).find(s=>s.id===order.cashSessionId);
 const already=paymentConfirmed(order);
 if(already&&previous)return {recorded:false,reason:"Recebimento já contabilizado",sessionId:previous.id};
 const when=asDate(at);
 const note="Recebimento declarado na conclusão da venda pelo operador";
 let current=activeSession(data);
 if(!current){
  const turnId="auto-turn-"+String(order.id);
  if((data.cashSessions||[]).some(s=>s.id===turnId))fail("Turno automático duplicado");
  current=openCash(data,{id:turnId,openingCash:0,operator:operator||"Operador",at:when});
  current.autoStarted=true;
 }
 if(previous?.status==="closed"){
  const movementId="sale-completion-"+String(order.id);
  if((data.cashMovements||[]).some(m=>m.kind==="late_payment"&&m.orderId===order.id))
   return {recorded:false,reason:"Recebimento tardio já contabilizado",sessionId:current.id};
  // Append to the current shift; the closed report is frozen.
  settlePreviousPayment(data,{id:movementId,orderId:order.id,method:order.paymentMethod,reference:note,at:when});
  order.paymentStatus=kind==="cash"?"Pago em dinheiro":"pago";
  order.paymentConfirmedAt=when;
  order.paymentConfirmationReference=note;
  order.paymentConfirmationSource="conclusao-venda";
  return {recorded:true,late:true,sessionId:current.id};
 }
 if(previous&&previous.id!==current.id)
  fail("O pedido pertence a outro caixa aberto; concilie os turnos antes de concluir");
 if(!previous)order.cashSessionId=current.id;
 if(already){
  if(!previous){
   order.paymentConfirmedAt ||=when;
   order.paymentConfirmationReference ||=note;
   order.paymentConfirmationSource ||= "conclusao-venda";
   return {recorded:true,reason:"Recebimento vinculado ao caixa",sessionId:current.id};
  }
  return {recorded:false,reason:"Recebimento já confirmado",sessionId:current.id};
 }
 order.paymentStatus=kind==="cash"?"Pago em dinheiro":"pago";
 order.paymentConfirmedAt=when;
 order.paymentConfirmationReference=note;
 order.paymentConfirmationSource="conclusao-venda";
 return {recorded:true,late:false,sessionId:current.id};
}
export function listOutstandingPrevious(data){
 validateCashData(data);
 const current=activeSession(data);
 if(!current)return [];
 return data.orders.filter(order=>{
  const source=(data.cashSessions||[]).find(s=>s.id===order.cashSessionId);
  return source&&source.status==="closed"&&order.status!=="cancelado"&&
   !paymentConfirmed(order)&&orderAmountCents(order)>0&&
   !(data.cashMovements||[]).some(m=>m.kind==="late_payment"&&m.orderId===order.id);
 });
}
/* An append-only settlement event belongs to today's turn, not the frozen
   report of the original shift. A late payment never rewrites old orders. */
export function settlePreviousPayment(data,{id,orderId,method,reference,at}){
 validateCashData(data);
 const current=activeSession(data);
 if(!current)fail("Abra um novo turno para receber pagamentos atrasados");
 if(!id||data.cashMovements?.some(x=>x.id===id))fail("Movimentação duplicada");
 const order=listOutstandingPrevious(data).find(x=>x.id===orderId);
 if(!order)fail("Pedido antigo não elegível ou pagamento já registrado");
 const kind=paymentKind(method);
 if(!["cash","pix","card"].includes(kind))fail("Escolha dinheiro, Pix ou cartão");
 const ref=String(reference||"").trim();
 if(!ref)fail("Referência da conferência obrigatória");
 const value=orderAmountCents(order);
 const event={id,kind:"late_payment",sessionId:current.id,originSessionId:order.cashSessionId,
  orderId,amount:money(value),paymentMethod:kind,reference:ref.slice(0,160),at:asDate(at)};
 arr(data,"cashMovements").unshift(event);
 return event;
}
export function calculateCash(data,sessionId){
 validateCashData(data);
 const session=(data.cashSessions||[]).find(x=>x.id===sessionId);
 if(!session)fail("Turno inexistente");
 // Após fechar, a conferência histórica não pode ser recalculada por edições posteriores.
 if(session.status==="closed"&&session.closedSummary)
  return JSON.parse(JSON.stringify(session.closedSummary));
 const payments={cash:0,pix:0,card:0,delivery:0,other:0};
 let sales=0,unconfirmed=0,cancelledUnrefunded=0,cancelledPaid=0,confirmedCount=0,pendingCount=0;
 for(const order of data.orders){
  if(order.cashSessionId!==sessionId)continue;
  const total=orderAmountCents(order);
  const kind=paymentKind(order.paymentMethod);
  if(paymentConfirmed(order)){
   payments[kind]+=total;confirmedCount++;
   if(order.status==="cancelado")cancelledPaid+=total;
   else sales+=total;
   if(order.status==="cancelado"&&kind==="cash"&&
    !(data.cashMovements||[]).some(m=>m.kind==="reembolso"&&m.orderId===order.id))
     cancelledUnrefunded+=total;
  }else if(order.status!=="cancelado"){
   unconfirmed+=total;pendingCount++;
  }
 }
 let supply=0,withdraw=0,refunds=0,lateCash=0,lateReceived=0;
 const previousPayments={cash:0,pix:0,card:0};
 for(const m of data.cashMovements||[]){
  if(m.sessionId!==sessionId)continue;
  const c=cents(m.amount);
  if(!Number.isFinite(c))continue;
  if(m.kind==="suprimento")supply+=c;
  if(m.kind==="sangria")withdraw+=c;
  if(m.kind==="reembolso")refunds+=c;
  if(m.kind==="late_payment"){
   lateReceived+=c;
   if(m.paymentMethod in previousPayments)previousPayments[m.paymentMethod]+=c;
   if(m.paymentMethod==="cash")lateCash+=c;
  }
 }
 const opening=cents(session.openingCash);
 const expected=opening+payments.cash+lateCash+supply-withdraw-refunds;
 return {sessionId,expectedCashCents:expected,expectedCash:money(expected),
  openingCash:session.openingCash,
  sales:money(sales),cancelledPaid:money(cancelledPaid),pending:money(unconfirmed),pendingCount,
  receivedFromPrevious:money(lateReceived),
  previousByMethod:Object.fromEntries(Object.entries(previousPayments).map(([k,v])=>[k,money(v)])),
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
