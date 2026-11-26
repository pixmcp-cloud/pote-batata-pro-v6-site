/* Firestore v1 REST adapter for Cloudflare Workers: service-account OAuth,
 * serializable transaction and atomic guarded writes. No Firebase Admin SDK.
 * This service account is NEVER bundled into client code or GitHub. */
import {serviceAccessToken} from "./auth.mjs";
export function encodeValue(value) {
 if(value==null)return {nullValue:"NULL_VALUE"};
 if(typeof value==="string")return {stringValue:value};
 if(typeof value==="boolean")return {booleanValue:value};
 if(typeof value==="number"){
  if(!Number.isFinite(value))throw Error("Invalid Firestore number");
  return Number.isInteger(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER?
   {integerValue:String(value)}:{doubleValue:value};
 }
 if(Array.isArray(value))
  return {arrayValue:{values:value.map(encodeValue)}};
 if(typeof value==="object")
  return {mapValue:{fields:encodeFields(value)}};
 throw Error("Unsupported Firestore type");
}
export function encodeFields(value){
 return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined)
  .map(([k,v])=>[k,encodeValue(v)]));
}
export function decodeValue(v){
 if(!v||typeof v!=="object")return null;
 if("stringValue" in v)return v.stringValue;
 if("integerValue" in v)return Number(v.integerValue);
 if("doubleValue" in v)return Number(v.doubleValue);
 if("booleanValue" in v)return v.booleanValue;
 if("nullValue" in v)return null;
 if("timestampValue" in v)return v.timestampValue;
 if("arrayValue" in v)return (v.arrayValue?.values||[]).map(decodeValue);
 if("mapValue" in v)return decodeFields(v.mapValue?.fields||{});
 throw Error("Unsupported Firestore value");
}
export function decodeFields(fields){
 return Object.fromEntries(Object.entries(fields||{})
  .map(([k,v])=>[k,decodeValue(v)]));
}
export class FirestoreError extends Error{
 constructor(status,message){super(message);this.status=status}
}
export function createFirestoreRepository(env,{requestFetch=fetch,accessToken=serviceAccessToken,apiBaseUrl=null}={}){
 const project=env.FIREBASE_PROJECT_ID;
 if(!/^[a-z][a-z0-9-]{2,50}$/.test(project||""))
  throw Error("Firebase project ID missing");
 const base="projects/"+project+"/databases/(default)";
 const prefix=apiBaseUrl||"https://firestore.googleapis.com/v1/"+base;
 const fullName=p=>base+"/documents/"+p.split("/").map(encodeURIComponent).join("/");
 const api=async (path,{method="GET",body}={})=>{
  const token=await accessToken(env,requestFetch);
  const response=await requestFetch(prefix+path,{
   method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   signal:AbortSignal.timeout(10000),
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(response.status===404)return {missing:true};
  if(!response.ok){
   const details=await response.json().catch(()=>({}));
   throw new FirestoreError(response.status,details?.error?.status||"FIRESTORE_FAILED");
  }
  return response.json();
 };
 return {
  async transaction(){
   const opened=await api("/documents:beginTransaction",{method:"POST",body:{options:{readWrite:{}}}});
   if(!opened.transaction)throw Error("Firestore transaction unavailable");
   const transaction=opened.transaction;
   let done=false;
   const labReadCache=new Map();
   const localLab=project==="demo-nucleobit-checkout"&&typeof apiBaseUrl==="string"&&/^http:\/\/127\.0\.0\.1:\d+\/v1\/projects\/demo-nucleobit-checkout\/databases\/\(default\)$/.test(apiBaseUrl);
   return {
    async get(path){
     if(done)throw Error("Transaction already finalized");
     if(localLab&&labReadCache.has(path))return structuredClone(labReadCache.get(path));
     // batchGet envia transaction no corpo JSON, não como parâmetro GET.
     // Além de ser suportado oficialmente, evita o erro BYTE_STRING do
     // Firebase Emulator nas consultas GET com ?transaction=....
     const response=await api("/documents:batchGet",{method:"POST",body:{
      documents:[fullName(path)],transaction
     }});
     const found=Array.isArray(response)?response[0]:response;
     if(found?.missing){if(localLab)labReadCache.set(path,null);return null;}
     if(!found?.found?.fields||!found.found.updateTime)
      throw Error("Firestore: resposta transacional batchGet inválida");
     const record={data:decodeFields(found.found.fields),updateTime:found.found.updateTime};
     if(localLab)labReadCache.set(path,structuredClone(record));return record;
    },
    // B02.7 only: bounded complete catalog query on local synthetic emulator.
    // Production repository does not expose this capability.
    ...(localLab?{
     async listRecords({collection,universe,groups,limit}){
      if(done||!/^users\/[A-Za-z0-9_-]{1,100}\/recordsV5$/.test(collection)||! /^[A-Za-z0-9_-]{1,100}$/.test(universe)||!Array.isArray(groups)||groups.length!==5||new Set(groups).size!==5||groups.some(g=>!["recipes","ingredients","beverages","addons","expenses"].includes(g))||limit!==241)throw Error("Invalid lab catalog query");
      const parent=collection.split("/").slice(0,-1).join("/");
      const response=await api("/documents/"+parent+":runQuery",{method:"POST",body:{transaction,structuredQuery:{from:[{collectionId:"recordsV5"}],where:{compositeFilter:{op:"AND",filters:[{fieldFilter:{field:{fieldPath:"record.universe"},op:"EQUAL",value:{stringValue:universe}}},{fieldFilter:{field:{fieldPath:"record.group"},op:"IN",value:{arrayValue:{values:groups.map(stringValue=>({stringValue}))}}}}]}},limit}}});
      if(!Array.isArray(response))throw Error("Invalid lab query response");
      return response.filter(x=>x.document).map(x=>({key:x.document.name.split("/").at(-1),data:decodeFields(x.document.fields),updateTime:x.document.updateTime}));
     },
     // Exact logical IDs, not just guessed physical keys: detects duplicates across
     // canonical/model/free aliases. All expenses are queried, including inserts.
     async listCatalogRecords({collection,universe,selection,limit}){
      const groups=["recipes","ingredients","beverages","addons"];
      if(done||!/^users\/[A-Za-z0-9_-]{1,100}\/recordsV5$/.test(collection)||! /^[A-Za-z0-9_-]{1,100}$/.test(universe)||!selection||Object.keys(selection).length!==4||groups.some(g=>!Array.isArray(selection[g])||selection[g].length>92||new Set(selection[g]).size!==selection[g].length||selection[g].some(id=>typeof id!=="string"||!/^[A-Za-z0-9_-]{1,100}$/.test(id)))||limit!==241)throw Error("Invalid selective lab query");
      const parent=collection.split("/").slice(0,-1).join("/");
      const field=(fieldPath,op,value)=>({fieldFilter:{field:{fieldPath},op,value}});
      const found=[];
      const query=async(group,ids)=>{
       if(found.length>=limit)return;
       const filters=[field("record.universe","EQUAL",{stringValue:universe}),field("record.group","EQUAL",{stringValue:group})];
       if(ids)filters.push(field("record.id","IN",{arrayValue:{values:ids.map(stringValue=>({stringValue}))}}));
       const response=await api("/documents/"+parent+":runQuery",{method:"POST",body:{transaction,structuredQuery:{from:[{collectionId:"recordsV5"}],where:{compositeFilter:{op:"AND",filters}},limit:limit-found.length}}});
       if(!Array.isArray(response))throw Error("Invalid selective lab response");
       for(const row of response){if(!row.document)continue;const d=row.document;
        if(!d.name||!d.updateTime||!d.fields)throw Error("Invalid selective lab document");
        const key=d.name.split("/").at(-1),data=decodeFields(d.fields);
        found.push({key,data,updateTime:d.updateTime});
        labReadCache.set(collection+"/"+key,structuredClone({data,updateTime:d.updateTime}));
       }
      };
      // Firestore IN allows at most 30 alternatives; smaller chunks stay bounded.
      for(const g of groups)for(let i=0;i<selection[g].length&&found.length<limit;i+=30)await query(g,selection[g].slice(i,i+30));
      if(found.length<limit)await query("expenses",null);
      return found;
     }
    }:{}),
    async commit(writes){
     if(done)throw Error("Transaction already finalized");
     const updates=writes.map(write=>{
      if(!write?.path||!write?.data||!write?.precondition)
       throw Error("Malformed Firestore commit");
      const currentDocument=write.precondition.exists===false?
       {exists:false}:{updateTime:write.precondition.updateTime};
      if(!("exists" in currentDocument) && !currentDocument.updateTime)
       throw Error("Missing Firestore version");
      return {
       update:{name:fullName(write.path),fields:encodeFields(write.data)},
       updateTransforms:[...new Set(["updatedAt",...(write.serverTimestamps||[])])].map(fieldPath=>({fieldPath,setToServerValue:"REQUEST_TIME"})),
       currentDocument
      };
     });
     const result=await api("/documents:commit",{
      method:"POST",body:{transaction,writes:updates}
     });
     done=true;
     return result;
    },
    async rollback(){
     if(done)return;
     done=true;
     try{await api("/documents:rollback",{method:"POST",body:{transaction}})}catch{}
    }
   };
  }
 };
}
