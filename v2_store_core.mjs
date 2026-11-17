/* Potê Batata Pro — normalized V2 storage codec.
   Pure functions. Never reads or writes Firebase. */
import {stableJson,jsonBytes,MAX_APPSTATE_BYTES} from "./sync_guard.mjs";

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
 const ranks=new Array(n);
 for(const i of anchors)ranks[i]=prior[i];
 let start=-1;
 for(const end of [...anchors,n]){
  const count=end-start-1;
  if(count){
   const left=start>=0?ranks[start]:null;
   const right=end<n?ranks[end]:null;
   if(left===null&&right===null){
    for(let j=start+1;j<end;j++)ranks[j]=j;
   }else if(left===null){
    for(let j=start+1;j<end;j++)ranks[j]=right-(end-j);
   }else if(right===null){
    for(let j=start+1;j<end;j++)ranks[j]=left+(j-start);
   }else{
    const step=(right-left)/(count+1);
    const minStep=Number.EPSILON*Math.max(1,Math.abs(left),Math.abs(right));
    if(!(step>minStep)){
      // Rebalance small collections; the V2 transaction validates the resulting diff.
      if(n>=MAX_CHANGES_PER_TX)throw Error("Ordenacao saturada: grupo grande requer importacao em lotes");
      return entries.map((_,idx)=>idx*1000);
     }
    for(let j=start+1;j<end;j++)ranks[j]=left+step*(j-start);
   }
  }
  start=end;
 }
 for(let i=1;i<n;i++)if(!(ranks[i]>ranks[i-1])){
  if(n>=MAX_CHANGES_PER_TX)throw Error("Ordenacao saturada: grupo grande requer importacao em lotes");
  return entries.map((_,idx)=>idx*1000);
 }
 return ranks;
}
function rowInfo(item,idx){
 const source=item&&typeof item==="object"?item:{value:item};
 const id=typeof source.id==="string"&&source.id?source.id:"_row_"+idx;
 return {id,item:copy(item)};
}
export function splitState(state,previousRecords=new Map()){
 if(!state?.data||typeof state.data!=="object")throw Error("Estado V2 inválido");
 const meta=copy(state),records=new Map(),errors=[];
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
    const key=recordId(universe,group,id);
    return {key,id,item,idx};
   });
   const seen=new Set(),assignedRanks=assignRanks(entries,previousRecords);
   for(const entry of entries){
    if(seen.has(entry.key)){errors.push("ID duplicado em "+universe+"/"+group+"/"+entry.id);continue}
    seen.add(entry.key);
    const record={universe,group,id:entry.id,item:copy(entry.item),rank:assignedRanks[entry.idx]};
    if(jsonBytes(record)>MAX_APPSTATE_BYTES){errors.push("Registro muito grande: "+universe+"/"+group+"/"+entry.id);continue}
    records.set(entry.key,record);
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
