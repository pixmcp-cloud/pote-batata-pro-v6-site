// Private Node.js service. Do not ship to public/ or deploy with free ElevenLabs.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {authorized,isFranchise,validateText,durationQuote,validateVoiceOptions,commercialReady,canReserve,franchiseQuota,individualFranchiseQuota} from './policy.mjs';
initializeApp({credential:applicationDefault(),projectId:'potobatata-b71f3'});
const db=getFirestore(),auth=getAuth();
const cfg={
 commercialApproved:process.env.VOICE_COMMERCIAL_APPROVED==='true',
 licensedTiers:(process.env.VOICE_LICENSED_TIERS||'').split(',').filter(Boolean),
 providerMicroBrlPer1000:Number(process.env.VOICE_PROVIDER_MICRO_BRL_PER_1000),
 creditMicroBrl:Number(process.env.AI_CREDIT_MICRO_BRL)
};
const originSet=new Set(['https://pdv.livresom.com','https://potobatata-b71f3.web.app','https://pixmcp-cloud.github.io']);
const voiceIds=(process.env.VOICE_ALLOWED_IDS||'').split(',').filter(x=>/^[A-Za-z0-9_-]{1,100}$/.test(x));
const key=process.env.ELEVENLABS_API_KEY;
const wallet=uid=>db.doc('users/'+uid+'/aiWallet/main');
const account=uid=>db.doc('users/'+uid);
const order=(uid,id)=>db.doc('users/'+uid+'/voiceAiOrders/'+id);
function fail(message,status=400){throw Object.assign(Error(message),{status});}
async function provider(path,body){
 if(!key||!cfg.commercialApproved)fail('Serviço comercial indisponível.',423);
 const res=await fetch('https://api.elevenlabs.io'+path,{
  method:body?'POST':'GET',headers:{'xi-api-key':key,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000),redirect:'error'
 });
 if(!res.ok)fail('Provedor indisponível.',502);
 return res;
}
async function subscription(){
 const s=await(await provider('/v1/user/subscription')).json();
 if(!commercialReady(s,cfg))fail('Licença comercial ou proteção de excedentes não confirmada.',423);
 return s;
}
async function session(req){
 const header=req.headers.authorization||'';
 if(!header.startsWith('Bearer '))fail('Autenticação obrigatória.',401);
 let user;try{user=await auth.verifyIdToken(header.slice(7),true)}catch{fail('Sessão inválida.',401)}
 if(user.email_verified!==true||user.firebase?.sign_in_provider!=='google.com')fail('Conta Google verificada obrigatória.',403);
 const admin=user.potebatataAdmin===true&&user.email==='pixmcp@gmail.com';
 const snap=await account(user.uid).get();
 if(!snap.exists||!authorized(snap.data(),Date.now(),admin))fail('IA exclusiva para PRO ativo, vitalício e franquia. Verifique sua licença ou bloqueio ADM.',403);
 return {uid:user.uid,admin};
}
async function read(req){
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>16000)fail('Pedido muito grande.',413);chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{fail('JSON inválido.')}
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
async function balance(uid){
 const snapshot=await wallet(uid).get(),value=snapshot.data()?.balance;
 if(!snapshot.exists)return 0;
 if(!Number.isSafeInteger(value)||value<0)fail('Carteira IA não homologada ou indisponível.',423);
 return value;
}
// Count every active official franchise, even when its access to voice is blocked by ADM.
const activeFranchises=()=>db.collection('users').where('franchise.status','==','active');
async function franchiseAllocation(tx,s,uid){
 const quota=franchiseQuota(s),quotaRef=db.doc('voiceAiFranchiseQuota/'+quota.cycle);
 const memberRef=quotaRef.collection('members').doc(uid);
 const [all,global,member]=await Promise.all([tx.get(activeFranchises()),tx.get(quotaRef),tx.get(memberRef)]);
 const active=all.docs.filter(d=>isFranchise(d.data()));
 if(!active.some(d=>d.id===uid))fail('Franquia ativa não encontrada.',403);
 const used=global.exists?global.data().used:0,individualUsed=member.exists?member.data().used:0;
 // Old aggregate-only counters cannot be allocated fairly: reconcile before commercial activation.
 if(global.exists&&used>0&&global.data().allocationVersion!==2)fail('Cota anterior requer conciliação.',423);
 const allocation=individualFranchiseQuota({limit:quota.limit,count:active.length,used,individualUsed});
 return {quota,quotaRef,memberRef,used,allocation};
}
function validateVoice(id){if(typeof id!=='string'||!voiceIds.includes(id))fail('Voz não autorizada.');return id;}
async function generate(uid,id,res,admin=false){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))fail('Cotação inválida.');
 const s=await subscription(),ref=order(uid,id);
 const q=await db.runTransaction(async tx=>{
  const [a,w,o]=await Promise.all([tx.get(account(uid)),tx.get(wallet(uid)),tx.get(ref)]);
  const quote=o.data(),current=w.data()?.balance;
  if(!canReserve({profile:a.data(),commercial:true,quote,balance:current,uid,now:Date.now(),admin}))fail('Cotação expirada, usada, acesso revogado ou saldo insuficiente.',409);
  if(durationQuote(quote.text,quote.seconds,cfg).credits!==quote.credits)fail('Preço alterado, solicite nova cotação.',409);
  validateVoice(quote.voiceId);
  validateVoiceOptions(quote.options);
  if(!Number.isSafeInteger(s.character_limit)||!Number.isSafeInteger(s.character_count)||s.character_limit-s.character_count<quote.text.length)fail('Cota do provedor insuficiente.',423);
  let franchiseReservation=null;
  if(isFranchise(a.data())){
   const {quota,quotaRef,memberRef,used,allocation}=await franchiseAllocation(tx,s,uid);
   const requested=quote.text.length;
   if(requested>allocation.remaining)fail('Cota individual ou coletiva das franquias insuficiente.',409);
   tx.set(quotaRef,{used:used+requested,limit:quota.limit,allocationVersion:2,updatedAt:FieldValue.serverTimestamp()},{merge:true});
   tx.set(memberRef,{used:allocation.used+requested,updatedAt:FieldValue.serverTimestamp()},{merge:true});
   franchiseReservation={cycle:quota.cycle,requested};
  }
  const debitId='voice-'+id+'-debit';
  tx.update(wallet(uid),{balance:current-quote.credits,lastEventId:debitId,updatedAt:FieldValue.serverTimestamp()});
  tx.create(wallet(uid).collection('entries').doc(debitId),{kind:'voice_debit',before:current,after:current-quote.credits,delta:-quote.credits,reason:'Reserva de locução',actorUid:uid,at:FieldValue.serverTimestamp()});
  tx.update(ref,{state:'reserved',franchiseReservation,reservedAt:FieldValue.serverTimestamp()});
  return {...quote,franchiseReservation};
 });
 // No automatic retry. A timeout may have consumed credits at the provider.
 // Keep reservation for manual reconciliation; never issue a second POST for this quote.
 try{
  const current=await account(uid).get();
  if(!authorized(current.data(),Date.now(),admin)||durationQuote(q.text,q.seconds,cfg).credits!==q.credits||isFranchise(current.data())!==Boolean(q.franchiseReservation)) {
   await db.runTransaction(async tx=>{
    const o=await tx.get(ref),w=await tx.get(wallet(uid));
    const quotaRef=q.franchiseReservation?db.doc('voiceAiFranchiseQuota/'+q.franchiseReservation.cycle):null;
    const memberRef=quotaRef?quotaRef.collection('members').doc(uid):null;
    const [quotaSnap,memberSnap]=quotaRef?await Promise.all([tx.get(quotaRef),tx.get(memberRef)]):[null,null];
    if(o.data()?.state==='reserved'&&Number.isSafeInteger(w.data()?.balance)){
     if(quotaRef){
      const used=quotaSnap.data()?.used,memberUsed=memberSnap.data()?.used;
      if(!Number.isSafeInteger(used)||!Number.isSafeInteger(memberUsed)||used<q.franchiseReservation.requested||memberUsed<q.franchiseReservation.requested)fail('Cota requer conciliação.',409);
      tx.update(quotaRef,{used:used-q.franchiseReservation.requested,updatedAt:FieldValue.serverTimestamp()});
      tx.update(memberRef,{used:memberUsed-q.franchiseReservation.requested,updatedAt:FieldValue.serverTimestamp()});
     }
     const refundId='voice-'+id+'-refund',before=w.data().balance;
     tx.update(wallet(uid),{balance:before+q.credits,lastEventId:refundId,updatedAt:FieldValue.serverTimestamp()});
     tx.create(wallet(uid).collection('entries').doc(refundId),{kind:'voice_refund',before,after:before+q.credits,delta:q.credits,reason:'Estorno anterior à síntese',actorUid:uid,at:FieldValue.serverTimestamp()});
     tx.update(ref,{state:'refunded',reason:'access_revoked_before_provider'});
    }
   });
   fail('Permissão ou preço alterado antes da geração.',403);
  }
  const opts=validateVoiceOptions(q.options);
  const audio=await provider('/v1/text-to-speech/'+encodeURIComponent(q.voiceId)+'?output_format=mp3_44100_128',{text:q.text,model_id:opts.modelId,voice_settings:opts.voiceSettings,...(opts.languageCode?{language_code:opts.languageCode}:{})});
  if(!audio.headers.get('content-type')?.startsWith('audio/'))fail('Formato inesperado.',502);
  const bytes=Buffer.from(await audio.arrayBuffer());
  if(!bytes.length||bytes.length>15*1024*1024)fail('Áudio inválido.',502);
  await ref.update({state:'completed',completedAt:FieldValue.serverTimestamp(),providerRequestId:audio.headers.get('request-id')||null});
  res.writeHead(200,{'Content-Type':'audio/mpeg'});res.end(bytes);
 }catch(e){
  await db.runTransaction(async tx=>{
   const o=await tx.get(ref);if(o.data()?.state==='reserved')tx.update(ref,{state:'reconcile',updatedAt:FieldValue.serverTimestamp()});
  }).catch(()=>{});
  throw e;
 }
}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 const origin=req.headers.origin;
 if(!originSet.has(origin))return send(res,403,{error:'Origem inválida.'});
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 if(req.method!=='POST')return send(res,405,{error:'Método inválido.'});
 try{
  const {uid,admin}=await session(req),data=await read(req);
  if(req.url==='/status'){
   const s=await subscription(),profile=(await account(uid).get()).data();
   const franchiseAllocationView=isFranchise(profile)?await db.runTransaction(async tx=>(await franchiseAllocation(tx,s,uid)).allocation,{readOnly:true}):null;
   const list=await(await provider('/v2/voices?page_size=100')).json();
   return send(res,200,{authorized:true,commercialReady:true,balance:await balance(uid),franchiseAllocation:franchiseAllocationView,voices:(list.voices||[]).filter(v=>voiceIds.includes(v.voice_id)).map(v=>({id:v.voice_id,name:v.name,description:typeof v.description==='string'?v.description.slice(0,250):'',previewUrl:typeof v.preview_url==='string'?v.preview_url:null}))});
  }
  if(req.url==='/quote'){
   const s=await subscription();
   const profile=(await account(uid).get()).data();
   if(!authorized(profile,Date.now(),admin))fail('Locução bloqueada pelo ADM.',403);
   const text=validateText(data.text),voiceId=validateVoice(data.voiceId),seconds=data.seconds,tariff=durationQuote(text,seconds,cfg),credits=tariff.credits,value=await balance(uid);
   let franchiseAllocationView=null;
   if(isFranchise(profile)){
    franchiseAllocationView=await db.runTransaction(async tx=>(await franchiseAllocation(tx,s,uid)).allocation,{readOnly:true});
    if(text.length>franchiseAllocationView.remaining)fail('Cota individual ou coletiva das franquias insuficiente.',409);
   }
   const options=validateVoiceOptions(data),quoteId=randomUUID();
   await order(uid,quoteId).create({uid,text,voiceId,seconds,credits,options,state:'quoted',expiresAt:Date.now()+300000,createdAt:FieldValue.serverTimestamp()});
   return send(res,200,{quoteId,credits,seconds,maxChars:tariff.maxChars,balance:value,franchiseAllocation:franchiseAllocationView});
  }
  if(req.url==='/generate')return await generate(uid,data.quoteId,res,admin);
  return send(res,404,{error:'Rota inexistente.'});
 }catch(e){if(!res.headersSent)send(res,e.status||400,{error:e.status?e.message:'Operação não concluída. Consulte o histórico.'});else res.end()}
});
server.requestTimeout=60000;
server.listen(Number(process.env.PORT||8788),'127.0.0.1');
