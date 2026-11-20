/* F02/F05/F20 - invariant checks before V5 transaction.
   No cloud read cost. These cannot authenticate external payment receipts. */
import {recordId} from "./v5_store_core.mjs";
import {paymentConfirmed,paymentKind,orderAmountCents} from "./pdv_cash_core.mjs";
const error=(message)=>{const e=Error(message);e.code="integrity/rejected";throw e};
const near=(a,b)=>Math.abs(Number(a)-Number(b))<=0.00002;
const add=(map,k,v)=>map.set(k,(map.get(k)||0)+v);
const newItems=(diff,group)=>diff.changes.filter(c=>c.kind==="record"&&!c.before&&c.after?.group===group).map(c=>c.after);
const changedOrders=diff=>diff.changes.filter(c=>c.kind==="record"&&c.before?.group==="orders"&&c.after?.group==="orders");
function orderNeeds(order){
 const q=Math.max(1,Number(order.qty)||1),ins=new Map(),bevs=new Map();
 if(order.stockOverrideApproved&&order.stockActualConsumed){
  for(const [id,quantity] of Object.entries(order.stockActualConsumed.ingredients||{}))ins.set(id,Number(quantity)||0);
  for(const [id,quantity] of Object.entries(order.stockActualConsumed.beverages||{}))bevs.set("bev:"+id,Number(quantity)||0);
 }else{
  for(const row of order.items||[]){
   const id=String(row.id||"");if(!id)continue;
   add(ins,id,(Number(row.g)||0)*q/Math.max(.01,Number(row.yieldPct||100)/100));
  }
  for(const row of order.beverageItems||[]){
   const id=String(row.id||"");if(id)add(bevs,"bev:"+id,(Number(row.qty)||0)*q);
  }
 }
 return new Map([...ins,...bevs]);
}
export function validateProductionJournalDiff(diff){
 if(!diff?.changes?.length)return {produced:0};
 const moves=newItems(diff,"stockMovements");
 let produced=0;
 for(const c of changedOrders(diff)){
  const before=c.before.item,after=c.after.item;
  if(before?.stockDeducted===true||after?.stockDeducted!==true)continue;
  if(!["em_producao","entregue"].includes(after.status))
   error("Baixa de pedido sem transição para produção.");
  const expected=orderNeeds(after),actual=new Map();
  for(const move of moves){
   if(move.universe!==c.after.universe||move.item?.referenceId!==after.id)continue;
   if(!(Number(move.item.quantity)<0))continue;
   const id=String(move.item.ingredientId||"");
   if(!id)error("Movimento de produção sem ingrediente identificado.");
   add(actual,id,-Number(move.item.quantity));
  }
  for(const [id,quantity] of expected){
   if(quantity>0&&!near(quantity,actual.get(id)||0))
    error("Consumo sem baixa correspondente do pedido "+after.id+": "+id);
  }
  for(const [id,quantity] of actual)
   if(!expected.has(id)||!near(quantity,expected.get(id)))
    error("Baixa excedente ou indevida do pedido "+after.id+": "+id);
  produced++;
 }
 return {produced};
}
export function validateCancellationJournalDiff(diff){
 if(!diff?.changes?.length)return {returns:0,losses:0};
 const moves=newItems(diff,"stockMovements"),losses=newItems(diff,"losses");
 let returns=0,lost=0;
 for(const c of changedOrders(diff)){
  const before=c.before.item,after=c.after.item;
  if(after?.stockRestored===true&&before?.stockRestored!==true){
   if(after.status!=="cancelado"||after.stockReturnDeclined===true)
    error("Pedido com estorno incompatível com cancelamento.");
   const expected=orderNeeds(after),found=new Map();
   for(const m of moves){
    const item=m.item;
    if(item?.referenceId!==after.id||!(Number(item.quantity)>0))continue;
    if(!/^Estorno (?:de estoque|bebida) por cancelamento$/i.test(String(item.reason||"")))
     error("Estorno de pedido com motivo inconsistente.");
    add(found,String(item.ingredientId||""),Number(item.quantity));
   }
   for(const [id,qty] of expected){
    if(qty>0&&!near(qty,found.get(id)||0))
     error("Estorno incompleto ou duplicado de "+id+" no pedido "+after.id);
   }
   for(const [id,qty] of found){
    if(!expected.has(id)||!near(qty,expected.get(id)))
     error("Estorno excedente no pedido "+after.id+": "+id);
    const drink=id.startsWith("bev:");
    const key=drink?id.slice(4):id;
    const deltaStock=diff.changes.find(ch=>ch.kind==="record"&&
     ch.before?.group===(drink?"beverages":"ingredients")&&
     ch.after?.group===(drink?"beverages":"ingredients")&&
     ch.after.universe===c.after.universe&&ch.after.id===key);
    if(!deltaStock||!near(Number(deltaStock.after.item.stock)-Number(deltaStock.before.item.stock),qty))
     error("Estorno sem reposição física correspondente: "+id);
   }
   returns++;
  }
  if(after?.stockReturnDeclined===true&&before?.stockReturnDeclined!==true){
   if(after.status!=="cancelado"||after.stockRestored===true)
    error("Pedido marcado como perda e devolução simultaneamente.");
   const event=losses.filter(l=>l.item?.orderId===after.id&&l.item?.id===after.lossEventId);
   if(event.length!==1||event[0].item.type!=="order")
    error("Cancelamento por perda exige evento de prejuízo correspondente.");
   lost++;
  }
 }
 return {returns,losses:lost};
}
export function validateCashJournalDiff(before,next,diff){
 if(!diff?.changes?.length)return {checked:0};
 const added=newItems(diff,"cashMovements");
 let checked=0;
 for(const m of added){
  const event=m.item;
  if(!["reembolso","late_payment"].includes(event.kind))continue;
  const orderKey=recordId(m.universe,"orders",String(event.orderId||""));
  const order=next.records.get(orderKey)?.item;
  if(!order)error("Movimento financeiro sem pedido de origem existente: "+event.id);
  const value=orderAmountCents(order)/100;
  if(!near(value,event.amount)||value<=0)
   error("Valor financeiro divergente do pedido: "+event.id);
  if(event.originSessionId!==order.cashSessionId)
   error("Turno de origem incorreto no movimento: "+event.id);
  if(event.kind==="reembolso"&&(order.status!=="cancelado"||!paymentConfirmed(order)||paymentKind(order.paymentMethod)!=="cash"||String(event.reason||"").trim().length===0))
   error("Reembolso sem pedido cancelado, pago em dinheiro e motivo documentado.");
  if(event.kind==="late_payment"){
   const previousOrder=before?.records?.get(orderKey)?.item;
   const confirmationInThisCommit=previousOrder&&!paymentConfirmed(previousOrder)&&
    paymentConfirmed(order)&&diff.changes.some(ch=>
     ch.kind==="record"&&ch.before?.group==="orders"&&
     ch.after?.group==="orders"&&ch.after.universe===m.universe&&
     ch.after.id===event.orderId&&!paymentConfirmed(ch.before.item)&&
     paymentConfirmed(ch.after.item));
   // O pedido pode ser confirmado no MESMO commit do recebimento tardio
   // (ex.: "Concluir" com turno original já encerrado). Continuamos
   // recusando pagamentos já confirmados antes desta operação.
   const duplicateConfirmation=paymentConfirmed(previousOrder)||
    (paymentConfirmed(order)&&!confirmationInThisCommit);
   if(order.status==="cancelado"||duplicateConfirmation||
      !["cash","pix","card"].includes(event.paymentMethod)||
      !String(event.reference||"").trim())
    error("Pagamento antigo já confirmado, duplicado ou sem comprovante válido.");
  }
  const duplicate=[...next.records.values()].filter(x=>x.group==="cashMovements"&&x.universe===m.universe&&
   x.item?.kind===event.kind&&x.item?.orderId===event.orderId);
  if(duplicate.length!==1)error("Movimento financeiro duplicado: "+event.orderId);
  checked++;
 }
 return {checked};
}
