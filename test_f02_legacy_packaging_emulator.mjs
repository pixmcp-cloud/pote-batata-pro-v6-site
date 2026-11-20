// F02: the existing V2 UI stores packaging as ingredients (category Embalagem).
// Real Firestore Emulator REST test proves atomic reserve/cancel using that
// SAME physical stock, without creating shadow packaging balances.
import assert from "node:assert/strict";
import {createWorkerApp} from "./workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields} from "./workers/antifraud/src/firestore.mjs";
import {recordPath} from "./workers/antifraud/src/domain.mjs";
import {serverPricePath} from "./workers/antifraud/src/server_price.mjs";
const host=process.env.FIRESTORE_EMULATOR_HOST,project=process.env.GCLOUD_PROJECT;
if(!host||project!=="demo-pote-hardening")throw Error("Demo Firestore Emulator required");
const uid="f02-legacy-pkg-qa",universe="batataria",recipeId="legacy-packaged";
const root="users/"+uid,base="http://"+host+"/v1/projects/"+project+"/databases/(default)";
const headers={"Authorization":"Bearer owner","Content-Type":"application/json"};
const path=(group,id)=>recordPath(uid,universe,group,id);
const all=[root,root+"/appState/v2",root+"/appState/v2InventoryGuard",root+"/appState/v2Pulse",
 path("recipes",recipeId),path("cashSessions","cash"),path("ingredients","potato"),path("ingredients","pot"),
 serverPricePath(uid,universe,recipeId)];
const write=async(p,data)=>{
 const r=await fetch(base+"/documents/"+p,{method:"PATCH",headers,body:JSON.stringify({fields:encodeFields(data)})});
 assert.equal(r.status,200,"seed "+p+" "+await r.text());
};
const read=async p=>{
 const r=await fetch(base+"/documents/"+p,{headers});
 if(r.status===404)return null;
 assert.equal(r.status,200,"read "+p);return decodeFields((await r.json()).fields);
};
const env={FIREBASE_PROJECT_ID:project,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false",
 ALLOWED_ORIGINS:"https://qa.example"};
const app=createWorkerApp({verify:async()=>({uid}),
 repository:()=>createFirestoreRepository(env,{accessToken:async()=>"owner",apiBaseUrl:base}),
 clock:()=>new Date("2026-11-20T13:20:00Z")});
const invoke=(route,payload)=>app.fetch(new Request("https://qa.example"+route,{method:"POST",
 headers:{Origin:"https://qa.example",Authorization:"Bearer qa",
 "Content-Type":"application/json"},body:JSON.stringify({universe,...payload})}),env);
const approveId="f02-legacy-package-price-approval-001";
const orderId="f02-legacy-package-order-1",operationId="f02-legacy-package-create-0001";
const cancelId="f02-legacy-package-cancel-0001";
all.push(path("orders",orderId),root+"/workerEvents/"+approveId,
 root+"/workerEvents/"+operationId,root+"/workerEvents/"+cancelId);
for(let i=0;i<4;i++){
 all.push(path("stockMovements","cf-reserve-"+operationId+"-"+i));
 all.push(path("stockMovements","cf-"+cancelId+"-"+i));
}
try{
 await write(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 await write(root+"/appState/v2",{schemaVersion:2});
 await write(root+"/appState/v2InventoryGuard",{revision:0});
 await write(root+"/appState/v2Pulse",{eventId:"seed"});
 await write(path("cashSessions","cash"),{record:{group:"cashSessions",id:"cash",universe,item:{status:"open"}}});
 await write(path("ingredients","potato"),{record:{group:"ingredients",id:"potato",universe,item:{
  id:"potato",name:"Batata",measureUnit:"g",stock:1000,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}}});
 await write(path("ingredients","pot"),{record:{group:"ingredients",id:"pot",universe,item:{
  id:"pot",name:"Pote 500g",category:"Embalagem",measureUnit:"un",stock:3,
  purchasePrice:30,purchaseQuantity:30,purchaseUnit:"un"}}});
 await write(path("recipes",recipeId),{record:{group:"recipes",id:recipeId,universe,item:{
  id:recipeId,name:"Batata em pote",items:[{id:"potato",g:100}],
  packagingItems:[{id:"pot",quantity:1}],targetGainPct:100}}});
 const approval=await invoke("/v1/catalog/approve-price",{recipeId,
  operationId:approveId,salePriceCents:1500});
 assert.equal(approval.status,200,"Approval "+await approval.clone().text());
 const req={recipeId,orderId,operationId,qty:2,cashSessionId:"cash",paymentMethod:"pix"};
 const created=await invoke("/v1/orders/create",req);
 assert.equal(created.status,200,"Create "+await created.clone().text());
 assert.equal((await read(path("ingredients","potato"))).record.item.stock,800);
 assert.equal((await read(path("ingredients","pot"))).record.item.stock,1);
 assert.equal(await read(path("packaging","pot")),null,"Do not create duplicate packaging balance");
 const order=(await read(path("orders",orderId))).record.item;
 assert.equal(order.stockReservationStatus,"reserved");
 assert.equal(order.items.find(x=>x.id==="pot")?.isPkg,true);
 assert.equal(order.items.find(x=>x.id==="pot")?.measureUnit,"un");
 assert.equal((order.packagingItems||[]).length,0,"Legacy packaging included in original ingredient physical group");
 const replay=await invoke("/v1/orders/create",req);
 assert.equal(replay.status,200);assert.equal((await replay.json()).alreadyApplied,true);
 const shortage=await invoke("/v1/orders/create",{...req,orderId:"package-shortage",
  operationId:"f02-legacy-package-shortage-001"});
 assert.equal(shortage.status,409,"Physical packaging shortage must prevent additional reservation");
 assert.equal((await read(path("ingredients","pot"))).record.item.stock,1);
 const cancel=await invoke("/v1/orders/cancel",{orderId,operationId:cancelId,decision:"return"});
 assert.equal(cancel.status,200,"Cancel "+await cancel.clone().text());
 assert.equal((await read(path("ingredients","pot"))).record.item.stock,3);
 assert.equal((await read(path("ingredients","potato"))).record.item.stock,1000);
 const again=await invoke("/v1/orders/cancel",{orderId,operationId:cancelId,decision:"return"});
 assert.equal(again.status,200);assert.equal((await again.json()).alreadyApplied,true);
 assert.equal((await read(path("ingredients","pot"))).record.item.stock,3);
 assert.equal(await read(path("packaging","pot")),null);
 console.log("PASS F02 LEGACY PACKAGING REST EMULATOR: same physical ingredient stock, approved price, reserve, shortage, cancel and idempotency; no shadow inventory");
}finally{
 all.push(path("orders","package-shortage"),root+"/workerEvents/f02-legacy-package-shortage-001");
 for(const p of [...new Set(all)].reverse())await fetch(base+"/documents/"+p,{method:"DELETE",headers}).catch(()=>{});
}
