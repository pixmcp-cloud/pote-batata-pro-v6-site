import test from "node:test";
import assert from "node:assert/strict";
import {encodeFields,decodeFields,FirestoreError,createFirestoreRepository}
 from "../src/firestore.mjs";
test("Firestore REST codec preserves nested V2 data, arrays and money",()=>{
 const value={record:{universe:"batataria",group:"orders",id:"o1",rank:1,
  item:{id:"o1",price:30.9,qty:2,stockDeducted:false,
   items:[{id:"batata",g:100},{id:"agua",g:0}],nullField:null}}};
 assert.deepEqual(decodeFields(encodeFields(value)),value);
});
test("real REST adapter commits Firestore transaction with version guards and server timestamps",async()=>{
 const requests=[],env={FIREBASE_PROJECT_ID:"potobatata-b71f3"};
 const requestFetch=async(url,options)=>{
  requests.push({url,options});
  if(url.endsWith(":beginTransaction"))
   return new Response(JSON.stringify({transaction:"serialized-transaction"}),{
    status:200,headers:{"content-type":"application/json"}});
  if(url.includes("/documents/users/uid/records/existing"))
   return new Response(JSON.stringify({name:"existing",updateTime:"2026-11-18T10:00:00Z",
    fields:encodeFields({record:{id:"o1",stock:100}})}),{
    status:200,headers:{"content-type":"application/json"}});
  if(url.includes("/documents/users/uid/records/missing"))
   return new Response("Not Found",{status:404});
  if(url.endsWith(":commit"))
   return new Response(JSON.stringify({commitTime:"2026-11-18T10:01:00Z"}),{
    status:200,headers:{"content-type":"application/json"}});
  if(url.endsWith(":rollback"))return new Response("{}",{status:200});
  return new Response("Unexpected",{status:500});
 };
 const store=createFirestoreRepository(env,{requestFetch,accessToken:async()=>"test-access"});
 const tx=await store.transaction();
 const doc=await tx.get("users/uid/records/existing");
 assert.equal(doc.data.record.stock,100);
 assert.equal(doc.updateTime,"2026-11-18T10:00:00Z");
 assert.equal(await tx.get("users/uid/records/missing"),null);
 await tx.commit([
  {path:"users/uid/records/existing",data:{record:{id:"o1",stock:90}},
   precondition:{updateTime:doc.updateTime}},
  {path:"users/uid/records/new",data:{record:{id:"movement",quantity:-10}},
   precondition:{exists:false}}
 ]);
 await tx.rollback();
 const commit=requests.find(r=>r.url.endsWith(":commit"));
 assert(commit,"REST commit was not called");
 const body=JSON.parse(commit.options.body);
 assert.equal(body.transaction,"serialized-transaction");
 assert.equal(body.writes.length,2);
 assert.equal(body.writes[0].currentDocument.updateTime,doc.updateTime);
 assert.equal(body.writes[1].currentDocument.exists,false);
 assert.equal(body.writes[0].updateTransforms[0].fieldPath,"updatedAt");
 assert.equal(body.writes[1].updateTransforms[0].setToServerValue,"REQUEST_TIME");
 assert.equal(body.writes[0].update.fields.record.mapValue.fields.stock.integerValue,"90");
 assert(!requests.some(r=>r.url.endsWith(":rollback")),"No rollback after successful commit");
 assert(requests.every(r=>r.options.headers.Authorization==="Bearer test-access"));
});
test("Firestore REST adapter converts aborted transaction to conflict",async()=>{
 const fakeFetch=async(url)=>{
  if(url.endsWith(":beginTransaction"))
   return new Response(JSON.stringify({transaction:"tx"}),{status:200});
  if(url.endsWith(":commit"))
   return new Response(JSON.stringify({error:{status:"ABORTED"}}),{status:409});
  return new Response("{}",{status:200});
 };
 const repo=createFirestoreRepository({FIREBASE_PROJECT_ID:"potobatata-b71f3"},
  {requestFetch:fakeFetch,accessToken:async()=>"token"});
 const tx=await repo.transaction();
 await assert.rejects(()=>tx.commit([
  {path:"users/a/records/one",data:{record:{id:"x"}},precondition:{exists:false}}
 ]),e=>e instanceof FirestoreError&&e.status===409);
});
