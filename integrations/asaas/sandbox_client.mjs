/* Asaas client: only sandbox, only behind an explicit QA gate. Never bundle in browser. */
export const ASAAS_SANDBOX_URL="https://api-sandbox.asaas.com/v3";
const invalid=m=>{throw new Error(m)};
const reference=v=>typeof v==="string"&&/^[a-zA-Z0-9_.:-]{4,100}$/.test(v);
export function createAsaasSandboxClient({apiKey,fetchImpl,allowSandboxWrites=false}={}){
 if(allowSandboxWrites!==true)invalid("Asaas Sandbox desativado por padrão");
 if(typeof apiKey!=="string"||!apiKey.startsWith("$aact_hmlg_")||apiKey.length<20)
  invalid("Chave do Sandbox necessária. Nunca utilize chave de produção.");
 if(typeof fetchImpl!=="function")invalid("Transporte HTTP obrigatório");
 async function post(endpoint,body){
  const response=await fetchImpl(ASAAS_SANDBOX_URL+endpoint,{
   method:"POST",headers:{"Content-Type":"application/json",
    "User-Agent":"PoteBatataPro-Sandbox/1.0","access_token":apiKey},
   body:JSON.stringify(body)
  });
  if(response?.ok!==true)invalid("Falha HTTP no Sandbox: "+String(response?.status??"sem resposta"));
  const payload=await response.json();
  if(!payload||typeof payload.id!=="string"||!payload.id)
   invalid("Resposta sem identificador Asaas");
  return Object.freeze({id:payload.id});
 }
 return Object.freeze({
  async createCustomer({tenantId,name,cpfCnpj,email}={}){
   if(!reference(tenantId)||typeof name!=="string"||name.trim().length<3||
     name.length>150||typeof cpfCnpj!=="string"||
     !/^(?:\d{11}|\d{14})$/.test(cpfCnpj)||typeof email!=="string"||
     !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    invalid("Dados obrigatórios do cliente Sandbox ausentes");
   return post("/customers",{name:name.trim(),cpfCnpj,email,
    externalReference:tenantId,notificationDisabled:true});
  },
  async createMonthlyPixSubscription({customerId,amountCents,nextDueDate,reference:ref}={}){
   if(typeof customerId!=="string"||!/^cus_[a-zA-Z0-9]+$/.test(customerId)||
     !Number.isSafeInteger(amountCents)||amountCents<100||amountCents>10000000||
     typeof nextDueDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)||
     Number.isNaN(Date.parse(nextDueDate+"T00:00:00Z"))||!reference(ref))
    invalid("Dados da assinatura Sandbox inválidos");
   return post("/subscriptions",{customer:customerId,billingType:"PIX",
    value:amountCents/100,cycle:"MONTHLY",nextDueDate,
    description:"Assinatura Potê Batata Pro",externalReference:ref,
    pixAutomaticAuthorizationMode:"DISABLED"});
  }
 });
}
