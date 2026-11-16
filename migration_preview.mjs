/* Read-only migration preview from legacy monolithic appState.
   Never connects to Firebase and never mutates the supplied state. */
import {jsonBytes,MAX_APPSTATE_BYTES} from "./sync_guard.mjs";
export const OPERATIONAL_COLLECTIONS=[
 "recipes","ingredients","orders","clients","suppliers","expenses",
 "purchases","stockMovements","losses","beverages","addons","combos","prepBatches","garimpoOffers"
];
const safeSegment=s=>encodeURIComponent(String(s)).replaceAll("%2F","%252F");
function branchData(data){
 const branches=new Map();
 const active=String(data.businessType||"default");
 branches.set(active,data);
 for(const [name,value] of Object.entries(data.businessUniverses||{})){
  if(name===active)continue;
  branches.set(name,value||{});
 }
 return branches;
}
export function previewMigration(original){
 const state=original?.state??original,data=state?.data;
 if(!data||typeof data!=="object")return {ok:false,errors:["Estado legado inválido ou ausente"],documents:[],counts:{}};
 const errors=[],documents=[],counts={};
 const groups=branchData(data);
 for(const [universe,records] of groups){
  for(const name of OPERATIONAL_COLLECTIONS){
   const rows=records?.[name]??[];
   if(!Array.isArray(rows)){errors.push(universe+"/"+name+": não é uma lista");continue}
   counts[universe+"/"+name]=rows.length;
   const seen=new Set();
   for(const item of rows){
    if(!item||typeof item!=="object"||typeof item.id!=="string"||!item.id.trim()){
     errors.push(universe+"/"+name+": registro sem ID");continue;
    }
    if(seen.has(item.id)){errors.push(universe+"/"+name+": ID duplicado "+item.id);continue}
    seen.add(item.id);
    if(jsonBytes(item)>MAX_APPSTATE_BYTES){
     errors.push(universe+"/"+name+"/"+item.id+": documento maior que o limite seguro");continue;
    }
    const suffix="businessUniverses/"+safeSegment(universe)+"/"+name+"/"+safeSegment(item.id);
    documents.push({path:suffix,id:item.id,collection:name,universe,bytes:jsonBytes(item)});
   }
  }
 }
 return {ok:errors.length===0,errors,counts,documents,
  sourceBytes:jsonBytes(state),sourcePreserved:true,plannedVersion:2,
  note:"Prévia somente leitura. Nenhum documento ou regra do Firebase foi modificado."};
}
