import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerApp} from "../src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields} from "../src/firestore.mjs";
import {recordPath} from "../src/domain.mjs";

/* F02/F05: complete Worker -> Firestore REST-adapter integration with an
 * in-memory HTTP Firestore protocol double. No Google keys or customer data.
 * This is NOT a substitute for real Cloud Firestore REST acceptance tests.
 */
const UID="rest-owner-1",UNIVERSE="batataria",PROJECT="demo-pote-rest";
const base="projects/"+PROJECT+"/databases/(default)";
const apiPrefix="http://firestore-emulated.local/v1/"+base;
const rpath=(group,id)=>recordPath(UID,UNIVERSE,group,id);
const op1="12345678-ae12-4d62-9f33-123456789001";
const op2="12345678-ae12-4d62-9f33-123456789002";
const op3="12345678-ae12-4d62-9f33-123456789003";
const clone=x=>structuredClone(x);
const response=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json"}
});
class HttpFirestoreDouble{
 constructor(){
  this.docs=new Map();
  this.version=0;
  this.httpCalls=[];
  this.commits=0;
 }
 seed(path,data){
  this.docs.set(path,{data:clone(data),updateTime:"v"+(++this.version)});
 }
 read(path){return clone(this.docs.get(path)?.data)}
 async fetch(url,options={}){
  const parsed=new URL(url),path=parsed.pathname,method=options.method||"GET";
  assert.equal(options.headers?.Authorization,"Bearer synthetic-service-token");
  this.httpCalls.push(method+" "+path);
  if(path.endsWith("/documents:beginTransaction")&&method==="POST")
   return response({transaction:"c3ludGhldGljLXR4"});
  if(path.endsWith("/documents:rollback")&&method==="POST")return response({});
  if(path.endsWith("/documents:commit")&&method==="POST"){
   const {transaction,writes}=JSON.parse(options.body||"{}");
   assert.equal(transaction,"c3ludGhldGljLXR4");
   assert(Array.isArray(writes)&&writes.length>0);
   // Yield once to make concurrent Worker transactions overlap.
   await Promise.resolve();
   for(const write of writes){
    const docPrefix=base+"/documents/";
    assert(write.update.name.startsWith(docPrefix));
    const name=decodeURIComponent(write.update.name.slice(docPrefix.length));
    const previous=this.docs.get(name);
    const condition=write.currentDocument;
    if(condition?.exists===false&&previous)return response({error:{status:"ALREADY_EXISTS"}},409);
    if(condition?.updateTime&&condition.updateTime!==previous?.updateTime)
     return response({error:{status:"ABORTED"}},409);
    assert.deepEqual(write.updateTransforms,[{
     fieldPath:"updatedAt",setToServerValue:"REQUEST_TIME"
    }]);
   }
   for(const write of writes){
    const name=decodeURIComponent(write.update.name.slice((base+"/documents/").length));
    const obj=decodeFields(write.update.fields);
    obj.updatedAt="2026-11-18T16:00:00Z";
    this.seed(name,obj);
   }
   this.commits++;
   return response({commitTime:"2026-11-18T16:00:00Z"});
  }
  const docMarker="/documents/";
  const pos=path.indexOf(docMarker);
  if(method==="GET"&&pos>=0){
   const name=decodeURIComponent(path.slice(pos+docMarker.length));
   const found=this.docs.get(name);
   if(!found)return new Response("Not found",{status:404});
   return response({name:base+"/documents/"+name,fields:encodeFields(found.data),
    updateTime:found.updateTime});
  }
  return response({error:{status:"UNEXPECTED_REST_CALL"}},501);
 }
}
function fixture({stock=400,extraOrder=false}={}){
 const db=new HttpFirestoreDouble(),root="users/"+UID;
 db.seed(root,{email:"owner@invalid.example",
  license:{status:"active",kind:"lifetime",term:"lifetime"}});
 db.seed(root+"/appState/v2",{schemaVersion:2,migration:{status:"complete"}});
 db.seed(root+"/appState/v2InventoryGuard",{revision:0});
 db.seed(root+"/appState/v2Pulse",{eventId:"seed",changedKeys:[],sensitive:false});
 const order=id=>({id,status:"recebido",qty:2,price:30,stockDeducted:false,
  paymentMethod:"Pix",paymentStatus:"Informado",
  items:[{id:"batata",g:100,yieldPct:80}],
  beverageItems:[{id:"suco",qty:1}]});
 function put(group,id,item){
  db.seed(rpath(group,id),{record:{universe:UNIVERSE,group,id,rank:1,item}});
 }
 put("orders","o1",order("o1"));
 if(extraOrder)put("orders","o2",order("o2"));
 put("ingredients","batata",{id:"batata",stock,name:"Batata"});
 put("beverages","suco",{id:"suco",stock:4,name:"Suco"});
 const env={FIREBASE_PROJECT_ID:PROJECT,ENABLE_WRITES:"true",
  ALLOWED_ORIGINS:"https://pdv.livresom.com"};
 const app=createWorkerApp({
  verify:async token=>{
   if(token!=="synthetic-firebase")throw Error("Bad Firebase token");
   return {uid:UID,email:"owner@invalid.example",isAdmin:false}
  },
  repository:()=>createFirestoreRepository(env,{
   requestFetch:db.fetch.bind(db),
   accessToken:async()=>"synthetic-service-token",
   apiBaseUrl:apiPrefix
  }),
  clock:()=>new Date("2026-11-18T16:00:00Z")
 });
 function request(operationId,{action="produce",orderId="o1",decision}={}){
  return new Request("https://worker.local/v1/orders/"+action,{
   method:"POST",
   headers:{"Authorization":"Bearer synthetic-firebase",
    "Origin":"https://pdv.livresom.com","Content-Type":"application/json"},
   body:JSON.stringify({universe:UNIVERSE,orderId,operationId,
    ...(decision?{decision}:{})})
  });
 }
 const send=(operationId,props)=>app.fetch(request(operationId,props),env);
 return {db,env,app,send,request};
}
test("F02 REST HTTP: server-approved recipe creates order then produces once",async()=>{
 const {db,env,app,send,request}=fixture();
 const put=(group,id,item)=>db.seed(rpath(group,id),{
  record:{universe:UNIVERSE,group,id,rank:1,item}});
 put("recipes","r1",{id:"r1",name:"Batata QA",serverPriceVersion:1,
  serverSalePriceCents:3000,items:[{id:"batata",g:100}]});
 put("cashSessions","s1",{id:"s1",status:"open"});
 put("ingredients","batata",{id:"batata",name:"Batata",stock:400,
  purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"});
 const baseReq=request(op1);
 const body={universe:UNIVERSE,operationId:op1,orderId:"fresh",
  recipeId:"r1",qty:2,cashSessionId:"s1",paymentMethod:"pix"};
 const go=()=>app.fetch(new Request("https://worker.local/v1/orders/create",{
  method:"POST",headers:baseReq.headers,body:JSON.stringify(body)}),env);
 const first=await go();assert.equal(first.status,200,await first.text());
 assert.equal(db.read(rpath("orders","fresh")).record.item.price,30);
 assert.equal((await(await go()).json()).alreadyApplied,true);
 assert.equal(db.read(rpath("ingredients","batata")).record.item.stock,200,
  "Ingredients were reserved at order creation");
 assert.equal(db.read(rpath("orders","fresh")).record.item.stockReservationStatus,"reserved");
 assert.equal((await send(op2,{orderId:"fresh"})).status,200);
 assert.equal(db.read(rpath("ingredients","batata")).record.item.stock,200);
});
test("F02 end-to-end REST HTTP adapter: stock, beverage, pulse and retry",async()=>{
 const {db,send}=fixture();
 const first=await send(op1);
 assert.equal(first.status,200,JSON.stringify(await first.json()));
 assert.equal(db.read(rpath("ingredients","batata")).record.item.stock,150);
 assert.equal(db.read(rpath("beverages","suco")).record.item.stock,2);
 assert.equal(db.read("users/"+UID+"/appState/v2InventoryGuard").revision,1);
 assert.equal(db.read("users/"+UID+"/appState/v2Pulse").origin,"cloudflare-worker");
 assert.equal(db.read(rpath("orders","o1")).record.item.stockDeducted,true);
 const count=db.commits;
 assert.equal((await (await send(op1)).json()).alreadyApplied,true);
 assert.equal(db.commits,count,"Retry cannot commit a second ledger");
 assert(db.httpCalls.some(x=>x.includes("/documents:beginTransaction")));
 assert(db.httpCalls.some(x=>x.includes("/documents:commit")));
 assert(db.httpCalls.some(x=>x.includes("/documents/users/")));
});
test("F05 end-to-end REST: cancel restores physical stock exactly once",async()=>{
 const {db,send}=fixture();
 assert.equal((await send(op1)).status,200);
 const cancel=await send(op2,{action:"cancel",decision:"return"});
 assert.equal(cancel.status,200,await cancel.text());
 assert.equal(db.read(rpath("ingredients","batata")).record.item.stock,400);
 assert.equal(db.read(rpath("beverages","suco")).record.item.stock,4);
 const commits=db.commits;
 assert.equal((await (await send(op2,{action:"cancel",decision:"return"})).json()).alreadyApplied,true);
 assert.equal(db.commits,commits);
 assert.equal((await send(op3,{action:"cancel",decision:"return"})).status,409);
});
test("F05 end-to-end REST: cancellation loss does not restore ingredients",async()=>{
 const {db,send}=fixture();
 assert.equal((await send(op1)).status,200);
 const cancel=await send(op2,{action:"cancel",decision:"loss"});
 assert.equal(cancel.status,200,await cancel.text());
 assert.equal(db.read(rpath("ingredients","batata")).record.item.stock,150);
 assert.equal(db.read(rpath("beverages","suco")).record.item.stock,2);
 assert.equal(db.read(rpath("orders","o1")).record.item.status,"cancelado");
});
test("F02 REST HTTP: competing orders cannot oversell same stock",async()=>{
 const {db,send}=fixture({extraOrder:true});
 const [a,b]=await Promise.all([
  send(op1,{orderId:"o1"}),send(op2,{orderId:"o2"})
 ]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 assert.equal(db.read(rpath("ingredients","batata")).record.item.stock,150);
 assert.equal(db.read(rpath("beverages","suco")).record.item.stock,2);
 assert.equal(db.read("users/"+UID+"/appState/v2InventoryGuard").revision,1);
});
test("F02 REST HTTP: shortage and denied user never commit",async()=>{
 const {db,send,app,env}=fixture({stock:2});
 assert.equal((await send(op1)).status,409);
 assert.equal(db.commits,0);
 db.seed("users/"+UID,{email:"owner@invalid.example",
  license:{status:"inactive",kind:"trial"}});
 assert.equal((await send(op2)).status,403);
 assert.equal(db.commits,0);
 const health=await app.fetch(new Request("https://worker.local/health"),env);
 assert.equal((await health.json()).writesEnabled,true,"demo only test gate");
});
