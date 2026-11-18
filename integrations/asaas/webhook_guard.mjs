/** Sandbox webhook preparation. The guard NEVER activates a Pro license.
 * A future backend must persist IDs and re-check payments against Asaas.
 */
export function validateAsaasWebhookToken(received,expected){
 if(typeof expected!=="string"||expected.length<32||expected.length>255)
  throw Error("Segredo de webhook não configurado");
 if(typeof received!=="string"||received.length!==expected.length)
  throw Error("Webhook não autenticado");
 let diff=0;
 for(let i=0;i<expected.length;i++)diff|=received.charCodeAt(i)^expected.charCodeAt(i);
 if(diff!==0)throw Error("Webhook não autenticado");
 return true;
}
export function interpretAsaasPaymentEvent(payload){
 if(!payload||typeof payload!=="object"||Array.isArray(payload)||
   typeof payload.id!=="string"||payload.id.length<8||payload.id.length>200||
   typeof payload.event!=="string")
  throw Error("Evento inválido");
 const known=["PAYMENT_CREATED","PAYMENT_RECEIVED","PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE","PAYMENT_DELETED","PAYMENT_REFUNDED"];
 if(!known.includes(payload.event))
  return Object.freeze({eventId:payload.id,action:"ignore",eligibleToGrant:false});
 const p=payload.payment;
 if(!p||typeof p.id!=="string"||!/^pay_[a-zA-Z0-9_-]+$/.test(p.id)||
    typeof p.subscription!=="string"||!/^sub_[a-zA-Z0-9_-]+$/.test(p.subscription)||
    typeof p.value!=="number"||!Number.isFinite(p.value)||
    p.value<=0||p.value>100000)
  throw Error("Cobrança de assinatura sem dados confiáveis");
 const cents=Math.round(p.value*100);
 if(!Number.isSafeInteger(cents)||cents<1)
  throw Error("Valor fora dos limites");
 return Object.freeze({eventId:payload.id,action:payload.event,
  paymentId:p.id,subscriptionId:p.subscription,amountCents:cents,
  eligibleToGrant:false,requiresServerReconciliation:true});
}
