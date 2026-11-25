// Public checkout: keep only a cryptographic fingerprint and operation ID
// locally. Never store name, phone or payment credentials. No automatic fallback.
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,"0")).join("");
export function createCheckoutClient({endpoint,fetcher=fetch,storage,randomId=()=>crypto.randomUUID()}={}){
 const key=slug=>"pote-checkout-pending-v1:"+slug;
 const store=()=>storage||globalThis.localStorage;
 const read=slug=>{try{return JSON.parse(store().getItem(key(slug))||"null")}catch{throw Error("Armazenamento indisponível. Não é seguro confirmar o pedido.")}};
 const write=(slug,data)=>{try{store().setItem(key(slug),JSON.stringify(data))}catch{throw Error("Não foi possível guardar a referência do pedido. Nenhum envio foi iniciado.")}};
 let inFlight=false;
 return {
  hasPending(slug){try{return Boolean(read(slug))}catch{return true}},
  complete(slug){try{store().removeItem(key(slug))}catch{}},
  async submit(input,challenge,identity){
   if(!identity?.uid||typeof identity.token!=="string"||!identity.token)throw Error("Entre com Google para confirmar seu pedido.");
   if(inFlight)throw Error("Pedido já está sendo confirmado.");
   inFlight=true;
   try{
    const fingerprint=await digest(JSON.stringify({uid:identity.uid,input})),prior=read(input.slug);
    if(prior&&prior.fingerprint!==fingerprint)throw Error("Existe uma confirmação pendente. Restaure os itens, nome e telefone originais e tente novamente; não crie outro pedido.");
    if(prior?.result)return prior.result;
    const operationId=prior?.operationId||randomId(),pending={fingerprint,operationId};
    write(input.slug,pending);
    let response;
    try{response=await fetcher(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+identity.token},body:JSON.stringify({...input,operationId,challenge}),signal:AbortSignal.timeout(25000)});}
    catch{throw Error("Resposta não confirmada. Mantenha a sacola e tente novamente com os mesmos dados. O pedido não será duplicado.")}
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.ok!==true){
     // Clear only definite pre-commit rejections on a first attempt. After an
     // ambiguous response retain the original ID for safe reconciliation.
     if(!prior&&[400,403,409,423].includes(response.status)&&result?.error&&result.error!=="transaction_conflict"&&result.error!=="idempotency_conflict")store().removeItem(key(input.slug));
     throw Error(result?.message||"Pedido não confirmado pelo servidor. Confira a loja e tente novamente com os mesmos dados.");
    }
    if(result.checkoutId!==operationId||result.totalCents!==input.expectedTotalCents||
      !Array.isArray(result.orderNumbers)||!result.orderNumbers.length||!result.orderNumbers.every(n=>Number.isSafeInteger(n)&&n>0))
     throw Error("Confirmação inválida. Mantenha os dados e tente novamente.");
    write(input.slug,{...pending,result});
    return result;
   }finally{inFlight=false}
  }
 };
}
