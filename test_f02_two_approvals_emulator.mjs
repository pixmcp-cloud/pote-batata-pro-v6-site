// QA-only: two REST transactions competing for the same price approval revision.
// Never run outside the demo Firestore Emulator.
import assert from "node:assert/strict";
import {createFirestoreRepository,encodeFields,FirestoreError} from "./workers/antifraud/src/firestore.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("Requires demo-pote-hardening Emulator");
const base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const path="users/f02-two-approvals-qa/appState/approvedPrice";
const endpoint=base+"/documents/"+path;
const headers={"Authorization":"Bearer owner","Content-Type":"application/json"};
const patch=async revision=>{const r=await fetch(endpoint,{method:"PATCH",headers,body:JSON.stringify({fields:encodeFields({revision,costCents:1200,salePriceCents:2400})})});if(!r.ok)throw Error("seed "+r.status+" "+await r.text())};
const repo=()=>createFirestoreRepository({FIREBASE_PROJECT_ID:project},{accessToken:async()=>"owner",apiBaseUrl:base});
const read=async()=>{const r=await fetch(endpoint,{headers});if(!r.ok)throw Error("read "+r.status);return r.json()};
try{
 await patch(1);
 const approve=async(label)=>{
  const tx=await repo().transaction();
  try{
   const snap=await tx.get(path);
   assert.equal(snap.data.costCents,1200);
   await tx.commit([{path,data:{revision:snap.data.revision+1,costCents:1200,salePriceCents:2500},precondition:{updateTime:snap.updateTime}}]);
   console.log(label,"COMMITTED",snap.data.revision+1);
   return "ok";
  }catch(e){
   await tx.rollback();
   console.log(label,"REJECTED",e.status||e.name,e.message);
   if(e instanceof FirestoreError&&[409,412,400].includes(e.status))return "conflict";
   throw e;
  }
 };
 const outcomes=await Promise.allSettled([approve("A"),approve("B")]);
 console.log("OUTCOMES",JSON.stringify(outcomes));
 assert(outcomes.every(o=>o.status==="fulfilled"),"both requests must finish");
 const final=await read();
 const revision=Number(final.fields.revision.integerValue);
 assert.equal(revision,2,"exactly one concurrent approval must commit");
 const settled=outcomes.map(o=>o.value);
 assert.deepEqual(settled.sort(),["conflict","ok"],"one winner and one rejected transaction required");
 console.log("PASS F02 REAL REST APPROVAL CONCURRENCY revision",revision);
}finally{await fetch(endpoint,{method:"DELETE",headers}).catch(()=>{})}
