/* F06: non-destructive, non-inventory bulk edits can be saved in bounded
 * Firestore transactions. Never split orders, physical stock or financial events:
 * those changes must remain atomic and continue to fail closed >290 records. */
import {MAX_CHANGES_PER_TX} from "./v5_store_core.mjs";
import {jsonBytes} from "./sync_guard.mjs?v=v4-backup-20261117";

const BATCHABLE_GROUPS=new Set(['recipes','clients','suppliers',
 'recipeVersions','recipeTrash','checklist','garimpoOffers']);
export const SAFE_V5_BATCH_DOCUMENTS=150;
export const SAFE_V5_BATCH_BYTES=1500000;
export function planV5Batches(diff){
 const changes=diff?.changes||[];
 if(changes.length<=MAX_CHANGES_PER_TX)return [changes];
 if(diff.sensitive || changes.some(change=>
   change.kind!=="record" || change.after===null ||
   !BATCHABLE_GROUPS.has(change.after.group))){
  const e=new Error("Importação grande com estoque, pedidos, dados financeiros, exclusões ou configurações não pode ser fracionada automaticamente. Exporte um backup e divida a operação.");
  e.code="sync/large-sensitive";throw e;
 }
 const batches=[];let batch=[],bytes=0;
 for(const change of changes){
  const estimate=jsonBytes(change.after)+512;
  if(estimate>SAFE_V5_BATCH_BYTES){
   const e=new Error("Cadastro muito grande para importação segura em lotes.");
   e.code="sync/large-record";throw e;
  }
  if(batch.length&&(batch.length>=SAFE_V5_BATCH_DOCUMENTS||bytes+estimate>SAFE_V5_BATCH_BYTES)){
   batches.push(batch);batch=[];bytes=0;
  }
  batch.push(change);bytes+=estimate;
 }
 if(batch.length)batches.push(batch);
 return batches;
}
