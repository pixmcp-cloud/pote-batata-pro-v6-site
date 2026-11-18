/**
 * Real Cloud Firestore REST smoke test, exclusively for the no-billing QA project.
 * Credentials are never loaded by this file or committed. A short-lived OAuth
 * bearer is injected by the authorized local test launcher via an env variable.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createWorkerApp} from "../workers/antifraud/src/index.mjs";
import {createFirestoreRepository,encodeFields,decodeFields}
 from "../workers/antifraud/src/firestore.mjs";
import {recordPath} from "../workers/antifraud/src/domain.mjs";

const PROJECT="pote-batata-qa-20261118",DB="projects/"+PROJECT+"/databases/(default)";
const BASE="https://firestore.googleapis.com/v1/"+DB,ORIGIN="https://pdv.livresom.com";
const token=process.env.POTE_QA_ACCESS_TOKEN;
const uid="qa-worker-rest-"+randomUUID(),root="users/"+uid,universe="batataria";
if(!token||token.length<50)throw Error("A short-lived QA access token is required");
const full=p=>DB+"/documents/"+p.split("/").map(encodeURIComponent).join("/");
const key=(group,id)=>recordPath(uid,universe,group,id);
const row=(group,id,item)=>({record:{universe,group,id,rank:1,item}});
const order=(id,grams=100,withWater=true)=>({id,status:"recebido",stockDeducted:false,qty:2,price:30,
 paymentMethod:"Pix",paymentStatus:"Informado",
 items:[{id:"potato",g:grams,yieldPct:100}],beverageItems:withWater?[{id:"water",qty:1}]:[]});
async function http(url,body,method="GET"){
 const response=await fetch(url,{
  method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(12000)
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error("QA Cloud REST "+response.status+" "+
  String(result.error?.status||"unknown"));
 return result;
}
const authFetch=(path,body,method)=>http(BASE+path,body,method);
async function seed(){
 const docs=[
  [root,{license:{status:"active",kind:"lifetime",term:"lifetime"}}],
  [root+"/appState/v2",{schemaVersion:2,migration:{status:"complete"}}],
  [root+"/appState/v2InventoryGuard",{revision:0}],
  [root+"/appState/v2Pulse",{eventId:"seed",sensitive:false,changedKeys:[]}],
  [key("orders","o1"),row("orders","o1",order("o1"))],
  [key("orders","o2"),row("orders","o2",order("o2",400,false))],
  [key("orders","o3"),row("orders","o3",order("o3",400,false))],
  [key("orders","o4"),row("orders","o4",{
   ...order("o4"),status:"entregue",stockDeducted:true,
   cashSessionId:"s1",paymentStatus:"pendente"})],
  [key("cashSessions","s1"),row("cashSessions","s1",{
   id:"s1",status:"open",openingCash:0})],
  [key("ingredients","potato"),row("ingredients","potato",{id:"potato",name:"Batata",stock:1000})],
  [key("beverages","water"),row("beverages","water",{id:"water",name:"Água",stock:10})]
 ];
 await authFetch("/documents:commit",{writes:docs.map(([path,doc])=>({
  update:{name:full(path),fields:encodeFields(doc)},
  currentDocument:{exists:false},
  updateTransforms:[{fieldPath:"updatedAt",setToServerValue:"REQUEST_TIME"}]
 }))},"POST");
}
async function read(path){
 const doc=await authFetch("/documents/"+path.split("/").map(encodeURIComponent).join("/"));
 return decodeFields(doc.fields);
}
async function cleanup(){
 if(!/^qa-worker-rest-[0-9a-f-]{36}$/.test(uid))throw Error("Unsafe cleanup prefix");
 const names=[full(root)];
 for(const collection of ["appState","records","workerEvents"]){
  const listing=await authFetch("/documents/"+root+"/"+collection+"?pageSize=250");
  for(const item of listing.documents||[]){
   if(!item.name.startsWith(DB+"/documents/"+root+"/"))throw Error("Unscoped cleanup");
   names.push(item.name);
  }
 }
 for(let n=0;n<names.length;n+=70)
  await authFetch("/documents:commit",{
   writes:names.slice(n,n+70).map(name=>({delete:name}))
  },"POST");
 return names.length;
}
async function run(){
 const billing=await http("https://cloudbilling.googleapis.com/v1/projects/"+PROJECT+"/billingInfo");
 assert.equal(billing.billingEnabled,false);
 const database=await http("https://firestore.googleapis.com/v1/"+DB);
 assert.equal(database.freeTier,true);
 assert.equal(database.databaseEdition,"STANDARD");
 const env={ENABLE_WRITES:"true",PRODUCTION_CUTOVER_APPROVED:"true",
  FIREBASE_PROJECT_ID:PROJECT,ALLOWED_ORIGINS:ORIGIN};
 const worker=createWorkerApp({
  verify:async()=>({uid,email:"qa@invalid.example",isAdmin:false}),
  repository:()=>createFirestoreRepository(env,{requestFetch:fetch,
   accessToken:async()=>token}),
  clock:()=>new Date()
 });
 const req=(op,action="produce",decision,orderId="o1")=>new Request(
  "https://worker.qa.invalid/v1/orders/"+action,{
   method:"POST",headers:{Origin:ORIGIN,Authorization:"Bearer synthetic-qa-token",
    "Content-Type":"application/json"},
   body:JSON.stringify({universe,orderId,operationId:op,
    ...(decision?{decision}:{})})
  });
 const op1=randomUUID(),op2=randomUUID(),op3=randomUUID(),op4=randomUUID(),op5=randomUUID();
 let started=false;
 try{
  await seed();started=true;
  assert.equal((await worker.fetch(req(op1),{...env,PRODUCTION_CUTOVER_APPROVED:"false"})).status,
   423,"Local QA must preserve disabled cutover gate");
  const first=await worker.fetch(req(op1),env);
  assert.equal(first.status,200,JSON.stringify(await first.json()));
  assert.equal((await read(key("ingredients","potato"))).record.item.stock,800);
  assert.equal((await read(key("beverages","water"))).record.item.stock,8);
  assert.equal((await (await worker.fetch(req(op1),env)).json()).alreadyApplied,true);
  const cancelled=await worker.fetch(req(op2,"cancel","return"),env);
  assert.equal(cancelled.status,200,JSON.stringify(await cancelled.json()));
  assert.equal((await read(key("ingredients","potato"))).record.item.stock,1000);
  assert.equal((await read(key("beverages","water"))).record.item.stock,10);
  assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,2);
  const race=await Promise.all([
   worker.fetch(req(op3,"produce",undefined,"o2"),env),
   worker.fetch(req(op4,"produce",undefined,"o3"),env)
  ]);
  const statuses=race.map(r=>r.status).sort((a,b)=>a-b);
  assert.deepEqual(statuses,[200,409],
   "Two simultaneous REST orders must not oversell 1000g; got "+statuses);
  assert.equal((await read(key("ingredients","potato"))).record.item.stock,200);
  const winner=race[0].status===200?"o2":"o3";
  const loser=winner==="o2"?"o3":"o2";
  const loss=await worker.fetch(req(op5,"cancel","loss",winner),env);
  assert.equal(loss.status,200,JSON.stringify(await loss.json()));
  assert.equal((await read(key("ingredients","potato"))).record.item.stock,200);
  assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,4);
  const rejected=await worker.fetch(req(randomUUID(),"produce",undefined,loser),env);
  assert.equal(rejected.status,409);
  assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,4);
  const adjustmentId=randomUUID();
  const adjustBody={operationId:adjustmentId,universe,group:"ingredients",
   itemId:"potato",delta:500,reason:"purchase",note:"Reposição teste QA"};
  const adjustReq=()=>new Request("https://worker.qa.invalid/v1/inventory/adjust",{
   method:"POST",headers:{Origin:ORIGIN,Authorization:"Bearer synthetic-qa-token",
    "Content-Type":"application/json"},body:JSON.stringify(adjustBody)
  });
  const added=await worker.fetch(adjustReq(),env);
  assert.equal(added.status,200,JSON.stringify(await added.json()));
  assert.equal((await read(key("ingredients","potato"))).record.item.stock,700);
  assert.equal((await(await worker.fetch(adjustReq(),env)).json()).alreadyApplied,true);
  assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,5);  const lossPayload={...adjustBody,operationId:randomUUID(),
   delta:-50,reason:"loss",note:"Descarte QA"};
  const lossRequest=new Request("https://worker.qa.invalid/v1/inventory/adjust",{
   method:"POST",headers:{Origin:ORIGIN,Authorization:"Bearer synthetic-qa-token",
    "Content-Type":"application/json"},body:JSON.stringify(lossPayload)
  });
  assert.equal((await worker.fetch(lossRequest,env)).status,200);
  assert.equal((await read(key("ingredients","potato"))).record.item.stock,650);
  assert.equal((await read(key("losses","cf-loss-"+lossPayload.operationId))).record.item.quantityBase,50);
  assert.equal((await read(root+"/appState/v2InventoryGuard")).revision,6);
  console.log("QA_LIVE_REST_WORKER_PASS project="+PROJECT+
   " effects=produce/retry/cancel/race/loss/stock/guard");
 }finally{
  if(started){
   const deleted=await cleanup();
   console.log("QA_LIVE_REST_SYNTHETIC_CLEANUP="+deleted);
  }
 }
}
run().catch(error=>{
 console.error("QA_LIVE_REST_WORKER_FAIL",String(error.message).slice(0,350));
 process.exitCode=1;
});
