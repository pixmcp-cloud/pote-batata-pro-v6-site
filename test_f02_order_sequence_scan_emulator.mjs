// Read-only F02 sequence preflight against genuine paginated Firestore REST.
// All fixture writes are to demo-pote-hardening Emulator; never to production.
import assert from "node:assert/strict";
import {encodeFields} from "./workers/antifraud/src/firestore.mjs";
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
const paths=[root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",...orderPaths];
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
 console.log("PASS F02 PAGED SEQUENCE SCAN REST EMULATOR: all pages, multi-group and universe, duplicate blocking, behind-metadata manual review; zero scanner writes");
}finally{
 for(const path of paths.reverse()){
  await fetch(base+"/documents/"+path,{method:"DELETE",headers}).catch(()=>{});
 }
}
