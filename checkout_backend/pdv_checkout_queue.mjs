// B02.3 isolated queue for online orders. Never insert these objects into legacy
// state.data.orders: its production/cash handlers have different semantics.
const statuses={received:"Recebido",preparing:"Em preparo",ready:"Finalizado",out_for_delivery:"Saiu para entrega",delivered:"Entregue",cancelled:"Cancelado"};
const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
const int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const actions={received:["prepare","cancel"],preparing:["ready"],ready:["dispatch","deliver"],out_for_delivery:["deliver"],delivered:[],cancelled:[]};
const clone=x=>JSON.parse(JSON.stringify(x));
export function queueRow(order,now){
 if(!order||!id(order.id)||!id(order.storeId)||!Object.hasOwn(statuses,order.status)||!["pending","confirmed","refunded"].includes(order.paymentStatus)||!int(order.createdAt,1)||!int(order.totalCents,1)||!int(now,1)||!Array.isArray(order.lines))throw Error("invalid_order");
 const end=order.status==="delivered"?order.deliveredAt:order.status==="cancelled"?order.events?.at(-1)?.at:now;
 if(!int(end,order.createdAt))throw Error("invalid_time");
 const available=actions[order.status].filter(a=>(a!=="dispatch"||order.fulfillment==="delivery")&&(a!=="deliver"||order.status!=="ready"||order.fulfillment==="pickup")&&(a!=="cancel"||(order.paymentStatus==="pending"&&order.stockState==="reserved")));
 if(order.status!=="cancelled"&&order.paymentStatus==="pending")available.push("confirm_payment");
 return {id:order.id,storeId:order.storeId,label:statuses[order.status],status:order.status,totalCents:order.totalCents,paymentStatus:order.paymentStatus,paymentMethod:order.paymentMethod,canReconcile:["received","preparing","ready","out_for_delivery"].includes(order.status)&&["reserved","consumed"].includes(order.stockState)&&(order.stockState==="consumed"||order.paymentStatus==="confirmed")&&!(order.paymentStatus==="confirmed"&&order.paymentMethod==="cash"),stockState:order.stockState,reservationExpiresAt:order.reservationExpiresAt??null,elapsedMs:end-order.createdAt,createdAt:order.createdAt,actions:available,lines:clone(order.lines),fulfillment:order.fulfillment};
}
export function orderPrintText(order){
 const row=queueRow(order,order.deliveredAt);
 if(row.status!=="delivered")throw Error("receipt_pending");
 const money=c=>{if(!int(c))throw Error("invalid_total");return (c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})};
 const seconds=Math.floor(row.elapsedMs/1000),pad=n=>String(n).padStart(2,"0"),elapsed=pad(Math.floor(seconds/3600))+":"+pad(Math.floor(seconds/60)%60)+":"+pad(seconds%60);
 const clean=x=>String(x??"").replace(/[\r\n\x00-\x1f]/g," ").slice(0,220);
 return [order.channel==="counter"?"PDV NÚCLEOBIT — VENDA DE BALCÃO":"PDV NÚCLEOBIT — PEDIDO ONLINE","COMPROVANTE NÃO FISCAL — LABORATÓRIO","#"+row.id,...row.lines.map(l=>clean(l.quantity)+"x "+clean(l.title)+" — "+money(l.totalCents)),"Total: "+money(row.totalCents),"Pagamento: "+(row.paymentStatus==="confirmed"?"Confirmado pelo lojista":"Pendente"),"Recebido: "+new Date(order.createdAt).toISOString(),"Entregue: "+new Date(order.deliveredAt).toISOString(),"Tempo total: "+elapsed].join("\n");
}
// Owner-only read subscription and transition transport are injected. Auth/rules
// and server transactions enforce authorization, not this UI controller.
export function createQueueController({storeId,subscribeOwner,transition,emit,clock=()=>Date.now()}={}){
 if(!id(storeId)||typeof subscribeOwner!=="function"||typeof transition!=="function"||typeof emit!=="function")throw Error("invalid_config");
 let closed=false,rows=new Map(),busy=new Set();
 const publish=()=>{if(!closed)emit([...rows.values()].map(o=>queueRow(o,clock())).sort((a,b)=>b.createdAt-a.createdAt))};
 const detach=subscribeOwner(storeId,orders=>{
  if(closed)return;
  rows=new Map((Array.isArray(orders)?orders:[]).filter(o=>o?.storeId===storeId).map(o=>[o.id,o]));publish();
 },()=>{rows.clear();publish()});
 async function act(orderId,action,operationId,paymentReference){
  if(closed||!rows.has(orderId)||!id(operationId)||operationId.length<16)throw Error("unavailable");
  if(!queueRow(rows.get(orderId),clock()).actions.includes(action))throw Error("invalid_action");
  if(action==="confirm_payment"&&(typeof paymentReference!=="string"||!paymentReference.trim()||paymentReference.trim().length>120))throw Error("payment_reference_required");
  if(action!=="confirm_payment"&&paymentReference!==undefined)throw Error("invalid_action");
  if(busy.has(orderId))throw Error("busy");
  busy.add(orderId);
  try{return await transition({storeId,orderId,action,operationId,...(paymentReference!==undefined?{paymentReference:paymentReference.trim()}:{})})}
  finally{busy.delete(orderId)}
 }
 async function reconcile(orderId,operationId,values){
  if(closed||!rows.has(orderId)||!id(operationId)||operationId.length<16||busy.has(orderId))throw Error("unavailable");
  const row=queueRow(rows.get(orderId),clock());
  if(!row.canReconcile||!values||typeof values.reason!=="string"||!values.reason.trim()||values.reason.length>220||!["return","loss"].includes(values.stockDecision)||row.stockState==="consumed"&&values.stockDecision!=="loss")throw Error("invalid_reconciliation");
  const ref=typeof values.refundReference==="string"?values.refundReference.trim():"";
  if(row.paymentStatus==="confirmed"&&(!ref||ref.length>120))throw Error("refund_reference_required");
  if(row.paymentStatus==="pending"&&ref)throw Error("refund_not_due");
  busy.add(orderId);try{return await transition({storeId,orderId,operationId,action:"reconcile_cancel",reconciliation:{reason:values.reason.trim(),stockDecision:values.stockDecision,...(ref?{refundReference:ref}:{})}})}finally{busy.delete(orderId)}
 }
 return {act,reconcile,print(orderId){if(closed||!rows.has(orderId))throw Error("unavailable");return orderPrintText(rows.get(orderId))},close(){closed=true;rows.clear();if(typeof detach==="function")detach();emit([])}};
}
