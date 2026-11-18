/* Optional bridge to Cloudflare Worker inventory API. Disabled by default.
 * IMPORTANT: Do not enable until service-account auth, Firestore rules and
 * production shadow tests are approved. No browser-triggered fallback.
 * The only source of truth after an accepted call is the V2 Firestore reload. */
const allowedAction=new Set(["produce","cancel","finish"]);
const uuidPattern=/^[a-zA-Z0-9_-]{20,80}$/;
const idPattern=/^[a-zA-Z0-9_.:-]{1,180}$/;
const universePattern=/^[a-z0-9_-]{1,64}$/;
function error(message,code="worker/error"){
 const e=Error(message);e.code=code;return e;
}
export function createWorkerBridge({
 enabled=false,endpoint,getSession,flush,refresh,
 requestFetch=fetch,storage=globalThis.sessionStorage,
 uuid=()=>globalThis.crypto.randomUUID(),timeoutMs=12000
}={}){
 if(typeof endpoint!=="string"||!/^https:\/\//.test(endpoint))
  throw error("Endereço HTTPS do servidor ausente");
 const root=endpoint.replace(/\/+$/,"");
 const busy=new Set();
 const readKey=(uid,universe,action,orderId)=>"pote:worker:v1:"+
  encodeURIComponent(uid)+":"+encodeURIComponent(universe)+":"+action+":"+encodeURIComponent(orderId);
 async function transition(action,{orderId,universe,decision}={}){
  if(!enabled)throw error("Worker desativado. Nenhum dado foi alterado.","worker/disabled");
  if(!allowedAction.has(action)||!idPattern.test(orderId)||!universePattern.test(universe)||
    (action==="cancel"&&!["return","loss"].includes(decision))||
    (action!=="cancel"&&decision!==undefined))
   throw error("Parâmetros de operação inválidos","worker/invalid");
  const before=getSession?.();
  if(!before?.uid||!before?.user||before.user.uid!==before.uid||before.ready!==true||
    before.proActive!==true||before.syncBlocked===true)
   throw error("Conta ou sincronização não disponível","worker/session");
  const lock=before.uid+"|"+universe+"|"+action+"|"+orderId;
  if(busy.has(lock))throw error("Operação já está em andamento","worker/busy");
  busy.add(lock);
  try{
   if(typeof flush!=="function"||await flush()!==true)
    throw error("Alterações pendentes não foram salvas. Nenhuma baixa foi enviada.","worker/not-synced");
   const current=getSession?.();
   if(current?.uid!==before.uid||current?.user!==before.user||
      current?.ready!==true||current?.syncBlocked===true)
    throw error("A conta mudou durante a sincronização","worker/session");
   const token=await current.user.getIdToken();
   if(typeof token!=="string"||token.length<32)
    throw error("Token Google indisponível","worker/auth");
   const key=readKey(before.uid,universe,action,orderId);
   let operationId=storage?.getItem(key);
   if(!operationId||!uuidPattern.test(operationId)){
    operationId=uuid();
    if(!uuidPattern.test(operationId))throw error("Identificador não confiável","worker/id");
    storage?.setItem(key,operationId);
   }
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),timeoutMs);
   let response;
   try{
    response=await requestFetch(root+"/v1/orders/"+action,{
     method:"POST",mode:"cors",cache:"no-store",
     headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
     body:JSON.stringify({universe,orderId,operationId,
      ...(action==="cancel"?{decision}:{})}),
     signal:controller.signal
    });
   }catch(e){
    throw error("Servidor indisponível. O pedido foi preservado. Repita para consultar a mesma operação.",
     "worker/network");
   }finally{clearTimeout(timeout)}
   let result;
   try{result=await response.json()}catch{result={}}
   if(!response.ok){
    // HTTP 423 is a deliberate hard stop; do not fall back to direct writes.
    throw error(result?.message||(
     response.status===423?"Worker ainda em homologação; estoque inalterado.":
     response.status===409?"Dados alterados por outra sessão. Atualize o pedido.":
     "O servidor não autorizou a operação."),result.error||"worker/http-"+response.status);
   }
   if(result.ok!==true||result.orderId!==orderId||
      result.operationId!==operationId)
    throw error("Resposta incompleta. Nenhuma alteração local será presumida.","worker/invalid-response");
   const post=getSession?.();
   if(post?.uid!==before.uid||post?.user!==before.user||post?.ready!==true)
    throw error("Conta alterada. Entre novamente para conferir a operação.","worker/session");
   try{await refresh()}catch{
    throw error("Operação recebida pelo servidor, mas a atualização local falhou. Reabra o aplicativo.",
     "worker/refresh");
   }
   // Only after confirmed reload can this operation key be retired. A retry
   // after a timeout or reload continues using the same event ID.
   storage?.removeItem(key);
   return result;
  }finally{busy.delete(lock)}
 }
 return Object.freeze({
  get enabled(){return enabled===true},
  produce:(orderId,universe)=>transition("produce",{orderId,universe}),
  finish:(orderId,universe)=>transition("finish",{orderId,universe}),
  cancel:(orderId,universe,decision)=>transition("cancel",{orderId,universe,decision}),
  // Kept strictly private; no client-side switch to enable writes.
 });
}
