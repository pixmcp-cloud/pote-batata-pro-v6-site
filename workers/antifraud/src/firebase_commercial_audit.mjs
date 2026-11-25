const PROJECT="potobatata-b71f3";
const base="https://firestore.googleapis.com/v1/projects/"+PROJECT+"/databases/(default)";
const normal=fields=>{const list=(fields||[]).map(x=>({fieldPath:x.fieldPath,order:x.order}));if(list.length&&!list.some(x=>x.fieldPath==="__name__"))list.push({fieldPath:"__name__",order:list.at(-1).order});return JSON.stringify(list);};
export async function auditFirebase({token,expected,requestFetch=(...args)=>fetch(...args)}){
 if(typeof token!=="string"||!token)throw Error("missing_token");
 const get=async path=>requestFetch(base+path,{method:"GET",headers:{Authorization:"Bearer "+token},redirect:"manual",signal:AbortSignal.timeout(15000)});
 const failure=e=>{const m=String(e?.message||"");return e?.name==="TimeoutError"||e?.name==="AbortError"?"TIMEOUT":/illegal invocation/i.test(m)?"ILLEGAL_INVOCATION":/redirect/i.test(m)?"REDIRECT_ERROR":/fetch|network|connect/i.test(m)?"NETWORK_ERROR":/header|authorization/i.test(m)?"HEADER_ERROR":e?.name==="TypeError"?"TRANSPORT_ERROR":"REQUEST_ERROR";};
 const report={database:"UNKNOWN",policy:"UNKNOWN",indexes:[],indexReads:{}};
 try{const r=await get("");report.database=r.ok?"READABLE":"HTTP_"+r.status;}catch(e){report.database=failure(e);}
 try{
  const r=await get("/documents/legalPolicy/current");
  if(r.status===404)report.policy="MISSING";
  else if(!r.ok)report.policy="HTTP_"+r.status;
  else{
   const b=await r.json(),f=b.fields||{};
   report.policy=f.active?.booleanValue===true?"ACTIVE_REQUIRES_REVIEW":"INACTIVE";
  }
 }catch(e){report.policy=failure(e);}
 // The Firestore Admin list API uses the wildcard collection group for the
 // database-wide index inventory. Classify only after a complete enumeration.
 let all=[],page="",complete=false,readStatus="UNKNOWN";const seen=new Set();
 try{
  for(let n=0;n<10;n++){
   const r=await get("/collectionGroups/-/indexes"+(page?"?pageToken="+encodeURIComponent(page):""));
   readStatus="HTTP_"+r.status;
   if(!r.ok){
    const body=await r.json().catch(()=>({})),status=body?.error?.status;
    if(typeof status==="string"&&/^[A-Z_]{1,40}$/.test(status))readStatus+="_"+status;
    break;
   }
   const b=await r.json();
   if(b.indexes!==undefined&&!Array.isArray(b.indexes)){readStatus="INVALID_RESPONSE";break;}
   all.push(...(b.indexes||[]));page=b.nextPageToken||"";
   if(!page){complete=true;break;}if(seen.has(page))break;seen.add(page);
  }
 }catch(e){readStatus=failure(e);}
 for(const group of [...new Set(expected.map(x=>x.collectionGroup))]){
  report.indexReads[group]=readStatus;
  for(const i of expected.filter(x=>x.collectionGroup===group)){
   const matches=all.filter(x=>typeof x.name==="string"&&x.name.startsWith("projects/"+PROJECT+"/databases/(default)/collectionGroups/"+group+"/indexes/")&&x.queryScope===i.queryScope&&normal(x.fields)===normal(i.fields));
   const state=matches.some(x=>x.state==="READY")?"READY":matches.some(x=>x.state==="CREATING")?"CREATING":matches.length?"NOT_READY":complete?"MISSING":"UNKNOWN";
   report.indexes.push({collectionGroup:group,fields:i.fields,state,matchingIds:matches.map(x=>x.name.split("/").at(-1))});
  }
 }
 report.relatedIndexInventory=all.filter(x=>typeof x.name==="string"&&expected.some(i=>x.name.startsWith("projects/"+PROJECT+"/databases/(default)/collectionGroups/"+i.collectionGroup+"/indexes/"))).map(x=>({id:x.name.split("/").at(-1),collectionGroup:x.name.split("/").at(-3),queryScope:x.queryScope,fields:(x.fields||[]).map(f=>({fieldPath:f.fieldPath,order:f.order})),state:x.state}));
 return report;
}
