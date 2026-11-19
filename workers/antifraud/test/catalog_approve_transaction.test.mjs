import test from "node:test";
import assert from "node:assert/strict";
import {approveRecipePrice} from "../src/catalog_approve.mjs";
import {recordPath} from "../src/domain.mjs";
import {serverPricePath} from "../src/server_price.mjs";

const uid="qa-owner",universe="qa",recipeId="batata";
const operationId="qa-approval-operation-000001";
const root="users/"+uid;
const recipePath=recordPath(uid,universe,"recipes",recipeId);
const ingredientPath=recordPath(uid,universe,"ingredients","insumo");
const approvalPath=serverPricePath(uid,universe,recipeId);
const docs=()=>new Map([
 [root,{data:{}}],
 [root+"/appState/v2",{data:{schemaVersion:2}}],
 [root+"/appState/v2InventoryGuard",{data:{revision:1}}],
 [root+"/appState/v2Pulse",{data:{eventId:"initial"}}],
 [recipePath,{data:{record:{id:recipeId,group:"recipes",universe,item:{
  items:[{id:"insumo",g:100}],targetGainPct:100}}}}],
 [ingredientPath,{data:{record:{id:"insumo",group:"ingredients",universe,item:{
  measureUnit:"g",purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}}}}]
]);
function harness(changes=()=>{}){
 const state=docs();changes(state);
 let committed=false,reads=[],writes=[];
 const tx={get:async path=>{reads.push(path);return state.get(path)||null},
  commit:async changes=>{committed=true;writes=changes},
  rollback:async()=>{}};
 return {state,reads,get committed(){return committed},get writes(){return writes},
  deps:{user:{uid},env:{},repository:()=>({transaction:async()=>tx}),
   clock:()=>new Date("2026-11-19T12:00:00Z"),hasAccess:()=>true}};
}
const body=(price=2000)=>({universe,recipeId,operationId,salePriceCents:price});
test("F02 transaction approves server-read ingredient cost, not browser-supplied cost",async()=>{
 const h=harness();
 const result=await approveRecipePrice(body(),h.deps);
 assert.equal(result.ok,true);
 assert.equal(h.committed,true);
 assert.ok(h.reads.includes(ingredientPath));
 const approval=h.writes.find(x=>x.path===approvalPath);
 assert.equal(approval.data.materialCostCents,100);
 assert.equal(approval.data.salePriceCents,2000);
 assert.equal(h.writes.length,5);
});
test("F02 rejects unknown, estimated, archived, impossible yield and wrong unit without commit",async()=>{
 const variants=[
 s=>s.delete(ingredientPath),
 s=>s.get(ingredientPath).data.record.item.costEstimateMode="estimated",
 s=>s.get(ingredientPath).data.record.item.hasUnknownCosts=true,
 s=>s.get(ingredientPath).data.record.item.archived=true,
 s=>s.get(ingredientPath).data.record.item.yield=120,
 s=>s.get(ingredientPath).data.record.item.measureUnit="ml"
 ];
 for(const mutate of variants){
  const h=harness(mutate);
  await assert.rejects(approveRecipePrice(body(),h.deps));
  assert.equal(h.committed,false);
 }
});
test("F02 rejects price below server minimum, with no partial writes",async()=>{
 const h=harness();
 await assert.rejects(approveRecipePrice(body(199),h.deps),{code:"price_below_cost"});
 assert.equal(h.committed,false);
});
test("F02 existing approval increments revision and requires optimistic precondition",async()=>{
 const h=harness(s=>s.set(approvalPath,{updateTime:"2026-11-19T00:00:00Z",
  data:{universe,recipeId,revision:2}}));
 const result=await approveRecipePrice(body(),h.deps);
 assert.equal(result.revision,3);
 assert.equal(h.writes.find(x=>x.path===approvalPath).precondition.updateTime,
  "2026-11-19T00:00:00Z");
});
test("F02 complex recipe still fails closed",async()=>{
 const h=harness(s=>s.get(recipePath).data.record.item.addonIds=["extra"]);
 await assert.rejects(approveRecipePrice(body(),h.deps),{code:"recipe_review_required"});
 assert.equal(h.committed,false);
});

test("F02 concurrent cost revision invalidates approval transaction without partial writes",async()=>{
 const h=harness();
 const originalTransaction=h.deps.repository;
 let revisionChanged=false;
 h.deps.repository=()=>({transaction:async()=>{
  const tx=await originalTransaction().transaction();
  const read=tx.get.bind(tx);
  tx.get=async path=>{
   const snapshot=await read(path);
   if(path===ingredientPath&&snapshot){
    revisionChanged=true;
    // Simulate a competing writer after the transaction read snapshot.
    h.state.set(path,{...snapshot,updateTime:"new-cost-revision",
      data:{record:{...snapshot.data.record,item:{
       ...snapshot.data.record.item,purchasePrice:30}}}});
   }
   return snapshot;
  };
  tx.commit=async changes=>{
   if(revisionChanged)throw Object.assign(new Error("ABORTED: concurrent cost update"),{code:"ABORTED"});
   throw new Error("Unexpected successful commit");
  };
  return tx;
 }});
 await assert.rejects(approveRecipePrice(body(),h.deps),{code:"ABORTED"});
 assert.equal(h.committed,false);
});
