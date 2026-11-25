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
   return {
    async get(path){
     // batchGet envia transaction no corpo JSON, não como parâmetro GET.
     // Além de ser suportado oficialmente, evita o erro BYTE_STRING do
     // Firebase Emulator nas consultas GET com ?transaction=....
     const response=await api("/documents:batchGet",{method:"POST",body:{
      documents:[fullName(path)],transaction
     }});
     const found=Array.isArray(response)?response[0]:response;
     if(found?.missing)return null;
     if(!found?.found?.fields||!found.found.updateTime)
      throw Error("Firestore: resposta transacional batchGet inválida");
     return {data:decodeFields(found.found.fields),updateTime:found.found.updateTime};
    },
    // Bounded query in the same read-write transaction. Never truncate reservations.
    async receivedOrders(uid,limit=201){
     if(!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)||!Number.isInteger(limit)||limit<1||limit>201)throw Error("Invalid reservation query");
     const response=await api("/documents/users/"+encodeURIComponent(uid)+":runQuery",{method:"POST",body:{
      transaction,structuredQuery:{from:[{collectionId:"recordsV5"}],where:{fieldFilter:{field:{fieldPath:"record.item.status"},op:"EQUAL",value:{stringValue:"recebido"}}},limit}
     }});
     if(!Array.isArray(response))throw Error("Invalid reservation query response");
     return response.filter(row=>row.document).map(row=>({data:decodeFields(row.document.fields),updateTime:row.document.updateTime}));
    },
    async expenses(uid,limit=201){
     if(!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)||!Number.isInteger(limit)||limit<1||limit>201)throw Error("Invalid expense query");
     const response=await api("/documents/users/"+encodeURIComponent(uid)+":runQuery",{method:"POST",body:{
      transaction,structuredQuery:{from:[{collectionId:"recordsV5"}],where:{fieldFilter:{field:{fieldPath:"record.group"},op:"EQUAL",value:{stringValue:"expenses"}}},limit}
     }});
     if(!Array.isArray(response))throw Error("Invalid expense query response");
     return response.filter(row=>row.document).map(row=>({data:decodeFields(row.document.fields),updateTime:row.document.updateTime}));
    },
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
       updateTransforms:[{fieldPath:"updatedAt",setToServerValue:"REQUEST_TIME"}],
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
