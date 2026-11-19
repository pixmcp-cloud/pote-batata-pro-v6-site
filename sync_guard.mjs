/* Pure helpers for optimistic Firestore synchronization. No Firebase access or writes. */
const canonical=value=>{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==="object"){
  const result=Object.create(null);
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

/* No deletion unless the pending backup exactly matches the authenticated
   account's just-loaded remote state. Real conflicts remain blocked. */
export const pendingMatchesLoadedState=(pending,uid,cloudState)=>
 Boolean(pending&&pending.version===1&&pending.uid===String(uid)&&
 pending.state&&cloudState&&stableJson(pending.state)===stableJson(cloudState));


/* A stale offline backup must never be mistaken for a conflict solely because
   the user navigated between tabs. V2 does not persist top-level UI controls. */
const stableCore=value=>{
 if(!value||typeof value!=="object"||!value.data||typeof value.data!=="object")return null;
 const core={...value};
 delete core.mode;delete core.tab;delete core.expansion;
 return stableJson(core);
};
const backupGroupNames={
 orders:"Pedidos",ingredients:"Ingredientes/estoque",cashSessions:"Turnos PDV",
 cashMovements:"Movimentacoes PDV",stockMovements:"Movimentacoes de estoque",
 beverages:"Bebidas",clients:"Clientes",recipes:"Receitas",addons:"Adicionais",
 combos:"Combos",purchases:"Compras",expenses:"Despesas",losses:"Perdas",
 prepBatches:"Lotes de producao",businessUniverses:"Outros universos"
};

/* Read receipts are monotonic cosmetic state. They MUST NOT bypass validation
   of orders, stock, cash, licenses, delivery or any other commercial field. */
const plainNoticeMap=value=>value&&typeof value==="object"&&!Array.isArray(value);
export function normalizeNotificationReadCenter(value){
 if(value===undefined||value===null)return {version:1,read:{}};
 if(!plainNoticeMap(value))return null;
 if(Object.keys(value).some(k=>k!=="version"&&k!=="read")||value.version!==1||
    !plainNoticeMap(value.read))return null;
 const keys=Object.keys(value.read);
 if(keys.length>500)return null;
 for(const id of keys){
  const stamp=value.read[id];
  if(!/^(broadcast|order):\S{1,200}$/.test(id)||
    typeof stamp!=="string"||stamp.length>64||
    !Number.isFinite(Date.parse(stamp)))return null;
 }
 return {version:1,read:{...value.read}};
}
export function mergeNotificationReadCenters(local,cloud){
 const a=normalizeNotificationReadCenter(local),b=normalizeNotificationReadCenter(cloud);
 if(!a||!b)return null;
 const entries=Object.entries({...a.read,...b.read});
 if(entries.length>500)return null; // Do not silently drop earlier acknowledgements.
 return {version:1,read:Object.fromEntries(entries)};
}
const stableWithoutReadReceipts=value=>{
 if(!value||typeof value!=="object"||!value.data||typeof value.data!=="object")return null;
 const top={...value,data:{...value.data}};
 delete top.mode;delete top.tab;delete top.expansion;
 delete top.data.notificationCenter;
 return stableJson(top);
};

export function inspectPendingAgainstCloud(pending,uid,cloud,{v2=true}={}){
 if(!pending||pending.version!==1||pending.uid!==String(uid)||!pending.state)
  return {kind:"invalid",safeToRelease:false,details:["Backup local ausente, invalido ou de outra conta"]};
 const local=pending.state;
 if(!local?.data||!cloud?.data)
  return {kind:"invalid",safeToRelease:false,details:["Estado local ou da nuvem incompleto"]};
 if(stableJson(local)===stableJson(cloud))
  return {kind:"identical",safeToRelease:true,details:["Dados locais identicos aos da nuvem"]};
 if(v2&&stableCore(local)!==null&&stableCore(local)===stableCore(cloud))
  return {kind:"navigation-only",safeToRelease:true,
   details:["Somente a tela, aba ou expansao mudou. Pedidos, estoque e cadastros coincidem integralmente com a nuvem"]};
  if(v2&&stableWithoutReadReceipts(local)!==null&&
    stableWithoutReadReceipts(local)===stableWithoutReadReceipts(cloud)){
   const merged=mergeNotificationReadCenters(local.data.notificationCenter,cloud.data.notificationCenter);
   if(merged){
    const remote=normalizeNotificationReadCenter(cloud.data.notificationCenter);
    const needsMerge=stableJson(merged)!==stableJson(remote);
    return {kind:"notification-read-only",safeToRelease:!needsMerge,
     needsNotificationMerge:needsMerge,
     mergedNotificationCenter:merged,
     details:[needsMerge?
      "Somente notificacoes lidas variaram; as marcacoes locais serao preservadas na nuvem antes de liberar vendas":
      "Somente notificacoes lidas variaram, mas todas as marcacoes locais ja existem na nuvem"]};
   }
  }
  const differences=[];
 const a=local.data,b=cloud.data;
 const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 for(const key of keys){
  if(stableJson(a[key])===stableJson(b[key]))continue;
  const label=backupGroupNames[key]||"Dados do negocio: "+key.replace(/[^a-z0-9_-]/gi,"").slice(0,35);
  const left=Array.isArray(a[key])?a[key].length:null,remote=Array.isArray(b[key])?b[key].length:null;
  differences.push(label+(left!==null||remote!==null?
   " (aparelho: "+(left??0)+", nuvem: "+(remote??0)+"; conteudo divergente)":" (valor divergente)"));
  if(differences.length>=8)break;
 }
 const metaKeys=new Set([...Object.keys(local),...Object.keys(cloud)]);
 for(const key of metaKeys){
  if(["mode","tab","expansion","data"].includes(key))continue;
  if(stableJson(local[key])!==stableJson(cloud[key])){
   differences.push("Configuracao geral: "+key.replace(/[^a-z0-9_-]/gi,"").slice(0,35));
   if(differences.length>=8)break;
  }
 }
 return {kind:"business-different",safeToRelease:false,
  details:differences.length?differences:["Conteudo local difere da nuvem"]};
}
