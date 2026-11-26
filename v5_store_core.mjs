/* Potê Batata Pro — normalized V5 storage codec.
   Pure functions. Never reads or writes Firebase. */
import {stableJson,jsonBytes,MAX_APPSTATE_BYTES} from "./sync_guard.mjs?v=v4-backup-20261117";
import {freeSlotKey,modelRecordKey} from "./free_id_policy.mjs";

export const RECORD_GROUPS=[
 "recipes","ingredients","orders","clients","suppliers","expenses",
 "recipeVersions","recipeTrash","purchases","stockMovements","beverages",
 "addons","combos","prepBatches","checklist","losses","garimpoOffers",
 "cashSessions","cashMovements"
];
export const INVENTORY_GROUPS=new Set(["orders","ingredients","beverages","purchases","stockMovements","losses","prepBatches","cashSessions","cashMovements"]);
export const MAX_CHANGES_PER_TX=290;
const copy=v=>JSON.parse(JSON.stringify(v));
const asList=v=>Array.isArray(v)?v:[];
const empty=()=>[];
export const branchId=data=>String(data?.businessType||"default");
const encodeKey=value=>{
 const bytes=new TextEncoder().encode(String(value));
 if(bytes.length>700)throw Error("ID extenso demais para o Firestore");
 let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
 return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const decodeKey=value=>{
 const fixed=String(value).replace(/-/g,"+").replace(/_/g,"/");
 const binary=atob(fixed);
 return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
};
export function recordId(universe,group,id){
 if(!RECORD_GROUPS.includes(group))throw Error("Grupo não permitido: "+group);
 if(!universe||id==null||!String(id))throw Error("Registro sem ID");
 return encodeKey(JSON.stringify([universe,group,String(id)]));
}
export function recordPathParts(encodedId){
 const [universe,group,id]=JSON.parse(decodeKey(encodedId));
 if(!RECORD_GROUPS.includes(group))throw Error("Grupo desconhecido");
 return {universe,group,id};
}
function rankGapStep(prior,start,end){
 const count=end-start-1;
 if(!count)return 1;
 const left=prior[start],right=prior[end];
 if(left===undefined||right===undefined){
  const edge=left??right;
  if(edge===undefined)return 1;
  const step=Math.max(1,2*Number.EPSILON*Math.abs(edge));
  const farthest=left===undefined?edge-step*count:edge+step*count;
  return Number.isFinite(farthest)?step:null;
 }
 const step=(right-left)/(count+1);
 const minimum=Number.EPSILON*Math.max(1,Math.abs(left),Math.abs(right));
 return step>minimum&&left+step*count<right?step:null;
}
function widenRankGap(prior,anchors,gap,budget){
 // Procura a menor janela contígua que libera espaço entre duas âncoras.
 for(let removed=1;removed<=budget;removed++){
  const first=Math.max(0,gap-1-removed);
  const last=Math.min(gap-1,anchors.length-2-removed);
  for(let left=last;left>=first;left--){
   const right=left+removed+1;
   if(rankGapStep(prior,anchors[left],anchors[right])!==null){
    anchors.splice(left+1,removed);
    return left+1;
   }
  }
 }
 return -1;
}
// Mantém o maior conjunto possível de posições anteriores, mas persiste
// reordenações reais. Inserir um pedido novo não deve regravar pedidos antigos.
function assignRanks(entries,previousRecords){
 const n=entries.length;
 const prior=entries.map(e=>previousRecords.get(e.key)?.rank);
 const tails=[],indices=[],links=new Array(n).fill(-1);
 // Longest Increasing Subsequence das posições antigas em O(n log n).
 for(let i=0;i<n;i++){
  const rank=prior[i];
  if(!Number.isFinite(rank))continue;
  let lo=0,hi=tails.length;
  while(lo<hi){
   const mid=(lo+hi)>>1;
   if(tails[mid]<rank)lo=mid+1;else hi=mid;
  }
  if(lo>0)links[i]=indices[lo-1];
  tails[lo]=rank;indices[lo]=i;
 }
 const anchors=[];
 if(indices.length){
  let index=indices[indices.length-1];
  while(index!==-1){anchors.push(index);index=links[index]}
  anchors.reverse();
 }
 // As linhas sem âncora já podem consumir parte do orçamento. O limite real
 // da transação ainda é aplicado ao diff completo de todos os grupos.
 let budget=MAX_CHANGES_PER_TX-(n-anchors.length);
 anchors.unshift(-1);
 anchors.push(n);
 const saturated="Ordenacao saturada: grupo grande requer importacao em lotes";
 for(let gap=1;gap<anchors.length;){
  if(rankGapStep(prior,anchors[gap-1],anchors[gap])!==null){gap++;continue}
  if(n<MAX_CHANGES_PER_TX)return entries.map((_,idx)=>idx*1000);
  const before=anchors.length;
  gap=widenRankGap(prior,anchors,gap,budget);
  if(gap<0)throw Error(saturated);
  budget-=before-anchors.length;
 }
 const ranks=new Array(n);
 for(let gap=1;gap<anchors.length;gap++){
  const start=anchors[gap-1],end=anchors[gap];
  const left=prior[start],right=prior[end];
  const step=rankGapStep(prior,start,end);
  if(start>=0)ranks[start]=left;
  for(let j=start+1;j<end;j++){
   if(left!==undefined)ranks[j]=left+step*(j-start);
   else if(right!==undefined)ranks[j]=right-step*(end-j);
   else ranks[j]=j;
  }
 }
 if(ranks.some((rank,i)=>!Number.isFinite(rank)||(i>0&&rank<=ranks[i-1]))){
  if(n>=MAX_CHANGES_PER_TX)throw Error(saturated);
  return entries.map((_,idx)=>idx*1000);
 }
 return ranks;
}
function rowInfo(item,idx){
 const source=item&&typeof item==="object"?item:{value:item};
 const id=typeof source.id==="string"&&source.id?source.id:"_row_"+idx;
 return {id,item:copy(item)};
}
function historicalFreeSlots(previousRecords){
 const slots=new Map();
 for(const [key,record] of previousRecords){
  const slot=freeSlotKey(record);
  if(!slot)continue;
  if(!slots.has(slot))slots.set(slot,new Map());
  slots.get(slot).set(recordId(record.universe,record.group,record.id),key);
 }
 for(const [slot,items] of slots)if(items.size<2)slots.delete(slot);
 return slots;
}
function freeLimitError(group,slot){
 const scope=slot.startsWith("free~base~")?"universo base":"conjunto dos ramos extras";
 const error=Error("FREE: máximo de 1 cadastro próprio em "+group+" no "+scope+".");
 error.code="free/limit";
 return error;
}
export function splitState(state,previousRecords=new Map(),{free=false}={}){
 if(!state?.data||typeof state.data!=="object")throw Error("Estado V2 inválido");
 const meta=copy(state),records=new Map(),errors=[];
 const historical=free?historicalFreeSlots(previousRecords):new Map();
 delete meta.mode;delete meta.tab;delete meta.expansion;
 const data=meta.data;
 const active=branchId(data);
 const archived=copy(data.businessUniverses||{});
 delete data.businessUniverses;
 const branches={[active]:data};
 for(const [name,value] of Object.entries(archived)){
  if(name===active)continue;
  branches[name]=value;
 }
 const metaBranches={};
 for(const [universe,branch] of Object.entries(branches)){
  const branchMeta=universe===active?data:copy(branch||{});
  for(const group of RECORD_GROUPS){
   const rows=asList(branch?.[group]);
   const entries=rows.map((item,idx)=>{
    const {id}=rowInfo(item,idx);
    const recordInfo={universe,group,id};
    const originalKey=recordId(universe,group,id);
    const templateKey=modelRecordKey(recordInfo);
    const quotaKey=freeSlotKey(recordInfo);
    const priorQuota=quotaKey&&previousRecords.get(quotaKey);
    // Keep the existing FREE identity through paid upgrades and renewals.
    const reserved=priorQuota?.universe===universe&&priorQuota?.group===group&&priorQuota?.id===id?quotaKey:null;
    const slot=free?quotaKey:reserved;
    const previousSlot=historical.get(slot);
    if(previousSlot){
     // Uma renovação vencida não deve reescrever nem apagar o histórico excedente.
     const retainedKey=previousSlot.get(originalKey);
     if(!retainedKey)throw freeLimitError(group,slot);
     return {key:retainedKey,id,item,idx,legacySlot:retainedKey!==slot?slot:null};
    }
    const hasLegacyModel=templateKey&&previousRecords.has(originalKey);
    const key=(templateKey&&!hasLegacyModel?templateKey:null)||slot||originalKey;
    return {key,id,item,idx,migrateModel:free&&hasLegacyModel?templateKey:null};
   });
   const seen=new Set(),assignedRanks=assignRanks(entries,previousRecords);
   for(const entry of entries){
    if(free&&entry.key.startsWith("free~")&&(seen.has(entry.key)||records.has(entry.key)))
     throw freeLimitError(group,entry.key);
    if(seen.has(entry.key)){errors.push("ID duplicado em "+universe+"/"+group+"/"+entry.id);continue}
    seen.add(entry.key);
    const record={universe,group,id:entry.id,item:copy(entry.item),rank:assignedRanks[entry.idx]};
    const recordChanged=entry.legacySlot||entry.migrateModel ?
     stableJson(previousRecords.get(entry.key))!==stableJson(record) : false;
    if(entry.legacySlot&&recordChanged){
     const error=Error("Este cadastro permanece no histórico. Para editá-lo, regularize a cota do plano ou ative o Pro.");
     error.code="free/limit";
     throw error;
    }
    if(jsonBytes(record)>MAX_APPSTATE_BYTES){errors.push("Registro muito grande: "+universe+"/"+group+"/"+entry.id);continue}
    records.set(entry.migrateModel&&recordChanged?entry.migrateModel:entry.key,record);
   }
   branchMeta[group]=empty();
  }
  if(universe!==active)metaBranches[universe]=branchMeta;
 }
 data.businessUniverses=metaBranches;
 if(jsonBytes(meta)>MAX_APPSTATE_BYTES)errors.push("Configurações excedem limite seguro do Firestore");
 if(errors.length)throw Error(errors.slice(0,5).join("; "));
 return {meta,records};
}
export function combineState(meta,records){
 const result=copy(meta),data=result.data;
 if(!data||typeof data!=="object")throw Error("Metadados V2 incompletos");
 data.businessUniverses??={};
 // The active workspace has priority over a stale archived copy with the same ID.
 const active=branchId(data),all={...(data.businessUniverses||{}),[active]:data};
 for(const branch of Object.values(all))
  for(const group of RECORD_GROUPS)branch[group]=[];
 const sorted=[...records.values()].sort((a,b)=>a.universe.localeCompare(b.universe)||
  a.group.localeCompare(b.group)||a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 for(const rec of sorted){
  const bucket=all[rec.universe];
  if(!bucket||!RECORD_GROUPS.includes(rec.group))continue;
  bucket[rec.group].push(copy(rec.item));
 }
 // Active universe is represented once; the UI module can snapshot it when switching.
 return result;
}
export function diffState(before,after){
 const changes=[];
 if(stableJson(before.meta)!==stableJson(after.meta))
  changes.push({kind:"meta",before:before.meta,after:after.meta});
 const keys=new Set([...before.records.keys(),...after.records.keys()]);
 for(const key of keys){
  const old=before.records.get(key)||null,now=after.records.get(key)||null;
  if(stableJson(old)!==stableJson(now))changes.push({kind:"record",key,before:old,after:now});
 }
 const sensitive=changes.some(c=>c.kind==="record"&&
  INVENTORY_GROUPS.has((c.after||c.before)?.group));
 return {changes,sensitive,needsRefresh:changes.length>0};
}
export function validateChangeSet(diff){
 if(diff.changes.length>MAX_CHANGES_PER_TX)
  throw Error("Operação muito grande para transação segura. Divida a importação ou solicite assistência.");
 return true;
}
export function freshV2(initial){return splitState(initial)}
export function createMockState({businessType="default"}={}){
 return {data:{businessType,businessUniverses:{},recipes:[],ingredients:[],orders:[],
 clients:[],suppliers:[],expenses:[],settings:{},brand:{}}};
}
