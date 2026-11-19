import assert from "node:assert/strict";
import {encodeFields} from "./workers/antifraud/src/firestore.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host||process.env.GCLOUD_PROJECT!=="demo-pote-hardening")throw Error("demo emulator only");
const base="http://"+host+"/v1/projects/demo-pote-hardening/databases/(default)";
const path="users/f02-batchget-probe/appState/v2InventoryGuard";
const name="projects/demo-pote-hardening/databases/(default)/documents/"+path;
const headers={"Authorization":"Bearer owner","Content-Type":"application/json"};
const req=async(label,url,options={})=>{console.log("START",label);const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),3000);try{const r=await fetch(url,{...options,headers,signal:ctrl.signal});const body=await r.text();console.log("END",label,r.status,body.slice(0,900));return {status:r.status,body}}catch(e){console.log("FAIL",label,e.name,e.message);return {error:e.name}}finally{clearTimeout(t)}};
try{
 await req("seed",base+"/documents/"+path,{method:"PATCH",body:JSON.stringify({fields:encodeFields({revision:10})})});
 const tx=await req("begin",base+"/documents:beginTransaction",{method:"POST",body:JSON.stringify({options:{readWrite:{}}})});
 assert.equal(tx.status,200);
 const transaction=JSON.parse(tx.body).transaction;
 await req("GET query transaction",base+"/documents/"+path+"?transaction="+encodeURIComponent(transaction));
 await req("POST batchGet transaction",base+"/documents:batchGet",{method:"POST",body:JSON.stringify({documents:[name],transaction})});
 await req("rollback",base+"/documents:rollback",{method:"POST",body:JSON.stringify({transaction})});
}finally{await req("delete",base+"/documents/"+path,{method:"DELETE"})}
