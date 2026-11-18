/** Pure, fail-closed reconciliation preflight. No side effects or license writes.
 * `verifiedPayment` must be obtained server-to-server from Asaas, not webhook/browser.
 * Persist idempotency transactionally before any future license mutation.
 */
const id=(v,p)=>typeof v==="string"&&p.test(v);
export function preflightAsaasSubscriptionPayment({event,verifiedPayment,tenant,processedEventIds}={}){
 const reject=(reason)=>Object.freeze({eligibleToGrant:false,reason});
 if(!event||event.action!=="PAYMENT_RECEIVED"||
   event.requiresServerReconciliation!==true||event.eligibleToGrant!==false)
  return reject("event_not_receipt");
 if(!tenant||!id(tenant.tenantId,/^[a-zA-Z0-9_.:-]{4,100}$/)||
   !id(tenant.asaasCustomerId,/^cus_[a-zA-Z0-9_-]+$/)||
   !id(tenant.asaasSubscriptionId,/^sub_[a-zA-Z0-9_-]+$/)||
   !Number.isSafeInteger(tenant.planAmountCents)||tenant.planAmountCents<=0)
  return reject("tenant_mapping_missing");
 if(!Array.isArray(processedEventIds)||
   processedEventIds.some(x=>typeof x!=="string"))
  return reject("idempotency_state_missing");
 if(processedEventIds.includes(event.eventId))return reject("event_already_processed");
 if(!verifiedPayment||typeof verifiedPayment!=="object"||
   verifiedPayment.id!==event.paymentId||
   verifiedPayment.customer!==tenant.asaasCustomerId||
   verifiedPayment.subscription!==tenant.asaasSubscriptionId||
   verifiedPayment.billingType!=="PIX"||
   verifiedPayment.status!=="RECEIVED")
  return reject("server_payment_not_confirmed");
 const amount=verifiedPayment.value;
 if(typeof amount!=="number"||!Number.isFinite(amount)||
   Math.round(amount*100)!==tenant.planAmountCents||
   event.amountCents!==tenant.planAmountCents)
  return reject("amount_mismatch");
 if(!id(verifiedPayment.paymentDate,/^\d{4}-\d{2}-\d{2}$/))
  return reject("payment_date_missing");
 // This is NOT an authorization. A backend must atomically validate tenant,
 // event ID, payment ID and entitlement before any license grant.
 return Object.freeze({eligibleToGrant:false,reason:"awaiting_atomic_server_authorization",
   tenantId:tenant.tenantId,paymentId:event.paymentId,eventId:event.eventId,
   amountCents:tenant.planAmountCents});
}
