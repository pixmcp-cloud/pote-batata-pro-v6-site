import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerApp} from "../src/index.mjs";
import {recordPath} from "../src/domain.mjs";
import {serverPricePath} from "../src/server_price.mjs";
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
 db.seed(root+"/appState/v2OrderSequence__"+UNIVERSE,{version:1,universe:UNIVERSE,last:0});
 const order={id:"o1",status:"recebido",qty:2,price:35,
  paymentMethod:"Pix",paymentStatus:"pago",stockDeducted:false,
  items:[{id:"batata",g:100,yieldPct:80}],
  beverageItems:[{id:"suco",qty:1}]};
 const put=(group,id,item)=>db.seed(recordPath(UID,UNIVERSE,group,id),
  {record:{universe:UNIVERSE,group,id,rank:1,item}});
 put("orders","o1",order);
 put("ingredients","batata",{id:"batata",stock:400,name:"Batata"});
 put("beverages","suco",{id:"suco",stock:4,name:"Suco"});
 const approve=id=>{
  const recipe=db.current(recordPath(UID,UNIVERSE,"recipes",id)).record.item;
  db.seed(serverPricePath(UID,UNIVERSE,id),{
   version:1,universe:UNIVERSE,recipeId:id,
   salePriceCents:recipe.serverSalePriceCents,
   minimumGainPct:recipe.serverMinimumGainPct??100,
   revision:recipe.serverPriceRevision??1,
   items:recipe.items.map(item=>({id:item.id,g:item.g}))
  });
 };
 return {db,put,approve};
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
});test("F05 HTTP loss of packaging and addons is atomic, auditable and idempotent",async()=>{
 for(const [group,id,unit] of [["packaging","pot","un"],["addons","bacon","g"]]){
  const {db,put}=makeStore(),app=appFor(db);
  put(group,id,{id,stock:20,name:id,measureUnit:unit});
  const body={universe:UNIVERSE,operationId:OP1,group,itemId:id,
   delta:-2,reason:"loss",note:"Descarte sanitário"};
  const go=()=>app.fetch(request(body,"/v1/inventory/adjust"),env);
  const first=await go();
  assert.equal(first.status,200,await first.text());
  assert.equal(db.current(recordPath(UID,UNIVERSE,group,id)).record.item.stock,18);
  const movement=db.current(recordPath(UID,UNIVERSE,"stockMovements","cf-adjust-"+OP1)).record.item;
  const loss=db.current(recordPath(UID,UNIVERSE,"losses","cf-loss-"+OP1)).record.item;
  assert.equal(movement.stockGroup,group);
  assert.equal(loss.stockGroup,group);
  assert.equal(loss.quantityBase,2);
  assert.equal((await(await go()).json()).alreadyApplied,true);
  assert.equal(db.current(recordPath(UID,UNIVERSE,group,id)).record.item.stock,18);
 }
});
test("F02 adjustment rejects oversubtraction",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const b={universe:UNIVERSE,operationId:OP3,group:"ingredients",itemId:"batata",delta:-999,reason:"loss"};
 assert.equal((await app.fetch(request(b,"/v1/inventory/adjust"),env)).status,409);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,400);
});test("F02 concurrent losses cannot make negative stock",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const go=id=>app.fetch(request({universe:UNIVERSE,operationId:id,
  group:"ingredients",itemId:"batata",delta:-250,reason:"loss"},
  "/v1/inventory/adjust"),env);
 const responses=await Promise.all([go(OP1),go(OP2)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,150);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
});test("F20 operator receipt confirms stored amount once, without duplicate cash movement",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const p=recordPath(UID,UNIVERSE,"orders","o1");
 const old=db.current(p).record;
 db.seed(p,{record:{...old,item:{...old.item,status:"entregue",
  stockDeducted:true,paymentStatus:"pendente",cashSessionId:"s1"}}});
 db.seed(recordPath(UID,UNIVERSE,"cashSessions","s1"),
  {record:{universe:UNIVERSE,group:"cashSessions",id:"s1",rank:1,item:{status:"open"}}});
 const body={universe:UNIVERSE,operationId:OP3,orderId:"o1"};
 const go=()=>app.fetch(request(body,"/v1/orders/receipt"),env);
 const first=await go();
 assert.equal(first.status,200);
 assert.equal((await first.json()).amountCents,7000);
 assert.equal(db.current(p).record.item.paymentStatus,"pago");
 assert.equal(db.current(p).record.item.bankReconciled,false);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
 assert.equal((await(await go()).json()).alreadyApplied,true);
 assert.equal([...db.docs.keys()].filter(k=>k.includes("cashMovements")).length,0);
});test("F20 no receipt for an unfinished sale",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const body={universe:UNIVERSE,orderId:"o1",operationId:OP2};
 assert.equal((await app.fetch(request(body,"/v1/orders/receipt"),env)).status,409);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);
});test("F20 cash opening is atomic, idempotent and single-session",async()=>{
 const {db}=makeStore(),app=appFor(db),control="users/"+UID+"/appState/v2CashControl__"+UNIVERSE;
 db.seed(control,{version:1,activeSessionId:null});
 const body={universe:UNIVERSE,operationId:OP1,openingCashCents:5000,operator:"Caixa QA"};
 const go=()=>app.fetch(request(body,"/v1/cash/open"),env);
 const first=await go();assert.equal(first.status,200,await first.text());
 const reply=await (await go()).json();assert.equal(reply.alreadyApplied,true);
 const sessionId="cf-turn-"+OP1;
 const shift=db.current(recordPath(UID,UNIVERSE,"cashSessions",sessionId)).record.item;
 assert.equal(shift.openingCash,50);
 assert.equal(shift.status,"open");
 assert.equal(db.current(control).activeSessionId,sessionId);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
 const other={...body,operationId:OP2};
 assert.equal((await app.fetch(request(other,"/v1/cash/open"),env)).status,409);
 assert.equal(db.current(control).activeSessionId,sessionId);
});
test("F20 cash opening fails closed without migration and validates money",async()=>{
 const {db}=makeStore(),app=appFor(db);
 const body={universe:UNIVERSE,operationId:OP1,openingCashCents:0};
 assert.equal((await app.fetch(request(body,"/v1/cash/open"),env)).status,409);
 assert.equal((await app.fetch(request({...body,openingCashCents:"1000"},"/v1/cash/open"),env)).status,400);
 assert.equal((await app.fetch(request({...body,openingCashCents:-1},"/v1/cash/open"),env)).status,400);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);
});
test("F20 two concurrent cash openings have one winner",async()=>{
 const {db}=makeStore(),app=appFor(db),marker="users/"+UID+"/appState/v2CashControl__"+UNIVERSE;
 db.seed(marker,{version:1,activeSessionId:null});
 const attempt=operationId=>app.fetch(request({
  universe:UNIVERSE,operationId,openingCashCents:0
 },"/v1/cash/open"),env);
 const result=await Promise.all([attempt(OP1),attempt(OP2)]);
 assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);
 const active=db.current(marker).activeSessionId;
 assert(active==="cf-turn-"+OP1||active==="cf-turn-"+OP2);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,1);
});
test("F20 close cash shift once and release control for next opening",async()=>{
 const {db}=makeStore(),app=appFor(db),control="users/"+UID+"/appState/v2CashControl__"+UNIVERSE;
 db.seed(control,{version:1,activeSessionId:null});
 const opening={universe:UNIVERSE,operationId:OP1,openingCashCents:5000};
 assert.equal((await app.fetch(request(opening,"/v1/cash/open"),env)).status,200);
 const sessionId="cf-turn-"+OP1;
 const close={universe:UNIVERSE,operationId:OP2,sessionId,declaredCashCents:7200};
 const go=()=>app.fetch(request(close,"/v1/cash/close"),env);
 assert.equal((await go()).status,200);
 const session=db.current(recordPath(UID,UNIVERSE,"cashSessions",sessionId)).record.item;
 assert.equal(session.declaredClosingCash,72);
 assert.equal(session.reconciliationStatus,"pending");
 assert.equal(session.bankReconciled,false);
 assert.equal(db.current(control).activeSessionId,null);
 assert.equal((await(await go()).json()).alreadyApplied,true);
 assert.equal((await app.fetch(request({...close,operationId:OP3},"/v1/cash/close"),env)).status,409);
 assert.equal((await app.fetch(request({...opening,operationId:OP3},"/v1/cash/open"),env)).status,200);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,3);
});
test("F02 server-priced order creation persists once then produces using stored recipe",async()=>{
 const {db,put,approve}=makeStore(),app=appFor(db);
 put("recipes","r1",{id:"r1",name:"Batata teste",serverPriceVersion:1,
  serverSalePriceCents:3000,items:[{id:"batata",g:100}]});
 approve("r1");
 put("ingredients","batata",{id:"batata",stock:400,name:"Batata",
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open",openingCash:0});
 const body={universe:UNIVERSE,operationId:OP1,orderId:"new1",
  recipeId:"r1",qty:2,cashSessionId:"s1",paymentMethod:"pix"};
 const go=()=>app.fetch(request(body,"/v1/orders/create"),env);
 const created=await go();assert.equal(created.status,200,await created.text());
 const saved=db.current(recordPath(UID,UNIVERSE,"orders","new1")).record.item;
 assert.equal(saved.price,30);assert.equal(saved.paymentStatus,"pendente");
 assert.equal(saved.stockReservationStatus,"reserved");
 assert.equal(saved.stockDeducted,true);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,200);
 assert.equal((await(await go()).json()).alreadyApplied,true);
 assert.equal((await app.fetch(request({...body,qty:3},"/v1/orders/create"),env)).status,409);
 const produced=await app.fetch(request({operationId:OP2,universe:UNIVERSE,
  orderId:"new1"}),env);
 assert.equal(produced.status,200,await produced.text());
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,200);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"orders","new1")).record.item.stockReservationStatus,"consumed");
});
test("F02 order creation rejects client prices and missing authoritative price",async()=>{
 const {db,put}=makeStore(),app=appFor(db);
 put("recipes","r1",{id:"r1",name:"Batata",items:[{id:"batata",g:100}]});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const b={universe:UNIVERSE,operationId:OP1,orderId:"new1",
  recipeId:"r1",qty:2,cashSessionId:"s1",paymentMethod:"pix"};
 const go=data=>app.fetch(request(data,"/v1/orders/create"),env);
 assert.equal((await go({...b,price:0.01})).status,400);
 assert.equal((await go(b)).status,409);
 put("recipes","r1",{id:"r1",name:"Batata",serverPriceVersion:1,
  serverSalePriceCents:100,items:[{id:"batata",g:100}]});
 assert.equal((await go(b)).status,409);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"orders","new1")),undefined);
});
test("staging mode fails closed, health exposes no customer data",async()=>{
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

function finishFixture(method="Pix"){
 const {db}=makeStore(),app=appFor(db);
 const path=recordPath(UID,UNIVERSE,"orders","o1"),original=db.current(path).record;
 db.seed(path,{record:{...original,item:{...original.item,
  paymentMethod:method,paymentStatus:"pendente",cashSessionId:"s1"}}});
 const cashPath=recordPath(UID,UNIVERSE,"cashSessions","s1");
 db.seed(cashPath,{record:{universe:UNIVERSE,group:"cashSessions",
  id:"s1",rank:1,item:{status:"open"}}});
 return {db,app,path,cashPath};
}
test("F20 finish: one-click Pix receipt without duplicate PDV credit",async()=>{
 const {db,app,path}=finishFixture("Pix");
 assert.equal((await app.fetch(request(payload(OP1)),env)).status,200);
 const docsBefore=db.docs.size;
 const finish=()=>app.fetch(request(payload(OP2),"/v1/orders/finish"),env);
 const first=await finish();
 assert.equal(first.status,200);
 const receipt=await first.json();
 assert.equal(receipt.receiptRecorded,true);
 assert.equal(receipt.bankReconciled,false);
 const order=db.current(path).record.item;
 assert.equal(order.status,"entregue");
 assert.equal(order.paymentStatus,"pago");
 assert.equal(order.paymentDeclarationSource,"operator");
 assert.equal(db.docs.size,docsBefore+1,"Only worker journal may be added");
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,2);
 assert.equal((await (await finish()).json()).alreadyApplied,true);
 assert.equal((await app.fetch(request(payload(OP3),"/v1/orders/finish"),env)).status,409);
});
test("F20 finish: payment on delivery stays pending",async()=>{
 const {db,app,path}=finishFixture("Cart?o na entrega");
 assert.equal((await app.fetch(request(payload(OP1)),env)).status,200);
 const result=await app.fetch(request(payload(OP2),"/v1/orders/finish"),env);
 assert.equal(result.status,200);
 assert.equal((await result.json()).receiptRecorded,false);
 const order=db.current(path).record.item;
 assert.equal(order.status,"entregue");
 assert.equal(order.paymentStatus,"pendente");
 assert.equal(order.paymentConfirmedAt,undefined);
});
test("F20 finish: closed shift cannot silently confirm sale",async()=>{
 const {db,app,path,cashPath}=finishFixture("Dinheiro");
 assert.equal((await app.fetch(request(payload(OP1)),env)).status,200);
 db.seed(cashPath,{record:{universe:UNIVERSE,group:"cashSessions",
  id:"s1",rank:1,item:{status:"closed"}}});
 assert.equal((await app.fetch(request(payload(OP2),"/v1/orders/finish"),env)).status,409);
 assert.equal(db.current(path).record.item.status,"em_producao");
 assert.equal(db.current(path).record.item.paymentStatus,"pendente");
});


test("F02 reservation once: stock deducted when ordering, not again when producing",async()=>{
 const {db,put,approve}=makeStore(),app=appFor(db);
 put("recipes","r2",{id:"r2",name:"Batata Reserva",serverPriceVersion:1,
  serverSalePriceCents:4000,items:[{id:"batata",g:100}]});
 approve("r2");
 put("ingredients","batata",{id:"batata",stock:400,name:"Batata",
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const b={universe:UNIVERSE,operationId:OP1,orderId:"reserved1",
  recipeId:"r2",qty:2,cashSessionId:"s1",paymentMethod:"pix"};
 assert.equal((await app.fetch(request(b,"/v1/orders/create"),env)).status,200);
 const doc=recordPath(UID,UNIVERSE,"ingredients","batata");
 const order=recordPath(UID,UNIVERSE,"orders","reserved1");
 assert.equal(db.current(doc).record.item.stock,200);
 const size=db.docs.size;
 assert.equal((await (await app.fetch(request(b,"/v1/orders/create"),env)).json()).alreadyApplied,true);
 assert.equal(db.docs.size,size);
 assert.equal((await app.fetch(request({universe:UNIVERSE,orderId:"reserved1",
  operationId:OP2},"/v1/orders/produce"),env)).status,200);
 assert.equal(db.current(doc).record.item.stock,200,"Production must not double-deduct reservation");
 assert.equal(db.current(order).record.item.stockReservationStatus,"consumed");
 assert.equal([...db.docs.keys()].filter(x=>x.includes("/workerEvents/")).length,2);
});
test("F02 reservation cancellation restores ingredients exactly once",async()=>{
 const {db,put,approve}=makeStore(),app=appFor(db);
 put("recipes","r2",{id:"r2",name:"Reserva",serverPriceVersion:1,
  serverSalePriceCents:4000,items:[{id:"batata",g:100}]});
 approve("r2");
 put("ingredients","batata",{id:"batata",stock:400,name:"Batata",
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const b={universe:UNIVERSE,operationId:OP1,orderId:"reserve-cancel",
  recipeId:"r2",qty:2,cashSessionId:"s1",paymentMethod:"cash"};
 assert.equal((await app.fetch(request(b,"/v1/orders/create"),env)).status,200);
 const stockPath=recordPath(UID,UNIVERSE,"ingredients","batata");
 assert.equal(db.current(stockPath).record.item.stock,200);
 const cancel={universe:UNIVERSE,orderId:"reserve-cancel",
  operationId:OP2,decision:"return"};
 assert.equal((await app.fetch(request(cancel,"/v1/orders/cancel"),env)).status,200);
 assert.equal(db.current(stockPath).record.item.stock,400);
 assert.equal((await (await app.fetch(request(cancel,"/v1/orders/cancel"),env)).json()).alreadyApplied,true);
 assert.equal(db.current(stockPath).record.item.stock,400);
});
test("F02 duplicate ingredient entries are summed before stock reservation",async()=>{
 const {db,put,approve}=makeStore(),app=appFor(db);
 put("recipes","r2",{id:"r2",name:"Reserva",serverPriceVersion:1,
  serverSalePriceCents:4000,items:[{id:"batata",g:75},{id:"batata",g:75}]});
 approve("r2");
 put("ingredients","batata",{id:"batata",stock:250,name:"Batata",
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const b={universe:UNIVERSE,operationId:OP1,orderId:"duplicate-fail",
  recipeId:"r2",qty:2,cashSessionId:"s1",paymentMethod:"pix"};
 assert.equal((await app.fetch(request(b,"/v1/orders/create"),env)).status,409,
  "300g total is more than 250g on hand");
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,250);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"orders","duplicate-fail")),undefined);
 put("ingredients","batata",{id:"batata",stock:350,name:"Batata",
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 assert.equal((await app.fetch(request({...b,operationId:OP2,
  orderId:"duplicate-ok"},"/v1/orders/create"),env)).status,200);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,50);
});
test("F02 concurrent creates cannot oversell same 400g ingredient",async()=>{
 const {db,put,approve}=makeStore(),app=appFor(db);
 put("recipes","r2",{id:"r2",name:"Batata Reserva",serverPriceVersion:1,
  serverSalePriceCents:4000,items:[{id:"batata",g:125}]});
 approve("r2");
 put("ingredients","batata",{id:"batata",stock:400,name:"Batata",
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const data=(operationId,orderId)=>({universe:UNIVERSE,operationId,
  orderId,recipeId:"r2",qty:2,cashSessionId:"s1",paymentMethod:"pix"});
 const result=await Promise.all([
  app.fetch(request(data(OP1,"order-one"),"/v1/orders/create"),env),
  app.fetch(request(data(OP2,"order-two"),"/v1/orders/create"),env)
 ]);
 assert.deepEqual(result.map(x=>x.status).sort(),[200,409]);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata")).record.item.stock,150);
 assert.equal(["order-one","order-two"].filter(x=>db.current(
  recordPath(UID,UNIVERSE,"orders",x))).length,1);
});


test("F02 owner can approve an actual price and immediately create a guarded order",async()=>{
 const {db,put}=makeStore(),app=appFor(db);
 put("recipes","catalog-r1",{id:"catalog-r1",name:"Batata",
  items:[{id:"batata",g:100}],targetGainPct:100});
 put("ingredients","batata",{id:"batata",name:"Batata",stock:400,
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const body={universe:UNIVERSE,operationId:OP1,recipeId:"catalog-r1",
  salePriceCents:3000};
 const action=()=>app.fetch(request(body,"/v1/catalog/approve-price"),env);
 const approved=await action();assert.equal(approved.status,200,await approved.text());
 const approval=db.current(serverPricePath(UID,UNIVERSE,"catalog-r1"));
 assert.equal(approval.salePriceCents,3000);
 assert.equal(approval.revision,1);
 assert.equal(approval.minimumGainPct,100);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"recipes","catalog-r1"))
  .record.item.serverSalePriceCents,3000);
 assert.equal((await (await action()).json()).alreadyApplied,true);
 assert.equal((await app.fetch(request({...body,salePriceCents:1},
  "/v1/catalog/approve-price"),env)).status,409);
 const sale={universe:UNIVERSE,operationId:OP2,orderId:"catalog-sale-1",
  recipeId:"catalog-r1",qty:1,cashSessionId:"s1",paymentMethod:"pix"};
 const placed=await app.fetch(request(sale,"/v1/orders/create"),env);
 assert.equal(placed.status,200,await placed.text());
 assert.equal(db.current(recordPath(UID,UNIVERSE,"orders","catalog-sale-1"))
  .record.item.price,30);
 assert.equal(db.current(recordPath(UID,UNIVERSE,"ingredients","batata"))
  .record.item.stock,300);
});
test("F02 backend refuses approval below cost and unpriced recipes",async()=>{
 const {db,put}=makeStore(),app=appFor(db);
 put("recipes","catalog-r2",{id:"catalog-r2",name:"Insumos",
  items:[{id:"batata",g:100}],targetGainPct:100});
 put("ingredients","batata",{id:"batata",name:"Batata",stock:400,
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 const body={universe:UNIVERSE,operationId:OP1,recipeId:"catalog-r2",
  salePriceCents:100};
 assert.equal((await app.fetch(request(body,"/v1/catalog/approve-price"),env)).status,409);
 assert.equal(db.current(serverPricePath(UID,UNIVERSE,"catalog-r2")),undefined);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);
 put("recipes","catalog-r2",{id:"catalog-r2",name:"Preço estimado",
  costEstimateMode:"estimated",items:[{id:"batata",g:100}]});
 assert.equal((await app.fetch(request({...body,salePriceCents:3000},
  "/v1/catalog/approve-price"),env)).status,409);
});
test("F02 price reapproval revisions invalidate old quantities",async()=>{
 const {db,put}=makeStore(),app=appFor(db);
 const old={id:"catalog-r3",name:"Batata",items:[{id:"batata",g:100}],
  targetGainPct:100};
 put("recipes","catalog-r3",old);
 put("ingredients","batata",{id:"batata",name:"Batata",stock:400,
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 put("cashSessions","s1",{id:"s1",status:"open"});
 const go=(operationId,salePriceCents)=>app.fetch(request({
  universe:UNIVERSE,operationId,recipeId:"catalog-r3",salePriceCents
 },"/v1/catalog/approve-price"),env);
 assert.equal((await go(OP1,3000)).status,200);
 const prior=db.current(recordPath(UID,UNIVERSE,"recipes","catalog-r3")).record.item;
 put("recipes","catalog-r3",{...prior,items:[{id:"batata",g:120}]});
 const attempt={universe:UNIVERSE,operationId:OP2,orderId:"new-price-stale",
  recipeId:"catalog-r3",qty:1,cashSessionId:"s1",paymentMethod:"pix"};
 assert.equal((await app.fetch(request(attempt,"/v1/orders/create"),env)).status,409,
  "Stale price approval must reject changed ingredient quantities");
 assert.equal((await go(OP3,3500)).status,200);
 const current=db.current(serverPricePath(UID,UNIVERSE,"catalog-r3"));
 assert.equal(current.revision,2);
 assert.deepEqual(current.items,[{id:"batata",g:120}]);
 const sale=await app.fetch(request({...attempt,
  operationId:"76aaf9b2-ef09-4340-b2b8-289452606372",orderId:"new-price-ok"},
  "/v1/orders/create"),env);
 assert.equal(sale.status,200,await sale.text());
 assert.equal(db.current(recordPath(UID,UNIVERSE,"orders","new-price-ok"))
  .record.item.serverPriceRevision,2);
});


test("F02 Free tenant and disabled Worker cannot approve catalog prices",async()=>{
 const {db,put}=makeStore(),app=appFor(db);
 put("recipes","limited",{id:"limited",name:"Limited",
  items:[{id:"batata",g:100}],targetGainPct:100});
 put("ingredients","batata",{id:"batata",name:"Batata",stock:400,
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g"});
 const body={universe:UNIVERSE,operationId:OP1,recipeId:"limited",
  salePriceCents:3000};
 const route="/v1/catalog/approve-price";
 assert.equal((await app.fetch(request(body,route),
  {...env,ENABLE_WRITES:"false"})).status,423);
 assert.equal(db.current(serverPricePath(UID,UNIVERSE,"limited")),undefined);
 db.seed("users/"+UID,{email:"qa@example.com",license:{status:"inactive",kind:"free"}});
 assert.equal((await app.fetch(request(body,route),env)).status,403);
 assert.equal(db.current(serverPricePath(UID,UNIVERSE,"limited")),undefined);
 assert.equal(db.current("users/"+UID+"/appState/v2InventoryGuard").revision,0);
});
