// Read-only F02 sequence preflight against genuine paginated Firestore REST.
// All fixture writes are to demo-pote-hardening Emulator; never to production.
import assert from "node:assert/strict";
import {encodeFields,decodeFields,createFirestoreRepository} from "./workers/antifraud/src/firestore.mjs";
import {bootstrapOrderSequenceQa} from "./workers/antifraud/src/order_sequence_bootstrap_qa.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
import {scanOrderSequenceFirestore} from "./workers/antifraud/src/order_sequence_scan.mjs";
const project=process.env.GCLOUD_PROJECT,host=process.env.FIRESTORE_EMULATOR_HOST;
if(project!=="demo-pote-hardening"||!host)throw Error("F02 test requires isolated demo Firestore Emulator");
const uid="f02-pagination-sequence-qa",universe="batataria";
const root="users/"+uid,base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const headers={Authorization:"Bearer owner","Content-Type":"application/json"};
const records=[
 [universe,"orders","historic-a",117],
 [universe,"orders","historic-b",119],
 [universe,"orders","historic-c",120],
 [universe,"ingredients","potato",0],
 [universe,"beverages","water",0],
 ["pizzaria","orders","pizza-older",500]
];
const orderPaths=records.map(([scope,group,id])=>recordPath(uid,scope,group,id));
const paths=[root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",root+"/appState/v2OrderSequence__"+universe,...orderPaths];
const write=async(path,body)=>{
 const res=await fetch(base+"/documents/"+path,{method:"PATCH",headers,
 body:JSON.stringify({fields:encodeFields(body)})});
 assert.equal(res.status,200,"QA seed "+path+" "+await res.text());
};
const audit=()=>scanOrderSequenceFirestore({uid,universe,projectId:project,
 accessToken:"owner",apiBaseUrl:base,pageSize:2,maxPages:10});
try{
 await write(root+"/appState/v2",{schemaVersion:2,state:{data:{
  businessType:universe,orderSequenceLast:120,businessUniverses:{
   pizzaria:{orderSequenceLast:500}}}}});
 await write(root+"/appState/v2InventoryGuard",{revision:1});
 await write(root+"/appState/v2Pulse",{eventId:"seed"});
 for(let i=0;i<records.length;i++){
  const [scope,group,id,number]=records[i];
  await write(orderPaths[i],{record:{universe:scope,group,id,
   rank:-100-i,item:group==="orders"?{id,orderNumber:number}:{id,stock:3}}});
 }
 const checked=await audit();
 assert.equal(checked.status,"ready",JSON.stringify(checked));
 assert.equal(checked.action,"initialize_after_authorization");
 assert.equal(checked.highest,120);
 assert.equal(checked.numbered,3);
 assert.equal(checked.scanned,6);
 assert(checked.pages>=3,"Pagination must fetch all result pages");
 assert.equal(checked.listingComplete,true);assert.equal(checked.snapshotStable,true);
 // Changing one historical order to a duplicate is a NO-GO.
 await write(orderPaths[2],{record:{universe,group:"orders",id:"historic-c",
  rank:-102,item:{id:"historic-c",orderNumber:119}}});
 const duplicate=await audit();
 assert.equal(duplicate.status,"blocked",JSON.stringify(duplicate));
 assert.equal(duplicate.reason,"duplicate_public_numbers");
 // Restore a valid history and move ahead of the legacy counter.
 await write(orderPaths[2],{record:{universe,group:"orders",id:"historic-c",
  rank:-102,item:{id:"historic-c",orderNumber:121}}});
 const behind=await audit();
 assert.equal(behind.status,"manual_review");
 assert.equal(behind.reason,"metadata_behind_orders");
 // Restore the original history and verify a stale scan never writes.
 await write(orderPaths[2],{record:{universe,group:"orders",id:"historic-c",
  rank:-102,item:{id:"historic-c",orderNumber:120}}});
 const report=await audit();
 assert.equal(report.status,"ready");
 const repository=env=>createFirestoreRepository(env,{
  accessToken:async()=>"owner",apiBaseUrl:base});
 const env={FIREBASE_PROJECT_ID:project};
 await assert.rejects(bootstrapOrderSequenceQa({uid,universe,
  env:{FIREBASE_PROJECT_ID:"potobatata-b71f3"},report,repository}),
  /qa_project_only/);
 await write(root+"/appState/v2InventoryGuard",{revision:2});
 await assert.rejects(bootstrapOrderSequenceQa({uid,universe,env,report,repository}),
  /stale_sequence_preflight/);
 const markerPath=root+"/appState/v2OrderSequence__"+universe;
 const getMarker=async()=>{
  const r=await fetch(base+"/documents/"+markerPath,{headers});
  return r.status===404?null:decodeFields((await r.json()).fields);
 };
 assert.equal(await getMarker(),null,"Stale preflight cannot write marker");
 const fresh=await audit();
 assert.equal(fresh.status,"ready");
 const migrated=await bootstrapOrderSequenceQa({uid,universe,env,
  report:fresh,repository});
 assert.equal(migrated.ok,true);assert.equal(migrated.last,120);
 assert.equal((await getMarker()).last,120);
 const after=await audit();
 assert.equal(after.action,"already_initialized");
 assert.equal(after.last,120);
 await assert.rejects(bootstrapOrderSequenceQa({uid,universe,env,
  report:fresh,repository}),/stale_sequence_preflight/);
 console.log("PASS F02 PAGED SEQUENCE SCAN + QA BOOTSTRAP REST EMULATOR: pages, duplicates, stale read refused, demo-only atomic marker, replay refused");
}finally{
 for(const path of paths.reverse()){
  await fetch(base+"/documents/"+path,{method:"DELETE",headers}).catch(()=>{});
 }
}
