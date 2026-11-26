// ADM-only canary. Separate routes from stock; no public audio operations.
import {verifyFirebaseToken,serviceAccessToken} from './auth.mjs';
import {createFirestoreRepository} from './firestore.mjs';
import {durationQuote,validateText,validateVoiceOptions,commercialReady,canReserve} from '../../../voice_backend/policy.mjs';
import {PREVIEW_TEXT,PREVIEW_MAX,previewPath,encodePreview,decodePreview} from './voice_preview.mjs';
import {validateClone} from '../../../voice_backend/clone_policy.mjs';
const origins=new Set(['https://pdv.livresom.com','https://potobatata-b71f3.web.app','https://pixmcp-cloud.github.io']);
// During ADM-only homologation, use actual account voices. No publication to customers.
const validVoiceId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
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
  return (Array.isArray(v.voices)?v.voices:[]).filter(x=>validVoiceId(x.voice_id)).map(x=>({id:x.voice_id,name:String(x.name||'Voz').slice(0,120),description:String(x.description||'').slice(0,250),labels:Object.fromEntries(['gender','age','accent','language'].filter(k=>typeof x.labels?.[k]==='string').map(k=>[k,x.labels[k].slice(0,80)])),previewUrl:typeof x.preview_url==='string'?x.preview_url:null}));
 }
 async function transaction(env,fn){const t=await repo(env).transaction();try{return await fn(t)}finally{await t.rollback();}}
 async function profile(t,uid){const p=await t.get('users/'+uid);if(!p||p.data?.email!=='pixmcp@gmail.com'||p.data?.accessPolicy?.voiceAiEnabled===false)fail('Conta ADM não autorizada.',403);return p;}
 async function wallet(t,uid){const w=await t.get('users/'+uid+'/aiWallet/main');if(!w||!Number.isSafeInteger(w.data?.balance)||w.data.balance<0||w.data.balance>100000000)fail('Carteira IA inválida.',423);return w;}
 const cloneRegistryPath='voicePilotOperations/cloneRegistry';
 const cloneLockPath='voicePilotOperations/cloneLock';
 async function cloneRecords(env){return transaction(env,async t=>(await t.get(cloneRegistryPath))?.data?.voices||{});}
 async function usableVoices(env){const [catalog,records]=await Promise.all([voices(env),cloneRecords(env)]);return catalog.filter(v=>records[v.id]?.requiresVerification!==true).map(v=>records[v.id]?{...v,description:records[v.id].description,officialClone:true}:v);}
 async function cloneCreate(env,uid,body){
  let x;try{x=validateClone(body)}catch(e){fail(e.message,400);}
  const s=await subscription(env);
  if(s.can_use_instant_voice_cloning!==true)fail('Clonagem não disponível no plano.',423);
  const jobPath='voiceCloneJobs/'+x.requestId;
  const existing=await transaction(env,async t=>{
   await profile(t,uid);const job=await t.get(jobPath),lock=await t.get(cloneLockPath),registry=await t.get(cloneRegistryPath);
   if(job){if(job.data.uid!==uid)fail('Solicitação inválida.',403);if(job.data.state==='completed')return {voiceId:job.data.voiceId,state:job.data.voiceState};fail('Clonagem já solicitada; conciliação obrigatória.',409);}
   if(['reserved','reconcile'].includes(lock?.data?.state))fail('Existe clonagem pendente de conciliação.',409);
   if(Object.keys(registry?.data?.voices||{}).length>=100)fail('Limite de vozes oficiais atingido.',423);
   await t.commit([put(jobPath,{uid,name:x.name,description:x.description,consentRef:x.consentRef,consentConfirmed:true,state:'reserved'},null,['createdAt']),put(cloneLockPath,{uid,requestId:x.requestId,state:'reserved'},lock)]);return null;
  });
  if(existing)return existing;
  try{
   const form=new FormData();form.set('name',x.name);form.set('description',x.description);
   form.append('files',new Blob([x.bytes],{type:x.mime}),x.filename);
   const response=await providerFetch('https://api.elevenlabs.io/v1/voices/add',{method:'POST',headers:{'xi-api-key':env.ELEVENLABS_API_KEY},body:form,signal:AbortSignal.timeout(60000),redirect:'manual'});
   if(!response.ok)fail('Clonagem recusada pelo provedor (HTTP '+response.status+'). Concilie antes de repetir.',502);
   const v=await response.json();if(!validVoiceId(v.voice_id))fail('Resposta inválida da clonagem.',502);
   const requiresVerification=v.requires_verification!==false||Boolean(v.library_voice_match);
   const state=requiresVerification?'verification_required':'draft';
   await transaction(env,async t=>{
    const registry=await t.get(cloneRegistryPath),job=await t.get(jobPath),lock=await t.get(cloneLockPath);
    if(job?.data?.state!=='reserved'||lock?.data?.requestId!==x.requestId)fail('Conciliação necessária.',409);
    const entries=registry?.data?.voices||{};if(Object.hasOwn(entries,v.voice_id))fail('Voz já cadastrada.',409);
    const record={name:x.name,description:x.description,consentRef:x.consentRef,consentConfirmed:true,requiresVerification,state,createdBy:uid,createdAt:clock()};
    await t.commit([put(cloneRegistryPath,{voices:{...entries,[v.voice_id]:record}},registry),put(jobPath,{...job.data,state:'completed',voiceId:v.voice_id,voiceState:state},job),put(cloneLockPath,{uid,requestId:x.requestId,state:'completed'},lock)]);
   });
   return {voiceId:v.voice_id,state};
  }catch(e){
   try{await transaction(env,async t=>{const job=await t.get(jobPath),lock=await t.get(cloneLockPath);if(job?.data?.state==='reserved'&&lock?.data?.requestId===x.requestId)await t.commit([put(jobPath,{...job.data,state:'reconcile'},job),put(cloneLockPath,{...lock.data,state:'reconcile'},lock)]);});}catch{}
   fail(e.publicStatus?e.message:'Clonagem não confirmada. Não repita antes da conciliação.',502);
  }
 }
 async function portuguesePreview(env,uid,body){
  const id=body.voiceId;if(!validVoiceId(id)||Object.keys(body).some(k=>k!=='voiceId'))fail('Voz inválida.',400);
  const path=previewPath(id),budgetPath='voicePilotOperations/previewBudgetPtV1',lockPath='voicePilotOperations/active';
  const catalog=await usableVoices(env);if(!catalog.some(v=>v.id===id))fail('Voz não autorizada.',403);
  const cached=await transaction(env,async t=>{await profile(t,uid);return (await t.get(path))?.data;});
  if(cached?.state==='ready')return decodePreview(cached.audio);
  if(cached)fail('Amostra pendente de conciliação. Não será gerada novamente.',409);
  const s=await subscription(env);
  if(s.character_limit-s.character_count<PREVIEW_TEXT.length)fail('Cota insuficiente para preparar a amostra.',423);
  const reservation=await transaction(env,async t=>{
   await profile(t,uid);const prior=await t.get(path),budget=await t.get(budgetPath),lock=await t.get(lockPath);
   if(prior?.data?.state==='ready')return {audio:prior.data.audio};
   if(prior)fail('Amostra já solicitada.',409);
   if(['reserved','reconcile'].includes(lock?.data?.state))fail('Existe locução em andamento ou pendente de conciliação.',409);
   const count=budget?.data?.count??0;
   const ids=budget?.data?.voiceIds??catalog.slice(0,PREVIEW_MAX).map(v=>v.id);
   if(!Array.isArray(ids)||!ids.includes(id)||!Number.isSafeInteger(count)||count<0||count>=PREVIEW_MAX)fail('Limite de amostras iniciais atingido.',423);
   await t.commit([put(path,{state:'reserved',voiceId:id,uid},null,['createdAt']),put(budgetPath,{count:count+1,voiceIds:ids,reservedCharacters:(count+1)*PREVIEW_TEXT.length},budget),put(lockPath,{state:'reserved',uid,previewId:id},lock)]);return null;
  });
  if(reservation?.audio)return decodePreview(reservation.audio);
  try{
   const audio=await provider(env,'/v1/text-to-speech/'+encodeURIComponent(id)+'?output_format=mp3_44100_64',{text:PREVIEW_TEXT,model_id:'eleven_flash_v2_5',language_code:'pt',voice_settings:{stability:.5,similarity_boost:.75,style:0,speed:1,use_speaker_boost:true}});
   if(!audio.headers.get('Content-Type')?.startsWith('audio/'))fail('Amostra inválida.',502);
   const bytes=new Uint8Array(await audio.arrayBuffer()),encoded=encodePreview(bytes);
   await transaction(env,async t=>{const p=await t.get(path),l=await t.get(lockPath);if(p?.data?.state!=='reserved'||l?.data?.previewId!==id)fail('Conciliação necessária.',409);await t.commit([put(path,{...p.data,state:'ready',audio:encoded,language:'pt',characters:PREVIEW_TEXT.length},p,['completedAt']),put(lockPath,{state:'completed',uid,previewId:id},l)]);});
   return bytes;
  }catch(e){
   try{await transaction(env,async t=>{const p=await t.get(path),l=await t.get(lockPath);if(p?.data?.state==='reserved'&&l?.data?.previewId===id)await t.commit([put(path,{...p.data,state:'reconcile'},p),put(lockPath,{state:'reconcile',uid,previewId:id},l)]);});}catch{}
   fail('Não foi possível confirmar a amostra. Nenhum IA COIN debitado; conciliação necessária.',502);
  }
 }
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
    if(!catalog.length)fail('VOICE_CATALOG_EMPTY',503);
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
   const cloneUpload=route==='/voice/admin/clone/create';
   const maxBytes=cloneUpload?12*1024*1024:16000;
   if(Number(req.headers.get('Content-Length')||0)>maxBytes)fail('Pedido muito grande.',413);
   const bodyText=await req.text();if(bodyText.length>maxBytes)fail('Pedido muito grande.',413);
   let body;try{body=JSON.parse(bodyText||'{}')}catch{fail('JSON inválido.')}
   const uid=user.uid,base='users/'+uid,wp=base+'/aiWallet/main';
   if(route==='/voice/admin/clone/list'){
    await transaction(env,t=>profile(t,uid));
    const s=await subscription(env),records=await cloneRecords(env);
    return json({cloneApproved:s.can_use_instant_voice_cloning===true,sharedCloneApproved:false,voices:Object.entries(records).map(([id,d])=>({id,name:d.name,description:d.description,state:d.state}))});
   }
   if(route==='/voice/admin/clone/create')return json(await cloneCreate(env,uid,body));
   if(route==='/voice/admin/clone/publish')fail('Distribuição para lojistas ainda em homologação; clones verificados já podem ser usados pelo ADM.',423);
   if(route==='/voice/preview'){
    const bytes=await portuguesePreview(env,uid,body);
    return new Response(bytes,{status:200,headers:{...headers,'Content-Type':'audio/mpeg'}});
   }
   if(route==='/voice/status'){
    const balance=await transaction(env,async t=>{await profile(t,uid);return (await wallet(t,uid)).data.balance;});
    const s=await subscription(env),catalog=await usableVoices(env);
    return json({authorized:true,commercialReady:true,pilot:true,balance,voices:catalog,franchiseAllocation:null,providerRemaining:s.character_limit-s.character_count});
   }
   if(route==='/voice/quote'){
    let text,options,tariff;const voiceId=body.voiceId,seconds=body.seconds;
    try{text=validateText(body.text);options=validateVoiceOptions(body);tariff=durationQuote(text,seconds,cfg);}catch(e){fail(e.message,400);}
    if(!validVoiceId(voiceId))fail('Voz não autorizada.',403);
    const s=await subscription(env);
    if(s.character_limit-s.character_count<text.length)fail('Cota insuficiente.',423);
    if(!(await usableVoices(env)).some(v=>v.id===voiceId))fail('Voz não disponível.',423);
    const id=uuid(),expiresAt=clock()+300000,path=base+'/voiceAiOrders/'+id;
    const balance=await transaction(env,async t=>{await profile(t,uid);const w=await wallet(t,uid);if(w.data.balance<tariff.credits)fail('Saldo insuficiente.',409);await t.commit([put(path,{uid,text,voiceId,seconds,options,credits:tariff.credits,state:'quoted',expiresAt},null,['createdAt'])]);return w.data.balance;});
    return json({quoteId:id,credits:tariff.credits,seconds,maxChars:tariff.maxChars,balance,franchiseAllocation:null});
   }
   if(route==='/voice/generate'){
    const id=body.quoteId;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))fail('Cotação inválida.');
    const path=base+'/voiceAiOrders/'+id,lockPath='voicePilotOperations/active';
    const s=await subscription(env),catalog=await usableVoices(env);
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
