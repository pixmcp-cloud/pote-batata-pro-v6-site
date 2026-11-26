// A09 laboratory adapter, no real provider, wallet, auth implementation or deployment.
const product="brasil-inflaveis";
const tiers=[15,30,45,60,75];
const id=v=>typeof v==="string"&&/^[A-Za-z0-9:_-]{1,128}$/.test(v);
const key=v=>typeof v==="string"&&/^[A-Za-z0-9:_-]{12,128}$/.test(v);
const exact=(v,allowed)=>v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const reply=(status,body)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const error=(status,message)=>reply(status,{error:message});
const scopeOf=a=>Object.freeze({product,tenantId:a.tenantId,subjectId:a.subjectId});
function paymentValid(p,seconds){
 return exact(p,["commercial","promo"])&&integer(p.commercial,0,5)&&integer(p.promo,0,10)&&2*p.commercial+p.promo===seconds/15*2;
}
function validOptions(o){
 if(o===undefined)return true;
 if(!exact(o,["modelId","languageCode","voiceSettings"])||o.modelId!=="eleven_flash_v2_5"||![null,"pt","en","es"].includes(o.languageCode))return false;
 const v=o.voiceSettings;
 return exact(v,["stability","similarity_boost","style","speed","use_speaker_boost"])&&Object.keys(v).length===5&&["stability","similarity_boost","style"].every(k=>typeof v[k]==="number"&&v[k]>=0&&v[k]<=1)&&typeof v.speed==="number"&&v.speed>=.7&&v.speed<=1.2&&typeof v.use_speaker_boost==="boolean";
}
async function readJson(req){
 const len=req.headers.get("Content-Length");
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>8192))throw 413;
 if(!req.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))throw 415;
 if(!req.body)throw 400;
 const reader=req.body.getReader();let chunks=[],n=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>8192){await reader.cancel();throw 413;}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{throw 400;}
}
// The injected authenticate() MUST verify the real session and current tenant membership.
// The broker MUST enforce same scope again, validate wallet and tariffs server-side,
// implement durable reservations and idempotency, and sanitize response. This module
// intentionally cannot enable real execution: only mode "mock" is accepted.
export function createVoiceLab({mode="disabled",authenticate,broker,allowedOrigin}={}){
 return async function handle(req){
  if(mode!=="mock"||typeof authenticate!=="function"||!broker||typeof allowedOrigin!=="string")return error(503,"Voice Studio em homologação.");
  const u=new URL(req.url);
  if(u.origin!==allowedOrigin)return error(403,"Origem inválida.");
  const path=u.pathname;
  const isPost=["/api/voice/quotes","/api/voice/jobs"].includes(path);
  const match=/^\/api\/voice\/jobs\/([A-Za-z0-9:_-]{1,128})$/.exec(path);
  if(!isPost&&!match)return error(404,"Rota inexistente.");
  if(req.method!==(isPost?"POST":"GET"))return error(405,"Método inválido.");
  if(isPost&&req.headers.get("Origin")!==allowedOrigin)return error(403,"Origem inválida.");
  if(req.headers.get("Origin")&&req.headers.get("Origin")!==allowedOrigin)return error(403,"Origem inválida.");
  let a;try{a=await authenticate(req);}catch{return error(503,"Sessão indisponível.");}
  if(!a||!id(a.subjectId))return error(401,"Entre na sua conta.");
  if(a.product!==product||!id(a.tenantId)||a.voiceAllowed!==true||a.membershipVerified!==true)return error(403,"Acesso não autorizado.");
  const scope=scopeOf(a);
  try{
   if(match){
    const result=await broker.status(scope,match[1]);
    if(!result)return error(404,"Pedido não encontrado.");
    return safeJob(result);
   }
   let body;try{body=await readJson(req);}catch(e){return error([400,413,415].includes(e)?e:400,"Corpo inválido.");}
   const k=req.headers.get("Idempotency-Key");
   if(!key(k))return error(400,"Identificador de operação inválido.");
   if(path.endsWith("/quotes")){
    if(!exact(body,["text","durationSeconds","voiceId","paymentChoice","options"])||!tiers.includes(body.durationSeconds)||typeof body.text!=="string"||!body.text.trim()||body.text.trim().length>body.durationSeconds*10||!id(body.voiceId)||!paymentValid(body.paymentChoice,body.durationSeconds)||!validOptions(body.options))return error(400,"Cotação inválida.");
    const result=await broker.quote(scope,k,{text:body.text.trim(),durationSeconds:body.durationSeconds,voiceId:body.voiceId,paymentChoice:{...body.paymentChoice},options:body.options});
    if(!result||!id(result.quoteId)||!integer(result.expiresAt,1,Number.MAX_SAFE_INTEGER)||!paymentValid(result.paymentChoice,body.durationSeconds)||result.paymentChoice.commercial!==body.paymentChoice.commercial||result.paymentChoice.promo!==body.paymentChoice.promo)return error(503,"Cotação indisponível.");
    return reply(200,{quoteId:result.quoteId,expiresAt:result.expiresAt,paymentChoice:result.paymentChoice,maxChars:body.durationSeconds*10,lab:true});
   }
   if(!exact(body,["quoteId"])||!id(body.quoteId))return error(400,"Pedido inválido.");
   return safeJob(await broker.submit(scope,k,body.quoteId));
  }catch(e){const code=[402,403,404,409,429,503].includes(e?.status)?e.status:503;return error(code,"Operação não confirmada; consulte o estado antes de repetir.");}
 };
}
function safeJob(r){
 if(!r||!id(r.jobId)||!["QUOTED","GLOBAL_HELD","WALLET_HELD","DISPATCH_INTENT","AUDIO_STORED","COMPLETED","FAILED_SAFE","RECONCILE","CANCELLED"].includes(r.state))return error(503,"Estado indisponível.");
 // No arbitrary URL, audio, tokens, raw errors or cross-scope details in this lab.
 return reply(r.state==="COMPLETED"?200:202,{jobId:r.jobId,state:r.state,lab:true});
}
