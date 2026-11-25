import {test} from "node:test";
import assert from "node:assert/strict";
import {auditFirebase} from "../scripts/firebase-commercial-preflight.mjs";
const fields=[{fieldPath:"buyerUid",order:"ASCENDING"},{fieldPath:"createdAt",order:"DESCENDING"}];
const expected=[{collectionGroup:"publicOrderViews",queryScope:"COLLECTION",fields},{collectionGroup:"recordsV5",queryScope:"COLLECTION",fields}];
test("read-only audit handles pagination, READY, CREATING and missing policy without exposing data",async()=>{
 const calls=[];
 const r=await auditFirebase({token:"synthetic",expected,requestFetch:async(url,init)=>{
  calls.push({url,method:init.method});
  if(url.endsWith("(default)"))return Response.json({name:"synthetic"});
  if(url.endsWith("/documents/legalPolicy/current"))return new Response("",{status:404});
  assert(url.includes("/collectionGroups/-/indexes"));
  const prefix="projects/potobatata-b71f3/databases/(default)/collectionGroups/";
  if(!url.includes("pageToken"))return Response.json({indexes:[{name:prefix+"publicOrderViews/indexes/one",queryScope:"COLLECTION",fields:[...fields,{fieldPath:"__name__",order:"DESCENDING"}],state:"READY"}],nextPageToken:"next"});
  return Response.json({indexes:[{name:prefix+"recordsV5/indexes/two",queryScope:"COLLECTION",fields,state:"CREATING"}]});
 }});
 assert.equal(r.database,"READABLE");assert.equal(r.policy,"MISSING");
 assert.deepEqual(r.indexes.map(x=>x.state),["READY","CREATING"]);
 assert(calls.every(x=>x.method==="GET"&&x.url.startsWith("https://firestore.googleapis.com/v1/projects/potobatata-b71f3/")));
 assert.equal(calls.length,4);
});
test("permission denied does not get misreported as missing index",async()=>{
 const r=await auditFirebase({token:"synthetic",expected,requestFetch:async()=>new Response("",{status:403})});
 assert.equal(r.database,"HTTP_403");assert.equal(r.policy,"HTTP_403");assert(r.indexes.every(x=>x.state==="UNKNOWN"));
});

test("a complete empty inventory marks missing, not permission or transport failures",async()=>{const r=await auditFirebase({token:"synthetic",expected,requestFetch:async()=>Response.json({})});assert(r.indexes.every(x=>x.state==="MISSING"));});
