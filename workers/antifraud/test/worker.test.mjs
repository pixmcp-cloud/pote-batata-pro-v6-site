import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerApp} from "../src/index.mjs";
import {recordPath} from "../src/domain.mjs";
import {FirestoreError} from "../src/firestore.mjs";
const UID="owner-qa-01",UNIVERSE="batataria";
const OP1="cb1b159a-7019-4cd0-9f33-a2bb87575b1d";
const OP2="51c5d180-b702-4e83-b099-a7b5e2695506";
const OP3="555580da-f470-45c9-bc96-1d4fab3cb47e6";
const clone=x=>structuredClone(x);
class MemoryFirestore{
 constructor(){this.docs=new Map();this.version=0}
 seed(path,data){this.docs.set(path,{data:clone(data),updateTime:"v"+(++this.version)})}
 current(path){return this.docs.get(path)?.data}
 transaction(){
  const database=this;let done=false;
  return {
   async get(path){return database.docs.has(path)?clone(database.docs.get(path)):null},
   async commit(writes){
    if(done)throw Error("committed");
    for(const write of writes){
     const existing=database.docs.get(write.path);
     if(write.precondition.exists===false&&existing)
      throw new FirestoreError(409,"ALREADY_EXISTS");
     if(write.precondition.updateTime&&existing?.updateTime!==write.precondition.updateTime)
      throw new FirestoreError(409,"ABORTED");
    }
    for(const w of writes)database.seed(w.path,w.data);
    done=true;return {commitTime:new Date().toISOString()}
   },
   async rollback(){done=true}
  }
 }
}
function makeStore(){
 const db=new MemoryFirestore(),root="users/"+UID;
 db.seed(root,{email:"qa@example.com",
  license:{status:"active",kind:"lifetime",term:"lifetime"}});
 db.seed(root+"/appState/v2",{schemaVersion:2,state:{data:{businessType:"batataria"}}});
 db.seed(root+"/appState/v2InventoryGuard",{revision:0});
 db.seed(root+"/appState/v2Pulse",{eventId:"previous",sensitive:false,changedKeys:[]});
 const order={id:"o1",status:"recebido",qty:2,price:35,
  paymentMethod:"Pix",paymentStatus:"pago",stockDeducted:false,
  items:[{id:"batata",g:100,yieldPct:80}],
  beverageItems:[{id:"suco",qty:1}]};
 const put=(group,id,item)=>db.seed(recordPath(UID,UNIVERSE,group,id),
  {record:{universe:UNIVERSE,group,id,rank:1,item}});
 put("orders","o1",order);
 put("ingredients","batata",{id:"batata",stock:400,name:"Batata"});
 put("beverages","suco",{id:"suco",stock:4,name:"Suco"});
 return {db,put};
}
const env={ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"true",FIREBASE_PROJECT_ID:"potobatata-b71f3",
 ALLOWED_ORIGINS:"https://pdv.livresom.com"};
const appFor=db=>createWorkerApp({
 verify:async token=>{
  if(token!=="test-token")throw Error("Bad token");
  return {uid:UID,email:"qa@example.com",isAdmin:false};
 },
 repository:()=>db,
 clock:()=>new Date("2026-11-18T16:00:00Z")
});
const request=(body,route="/v1/orders/produce",origin="https://pdv.livresom.com",
 token="test-token")=>new Request("https://example.workers.dev"+route,{
 method:"POST",headers:{"Origin":origin,"Authorization":"Bearer "+token,
  "Content-Type":"application/json"},body:JSON.stringify(body)
});
const payload=(operationId,extra={})=>({operationId,universe:UNIVERSE,orderId:"o1",...extra});
test("F02 purchase adjustment is atomic and idempotent",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const data={universe:UNIVERSE,operationId:OP1,group:"ingredients",
  itemId:"batata",delta:75,reason:"purchase"};
 const go=()=>app.fetch(request(data,"/v1/inventory/adjust"),env);
 const first=await go();
 assert.equal(first.status,200,await first.text());
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,475);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
 assert.equal((await(await go()).json()).alreadyApplied,true);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,475);
});test("F05 stock loss once",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const b={universe:UNIVERSE,operationId:OP2,group:"ingredients",itemId:"batata",delta:-20,reason:"loss",note:"higiene"};
 const fn=()=>app.fetch(request(b,"/v1/inventory/adjust"),env);
 assert.equal((await fn()).status,200);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,380);
 const e=db.current(recordPath(UID,UNIVERSE,"losses","cf-loss-"+OP2)).record.item;
 assert.equal(e.quantityBase,20);
 assert.equal(e.costKnown,false);
 assert.equal((await(await fn()).json()).alreadyApplied,true);
});test("F02 adjustment rejects oversubtraction",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const b={universe:UNIVERSE,operationId:OP3,group:"ingredients",itemId:"batata",delta:-999,reason:"loss"};
 assert.equal((await app.fetch(request(b,"/v1/inventory/adjust"),env)).status,409);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,400);
});test("staging mode fails closed, health exposes no customer data",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const health=await app.fetch(new Request("https://x/health"),{...env,ENABLE_WRITES:"false"});
 assert.equal(health.status,200);
 assert.deepEqual(await health.json(),{status:"ok",project:"pote-batata-pro",writesEnabled:false});
 const disabled=await app.fetch(request(payload(OP1)),{...env,ENABLE_WRITES:"false"});
 assert.equal(disabled.status,423);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,400);
});
test("real projects require second release approval even when writes are enabled",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const response=await app.fetch(request(payload(OP1)),
  {...env,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false"});
 assert.equal(response.status,423);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,400);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);
 const health=await app.fetch(new Request("https://x/health"),
  {...env,ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"false"});
 assert.equal((await health.json()).writesEnabled,false);
});
test("reject forged identity, cross-tenant body and unknown origin",async()=>{
 const {db}=makeStore(),app=appFor(db);
 assert.equal((await app.fetch(request(payload(OP1),undefined,undefined,"wrong"),env)).status,401);
 assert.equal((await app.fetch(request({...payload(OP1),uid:"another"}),env)).status,400);
 assert.equal((await app.fetch(request(payload(OP1),undefined,"https://evil.example"),env)).status,403);
 const resp=await app.fetch(request(payload(OP1)),env);
 assert.equal(resp.headers.get("Access-Control-Allow-Origin"),"https://pdv.livresom.com");
});
test("producing twice is idempotent with same key; new key cannot double charge stock",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const response=await app.fetch(request(payload(OP1)),env);
 assert.equal(response.status,200,await response.text());
 const result=await (await app.fetch(request(payload(OP1)),env)).json();
 assert.equal(result.alreadyApplied,true);
 const second=await app.fetch(request(payload(OP2)),env);
 assert.equal(second.status,409);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"orders","o1")).record.item.stockDeducted,true);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,150);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"beverages","suco")).record.item.stock,2);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
 assert.equal(db.current("users/"+UID+"/appState/v2Pulse").changedKeys.length,5);
 assert.equal([...db.docs.keys()].filter(x=>x.includes("workerEvents/")).length,1);
});
test("cancel after production returns physical stock once, or records a loss",async()=>{
 const {db}=makeStore(),app=appFor(db);
 assert.equal((await app.fetch(request(payload(OP1)),env)).status,200);
 const cancel=await app.fetch(request(payload(OP2,{decision:"return"}),"/v1/orders/cancel"),env);
 assert.equal(cancel.status,200,await cancel.text());
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,400);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"beverages","suco")).record.item.stock,4);
 const before=db.docs.size;
 const retry=await app.fetch(request(payload(OP2,{decision:"return"}),"/v1/orders/cancel"),env);
 assert.equal((await retry.json()).alreadyApplied,true);
 assert.equal(db.docs.size,before);
 assert.equal((await app.fetch(request(payload(OP3,{decision:"return"}),"/v1/orders/cancel"),env)).status,409);
});
test("concurrent stock consumption is at most once, with independent operation ids",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const responses=await Promise.all([OP1,OP2].map(id=>app.fetch(request(payload(id)),env)));
 assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,150);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
});
test("expired or Free tenant cannot bypass quotas through the Worker",async()=>{
 const {db}=makeStore(),app=appFor(db);
 db.seed("users/"+UID,{email:"qa@example.com",license:{status:"inactive"}});
 const denied=await app.fetch(request(payload(OP1)),env);
 assert.equal(denied.status,403);
 db.seed("users/"+UID,{email:"qa@example.com",license:{status:"active",kind:"lifetime",
  term:"lifetime"},accessPolicy:{blockedUniverses:["batataria"]}});
 assert.equal((await app.fetch(request(payload(OP1)),env)).status,403);
});
test("stock shortage does not write order, movements, pulse or journal",async()=>{
 const {db}=makeStore(),app=appFor(db);
 db.seed(recordPath(UID,UNIVERSE,"ingredients","batata"),
  {record:{universe:UNIVERSE,group:"ingredients",id:"batata",rank:1,
   item:{id:"batata",stock:2,name:"Batata"}}});
 const size=db.docs.size;
 const response=await app.fetch(request(payload(OP1)),env);
 assert.equal(response.status,409);
 assert.equal(db.docs.size,size);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);

});
