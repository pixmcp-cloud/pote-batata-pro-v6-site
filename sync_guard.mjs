/* Pure helpers for optimistic Firestore synchronization. No Firebase access or writes. */
const canonical=value=>{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==="object"){
  const result={};
  for(const key of Object.keys(value).sort()){
   if(value[key]!==undefined)result[key]=canonical(value[key]);
  }
  return result;
 }
 return value;
};
export const stableJson=value=>JSON.stringify(canonical(value??null));
export const matchesRemote=(remote,expected)=>stableJson(remote??null)===expected;
export const nextRevision=previous=>{
 const n=Number(previous);
 return Number.isSafeInteger(n)&&n>=0?n+1:1;
};
export const jsonBytes=value=>new TextEncoder().encode(typeof value==="string"?value:JSON.stringify(value)).length;
export const MAX_APPSTATE_BYTES=850000; // Conservative guard below the 1 MiB Firestore document cap.
export const pendingKey=uid=>"pote-sync-pending-v1:"+String(uid||"");
export const makePending=(uid,state,reason="offline")=>({
 version:1,uid:String(uid),createdAt:new Date().toISOString(),reason,state
});
export function validateBackup(value){
 if(!value||typeof value!=="object"||!value.data||typeof value.data!=="object")return {ok:false,error:"O backup não contém o estado da aplicação."};
 for(const name of ["orders","ingredients","recipes","clients","suppliers","expenses"]){
  if(!Array.isArray(value.data[name]))return {ok:false,error:"Lista ausente ou inválida: "+name};
 }
 const groups={};
 for(const name of ["orders","ingredients","recipes","clients","suppliers","expenses","purchases","stockMovements","losses"]){
  const rows=value.data[name]||[];
  if(!Array.isArray(rows))return {ok:false,error:"Lista inválida: "+name};
  const ids=new Set();
  for(const row of rows){
   if(!row||typeof row!=="object"||typeof row.id!=="string"||!row.id.trim())return {ok:false,error:"Registro sem identificador em "+name};
   if(ids.has(row.id))return {ok:false,error:"Identificador duplicado em "+name};
   ids.add(row.id);
  }
  groups[name]=rows.length;
 }
 return {ok:true,counts:groups};
}
