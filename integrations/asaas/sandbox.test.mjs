import assert from "node:assert/strict";
import {createAsaasSandboxClient,ASAAS_SANDBOX_URL} from "./sandbox_client.mjs";
import {validateAsaasWebhookToken,interpretAsaasPaymentEvent} from "./webhook_guard.mjs";
let calls=[];
const fakeKey="$aact_hmlg_"+"z".repeat(30);
const fakeFetch=async(url,options)=>{
 calls.push({url,options});
 return {ok:true,status:200,json:async()=>({id:url.endsWith("/customers")?"cus_demo1":"sub_demo1"})};
};
assert.throws(()=>createAsaasSandboxClient({apiKey:fakeKey,fetchImpl:fakeFetch}));
assert.throws(()=>createAsaasSandboxClient({apiKey:"$aact_prod_"+"z".repeat(30),
 fetchImpl:fakeFetch,allowSandboxWrites:true}));
assert.equal(calls.length,0);
const client=createAsaasSandboxClient({apiKey:fakeKey,fetchImpl:fakeFetch,allowSandboxWrites:true});
const customer=await client.createCustomer({tenantId:"tenant-qa-01",name:"Negócio Teste",
 cpfCnpj:"11144477735",email:"teste@example.invalid"});
assert.equal(customer.id,"cus_demo1");
assert.equal(calls[0].url,ASAAS_SANDBOX_URL+"/customers");
assert.equal(calls[0].options.headers.access_token,fakeKey);
assert.equal(JSON.parse(calls[0].options.body).externalReference,"tenant-qa-01");
assert.equal(JSON.parse(calls[0].options.body).notificationDisabled,true);
const subscription=await client.createMonthlyPixSubscription({customerId:customer.id,
 amountCents:3990,nextDueDate:"2026-12-15",reference:"pote-tenant-qa-01"});
assert.equal(subscription.id,"sub_demo1");
assert.equal(calls[1].url,ASAAS_SANDBOX_URL+"/subscriptions");
const payload=JSON.parse(calls[1].options.body);
assert.deepEqual([payload.billingType,payload.cycle,payload.value],["PIX","MONTHLY",39.9]);
assert.equal(payload.pixAutomaticAuthorizationMode,"DISABLED");
await assert.rejects(()=>client.createMonthlyPixSubscription({
 customerId:"cus_demo1",amountCents:0,nextDueDate:"2026-12-15",reference:"pote-qa"}));
const token="qa-secret-"+"y".repeat(40);
assert.equal(validateAsaasWebhookToken(token,token),true);
assert.throws(()=>validateAsaasWebhookToken("bad",token));
assert.throws(()=>validateAsaasWebhookToken(token,"short"));
const paid=interpretAsaasPaymentEvent({id:"evt_12345678",event:"PAYMENT_RECEIVED",
 payment:{id:"pay_test1",subscription:"sub_test1",value:39.9}});
assert.deepEqual({action:paid.action,amountCents:paid.amountCents,grant:paid.eligibleToGrant},
 {action:"PAYMENT_RECEIVED",amountCents:3990,grant:false});
assert.throws(()=>interpretAsaasPaymentEvent({
 id:"evt_12345678",event:"PAYMENT_RECEIVED",payment:{id:"pay_test1",value:39.9}}));
console.log("PASS ASAAS: Sandbox only, PIX monthly mocked, webhook guarded, automatic PRO disabled.");
