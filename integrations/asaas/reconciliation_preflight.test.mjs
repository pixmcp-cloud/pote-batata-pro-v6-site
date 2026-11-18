import assert from "node:assert/strict";
import {preflightAsaasSubscriptionPayment} from "./reconciliation_preflight.mjs";
const event=Object.freeze({action:"PAYMENT_RECEIVED",requiresServerReconciliation:true,
 eligibleToGrant:false,eventId:"evt_test_12345",paymentId:"pay_demo1",amountCents:3990});
const tenant=Object.freeze({tenantId:"tenant-qa-01",asaasCustomerId:"cus_demo1",
 asaasSubscriptionId:"sub_demo1",planAmountCents:3990});
const verifiedPayment=Object.freeze({id:"pay_demo1",customer:"cus_demo1",
 subscription:"sub_demo1",billingType:"PIX",status:"RECEIVED",
 value:39.9,paymentDate:"2026-11-18"});
const args={event,tenant,verifiedPayment,processedEventIds:[]};
const run=x=>preflightAsaasSubscriptionPayment({...args,...x});
assert.deepEqual([run().reason,run().eligibleToGrant],
 ["awaiting_atomic_server_authorization",false]);
for(const [name,overrides,expected] of [
 ["duplicate",{processedEventIds:["evt_test_12345"]},"event_already_processed"],
 ["missing ledger",{processedEventIds:null},"idempotency_state_missing"],
 ["unpaid",{verifiedPayment:{...verifiedPayment,status:"PENDING"}},"server_payment_not_confirmed"],
 ["wrong customer",{verifiedPayment:{...verifiedPayment,customer:"cus_other"}},"server_payment_not_confirmed"],
 ["wrong subscription",{verifiedPayment:{...verifiedPayment,subscription:"sub_other"}},"server_payment_not_confirmed"],
 ["wrong payment",{verifiedPayment:{...verifiedPayment,id:"pay_other"}},"server_payment_not_confirmed"],
 ["wrong amount",{verifiedPayment:{...verifiedPayment,value:49.9}},"amount_mismatch"],
 ["wrong event amount",{event:{...event,amountCents:4000}},"amount_mismatch"],
 ["no tenant",{tenant:null},"tenant_mapping_missing"],
 ["no payment date",{verifiedPayment:{...verifiedPayment,paymentDate:null}},"payment_date_missing"],
 ["unverified",{verifiedPayment:null},"server_payment_not_confirmed"],
 ["event created",{event:{...event,action:"PAYMENT_CREATED"}},"event_not_receipt"]
]){
 const result=run(overrides);
 assert.equal(result.eligibleToGrant,false,name);
 assert.equal(result.reason,expected,name);
}
console.log("PASS ASAAS preflight: 13 isolated scenarios; no automatic PRO grant");
