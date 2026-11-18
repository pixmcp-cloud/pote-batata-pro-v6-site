/* F10 - V1 -> V2 staged migration, never deletes or mutates appState/main.
   All records are reconciled BEFORE v2 becomes active. Only execute after
   customer locally downloads + reopens a matching backup file. */
import {previewMigration} from "./migration_preview.mjs";
import {splitState,combineState} from "./v2_store_core.mjs";
import {stableJson,jsonBytes,MAX_APPSTATE_BYTES} from "./sync_guard.mjs";
const same=(a,b)=>stableJson(a??null)===stableJson(b??null);
const fail=(code,message)=>{const error=Error(message);error.code=code;throw error};
const digest=async v=>{
 const bytes=new TextEncoder().encode(stableJson(v));
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
};
export async function prepareLegacyMigration(source,{free=false}={}){
 const preview=previewMigration(source);
 if(!preview.ok)fail("migration/invalid",preview.errors.slice(0,4).join("; "));
 const state=source?.state??source;
 const normalized=splitState(state,new Map(),{free});
 if(jsonBytes(normalized.meta)>MAX_APPSTATE_BYTES)fail("migration/too-big","Metadados legados excedem o limite seguro.");
 if(normalized.records.size!==preview.documents.length)
  fail("migration/duplicate","Quantidade de registros divergente no plano de migração.");
 return {fingerprint:await digest(state),state,normalized,preview,recordCount:normalized.records.size};
}
export function inspectLegacyBackup(contents,uid,expectedState){
 return contents?.backupVersion===1&&contents?.uid===uid&&same(contents.state,expectedState);
}
export async function migrateLegacyV2({uid,db,sdk,planned,onProgress=()=>{},batchSize=6}){
 if(!uid||!planned||!(planned.normalized?.records instanceof Map))
  fail("migration/invalid","Plano inválido ou conta não autenticada");
 if(batchSize<1||batchSize>8)fail("migration/invalid","Lote de migração inseguro");
 const {doc,getDoc,getDocs,collection,runTransaction,serverTimestamp}=sdk;
 const legacy=doc(db,"users",uid,"appState","main");
 const root=doc(db,"users",uid,"appState","v2");
 const guard=doc(db,"users",uid,"appState","v2InventoryGuard");
 const pulse=doc(db,"users",uid,"appState","v2Pulse");
 const recordRef=k=>doc(db,"users",uid,"records",k);
 const sourceRecord=await getDoc(legacy);
 if(!sourceRecord.exists()||!same(sourceRecord.data()?.state,planned.state))
  fail("migration/source-changed","Origem V1 mudou; gere um novo backup antes de continuar.");
 const currentRoot=await getDoc(root);
 if(currentRoot.exists()&&currentRoot.data()?.migration?.status==="complete"){
  if(currentRoot.data().migration.fingerprint===planned.fingerprint)
   return {ok:true,alreadyComplete:true,records:planned.recordCount};
  fail("migration/conflict","Já existe um V2 diferente; nenhuma alteração foi efetuada.");
 }
 if(currentRoot.exists()){
  if(currentRoot.data()?.migration?.status!=="copying"||
     currentRoot.data().migration.fingerprint!==planned.fingerprint)
   fail("migration/conflict","Outro V2 ou migração divergente; nenhuma alteração foi efetuada.");
 }else{
  await runTransaction(db,async tx=>{
   const [old,existing]=await Promise.all([tx.get(legacy),tx.get(root)]);
   if(!old.exists()||!same(old.data()?.state,planned.state))
    fail("migration/source-changed","Dados V1 alterados desde a prévia.");
   if(existing.exists())fail("migration/conflict","Migração iniciada por outro dispositivo.");
   tx.set(root,{schemaVersion:2,state:planned.normalized.meta,
    migration:{status:"copying",fingerprint:planned.fingerprint,
     expectedRecords:planned.recordCount,startedAt:new Date().toISOString()},
    updatedAt:serverTimestamp()});
   tx.set(guard,{revision:0,updatedAt:serverTimestamp()});
   tx.set(pulse,{eventId:"migration-start-"+planned.fingerprint.slice(0,16),
    previousEventId:null,origin:"migration-v1",sensitive:false,changedKeys:[],updatedAt:serverTimestamp()});
  });
 }
 const list=[...planned.normalized.records.entries()];
 let confirmed=0,done=0;
 for(let start=0;start<list.length;start+=batchSize){
  const slice=list.slice(start,start+batchSize);
  const outcome=await runTransaction(db,async tx=>{
   const [g,priorPulse,oldRoot,...rows]=await Promise.all([
    tx.get(guard),tx.get(pulse),tx.get(root),...slice.map(([key])=>tx.get(recordRef(key)))
   ]);
   if(oldRoot.data()?.migration?.fingerprint!==planned.fingerprint||
      oldRoot.data().migration.status!=="copying")
    fail("migration/conflict","Migração sofreu alteração externa.");
   const fresh=slice.filter(([,record],i)=>{
    const found=rows[i];
    if(found.exists()&&!same(found.data()?.record,record))
     fail("migration/conflict","Registro migrado divergente: "+record.id);
    return !found.exists();
   });
   if(!fresh.length)return 0;
   const rev=Number(g.data()?.revision);
   if(!Number.isInteger(rev)||rev<0||!priorPulse.exists())
    fail("migration/conflict","Guarda de migração ausente.");
   const eventId="migration-"+planned.fingerprint.slice(0,12)+"-"+start;
   for(const [key,record] of fresh)
    tx.set(recordRef(key),{record,updatedAt:serverTimestamp()});
   tx.set(guard,{revision:rev+1,updatedAt:serverTimestamp()});
   tx.set(pulse,{eventId,previousEventId:priorPulse.data().eventId,
    origin:"migration-v1",sensitive:true,affected:fresh.length,
    changedKeys:fresh.map(([key])=>key),metaChanged:false,updatedAt:serverTimestamp()});
   return fresh.length;
  });
  confirmed+=outcome;done+=slice.length;
  onProgress({confirmed,processed:done,total:list.length});
 }
 const cloud=await getDocs(collection(db,"users",uid,"records"));
 const result=new Map();
 for(const row of cloud.docs){
  const record=row.data()?.record;
  if(!planned.normalized.records.has(row.id)||!same(record,planned.normalized.records.get(row.id)))
   fail("migration/conflict","V2 contém registro inesperado ou divergente: "+row.id);
  result.set(row.id,record);
 }
 if(result.size!==planned.recordCount||
    !same(combineState(planned.normalized.meta,result),combineState(planned.normalized.meta,planned.normalized.records)))
  fail("migration/incomplete","Conferência de cópia incompleta. A origem V1 foi preservada.");
 await runTransaction(db,async tx=>{
  const [old,current]=await Promise.all([tx.get(legacy),tx.get(root)]);
  if(!old.exists()||!same(old.data()?.state,planned.state))
   fail("migration/source-changed","V1 mudou durante a migração. V2 não foi ativado.");
  if(current.data()?.migration?.fingerprint!==planned.fingerprint)
   fail("migration/conflict","Outro processo alterou a migração.");
  if(current.data().migration.status==="complete")return;
  tx.update(root,{"migration.status":"complete","migration.completedAt":serverTimestamp(),
   updatedAt:serverTimestamp()});
 });
 return {ok:true,records:result.size,confirmed,sourcePreserved:true};
}
