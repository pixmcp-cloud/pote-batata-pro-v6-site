import test from "node:test";
import assert from "node:assert/strict";
import {createWorkerApp} from "../src/index.mjs";
import {FirestoreError} from "../src/firestore.mjs";
import {recordPath} from "../src/domain.mjs";
import {serverPricePath} from "../src/server_price.mjs";

// HTTP contract test with an optimistic-transaction double. Real REST/Firestore
// concurrency must still be exercised separately against a demo emulator.
const uid="f02-http-qa",universe="qa",recipeId="simple";
const root="users/"+uid;
const ingredient=recordPath(uid,universe,"ingredients","flour");
const recipe=recordPath(uid,universe,"recipes",recipeId);
const approval=serverPricePath(uid,universe,recipeId);
const clone=x=>structuredClone(x);
class Store {
 constructor(){this.docs=new Map();this.seq=0;this.beforeCommit=null}
 seed(path,data){this.docs.set(path,{data:clone(data),updateTime:"v"+(++this.seq)})}
 get(path){return this.docs.get(path)?.data}
 transaction(){
  const reads=new Map(),store=this;
  return {async get(path){
   const doc=store.docs.get(path);
   reads.set(path,doc?.updateTime??null);
   return doc?clone(doc):null;
  },async commit(writes){
   if(store.beforeCommit){const hook=store.beforeCommit;store.beforeCommit=null;await hook(store)}
   for(const [path,version] of reads){
    if((store.docs.get(path)?.updateTime??null)!==version)
     throw new FirestoreError(409,"ABORTED");
   }
   for(const w of writes){
    const current=store.docs.get(w.path);
    if(w.precondition?.exists===false&&current)throw new FirestoreError(409,"ALREADY_EXISTS");
    if(w.precondition?.updateTime&&current?.updateTime!==w.precondition.updateTime)
     throw new FirestoreError(409,"ABORTED");
   }
   for(const w of writes)store.seed(w.path,w.data);
  },async rollback(){}};
 }
}
const env={FIREBASE_PROJECT_ID:"demo-pote-hardening",ENABLE_WRITES:"true",
 PRODUCTION_CUTOVER_APPROVED:"false",ALLOWED_ORIGINS:"https://qa.example"};
const operationId="f02-http-approval-00000001";
const request=(op=operationId)=>new Request("https://qa.example/v1/catalog/approve-price",{
 method:"POST",headers:{Origin:"https://qa.example",Authorization:"Bearer test",
 "Content-Type":"application/json"},
 body:JSON.stringify({universe,recipeId,operationId:op,salePriceCents:2000})
});
function fixture(){
 const store=new Store();
 store.seed(root,{license:{status:"active",kind:"lifetime",term:"lifetime"}});
 store.seed(root+"/appState/v2",{schemaVersion:2});
 store.seed(root+"/appState/v2InventoryGuard",{revision:1});
 store.seed(root+"/appState/v2Pulse",{eventId:"initial"});
 store.seed(recipe,{record:{id:recipeId,group:"recipes",universe,
 item:{items:[{id:"flour",g:100}],targetGainPct:100}}});
 store.seed(ingredient,{record:{id:"flour",group:"ingredients",universe,
 item:{measureUnit:"g",purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}}});
 const app=createWorkerApp({verify:async()=>({uid}),repository:()=>store,
 clock:()=>new Date("2026-11-19T20:00:00Z")});
 return {store,app};
}
test("F02 HTTP rejects stale cost snapshot without partial writes, then safely retries",async()=>{
 const {store,app}=fixture();
 store.beforeCommit=s=>{
  const prior=s.get(ingredient).record;
  s.seed(ingredient,{record:{...prior,item:{...prior.item,purchasePrice:20}}});
 };
 const rejected=await app.fetch(request(),env);
 assert.equal(rejected.status,409);
 assert.equal((await rejected.json()).error,"transaction_conflict");
 assert.equal(store.get(approval),undefined);
 assert.equal(store.get(root+"/appState/v2InventoryGuard").revision,1);
 assert.equal([...store.docs.keys()].filter(p=>p.includes("/workerEvents/")).length,0);
 const accepted=await app.fetch(request(),env);
 assert.equal(accepted.status,200,await accepted.text());
 assert.equal(store.get(approval).materialCostCents,200);
 assert.equal(store.get(approval).revision,1);
 assert.equal(store.get(root+"/appState/v2InventoryGuard").revision,2);
 const duplicate=await app.fetch(request(),env);
 assert.equal(duplicate.status,200);
 assert.equal((await duplicate.json()).alreadyApplied,true);
 assert.equal(store.get(root+"/appState/v2InventoryGuard").revision,2);
});
test("F02 HTTP two approvals race: one commit only, conflict is retryable",async()=>{
 const {store,app}=fixture();
 let started=0,release;
 const gate=new Promise(resolve=>{release=resolve});
 const original=store.transaction.bind(store);
 store.transaction=()=>{const tx=original(),commit=tx.commit;
  tx.commit=async writes=>{
   started++;
   if(started===2)release();
   await gate;
   return commit(writes);
  };
  return tx;
 };
 const responses=await Promise.all([
  app.fetch(request("f02-http-approval-00000002"),env),
  app.fetch(request("f02-http-approval-00000003"),env)
 ]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal(store.get(approval).revision,1);
 assert.equal(store.get(root+"/appState/v2InventoryGuard").revision,2);
 assert.equal([...store.docs.keys()].filter(p=>p.includes("/workerEvents/")).length,1);
});

test("F02 HTTP complex recipe approval uses all component costs and rejects snapshot tampering",async()=>{
 const {store,app}=fixture();
 const r=store.get(recipe).record;
 store.seed(recipe,{record:{...r,item:{...r.item,
  packagingItems:[{id:"pot",quantity:1}],
  addons:[{id:"bacon",quantity:2,unit:"g"}],
  beverages:[{id:"juice",quantity:1}]}}});
 for(const [group,id,measureUnit,price,quantity,unit] of [
  ["packaging","pot","un",20,10,"un"],
  ["addons","bacon","g",50,1,"kg"],
  ["beverages","juice","un",30,10,"un"]]){
  store.seed(recordPath(uid,universe,group,id),{record:{id,group,universe,
   item:{measureUnit,purchasePrice:price,purchaseQuantity:quantity,purchaseUnit:unit}}});
 }
 const op="f02-http-complex-approval-0000001";
 const response=await app.fetch(request(op),env);
 assert.equal(response.status,200,await response.clone().text());
 assert.equal(store.get(approval).version,2);
 assert.equal(store.get(approval).materialCostCents,610);
 assert.equal(store.get(recipe).record.item.serverPriceVersion,2);
 const {verifyServerPrice}=await import("../src/server_price.mjs");
 const approved={data:store.get(approval)};
 const approvedRecipe=store.get(recipe).record.item;
 assert.equal(verifyServerPrice(approved,approvedRecipe,universe,recipeId).salePriceCents,2000);
 assert.throws(()=>verifyServerPrice(approved,{...approvedRecipe,addons:[{id:"bacon",quantity:3,unit:"g"}]},universe,recipeId));
});
