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
export function freezeCheckoutCashSession(session,now,operationId,countedCashCents){
 if(session?.status!=="open"||!id(operationId)||operationId.length<16||!Number.isSafeInteger(now)||now<session.openedAt||!cents(session.revision)||session.revision>=1000000000)fail("invalid_close");
 const t=totals(session);
 const refunds=session.refunds??{pix:0,card:0,count:0};
 if(!["pix","card","count"].every(k=>cents(refunds[k])))fail("invalid_refund_totals");
 const gross=add(add(t.cash,t.pix),t.card),refundTotal=add(refunds.pix,refunds.card);
 const drawer=checkoutDrawer(session);
 if(countedCashCents!==undefined&&!cents(countedCashCents))fail("invalid_counted_cash");
 return {...session,status:"closed",closedAt:now,closeOperationId:operationId,revision:session.revision+1,closedSummary:{sessionId:session.id,byMethod:{cash:t.cash,pix:t.pix,card:t.card},receivedCents:gross,cashDrawerIncreaseCents:t.cash,count:t.count,refundsByMethod:{pix:refunds.pix,card:refunds.card},refundedCents:refundTotal,netReceivedCents:gross-refundTotal,...drawer,...(countedCashCents===undefined?{}:{countedCashCents,differenceCents:countedCashCents-drawer.expectedCashCents})}};
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

export function checkoutDrawer(session){
 const t=totals(session),openingCashCents=session.openingCashCents??0,m=session.cashAdjustments??{supplyCents:0,withdrawalCents:0,count:0};
 if(!cents(openingCashCents)||!["supplyCents","withdrawalCents","count"].every(k=>cents(m[k])))fail("invalid_drawer");
 const expectedCashCents=add(add(openingCashCents,t.cash),m.supplyCents)-m.withdrawalCents;
 if(!cents(expectedCashCents))fail("invalid_drawer");
 return {openingCashCents,supplyCents:m.supplyCents,withdrawalCents:m.withdrawalCents,expectedCashCents};
}
export function openCheckoutCash({ownerUid,sessionId,openingCashCents,operationId,now,epoch}={}){
 if(!id(ownerUid)||!id(sessionId)||!id(operationId)||operationId.length<16||!cents(openingCashCents)||!Number.isSafeInteger(now)||now<=0||!id(epoch)||epoch.length<16)fail("invalid_request");
 return {id:sessionId,ownerUid,status:"open",openedAt:now,revision:0,openOperationId:operationId,cutoverEpoch:epoch,openingCashCents,totals:{cash:0,pix:0,card:0,count:0},cashAdjustments:{supplyCents:0,withdrawalCents:0,count:0}};
}
export function planDrawerMovement({session,kind,amountCents,reason,operationId,now}={}){
 if(session?.status!=="open"||!id(operationId)||operationId.length<16||!["suprimento","sangria"].includes(kind)||!cents(amountCents)||!amountCents||typeof reason!=="string"||!reason.trim()||reason.length>220||!Number.isSafeInteger(now)||now<session.openedAt||!cents(session.revision)||session.revision>=1000000000)fail("invalid_movement");
 const drawer=checkoutDrawer(session);
 if(kind==="sangria"&&amountCents>drawer.expectedCashCents)fail("insufficient_cash");
 const adjustments={...(session.cashAdjustments??{supplyCents:0,withdrawalCents:0,count:0})},key=kind==="sangria"?"withdrawalCents":"supplyCents";
 adjustments[key]=add(adjustments[key],amountCents);adjustments.count=add(adjustments.count,1);
 const next={...session,cashAdjustments:adjustments,revision:session.revision+1};checkoutDrawer(next);
 return {session:next,movement:{ownerUid:session.ownerUid,sessionId:session.id,kind,amountCents,reason:reason.trim(),operationId,at:now}};
}

 // A late external payment is NOT cash in a closed drawer. A separate receipt
 // preserves the original close summary. Cash needs physical reconciliation.
 export function planLateCheckoutReceipt({ownerUid,storeId,order,session,priorReceipt,now,epoch}={}){
  if(!session||session.status!=="closed"||session.ownerUid!==ownerUid||session.cutoverEpoch!==epoch||!id(session.id)||order?.acceptedCashSessionId!==session.id||!Number.isSafeInteger(session.openedAt)||!Number.isSafeInteger(session.closedAt)||session.closedAt<session.openedAt||!Number.isSafeInteger(order?.createdAt)||order.createdAt<session.openedAt||order.createdAt>session.closedAt||!Number.isSafeInteger(now)||now<session.closedAt||!session.closedSummary)fail("invalid_origin_session");
  if(order.paymentMethod==="cash")fail("cash_late_requires_reconciliation");
  if(!["pix","card"].includes(order.paymentMethod))fail("invalid_receipt");
  const receipt=planCheckoutCash({ownerUid,storeId,order,session:{...session,status:"open"},priorReceipt,now});
  return {...receipt,originSessionId:session.id,sessionId:null,source:"checkout-lab-late",outsideDrawer:true};
 }
