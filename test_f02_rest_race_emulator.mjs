// Isolated REST integration test: run ONLY with Firestore Emulator and demo project.
import assert from "node:assert/strict";
import {createFirestoreRepository,FirestoreError,encodeFields} from "./workers/antifraud/src/firestore.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST;
const project=process.env.GCLOUD_PROJECT||process.env.FIREBASE_PROJECT_ID;
if(!host||project!=="demo-pote-hardening")throw Error("Requires demo-pote-hardening Firestore Emulator");
const base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const path="users/f02-rest-race-qa/appState/v2InventoryGuard";
const endpoint=base+"/documents/"+path;
const requestFetch=fetch;
const repo=createFirestoreRepository({FIREBASE_PROJECT_ID:project},{
 requestFetch,accessToken:async()=>"owner",apiBaseUrl:base});
const patch=async(revision)=>{
 const response=await fetch(endpoint,{method:"PATCH",headers:{"Content-Type":"application/json","Authorization":"Bearer owner"},
 body:JSON.stringify({fields:encodeFields({revision})})});
 assert.equal(response.ok,true,await response.text());
};
const get=async()=>{
 const response=await fetch(endpoint,{headers:{"Authorization":"Bearer owner"}});
 assert.equal(response.ok,true,await response.text());
 return response.json();
};
try{
 await patch(10);
 const old=await repo.transaction();
 const snap=await old.get(path);
 assert.equal(snap.data.revision,10);
 // A separate client changes the document while the REST transaction is open.
 await patch(20);
 let conflict=null;
 try{await old.commit([{path,data:{revision:11},precondition:{updateTime:snap.updateTime}}])}
 catch(e){conflict=e}
 assert.ok(conflict instanceof FirestoreError,"stale transaction must be rejected");
 assert.ok([409,412].includes(conflict.status),"expected conflict status: "+conflict.status);
 await old.rollback();
 const after=await get();
 assert.equal(Number(after.fields.revision.integerValue),20,"stale transaction must not overwrite cost revision");
 const fresh=await repo.transaction();
 const current=await fresh.get(path);
 assert.equal(current.data.revision,20);
 await fresh.commit([{path,data:{revision:21},precondition:{updateTime:current.updateTime}}]);
 const final=await get();
 assert.equal(Number(final.fields.revision.integerValue),21);
 console.log("PASS F02 REST EMULATOR COST REVISION RACE: conflict "+conflict.status+", no stale write, fresh retry");
}finally{
 await fetch(endpoint,{method:"DELETE",headers:{"Authorization":"Bearer owner"}}).catch(()=>{});
}
