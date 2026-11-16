/* Firebase V2 repository. Store one logical record per document.
   No legacy deletes. In test-only cutover, old appState/main remains untouched.
   All inventory-sensitive edits serialize through the same transaction guard. */
import {splitState,combineState,diffState,validateChangeSet,recordId} from "./v2_store_core.mjs?v=adm-v2-recipes-20261116";
import {stableJson,nextRevision,jsonBytes,MAX_APPSTATE_BYTES} from "./sync_guard.mjs";
import {checkFreeUniverseDelta} from "./free_limits.mjs?v=kitchen-motoboy-20261116";

const same=(a,b)=>stableJson(a??null)===stableJson(b??null);
const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error};
const token=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():
 "client-"+Date.now()+"-"+Math.random().toString(36).slice(2);

export function createV2Store({uid,db,sdk,fresh,snapshot,apply,status=()=>{}}){
 const {doc,collection,getDoc,getDocs,runTransaction,onSnapshot,serverTimestamp}=sdk;
 const root=doc(db,"users",uid,"appState","v2");
 const guardRef=doc(db,"users",uid,"appState","v2InventoryGuard");
 const pulseRef=doc(db,"users",uid,"appState","v2Pulse");
 const recordsRef=collection(db,"users",uid,"records");
 const session=token();
 let baseline=null,guardRevision=0,seenPulse="",off=null,refreshing=false,refreshAgain=false;
 let saving=false,disposed=false,lastSavedJson="";
 const recordRef=key=>doc(db,"users",uid,"records",key);
 const stateJson=()=>JSON.stringify(snapshot());
 const loadDocuments=async()=>{
  const result=new Map(),snap=await getDocs(recordsRef);
  for(const d of snap.docs){
   const entry=d.data()?.record;
   if(!entry||!entry.group||!entry.universe)throw Error("Registro V2 inválido: "+d.id);
   if(d.id!==recordId(entry.universe,entry.group,entry.id))
    throw Error("Identificador V2 divergente: "+d.id);
   result.set(d.id,entry);
  }
  return result;
 };
 async function firstLoad(){
  if(disposed)throw Error("Sessão encerrada");
  let metaSnap=await getDoc(root),created=false;
  if(!metaSnap.exists()){
   fresh();
   const clean=splitState(snapshot());
   if(jsonBytes(clean.meta)>MAX_APPSTATE_BYTES)throw Error("Configuração inicial excede limite");
   try{
    await runTransaction(db,async tx=>{
     const current=await tx.get(root);
     if(current.exists())fail("sync/conflict","Conta foi inicializada em outra sessão");
     tx.set(root,{schemaVersion:2,state:clean.meta,updatedAt:serverTimestamp()});
     tx.set(guardRef,{revision:0,updatedAt:serverTimestamp()});
     tx.set(pulseRef,{eventId:token(),origin:session,updatedAt:serverTimestamp()});
    });
    created=true;
   }catch(e){
    if(e.code!=="sync/conflict")throw e;
   }
   metaSnap=await getDoc(root);
  }
  if(!metaSnap.exists()||metaSnap.data().schemaVersion!==2)
   throw Error("Versão da conta incompatível com o armazenamento V2");
  const [recordMap,guardSnap,pulseSnap]=await Promise.all([
   loadDocuments(),getDoc(guardRef),getDoc(pulseRef)
  ]);
  if(disposed)throw Error("Sessão encerrada");
  const meta=metaSnap.data().state;
  const restored=combineState(meta,recordMap);
  apply(restored);
  baseline={meta,records:recordMap};
  guardRevision=Number(guardSnap.data()?.revision)||0;
  seenPulse=String(pulseSnap.data()?.eventId||"");
  lastSavedJson=stateJson();
  status(created?"Conta V2 iniciada sem dados de teste":"Dados V2 carregados");
  return {created,records:recordMap.size,guardRevision};
 }
 async function save(){
  if(disposed||!baseline)return {ok:false,error:"V2 não inicializado"};
  if(saving)return {ok:false,queued:true};
  const current=stateJson();
  if(current===lastSavedJson)return {ok:true,unchanged:true};
  let next,delta;
  try{
   next=splitState(snapshot(),baseline.records);
   // O FREE tem uma ação/cadastro por grupo operacional em cada ramo extra.
   // Conferimos o delta antes de qualquer transação, sem reescrever legados.
   const client=typeof window!=="undefined"?window.POTE_AUTH:null;
   if(client?.uid&&!client.proActive){
    const branch=String(snapshot()?.data?.businessType||"");
    const quota=checkFreeUniverseDelta(baseline.records,next.records,branch);
    if(!quota.ok)return {ok:false,code:"free/limit",error:quota.error};
   }
   delta=diffState(baseline,next);
   validateChangeSet(delta);
  }catch(e){return {ok:false,error:e.message,code:"sync/invalid-state"}}
  if(!delta.changes.length){lastSavedJson=current;return {ok:true,unchanged:true}}
  saving=true;
  const old=baseline,oldGuard=guardRevision;
  try{
   await runTransaction(db,async tx=>{
    // All reads happen before any write, as Firestore transaction API requires.
    const queries=[];
    for(const ch of delta.changes){
     queries.push({ch,ref:ch.kind==="meta"?root:recordRef(ch.key)});
    }
    const observed=[];
    for(const q of queries)observed.push(await tx.get(q.ref));
    const guard=delta.sensitive?await tx.get(guardRef):null;
    for(let i=0;i<queries.length;i++){
     const q=queries[i],remote=q.ch.kind==="meta"?
      observed[i].data()?.state??null:observed[i].data()?.record??null;
     if(!same(remote,q.ch.before))
      fail("sync/conflict","Registro alterado em outro dispositivo: "+(q.ch.key||"configurações"));
    }
    if(delta.sensitive && Number(guard.data()?.revision||0)!==oldGuard)
     fail("sync/conflict","Pedidos ou estoque alterados em outra sessão");
    for(const q of queries){
     const change=q.ch;
     if(change.after===null)tx.delete(q.ref);
     else if(change.kind==="meta")tx.set(q.ref,{
      schemaVersion:2,state:change.after,updatedAt:serverTimestamp()
     },{merge:true});
     else tx.set(q.ref,{record:change.after,updatedAt:serverTimestamp()});
    }
    if(delta.sensitive)tx.set(guardRef,{
      revision:nextRevision(oldGuard),updatedAt:serverTimestamp()
    },{merge:true});
    tx.set(pulseRef,{
      eventId:token(),origin:session,updatedAt:serverTimestamp(),
      affected:delta.changes.length
    });
   });
   baseline=next;
   if(delta.sensitive)guardRevision=nextRevision(oldGuard);
   lastSavedJson=current;
   status("Dados V2 salvos com segurança");
   return {ok:true,changed:delta.changes.length};
  }catch(e){
   return {ok:false,code:e.code||"sync/error",error:e.message};
  }finally{saving=false}
 }
 async function refresh(){
  if(disposed||!baseline)return {ok:false};
  if(refreshing){refreshAgain=true;return {ok:false,queued:true}}
  refreshing=true;
  try{
   if(stateJson()!==lastSavedJson)
    return {ok:false,code:"sync/conflict",error:"Há alterações locais pendentes"};
   const head=await getDoc(root);
   if(!head.exists()||head.data().schemaVersion!==2)
    fail("sync/schema","Conta V2 indisponível");
   const [records,guard]=await Promise.all([loadDocuments(),getDoc(guardRef)]);
   if(stateJson()!==lastSavedJson)
    return {ok:false,code:"sync/conflict",error:"Alterações locais durante atualização"};
   const merged=combineState(head.data().state,records);
   apply(merged);
   baseline={meta:head.data().state,records};
   guardRevision=Number(guard.data()?.revision)||0;
   lastSavedJson=stateJson();
   status("Atualizado entre dispositivos");
   return {ok:true};
  }catch(e){return {ok:false,code:e.code||"sync/error",error:e.message}}
  finally{
   refreshing=false;
   if(refreshAgain){refreshAgain=false;void refresh()}
  }
 }
 function subscribe(onUpdate){
  off?.();
  off=onSnapshot(pulseRef,pulse=>{
   if(disposed||!baseline||pulse.metadata?.hasPendingWrites)return;
   const eventId=String(pulse.data()?.eventId||"");
   if(!eventId||eventId===seenPulse)return;
   seenPulse=eventId;
   if(pulse.data()?.origin===session)return;
   void refresh().then(result=>{if(!disposed)onUpdate(result)});
  },error=>onUpdate({ok:false,code:error.code||"sync/error",error:error.message}));
  return off;
 }
 function dispose(){disposed=true;off?.();off=null}
 return {
  load:firstLoad,save,refresh,subscribe,dispose,
  get lastJson(){return lastSavedJson},
  get guardRevision(){return guardRevision},
  get documentCount(){return baseline?.records.size||0},
  get isReady(){return !!baseline&&!disposed}
 };
}
