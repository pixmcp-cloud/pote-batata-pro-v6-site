// Isolated REST integration test: run ONLY with Firestore Emulator and demo project.
import assert from "node:assert/strict";
import {createFirestoreRepository,FirestoreError,encodeFields} from "./workers/antifraud/src/firestore.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST;
const project=process.env.GCLOUD_PROJECT||process.env.FIREBASE_PROJECT_ID;
if(!host||project!=="demo-pote-hardening")throw Error("Requires demo-pote-hardening Firestore Emulator");
const base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const path="users/f02-rest-race-qa/appState/v2InventoryGuard";
const endpoint=base+"/documents/"+path;
const requestFetch=async(url,options)=>{console.log("REST START",options?.method||"GET",url.split("?")[0]);try{const r=await fetch(url,options);console.log("REST END",r.status);return r}catch(e){console.log("REST ERROR",e.name,e.message);throw e}};
const repo=createFirestoreRepository({FIREBASE_PROJECT_ID:project},{
 requestFetch,accessToken:async()=>"owner",apiBaseUrl:base});
const patch=async(revision,{signal}={})=>{
 const response=await fetch(endpoint,{method:"PATCH",headers:{"Content-Type":"application/json","Authorization":"Bearer owner"},
 body:JSON.stringify({fields:encodeFields({revision})}),signal});
 assert.equal(response.ok,true,await response.text());
};
const get=async()=>{
 const response=await fetch(endpoint,{headers:{"Authorization":"Bearer owner"}});
 assert.equal(response.ok,true,await response.text());
 return response.json();
};
try{
 console.log("STEP seed"); await patch(10);
 console.log("STEP begin"); const old=await repo.transaction();
 console.log("STEP read"); const snap=await old.get(path);
 assert.equal(snap.data.revision,10);
 // Emulator serializes competing writes: a concurrent PATCH cannot bypass an open read transaction.
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),1500);
 let blocked=false;
 try{await patch(20,{signal:controller.signal})}
 catch(error){blocked=error?.name==="AbortError"||error?.name==="TimeoutError"}
 finally{clearTimeout(timer)}
 assert.equal(blocked,true,"concurrent cost update must not bypass open transaction");
 console.log("STEP rollback"); await old.rollback();
 console.log("STEP update after rollback"); await patch(20);
 const after=await get();
 assert.equal(Number(after.fields.revision.integerValue),20,"stale transaction must not overwrite cost revision");
 console.log("STEP fresh begin"); const fresh=await repo.transaction();
 console.log("STEP fresh read"); const current=await fresh.get(path);
 assert.equal(current.data.revision,20);
 console.log("STEP fresh commit"); await fresh.commit([{path,data:{revision:21},precondition:{updateTime:current.updateTime}}]);
 const final=await get();
 assert.equal(Number(final.fields.revision.integerValue),21);
 console.log("PASS F02 REST EMULATOR LOCK SERIALIZATION: concurrent update blocked, rollback, new cost and fresh transaction");
}finally{
 await fetch(endpoint,{method:"DELETE",headers:{"Authorization":"Bearer owner"}}).catch(()=>{});
}
