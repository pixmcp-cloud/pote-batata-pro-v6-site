// B02.4: isolated cash ledger for online checkout. Does not mutate legacy cash core.
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
const clone=x=>JSON.parse(JSON.stringify(x));
const methods=["cash","pix","card"];
const add=(a,b)=>{const n=a+b;if(!cents(n))fail("amount_limit");return n};
export function planCheckoutCash({ownerUid,storeId,order,session,priorReceipt,now}={}){
 if(!id(ownerUid)||!id(storeId)||order?.storeId!==storeId||!id(order.id)||order.status==="cancelled"||order.paymentStatus!=="confirmed"||!methods.includes(order.paymentMethod)||!cents(order.totalCents)||order.totalCents===0||typeof order.paymentConfirmationReference!=="string"||!order.paymentConfirmationReference.trim()||!Number.isSafeInteger(order.paymentConfirmedAt)||!Number.isSafeInteger(now)||now<order.paymentConfirmedAt)fail("invalid_receipt");
 if(priorReceipt)fail("receipt_exists");
 if(!session||session.ownerUid!==ownerUid||!id(session.id)||session.status!=="open"||!Number.isSafeInteger(session.openedAt)||session.openedAt>now)fail("cash_not_open");
 return {ownerUid,storeId,orderId:order.id,sessionId:session.id,method:order.paymentMethod,amountCents:order.totalCents,at:now,reference:order.paymentConfirmationReference,source:"checkout-lab"};
}
export function checkoutCashSummary(session,receipts){
 if(!session||!id(session.id)||!id(session.ownerUid)||!["open","closed"].includes(session.status)||!Array.isArray(receipts))fail("invalid_session");
 if(session.status==="closed"){if(!session.closedSummary)fail("missing_closed_summary");return clone(session.closedSummary)}
 const byMethod={cash:0,pix:0,card:0},seen=new Set();
 for(const r of receipts){
  if(r.sessionId!==session.id||r.ownerUid!==session.ownerUid)continue;
  if(!id(r.storeId)||!id(r.orderId)||!methods.includes(r.method)||!cents(r.amountCents)||r.amountCents===0||r.source!=="checkout-lab")fail("invalid_receipt");
  const k=JSON.stringify([r.storeId,r.orderId]);if(seen.has(k))fail("duplicate_receipt");seen.add(k);byMethod[r.method]=add(byMethod[r.method],r.amountCents);
 }
 return {sessionId:session.id,byMethod,receivedCents:add(add(byMethod.cash,byMethod.pix),byMethod.card),cashDrawerIncreaseCents:byMethod.cash,count:seen.size};
}
export function closeCheckoutCash(session,receipts,now){
 if(session?.status!=="open"||!Number.isSafeInteger(now)||now<session.openedAt)fail("invalid_close");
 return {...session,status:"closed",closedAt:now,closedSummary:checkoutCashSummary(session,receipts)};
}

function totals(session){
 const t=session.totals;
 if(!t||!methods.every(m=>cents(t[m]))||!cents(t.count))fail("invalid_session_totals");
 return {cash:t.cash,pix:t.pix,card:t.card,count:t.count};
}
export function applyCheckoutReceipt(session,receipt){
 if(session?.status!=="open"||receipt?.sessionId!==session.id||receipt.ownerUid!==session.ownerUid||!methods.includes(receipt.method)||!cents(receipt.amountCents)||receipt.amountCents===0||!cents(session.revision)||session.revision>=1000000000)fail("invalid_session");
 const t=totals(session);t[receipt.method]=add(t[receipt.method],receipt.amountCents);t.count=add(t.count,1);
 return {...session,revision:session.revision+1,totals:t};
}
export function freezeCheckoutCashSession(session,now,operationId){
 if(session?.status!=="open"||!id(operationId)||operationId.length<16||!Number.isSafeInteger(now)||now<session.openedAt||!cents(session.revision)||session.revision>=1000000000)fail("invalid_close");
 const t=totals(session);
 const refunds=session.refunds??{pix:0,card:0,count:0};
 if(!["pix","card","count"].every(k=>cents(refunds[k])))fail("invalid_refund_totals");
 const gross=add(add(t.cash,t.pix),t.card),refundTotal=add(refunds.pix,refunds.card);
 return {...session,status:"closed",closedAt:now,closeOperationId:operationId,revision:session.revision+1,closedSummary:{sessionId:session.id,byMethod:{cash:t.cash,pix:t.pix,card:t.card},receivedCents:gross,cashDrawerIncreaseCents:t.cash,count:t.count,refundsByMethod:{pix:refunds.pix,card:refunds.card},refundedCents:refundTotal,netReceivedCents:gross-refundTotal}};
}

 // Manual external refund record only; no gateway call. Cash refunds remain
 // blocked until actual physical drawer availability is reconciled with V5.
 export function planCheckoutRefund({ownerUid,storeId,order,receipt,priorRefund,session,now,reference}={}){
  if(!receipt||receipt.ownerUid!==ownerUid||receipt.storeId!==storeId||receipt.orderId!==order?.id||receipt.method!==order.paymentMethod||receipt.amountCents!==order.totalCents||receipt.source!=="checkout-lab"||!cents(receipt.amountCents)||receipt.amountCents===0||order.status!=="cancelled"||order.paymentStatus!=="refunded"||!Number.isSafeInteger(order.refundedAt)||order.refundedAt!==now)fail("invalid_refund");
  if(priorRefund)fail("refund_exists");
  if(receipt.method==="cash")fail("cash_refund_requires_reconciliation");
  if(!["pix","card"].includes(receipt.method)||typeof reference!=="string"||!reference.trim()||reference.length>120)fail("invalid_refund");
  if(!session||session.ownerUid!==ownerUid||session.status!=="open"||!id(session.id)||!Number.isSafeInteger(session.openedAt)||session.openedAt>now)fail("cash_not_open");
  return {ownerUid,storeId,orderId:order.id,originSessionId:receipt.sessionId,sessionId:session.id,method:receipt.method,amountCents:receipt.amountCents,reference:reference.trim(),at:now,source:"checkout-lab-refund"};
 }
 export function applyCheckoutRefund(session,refund){
  if(session?.status!=="open"||session.ownerUid!==refund?.ownerUid||session.id!==refund.sessionId||!["pix","card"].includes(refund.method)||!cents(refund.amountCents)||refund.amountCents===0||!cents(session.revision)||session.revision>=1000000000)fail("invalid_refund");
  const t={...(session.refunds??{pix:0,card:0,count:0})};if(!["pix","card","count"].every(k=>cents(t[k])))fail("invalid_refund_totals");
  t[refund.method]=add(t[refund.method],refund.amountCents);t.count=add(t.count,1);
  return {...session,revision:session.revision+1,refunds:t};
 }
