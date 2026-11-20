// Two complex orders race against the same stock using real Firestore Emulator.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
import {serverPricePath} from "./workers/antifraud/src/server_price.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("isolated emulator required");
const uid="f02-complex-race",universe="qa",recipeId="complex",root="users/"+uid;
const base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const headers={Authorization:"Bearer owner","Content-Type":"application/json"};
const record=(group,id)=>recordPath(uid,universe,group,id);
const paths=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse"];
const seed=async(path,data)=>{paths.push(path);const r=await fetch(base+"/documents/"+path,{method:"PATCH",headers,body:JSON.stringify({fields:encodeFields(data)})});if(!r.ok)throw Error("seed "+r.status+" "+await r.text())};
const get=async path=>{const r=await fetch(base+"/documents/"+path,{headers});if(r.status===404)return null;if(!r.ok)throw Error("read "+r.status+" "+await r.text());return r.json()};
const field=(doc,name)=>Number(doc.fields.record.mapValue.fields.item.mapValue.fields[name].doubleValue??doc.fields.record.mapValue.fields.item.mapValue.fields[name].integerValue);
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false",ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({verify:async()=>({uid}),repository:()=>createFirestoreRepository(env,{accessToken:async()=>"owner",apiBaseUrl:base}),clock:()=>new Date("2026-11-20T01:00:00Z")});
const call=(route,data)=>app.fetch(new Request("https://qa.example"+route,{method:"POST",headers:{Origin:"https://qa.example",Authorization:"Bearer synthetic","Content-Type":"application/json"},body:JSON.stringify(data)}),env);
const items=[["ingredients","potato","g",10,1,"kg",400],["packaging","pot","un",20,10,"un",2],["addons","bacon","g",50,1,"kg",20],["beverages","juice","un",30,10,"un",2]];
const operations=["f02-complex-race-order-00000001","f02-complex-race-order-00000002"];
try{
 await seed(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 await seed(root+"/appState/v2",{schemaVersion:2});
 await seed(root+"/appState/v2InventoryGuard",{revision:1});
 await seed(root+"/appState/v2Pulse",{eventId:"seed"});
 await seed(record("recipes",recipeId),{record:{group:"recipes",id:recipeId,universe,item:{name:"Complex",items:[{id:"potato",g:250}],packagingItems:[{id:"pot",quantity:1}],addons:[{id:"bacon",quantity:2,unit:"g"}],beverages:[{id:"juice",quantity:1}],targetGainPct:100}}});
 await seed(record("cashSessions","cash"),{record:{group:"cashSessions",id:"cash",universe,item:{status:"open"}}});
 for(const [group,id,measureUnit,purchasePrice,purchaseQuantity,purchaseUnit,stock] of items)
  await seed(record(group,id),{record:{group,id,universe,item:{measureUnit,purchasePrice,purchaseQuantity,purchaseUnit,stock}}});
 const approve=await call("/v1/catalog/approve-price",{universe,recipeId,operationId:"f02-complex-race-approve-00001",salePriceCents:2000});
 assert.equal(approve.status,200,"complex approval "+await approve.clone().text());
 paths.push(serverPricePath(uid,universe,recipeId));
 const order=(i)=>({universe,recipeId,orderId:"complex-order-"+i,operationId:operations[i],qty:1,cashSessionId:"cash",paymentMethod:"pix"});
 const responses=await Promise.all([call("/v1/orders/create",order(0)),call("/v1/orders/create",order(1))]);
 const results=await Promise.all(responses.map(async r=>({status:r.status,body:await r.json()})));
 console.log("COMPLEX CONCURRENT",JSON.stringify(results));
 assert(results.every(r=>[200,409].includes(r.status)),"unexpected status");
 let successes=results.filter(r=>r.status===200).length;
 for(let i=0;i<2;i++){
  if(results[i].status===200)continue;
  const retry=await call("/v1/orders/create",order(i));
  console.log("RETRY",i,retry.status,await retry.clone().text());
  if(retry.status===200)successes++;
  else assert.equal(retry.status,409);
 }
 assert.equal(successes,1,"exactly one order must reserve limited packaging and beverage");
 const expected={ingredients:150,packaging:1,addons:18,beverages:1};
 for(const [group,id] of items){const doc=await get(record(group,id));assert.equal(field(doc,"stock"),expected[group],group+" physical stock");}
 const accepted=results.findIndex(x=>x.status===200);
 const actual=accepted>=0?accepted:(await get(record("orders","complex-order-0"))?0:1);
 const same=await call("/v1/orders/create",order(actual));
 assert.equal(same.status,200);
 assert.equal((await same.json()).alreadyApplied,true);
 const canceled=await call("/v1/orders/cancel",{universe,orderId:"complex-order-"+actual,operationId:"f02-complex-race-cancel-00001",decision:"return"});
 assert.equal(canceled.status,200,await canceled.clone().text());
 for(const [group,id,,,,,stock] of items)assert.equal(field(await get(record(group,id)),"stock"),stock,group+" restored");
 const recipePath=record("recipes",recipeId);
 const before=await get(recipePath);
 const {decodeFields}=await import("./workers/antifraud/src/firestore.mjs");
 const oldRecord=decodeFields(before.fields).record;
 await seed(recipePath,{record:{...oldRecord,item:{...oldRecord.item,comboItems:[{id:"combo-unknown",qty:1}]}}});
 const comboApproval=await call("/v1/catalog/approve-price",{universe,recipeId,
  operationId:"f02-complex-race-combo-approve-00001",salePriceCents:2000});
 console.log("COMBO FAIL CLOSED",comboApproval.status,await comboApproval.clone().text());
 assert.equal(comboApproval.status,409,"unsupported combo must not be approved");
 const comboOrder=await call("/v1/orders/create",{...order(0),orderId:"combo-order",
  operationId:"f02-complex-race-combo-order-00001"});
 assert.equal(comboOrder.status,409,"modified combo cannot reuse old approval");
 assert.equal(await get(record("orders","combo-order")),null);
 // A flat combo declares physical components explicitly, including duplicate stock IDs.
 await seed(recipePath,{record:{...oldRecord,item:{...oldRecord.item,
  comboItems:[{kind:"ingredient",id:"potato",quantity:50,unit:"g"},
   {kind:"packaging",id:"pot",quantity:1,unit:"un"},
   {kind:"addon",id:"bacon",quantity:2,unit:"g"},
   {kind:"beverage",id:"juice",quantity:1,unit:"un"}]}}});
 const approvedCombo=await call("/v1/catalog/approve-price",{universe,recipeId,
  operationId:"f02-complex-race-combo-approve-00002",salePriceCents:5000});
 assert.equal(approvedCombo.status,200,"explicit combo approval "+await approvedCombo.clone().text());
 const comboCreate=await call("/v1/orders/create",{...order(0),orderId:"combo-order-valid",
  operationId:"f02-complex-race-combo-order-00002"});
 assert.equal(comboCreate.status,200,"explicit combo order "+await comboCreate.clone().text());
 const consumed={ingredients:100,packaging:0,addons:16,beverages:0};
 for(const [group,id] of items)assert.equal(field(await get(record(group,id)),"stock"),consumed[group],group+" combo reserved");
 const comboCancel=await call("/v1/orders/cancel",{universe,orderId:"combo-order-valid",
  operationId:"f02-complex-race-combo-cancel-00002",decision:"return"});
 assert.equal(comboCancel.status,200,"combo cancel "+await comboCancel.clone().text());
 for(const [group,id,,,,,stock] of items)assert.equal(field(await get(record(group,id)),"stock"),stock,group+" combo restored");
 const comboRace=(i)=>call("/v1/orders/create",{...order(i),
  orderId:"combo-race-"+i,operationId:"f02-combo-race-order-0000000"+i});
 const competing=await Promise.all([comboRace(0),comboRace(1)]);
 const statuses=competing.map(r=>r.status);
 console.log("COMBO CONCURRENT",JSON.stringify(statuses));
 assert(statuses.every(s=>s===200||s===409));
 let comboSuccess=statuses.filter(s=>s===200).length;
 for(let i=0;i<2;i++)if(statuses[i]!==200){
  const retry=await comboRace(i);
  if(retry.status===200)comboSuccess++;
  else assert.equal(retry.status,409);
 }
 assert.equal(comboSuccess,1,"only one combo may reserve shared physical stock");
 assert.equal(field(await get(record("ingredients","potato")),"stock"),100);
 assert.equal(field(await get(record("packaging","pot")),"stock"),0);
 assert.equal(field(await get(record("beverages","juice")),"stock"),0);
 console.log("PASS F02 COMPLEX AND COMBO CONCURRENT, RESERVE, CANCEL, LEGACY BLOCK");
}finally{for(const i of [0,1]){paths.push(record("orders","complex-order-"+i));paths.push(root+"/workerEvents/"+operations[i]);for(let j=0;j<4;j++)paths.push(record("stockMovements","cf-reserve-"+operations[i]+"-"+j));}for(let i=0;i<2;i++){paths.push(record("orders","combo-race-"+i),root+"/workerEvents/f02-combo-race-order-0000000"+i);for(let j=0;j<8;j++)paths.push(record("stockMovements","cf-reserve-f02-combo-race-order-0000000"+i+"-"+j));}paths.push(root+"/workerEvents/f02-complex-race-approve-00001",root+"/workerEvents/f02-complex-race-cancel-00001",root+"/workerEvents/f02-complex-race-combo-approve-00001",root+"/workerEvents/f02-complex-race-combo-order-00001",record("orders","combo-order"),record("orders","combo-order-valid"),root+"/workerEvents/f02-complex-race-combo-approve-00002",root+"/workerEvents/f02-complex-race-combo-order-00002",root+"/workerEvents/f02-complex-race-combo-cancel-00002");for(let j=0;j<4;j++)paths.push(record("stockMovements","cf-f02-complex-race-cancel-00001-"+j));for(const p of [...new Set(paths)].reverse())await fetch(base+"/documents/"+p,{method:"DELETE",headers}).catch(()=>{});}
