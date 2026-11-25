import {OperationalError,recordPath} from "./domain.mjs";
const deny=(message,code="order_state")=>{throw new OperationalError(message,409,code)};
const validUid=x=>typeof x==="string"&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const validId=x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x);
export function trackingPath(uid,id){
 if(!validUid(uid)||!validId(id))deny("Referência de consumidor inválida.","tracking_invalid");
 return "consumerOrders/"+uid+"/orders/"+id;
}
export function initialTracking({rows,slug,title,total,at,checkoutId}){
 return {checkoutId,slug,storeTitle:String(title||"Loja").slice(0,70),createdAt:at,updatedAt:at,status:"recebido",
  finishedAt:null,durationSeconds:null,totalCents:total,deliveryType:rows[0]?.deliveryType||"Retirada",...(rows[0]?.deliveryType==="Tele-entrega"?{deliveryFeeCents:Math.round(rows.reduce((sum,o)=>sum+(o.deliveryFee||0),0)*100),deliveryAddress:rows[0].clientAddress}:{}),lines:rows.map(o=>({id:o.id,orderNumber:o.orderNumber,name:o.name,qty:o.qty,priceCents:Math.round(o.price*100),status:"recebido"}))};
}
export function updateTracking(previous,updates,at){
 if(!previous||!Array.isArray(previous.lines)||!previous.lines.length||previous.lines.length>20)deny("Histórico do pedido indisponível.","tracking_invalid");
 const lines=previous.lines.map(line=>{
  const row=updates.find(o=>o.id===line.id);
  if(!row)return line;
  return {...line,status:row.status,readyAt:row.checkoutReadyAt||null,dispatchedAt:row.checkoutDispatchedAt||null,finishedAt:row.finishedAt||null,canceledAt:row.canceledAt||null};
 });
 const active=lines.filter(l=>l.status!=="cancelado");
 let status="recebido";
 if(!active.length)status="cancelado";
 else if(active.every(l=>l.status==="entregue"))status="entregue";
 else if(active.every(l=>l.dispatchedAt))status="saiu_entrega";
 else if(active.every(l=>l.readyAt))status="finalizado";
 else if(active.some(l=>l.status==="em_producao"||l.status==="entregue"))status="em_preparo";
 const terminal=status==="entregue"||status==="cancelado";
 const finishedAt=terminal?(previous.finishedAt||at):null;
 const start=Date.parse(previous.createdAt),end=Date.parse(finishedAt);
 if(terminal&&(!Number.isFinite(start)||!Number.isFinite(end)||end<start))deny("Horário inválido.","tracking_invalid");
 return {...previous,lines,status,updatedAt:at,finishedAt,durationSeconds:terminal?Math.floor((end-start)/1000):null,
  totalCents:active.reduce((sum,l)=>sum+l.qty*l.priceCents,0)+(active.length?previous.deliveryFeeCents||0:0)};
}
export async function loadTracking(tx,uid,order){
 if(order.source!=="public-checkout"||!order.consumerUid)return null;
 const path=trackingPath(order.consumerUid,order.checkoutId);
 const [doc,event]=await Promise.all([tx.get(path),tx.get("users/"+uid+"/publicCheckoutEvents/"+order.checkoutId)]);
 if(!doc||event?.data?.consumerUid!==order.consumerUid||doc.data.checkoutId!==order.checkoutId||!doc.data.lines?.some(l=>l.id===order.id))deny("Histórico não vinculado ao pedido.","tracking_invalid");
 return {path,doc};
}
export function planLifecycle(rows,action,at){
 const active=rows.filter(o=>o.status!=="cancelado");
 if(!active.length||!["ready","dispatch","deliver"].includes(action))deny("Pedido não disponível.");
 if(active.some(o=>o.status!=="em_producao"||o.stockDeducted!==true))deny("Conclua a produção de todos os itens primeiro.");
 if(action==="ready"&&active.some(o=>o.checkoutReadyAt))deny("Pedido já finalizado.");
 if(action==="dispatch"&&active.some(o=>!o.checkoutReadyAt||o.checkoutDispatchedAt||o.deliveryType!=="Tele-entrega"))deny("Pedido não está pronto para entrega.");
 if(action==="deliver"&&active.some(o=>!o.checkoutReadyAt||(o.deliveryType==="Tele-entrega"&&!o.checkoutDispatchedAt)))deny("Finalize o preparo antes de entregar.");
 return active.map(o=>{
  if(action==="ready")return {...o,checkoutReadyAt:at};
  if(action==="dispatch")return {...o,checkoutDispatchedAt:at};
  const durationSeconds=Math.floor((Date.parse(at)-Date.parse(o.createdAt))/1000);
  if(!Number.isSafeInteger(durationSeconds)||durationSeconds<0)deny("Horário inválido.","tracking_invalid");
  return {...o,status:"entregue",finishedAt:at,durationSeconds};
 });
}
export async function lifecycleRows(tx,uid,universe,tracking,action,at){
 const rows=await Promise.all(tracking.doc.data.lines.map(async line=>{
  const path=recordPath(uid,universe,"orders",line.id),doc=await tx.get(path),o=doc?.data?.record?.item;
  if(!o||o.checkoutId!==tracking.doc.data.checkoutId||o.id!==line.id||o.source!=="public-checkout"||o.status!==line.status)deny("Histórico e pedido divergentes.","tracking_invalid");
  return {path,doc,o};
 }));
 const planned=planLifecycle(rows.map(r=>r.o),action,at);
 return rows.filter(r=>planned.some(o=>o.id===r.o.id)).map(r=>({...r,next:planned.find(o=>o.id===r.o.id)}));
}
