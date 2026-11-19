/* Firebase V2 repository. Store one logical record per document.
   No legacy deletes. In test-only cutover, old appState/main remains untouched.
   All inventory-sensitive edits serialize through the same transaction guard. */
import {splitState,combineState,diffState,validateChangeSet,recordId} from "./v2_store_core.mjs?v=v4-free-ids-20261117";
import {stableJson,nextRevision,jsonBytes,MAX_APPSTATE_BYTES} from "./sync_guard.mjs?v=v4-backup-20261117";
import {checkFreeUniverseDelta,freeSlotKey,modelRecordKey} from "./free_limits.mjs?v=v4-free-ids-20261117";
import {validateInventoryJournalDiff} from "./inventory_integrity.mjs";
import {validateProductionJournalDiff,validateCancellationJournalDiff,validateCashJournalDiff} from "./operation_integrity.mjs?v=f20-late-atomic-20261118";
import {planV2Batches} from "./v2_batch_planner.mjs";

const same=(a,b)=>stableJson(a??null)===stableJson(b??null);
const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error};
const token=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():
 "client-"+Date.now()+"-"+Math.random().toString(36).slice(2);

export function createV2Store({uid,db,sdk,fresh,snapshot,apply,status=()=>{}}){
 const {doc,collection,getDoc,getDocs,runTransaction,onSnapshot,serverTimestamp}=sdk;
 const root=doc(db,"users",uid,"appState","v2");
 const legacyRef=doc(db,"users",uid,"appState","main");
 const guardRef=doc(db,"users",uid,"appState","v2InventoryGuard");
 const pulseRef=doc(db,"users",uid,"appState","v2Pulse");
 const recordsRef=collection(db,"users",uid,"records");
 const session=token();
 let baseline=null,guardRevision=0,seenPulse="",off=null,refreshing=false,refreshAgain=false;
 let saving=false,disposed=false,lastSavedJson="",needsFullRefresh=false;
 const recordRef=key=>doc(db,"users",uid,"records",key);
 const stateJson=()=>JSON.stringify(snapshot());
 const matchesRecordKey=(key,entry)=>entry&&entry.group&&entry.universe&&(
  key===recordId(entry.universe,entry.group,entry.id)||key===freeSlotKey(entry)||key===modelRecordKey(entry));
 const loadDocuments=async()=>{
  const result=new Map(),snap=await getDocs(recordsRef);
  for(const d of snap.docs){
   const entry=d.data()?.record;
   if(!entry||!entry.group||!entry.universe)throw Error("Registro V2 inválido: "+d.id);
   if(!matchesRecordKey(d.id,entry))
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
     const legacy=await tx.get(legacyRef);
     if(legacy.exists()&&legacy.data()?.state!=null)
      fail("migration/required","A conta tem dados no formato anterior. Faça backup verificável e migre sem apagar o histórico.");
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
  if(metaSnap.data()?.migration?.status==="copying")
   fail("migration/required","Migração V1 incompleta. O histórico original permanece preservado. Retome com o backup da mesma conta.");
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
  let next,delta,batches;
  try{
   const client=typeof window!=="undefined"?window.POTE_AUTH:null;
   const free=Boolean(client?.uid===uid&&!client.proActive);
   next=splitState(snapshot(),baseline.records,{free});
   // Keep lifetime order counters monotonic across backup restores and universe swaps.
   // A destructive import may remove orders, but it cannot reuse a public number.
   const previousData=baseline.meta?.data||{};
   const incomingData=next.meta?.data||{};
   const prevBranches={...(previousData.businessUniverses||{}),
    [String(previousData.businessType||'default')]:previousData};
   const nextBranches={...(incomingData.businessUniverses||{}),
    [String(incomingData.businessType||'default')]:incomingData};
   for(const [universe,branch] of Object.entries(prevBranches)){
    const oldNum=Number(branch?.orderSequenceLast||0);
    const nextNum=Number(nextBranches[universe]?.orderSequenceLast||0);
    if(!Number.isSafeInteger(oldNum)||oldNum<0||
      !Number.isSafeInteger(nextNum)||nextNum<oldNum)
     throw Error('Numero vitalicio de pedidos nao pode diminuir no negocio '+universe+'. Preserve backup e historico.');
   }
   // The backend also enforces one canonical record ID for each Free slot.
   if(free){
    const branch=String(snapshot()?.data?.businessType||"");
    const quota=checkFreeUniverseDelta(baseline.records,next.records,branch);
    if(!quota.ok)return {ok:false,code:"free/limit",error:quota.error};
   }
   delta=diffState(baseline,next);
   batches=planV2Batches(delta);
   // A new public sequence number and its order record MUST be committed in
   // one transaction. Two concurrent devices share the inventory guard.
   const numberedNewOrders=delta.changes.filter(ch=>ch.kind==="record"&&!ch.before&&
    ch.after?.group==="orders"&&Number.isSafeInteger(ch.after?.item?.orderNumber));
   if(numberedNewOrders.length){
    const activeBranch=String(snapshot()?.data?.businessType||"default");
    const sequenceLast=Number(snapshot()?.data?.orderSequenceLast||0);
    if(batches.length!==1||!delta.changes.some(ch=>ch.kind==="meta")||
      !Number.isSafeInteger(sequenceLast)||sequenceLast<1||
      numberedNewOrders.some(ch=>ch.after.universe!==activeBranch||
        ch.after.item.orderNumber>sequenceLast))
      throw Error("Numeracao do pedido exige gravar contador e pedido na mesma transacao");
    const numbers=new Set();
    for(const rec of next.records.values()){
     if(rec.group!=="orders"||rec.universe!==activeBranch)continue;
     const n=Number(rec.item?.orderNumber||0);
     if(!n)continue;
     if(!Number.isSafeInteger(n)||n<1||n>sequenceLast||numbers.has(n))
      throw Error("Numero sequencial duplicado ou acima do contador da empresa");
     numbers.add(n);
    }
   }
   for(const batch of batches)validateChangeSet({changes:batch});
   validateInventoryJournalDiff(delta);
   validateProductionJournalDiff(delta);
   validateCancellationJournalDiff(delta);
   validateCashJournalDiff(baseline,next,delta);
  }catch(e){return {ok:false,error:e.message,code:e.code==="free/limit"?e.code:"sync/invalid-state"}}
  if(!delta.changes.length){lastSavedJson=current;return {ok:true,unchanged:true}}
  saving=true;
  const oldGuard=guardRevision;
  let committed=0;
  try{
   for(const changeBatch of batches){
    const part={changes:changeBatch,sensitive:delta.sensitive};
    await runTransaction(db,async tx=>{
    // All reads happen before any write, as Firestore transaction API requires.
    const queries=[];
    for(const ch of part.changes){
     queries.push({ch,ref:ch.kind==="meta"?root:recordRef(ch.key)});
    }
    const observed=[];
    for(const q of queries)observed.push(await tx.get(q.ref));
    const guard=part.sensitive?await tx.get(guardRef):null;
    const previousPulse=await tx.get(pulseRef);
    for(let i=0;i<queries.length;i++){
     const q=queries[i],remote=q.ch.kind==="meta"?
      observed[i].data()?.state??null:observed[i].data()?.record??null;
     if(!same(remote,q.ch.before))
      fail("sync/conflict","Registro alterado em outro dispositivo: "+(q.ch.key||"configurações"));
    }
    if(part.sensitive && Number(guard.data()?.revision||0)!==oldGuard)
     fail("sync/conflict","Pedidos ou estoque alterados em outra sessão");
    for(const q of queries){
     const change=q.ch;
     if(change.after===null)tx.delete(q.ref);
     else if(change.kind==="meta")tx.set(q.ref,{
      schemaVersion:2,state:change.after,updatedAt:serverTimestamp()
     },{merge:true});
     else tx.set(q.ref,{record:change.after,updatedAt:serverTimestamp()});
    }
    if(part.sensitive)tx.set(guardRef,{
      revision:nextRevision(oldGuard),updatedAt:serverTimestamp()
    },{merge:true});
    tx.set(pulseRef,{
      eventId:token(),previousEventId:String(previousPulse.data()?.eventId||""),
      origin:session,updatedAt:serverTimestamp(),
      affected:part.changes.length,
      changedKeys:part.changes.filter(c=>c.kind==="record").map(c=>c.key),
      metaChanged:part.changes.some(c=>c.kind==="meta"),
      sensitive:part.sensitive
    });
    });
    committed+=changeBatch.length;
    if(batches.length>1){
     // Commit cursor: successful chunks are already in Firestore. If a later
     // chunk fails, a retry sends only still-pending items (no duplicates).
     const records=new Map(baseline.records);
     for(const change of changeBatch)records.set(change.key,change.after);
     baseline={meta:baseline.meta,records};
     status("Importação em lotes: "+committed+"/"+delta.changes.length+
       " registros confirmados na nuvem");
    }
   }
   baseline=next;
   if(delta.sensitive)guardRevision=nextRevision(oldGuard);
   lastSavedJson=current;
   status("Dados V2 salvos com segurança");
   return {ok:true,changed:delta.changes.length,batches:batches.length};
  }catch(e){
   return {ok:false,code:e.code||"sync/error",error:e.message,
    partial:committed>0,savedChanges:committed,
    ...(committed>0?{recovery:"Parte dos cadastros foi salva. Preserve o backup local e tente novamente sem recarregar a página."}:{})};
  }finally{saving=false}
 }
 async function refresh(hint=null,previousEventId=null){
  if(disposed||!baseline)return {ok:false};
  if(refreshing){refreshAgain=true;return {ok:false,queued:true}}
  refreshing=true;
  try{
   if(stateJson()!==lastSavedJson)
    return {ok:false,code:"sync/conflict",error:"Há alterações locais pendentes"};
   // Incremental refresh is permitted ONLY for an adjacent version in the
   // server pulse chain. Lost intermediate events or older clients force
   // a complete reload rather than risk omissions.
   const changes=hint?.changedKeys;
   const contiguous=hint&&typeof hint.previousEventId==="string"&&
     hint.previousEventId===previousEventId;
   const incremental=!needsFullRefresh&&contiguous&&Array.isArray(changes)&&
     changes.length<=60&&new Set(changes).size===changes.length&&
     changes.every(k=>typeof k==="string"&&k.length<=1000)&&
     typeof hint.metaChanged==="boolean"&&typeof hint.sensitive==="boolean";
   if(incremental){
    const [changedDocs,metaSnap,guardSnap]=await Promise.all([
     Promise.all(changes.map(key=>getDoc(recordRef(key)))),
     hint.metaChanged?getDoc(root):Promise.resolve(null),
     hint.sensitive?getDoc(guardRef):Promise.resolve(null)
    ]);
    if(stateJson()!==lastSavedJson)
     return {ok:false,code:"sync/conflict",error:"Alterações locais durante atualização"};
    const meta=metaSnap?metaSnap.data()?.state:baseline.meta;
    if(!meta||metaSnap&&metaSnap.data()?.schemaVersion!==2)
     fail("sync/schema","Metadados V2 incompatíveis");
    const nextRecords=new Map(baseline.records);
    changes.forEach((key,index)=>{
     const entry=changedDocs[index].data()?.record;
     if(!changedDocs[index].exists()){nextRecords.delete(key);return}
     if(!matchesRecordKey(key,entry))
      fail("sync/schema","Registro atualizado com identificador divergente");
     nextRecords.set(key,entry);
    });
    const merged=combineState(meta,nextRecords);
    apply(merged);
    baseline={meta,records:nextRecords};
    if(guardSnap)guardRevision=Number(guardSnap.data()?.revision)||0;
    lastSavedJson=stateJson();
    needsFullRefresh=false;
    status("Atualização incremental V2 aplicada");
    return {ok:true,incremental:true,readDocuments:changes.length+Number(!!metaSnap)+Number(!!guardSnap)};
   }
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
   needsFullRefresh=false;
   status("Atualizado entre dispositivos");
   return {ok:true,incremental:false};
  }catch(e){
   needsFullRefresh=true;
   return {ok:false,code:e.code||"sync/error",error:e.message}
  }finally{
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
   const previousEventId=seenPulse;
   seenPulse=eventId;
   if(pulse.data()?.origin===session)return;
   void refresh(pulse.data(),previousEventId).then(result=>{
    if(!result.ok&&!result.queued)needsFullRefresh=true;
    if(!disposed)onUpdate(result);
   });
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
