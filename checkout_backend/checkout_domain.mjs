// B02.1 isolated transactional domain. Not wired to production, Firestore or payments.
// Server-owned snapshots only. Caller MUST authenticate actor and atomically commit
// returned state under a durable transaction including the PDV/stock/pulse writes.
const id=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const int=(x,min=0,max=1000000000)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const fields=(x,keys)=>x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k));
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=(code)=>{throw Object.assign(Error(code),{code})};
const key=x=>id(x)&&x.length>=16;
const time=x=>int(x,1,8640000000000000);
const add=(a,b)=>{const x=a+b;if(!int(x))fail("limit");return x};
const mul=(a,b)=>{const x=a*b;if(!int(x))fail("limit");return x};
function customer(actor,store){
 if(!actor||actor.verified!==true||actor.provider!=="google.com"||!id(actor.uid)||actor.role!=="customer")fail("login_required");
 if(!id(store?.id)||store.enabled!==true)fail("store_unavailable");
}
function merchant(actor,store){
 if(!actor||actor.verified!==true||actor.provider!=="google.com"||actor.role!=="merchant"||actor.storeId!==store?.id||!id(actor.uid)||!id(store?.id))fail("forbidden");
}
function needsMap(list,qty,map){
 if(!Array.isArray(list)||!list.length||list.length>80)fail("invalid_recipe");
 for(const p of list){if(!id(p?.stockId)||!int(p?.units,1))fail("invalid_recipe");map.set(p.stockId,add(map.get(p.stockId)||0,mul(p.units,qty)))}
}
function requestShape(input){
 if(!fields(input,["lines","fulfillment","paymentMethod","address"])||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>40||!["delivery","pickup"].includes(input.fulfillment)||!["pix","card","cash"].includes(input.paymentMethod))fail("invalid_request");
 if(input.fulfillment==="delivery"&&(typeof input.address!=="string"||!input.address.trim()||input.address.length>220))fail("invalid_address");
 if(input.fulfillment==="pickup"&&input.address!==undefined&&input.address!=="")fail("invalid_address");
 const lines=input.lines.map(l=>{
  if(!fields(l,["productId","quantity","extras","note"])||!id(l.productId)||!int(l.quantity,1,99)||!Array.isArray(l.extras)||l.extras.length>20||typeof(l.note??"")!=="string"||(l.note??"").length>220)fail("invalid_line");
  const seen=new Set();
  const extras=l.extras.map(e=>{if(!fields(e,["id","quantity"])||!id(e.id)||!int(e.quantity,1,10)||seen.has(e.id))fail("invalid_extra");seen.add(e.id);return {id:e.id,quantity:e.quantity}}).sort((a,b)=>a.id.localeCompare(b.id));
  return {productId:l.productId,quantity:l.quantity,extras,note:(l.note??"").trim()};
 });
 return {lines,fulfillment:input.fulfillment,paymentMethod:input.paymentMethod,address:input.fulfillment==="delivery"?input.address.trim():""};
}
export function quoteCheckout(store,actor,input,now){
 customer(actor,store);if(!time(now)||!id(store.revision)||!Array.isArray(store.products)||!Array.isArray(store.inventory))fail("not_ready");
 const req=requestShape(input),needs=new Map(),lines=[];let subtotal=0;
 for(const l of req.lines){
  const product=store.products.find(p=>p.id===l.productId);
  if(!product||product.available!==true||!int(product.priceCents,1)||typeof product.title!=="string"||!Array.isArray(product.extras))fail("product_unavailable");
  let unit=product.priceCents;needsMap(product.recipe,l.quantity,needs);
  for(const e of l.extras){
   const a=product.extras.find(x=>x.id===e.id);
   if(!a||a.available!==true||!int(a.priceCents))fail("extra_unavailable");
   unit=add(unit,mul(a.priceCents,e.quantity));needsMap(a.recipe,mul(l.quantity,e.quantity),needs);
  }
  const total=mul(unit,l.quantity);subtotal=add(subtotal,total);lines.push({...l,title:product.title,unitCents:unit,totalCents:total});
 }
 const required=[...needs.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([stockId,units])=>({stockId,units}));
 for(const n of required){const s=store.inventory.find(x=>x.id===n.stockId);if(!s||!int(s.availableUnits)||s.availableUnits<n.units)fail("insufficient_stock")}
 if(req.fulfillment==="delivery"&&(store.deliveryEnabled!==true||!int(store.deliveryFeeCents)))fail("delivery_unavailable");
 const fee=req.fulfillment==="delivery"?store.deliveryFeeCents:0;
 return {request:req,storeId:store.id,customerUid:actor.uid,revision:store.revision,lines,required,subtotalCents:subtotal,deliveryCents:fee,totalCents:add(subtotal,fee),expiresAt:now+300000};
}
// Quote stored by trusted server; quoteId generated there, not accepted as a client price.
export function createCheckoutQuote(store,actor,input,quoteId,now){
 if(!key(quoteId)||!Array.isArray(store.quotes)||store.quotes.some(x=>x.id===quoteId))fail("invalid_quote");
 const q=quoteCheckout(store,actor,input,now),next=clone(store);
 next.quotes.push({id:quoteId,storeId:q.storeId,customerUid:q.customerUid,request:q.request,revision:q.revision,totalCents:q.totalCents,expiresAt:q.expiresAt,used:false});
 return {state:next,quote:{quoteId,lines:q.lines,subtotalCents:q.subtotalCents,deliveryCents:q.deliveryCents,totalCents:q.totalCents,revision:q.revision,expiresAt:q.expiresAt}};
}
export function submitCheckout(store,actor,{operationId,quoteId,input,expectedRevision,expectedTotalCents}={},now){
 customer(actor,store);if(!key(operationId)||!key(quoteId)||!id(expectedRevision)||!int(expectedTotalCents,1)||!time(now)||!Array.isArray(store.orders)||!int(store.sequence,0,9999998))fail("invalid_submit");
 const request=requestShape(input);
 const fingerprint=JSON.stringify([quoteId,request,expectedRevision,expectedTotalCents]);
 const existing=store.orders.find(o=>o.customerUid===actor.uid&&o.operationId===operationId);
 if(existing){if(existing.fingerprint!==fingerprint)fail("idempotency_conflict");return {state:store,order:clone(existing),duplicate:true}}
 const saved=store.quotes?.find(x=>x.id===quoteId&&x.customerUid===actor.uid&&x.storeId===store.id);
 if(!saved||saved.used===true||now>=saved.expiresAt||JSON.stringify(saved.request)!==JSON.stringify(request)||saved.revision!==expectedRevision||saved.totalCents!==expectedTotalCents)fail("invalid_quote");
 const q=quoteCheckout(store,actor,request,now);
 if(q.revision!==expectedRevision||q.totalCents!==expectedTotalCents)fail("quote_changed");
 const next=clone(store);next.sequence++;next.quotes.find(x=>x.id===quoteId).used=true;
 for(const n of q.required){const s=next.inventory.find(x=>x.id===n.stockId);s.availableUnits-=n.units}
 const order={id:"P"+String(next.sequence).padStart(7,"0"),storeId:store.id,customerUid:actor.uid,operationId,fingerprint,lines:q.lines,required:q.required,subtotalCents:q.subtotalCents,deliveryCents:q.deliveryCents,totalCents:q.totalCents,fulfillment:request.fulfillment,address:request.address,paymentMethod:request.paymentMethod,paymentStatus:"pending",status:"received",stockState:"reserved",createdAt:now,reservationExpiresAt:now+1800000,events:[{status:"received",at:now}],actions:[],deliveredAt:null,elapsedMs:null};
 next.orders.push(order);
 return {state:next,order:clone(order),duplicate:false};
}
// Merchant identity and membership must be obtained on the server, never from browser body.
// Only explicit payment confirmation by authorized merchant; no automated gateway charge.
export function transitionCheckout(store,actor,{orderId,operationId,action,paymentReference,reconciliation}={},now){
 merchant(actor,store);if(!id(orderId)||!key(operationId)||!["prepare","ready","dispatch","deliver","cancel","confirm_payment","expire","reconcile_cancel"].includes(action)||!time(now))fail("invalid_action");
 const ref=action==="confirm_payment"&&typeof paymentReference==="string"?paymentReference.trim():null;
 if(action==="confirm_payment"&&(!ref||ref.length>120))fail("payment_reference_required");
 if(action!=="confirm_payment"&&paymentReference!==undefined)fail("invalid_action");
 const recon=action==="reconcile_cancel"?reconciliation:null;
 if(action!=="reconcile_cancel"&&reconciliation!==undefined)fail("invalid_action");
 if(action==="reconcile_cancel"&&(!fields(recon,["reason","stockDecision","refundReference"])||typeof recon.reason!=="string"||!recon.reason.trim()||recon.reason.length>220||!["return","loss"].includes(recon.stockDecision)||!(recon.refundReference===undefined||typeof recon.refundReference==="string"&&recon.refundReference.trim()&&recon.refundReference.length<=120)))fail("invalid_reconciliation");
 const normalizedRecon=recon?{reason:recon.reason.trim(),stockDecision:recon.stockDecision,refundReference:recon.refundReference?.trim()??null}:null;
 const prior=store.orders.find(o=>o.id===orderId&&o.storeId===store.id);if(!prior)fail("not_found");
 const seen=prior.actions.find(a=>a.operationId===operationId);
 if(seen){if(seen.action!==action||seen.actorUid!==actor.uid||(seen.paymentReference??null)!==ref||JSON.stringify(seen.reconciliation??null)!==JSON.stringify(normalizedRecon))fail("idempotency_conflict");return {state:store,order:clone(prior),duplicate:true}}
 if(now<prior.createdAt||now<(prior.actions.at(-1)?.at??prior.createdAt))fail("invalid_time");
 const next=clone(store),o=next.orders.find(x=>x.id===orderId);
 if(["prepare","confirm_payment"].includes(action)&&o.status==="received"&&o.paymentStatus==="pending"&&time(o.reservationExpiresAt)&&now>=o.reservationExpiresAt)fail("reservation_expired");
 if(action==="confirm_payment"){
  if(o.status==="cancelled"||o.paymentStatus!=="pending")fail("invalid_payment_state");
  o.paymentStatus="confirmed";o.paymentConfirmedAt=now;o.paymentConfirmationReference=ref;
 }else if(action==="cancel"||action==="expire"){
  // Once prepared, route to existing audited loss/refund workflow; never silently replenish.
  if(o.status!=="received"||o.stockState!=="reserved"||o.paymentStatus!=="pending")fail("manual_reconciliation_required");
  if(action==="expire"&&(!time(o.reservationExpiresAt)||now<o.reservationExpiresAt))fail("reservation_not_expired");
  for(const n of o.required){const s=next.inventory.find(x=>x.id===n.stockId);if(!s||!int(s.availableUnits))fail("stock_changed");s.availableUnits=add(s.availableUnits,n.units)}
  o.status="cancelled";o.stockState="released";o.cancelReason=action==="expire"?"Reserva expirada":"Cancelamento pelo lojista";
 }else if(action==="reconcile_cancel"){
  if(!["received","preparing","ready","out_for_delivery"].includes(o.status)||!["reserved","consumed"].includes(o.stockState)||!["pending","confirmed"].includes(o.paymentStatus))fail("invalid_transition");
  if(o.stockState==="consumed"&&normalizedRecon.stockDecision!=="loss")fail("prepared_stock_cannot_return");
  if(o.paymentStatus==="confirmed"&&!normalizedRecon.refundReference)fail("refund_reference_required");
  if(o.paymentStatus==="pending"&&normalizedRecon.refundReference)fail("refund_not_due");
  if(normalizedRecon.stockDecision==="return"){for(const n of o.required){const s=next.inventory.find(x=>x.id===n.stockId);if(!s||!int(s.availableUnits))fail("stock_changed");s.availableUnits=add(s.availableUnits,n.units)}o.stockState="released"}
  else{o.stockState="lost";o.loss={units:clone(o.required),costCents:null,costKnown:false,reason:normalizedRecon.reason,at:now};}
  if(o.paymentStatus==="confirmed"){o.paymentStatus="refunded";o.refundedAt=now;}
  o.status="cancelled";o.cancelReason=normalizedRecon.reason;
 }else if(action==="prepare"&&o.status==="received"&&o.stockState==="reserved"){o.status="preparing";o.stockState="consumed"}
 else if(action==="ready"&&o.status==="preparing")o.status="ready";
 else if(action==="dispatch"&&o.status==="ready"&&o.fulfillment==="delivery")o.status="out_for_delivery";
 else if(action==="deliver"&&((o.status==="out_for_delivery"&&o.fulfillment==="delivery")||(o.status==="ready"&&o.fulfillment==="pickup"))){o.status="delivered";o.deliveredAt=now;o.elapsedMs=now-o.createdAt}
 else fail("invalid_transition");
 o.actions.push({operationId,actorUid:actor.uid,action,at:now,...(ref?{paymentReference:ref}:{}),...(normalizedRecon?{reconciliation:normalizedRecon}:{})});
 if(action!=="confirm_payment")o.events.push({status:o.status,at:now});
 return {state:next,order:clone(o),duplicate:false};
}
export function customerOrder(store,actor,orderId,now){
 if(!actor||actor.verified!==true||actor.provider!=="google.com"||actor.role!=="customer"||!id(actor.uid)||!time(now))fail("login_required");
 const o=store.orders.find(x=>x.id===orderId&&x.storeId===store.id&&x.customerUid===actor.uid);
 if(!o)fail("not_found");
 const end=o.deliveredAt??(o.status==="cancelled"?o.events.at(-1).at:now);
 return {id:o.id,status:o.status,paymentStatus:o.paymentStatus,lines:clone(o.lines),totalCents:o.totalCents,createdAt:o.createdAt,deliveredAt:o.deliveredAt,elapsedMs:Math.max(0,end-o.createdAt),events:clone(o.events)};
}
export function orderReceipt(order){
 if(!order||order.status!=="delivered"||!int(order.elapsedMs,0,8640000000000000))fail("receipt_pending");
 return {number:"#"+order.id,totalCents:order.totalCents,paymentStatus:order.paymentStatus,createdAt:order.createdAt,deliveredAt:order.deliveredAt,elapsedMs:order.elapsedMs};
}
