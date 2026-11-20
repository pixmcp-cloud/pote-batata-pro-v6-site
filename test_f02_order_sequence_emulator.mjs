// F02 immutable public sequence #P0000001: two real REST Worker orders race in
// Firestore Emulator, carry forward the V2 legacy counter, never reuse on cancel.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
import {serverPricePath} from "./workers/antifraud/src/server_price.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("Refusing non-demo project");
const uid="f02-sequence-atomic-qa",universe="batataria",recipeId="batata";
const root="users/"+uid,base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const headers={Authorization:"Bearer owner","Content-Type":"application/json"};
const rec=(group,id)=>recordPath(uid,universe,group,id);
const seqPath=root+"/appState/v2OrderSequence__"+universe;
const all=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",
 root+"/appState/v2Pulse",seqPath,rec("recipes",recipeId),
 rec("ingredients","potato"),rec("cashSessions","cash"),
 serverPricePath(uid,universe,recipeId)];
const put=async(p,data)=>{const r=await fetch(base+"/documents/"+p,{
 method:"PATCH",headers,body:JSON.stringify({fields:encodeFields(data)})});
 assert.equal(r.status,200,"Seed "+p+" "+await r.text())};
const read=async p=>{const r=await fetch(base+"/documents/"+p,{headers});
 if(r.status===404)return null;assert.equal(r.status,200,p);return decodeFields((await r.json()).fields)};
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",
 PRODUCTION_CUTOVER_APPROVED:"false",ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({verify:async()=>({uid}),
 repository:()=>createFirestoreRepository(env,{accessToken:async()=>"emulator",apiBaseUrl:base}),
 clock:()=>new Date("2026-11-20T17:00:00Z")});
const request=(route,payload)=>app.fetch(new Request("https://qa.example"+route,{
 method:"POST",headers:{Origin:"https://qa.example","Content-Type":"application/json",
 Authorization:"Bearer synthetic"},body:JSON.stringify({universe,...payload})}),env);
const ops=[0,1,2].map(i=>"f02-sequential-operation-000000"+i);
const orders=[0,1,2].map(i=>"f02-sequential-order-"+i);
for(let i=0;i<3;i++){all.push(rec("orders",orders[i]),root+"/workerEvents/"+ops[i]);
 for(let j=0;j<2;j++)all.push(rec("stockMovements","cf-reserve-"+ops[i]+"-"+j))}
const canceled="f02-sequential-cancel-000001";
all.push(root+"/workerEvents/"+canceled);
for(let j=0;j<2;j++)all.push(rec("stockMovements","cf-"+canceled+"-"+j));
const create=i=>request("/v1/orders/create",{orderId:orders[i],operationId:ops[i],
 recipeId,qty:1,cashSessionId:"cash",paymentMethod:"pix"});
try{
 await put(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 await put(root+"/appState/v2",{schemaVersion:2,state:{data:{businessType:universe,orderSequenceLast:120}}});
 await put(root+"/appState/v2InventoryGuard",{revision:0});
 await put(root+"/appState/v2Pulse",{eventId:"seed"});
 await put(rec("cashSessions","cash"),{record:{group:"cashSessions",id:"cash",
  universe,item:{status:"open"}}});
 await put(rec("ingredients","potato"),{record:{group:"ingredients",id:"potato",
  universe,item:{measureUnit:"g",stock:1000,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}}});
 await put(rec("recipes",recipeId),{record:{group:"recipes",id:recipeId,universe,
  item:{name:"Batata",items:[{id:"potato",g:100}],targetGainPct:100}}});
 const approval=await request("/v1/catalog/approve-price",{recipeId,
  operationId:"f02-seq-approve-price-00000001",salePriceCents:2000});
 all.push(root+"/workerEvents/f02-seq-approve-price-00000001");
 assert.equal(approval.status,200,"Approval "+await approval.clone().text());
 const both=await Promise.all([create(0),create(1)]);
 const statuses=both.map(r=>r.status);
 assert(statuses.every(x=>x===200||x===409),"unexpected statuses "+statuses);
 // Transaction race can reject both optimistic attempts: retry the same IDs.
 for(let i=0;i<2;i++)if(both[i].status!==200){
  const retry=await create(i);
  assert.equal(retry.status,200,"Retry "+i+" "+await retry.clone().text());
 }
 const oa=(await read(rec("orders",orders[0]))).record.item;
 const ob=(await read(rec("orders",orders[1]))).record.item;
 assert.deepEqual([oa.orderNumber,ob.orderNumber].sort((a,b)=>a-b),[121,122]);
 assert.equal((await read(seqPath)).last,122,"Control must persist both orders");
 const again=await create(0);
 assert.equal(again.status,200);const repeat=await again.json();
 assert.equal(repeat.alreadyApplied,true);
 assert.equal(repeat.orderNumber,oa.orderNumber,"Replayed receipt must use original public number");
 assert.equal((await read(seqPath)).last,122);
 const cancellation=await request("/v1/orders/cancel",{orderId:orders[0],
  operationId:canceled,decision:"return"});
 assert.equal(cancellation.status,200,"Cancel "+await cancellation.clone().text());
 assert.equal((await read(seqPath)).last,122,"Cancellation never reuses public order number");
 const next=await create(2);
 assert.equal(next.status,200,"Next "+await next.clone().text());
 const n=await next.json();
 assert.equal(n.orderNumber,123);
 assert.equal((await read(rec("orders",orders[2]))).record.item.orderNumber,123);
 assert.equal((await read(seqPath)).last,123);
 console.log("PASS F02 SEQUENCE ATOMIC: legacy #P0000120 -> 121/122 concurrent -> cancel -> 123; retries preserve number");
}finally{for(const p of [...new Set(all)].reverse())
 await fetch(base+"/documents/"+p,{method:"DELETE",headers}).catch(()=>{})}
