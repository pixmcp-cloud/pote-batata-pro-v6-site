// ADM-only canary. Separate routes from stock; no public audio operations.
import {verifyFirebaseToken,serviceAccessToken} from './auth.mjs';
import {createFirestoreRepository} from './firestore.mjs';
import {durationQuote,validateText,validateVoiceOptions,commercialReady,canReserve} from '../../../voice_backend/policy.mjs';
const origins=new Set(['https://pdv.livresom.com','https://potobatata-b71f3.web.app','https://pixmcp-cloud.github.io']);
const allowedVoiceIds=new Set(['gOupLcAkjEnguROwi4oS','OZ0L6eISlOejga3XjDFt','WQP7cQUF5aAS6Axh5yaa','6WwXjDDEMyNmFG95zycZ','dvbL7qkNGZY1IqPGZAjM','ktkP7Nsj67dw2zcplQYt','BFd5oBc2DDna33pSi4Gf','QtY3JBOUKEB5xzrRfOKc','7QN34D2r3hCNwbOYIeK0','g7LVvkPWALzPxOQbF6OE','l7kNoIfnJKPg7779LI2t','AaOhDHYJ1XLZk74lXhdE','fnYMz3F5gMEDGMWcH1ex','22N9cF8z0o7y23njdyaY','FrS6cKLB1wg4WYgPa9GW']);
const cfg={commercialApproved:true,licensedTiers:['starter'],providerMicroBrlPer1000:1500000,creditMicroBrl:1100000};
const fail=(message,status=400)=>{throw Object.assign(Error(message),{publicStatus:status});};
const put=(path,data,previous,serverTimestamps=[])=>({path,data,precondition:previous?{updateTime:previous.updateTime}:{exists:false},serverTimestamps});
export function createVoicePilot({verify=verifyFirebaseToken,repo=env=>createFirestoreRepository(env,{requestFetch:(...args)=>globalThis.fetch(...args)}),serviceToken=serviceAccessToken,providerFetch=(...args)=>globalThis.fetch(...args),clock=()=>Date.now(),uuid=()=>crypto.randomUUID()}={}){
 async function provider(env,path,body){
  if(!env.ELEVENLABS_API_KEY||env.VOICE_PILOT_ENABLED!=='true')fail('Serviço de voz não ativado.',423);
  let r;try{r=await providerFetch('https://api.elevenlabs.io'+path,{method:body?'POST':'GET',headers:{'xi-api-key':env.ELEVENLABS_API_KEY,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000),redirect:'manual'});}catch(e){fail('ELEVENLABS_TRANSPORT_'+(e instanceof TypeError?'TYPE_ERROR':e?.name==='TimeoutError'?'TIMEOUT':'FAILED'),502);}
  if(!r.ok)fail('ElevenLabs indisponível; operação não será repetida automaticamente.',502);
  return r;
 }
 async function subscription(env){
  let s;try{s=await(await provider(env,'/v1/user/subscription')).json();}catch(e){if(e.publicStatus)throw e;fail('ELEVENLABS_SUBSCRIPTION_INVALID_RESPONSE',502);}
  if(!commercialReady(s,cfg)||!Number.isSafeInteger(s.character_limit)||!Number.isSafeInteger(s.character_count)||s.character_count<0||s.character_count>s.character_limit)fail('Plano ou cota comercial não validada.',423);
  return s;
 }
 async function voices(env){
  let v;try{v=await(await provider(env,'/v2/voices?page_size=100')).json();}catch(e){if(e.publicStatus)throw e;fail('ELEVENLABS_CATALOG_INVALID_RESPONSE',502);}
  return (Array.isArray(v.voices)?v.voices:[]).filter(x=>allowedVoiceIds.has(x.voice_id)).map(x=>({id:x.voice_id,name:String(x.name||'Voz').slice(0,120),description:String(x.description||'').slice(0,250),previewUrl:typeof x.preview_url==='string'?x.preview_url:null}));
 }
 async function transaction(env,fn){const t=await repo(env).transaction();try{return await fn(t)}finally{await t.rollback();}}
 async function profile(t,uid){const p=await t.get('users/'+uid);if(!p||p.data?.email!=='pixmcp@gmail.com'||p.data?.accessPolicy?.voiceAiEnabled===false)fail('Conta ADM não autorizada.',403);return p;}
 async function wallet(t,uid){const w=await t.get('users/'+uid+'/aiWallet/main');if(!w||!Number.isSafeInteger(w.data?.balance)||w.data.balance<0||w.data.balance>100000000)fail('Carteira IA inválida.',423);return w;}
 async function finish(env,path,state){await transaction(env,async t=>{const q=await t.get(path);if(q?.data?.state==='reserved')await t.commit([put(path,{...q.data,state,completedAt:clock()},q)]);});}
 return async function voice(req,env){
  const origin=req.headers.get('Origin'),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin&&!origins.has(origin))return new Response(null,{status:403,headers});
  if(origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  const route=new URL(req.url).pathname;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(route==='/voice/health'&&req.method==='GET')return json({status:'ok',voicePilot:env.VOICE_PILOT_ENABLED==='true',scope:'adm-only',stockWrites:env.ENABLE_WRITES==='true'});
  try{
   if(env.VOICE_PILOT_ENABLED!=='true'||env.ENABLE_WRITES!=='false')fail('Piloto não ativado.',423);
   if(route==='/voice/ready'&&req.method==='GET'){
    const expected=env.VOICE_PROBE_TOKEN,provided=req.headers.get('X-Voice-Probe')||'';
    if(typeof expected!=='string'||expected.length<43||provided!==expected)fail('Não autorizado.',403);
    const s=await subscription(env),catalog=await voices(env);
    if(!catalog.length)fail('VOICE_CATALOG_NO_ALLOWLIST_MATCH',503);
    let bearer;try{bearer=await serviceToken(env,providerFetch)}catch{fail('FIREBASE_SERVICE_AUTH_FAILED',503);}
    let g;try{g=await providerFetch('https://firestore.googleapis.com/v1/projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)',{headers:{Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(15000)});}catch{fail('FIREBASE_METADATA_TRANSPORT_FAILED',503);}
    if(!g.ok)fail('FIREBASE_METADATA_HTTP_'+g.status,503);
    return json({ready:true,tier:s.tier,providerRemaining:s.character_limit-s.character_count,allowedVoices:catalog.length,overageOff:true,firestoreMetadata:true,scope:'adm-only'});
   }
   if(req.method!=='POST')fail('Método não permitido.',405);
   const token=req.headers.get('Authorization')||'';
   if(!/^Bearer [^\s]+$/.test(token))fail('Autenticação obrigatória.',401);
   let user;try{user=await verify(token.slice(7),env.FIREBASE_PROJECT_ID)}catch{fail('Sessão inválida.',401)}
   if(!user?.isAdmin||user.email!=='pixmcp@gmail.com'||!/^[A-Za-z0-9:_-]{1,128}$/.test(user.uid))fail('Homologação exclusiva do ADM.',403);
   if(route.startsWith('/voice/admin/clone/'))fail('Clonagem será liberada após homologação da geração.',423);
   const bodyText=await req.text();if(bodyText.length>16000)fail('Pedido muito grande.',413);
   let body;try{body=JSON.parse(bodyText||'{}')}catch{fail('JSON inválido.')}
   const uid=user.uid,base='users/'+uid,wp=base+'/aiWallet/main';
   if(route==='/voice/status'){
    const balance=await transaction(env,async t=>{await profile(t,uid);return (await wallet(t,uid)).data.balance;});
    const s=await subscription(env),catalog=await voices(env);
    return json({authorized:true,commercialReady:true,pilot:true,balance,voices:catalog,franchiseAllocation:null,providerRemaining:s.character_limit-s.character_count});
   }
   if(route==='/voice/quote'){
    const text=validateText(body.text),voiceId=body.voiceId,seconds=body.seconds,options=validateVoiceOptions(body);
    if(!allowedVoiceIds.has(voiceId))fail('Voz não autorizada.',403);
    const tariff=durationQuote(text,seconds,cfg),s=await subscription(env);
    if(s.character_limit-s.character_count<text.length)fail('Cota insuficiente.',423);
    if(!(await voices(env)).some(v=>v.id===voiceId))fail('Voz não disponível.',423);
    const id=uuid(),expiresAt=clock()+300000,path=base+'/voiceAiOrders/'+id;
    const balance=await transaction(env,async t=>{await profile(t,uid);const w=await wallet(t,uid);if(w.data.balance<tariff.credits)fail('Saldo insuficiente.',409);await t.commit([put(path,{uid,text,voiceId,seconds,options,credits:tariff.credits,state:'quoted',expiresAt},null,['createdAt'])]);return w.data.balance;});
    return json({quoteId:id,credits:tariff.credits,seconds,maxChars:tariff.maxChars,balance,franchiseAllocation:null});
   }
   if(route==='/voice/generate'){
    const id=body.quoteId;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))fail('Cotação inválida.');
    const path=base+'/voiceAiOrders/'+id,lockPath='voicePilotOperations/active';
    const s=await subscription(env),catalog=await voices(env);
    const q=await transaction(env,async t=>{
     const p=await profile(t,uid),w=await wallet(t,uid),order=await t.get(path),lock=await t.get(lockPath);
     const data=order?.data;
     if(!canReserve({profile:p.data,commercial:true,quote:data,balance:w.data.balance,uid,now:clock(),admin:true}))fail('Cotação expirada, usada ou saldo insuficiente.',409);
     if(lock?.data?.state==='reserved'||lock?.data?.state==='reconcile')fail('Há geração em andamento ou pendente de conciliação.',409);
     if(durationQuote(data.text,data.seconds,cfg).credits!==data.credits||!catalog.some(v=>v.id===data.voiceId)||s.character_limit-s.character_count<data.text.length)fail('Cotação ou cota alterada.',409);
     validateVoiceOptions(data.options);
     const debitId='voice-'+id+'-debit',before=w.data.balance,after=before-data.credits;
     await t.commit([put(wp,{balance:after,lastEventId:debitId},w),put(wp+'/entries/'+debitId,{kind:'voice_debit',before,after,delta:-data.credits,reason:'Reserva de locução ADM',actorUid:uid},null,['at']),put(path,{...data,state:'reserved',reservedAt:clock()},order),put(lockPath,{state:'reserved',quoteId:id,uid},lock)]);
     return data;
    });
    try{
     const opts=validateVoiceOptions(q.options),audio=await provider(env,'/v1/text-to-speech/'+encodeURIComponent(q.voiceId)+'?output_format=mp3_44100_128',{text:q.text,model_id:opts.modelId,voice_settings:opts.voiceSettings,...(opts.languageCode?{language_code:opts.languageCode}:{})});
     if(!audio.headers.get('Content-Type')?.startsWith('audio/'))fail('Formato inesperado.',502);
     const bytes=await audio.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>15*1024*1024)fail('Áudio inválido.',502);
     await transaction(env,async t=>{const order=await t.get(path),lock=await t.get(lockPath);if(order?.data?.state!=='reserved'||lock?.data?.quoteId!==id)fail('Conciliação necessária.',409);await t.commit([put(path,{...order.data,state:'completed',completedAt:clock(),providerRequestId:audio.headers.get('request-id')||null},order),put(lockPath,{state:'completed',quoteId:id,uid},lock)]);});
     return new Response(bytes,{status:200,headers:{...headers,'Content-Type':'audio/mpeg'}});
    }catch(e){try{await transaction(env,async t=>{const order=await t.get(path),lock=await t.get(lockPath);if(order?.data?.state==='reserved'&&lock?.data?.quoteId===id)await t.commit([put(path,{...order.data,state:'reconcile'},order),put(lockPath,{state:'reconcile',quoteId:id,uid},lock)]);})}catch{}fail('Geração não confirmada. Reserva preservada para conciliação; não repita.',502);}
   }
   fail('Rota inexistente.',404);
  }catch(e){return json({error:e.publicStatus?e.message:'Operação indisponível. Consulte o histórico.'},e.publicStatus||503);}
 };
}
export default createVoicePilot();
