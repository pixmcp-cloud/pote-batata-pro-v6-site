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
