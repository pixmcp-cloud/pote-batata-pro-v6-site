import test from "node:test";
import assert from "node:assert/strict";
import {authoritativeComponentCost,minimumApprovedPriceCents} from "../src/component_cost.mjs";
const docs={
 "ingredient:batata":{id:"batata",kind:"ingredient",item:{measureUnit:"g",purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}},
 "addon:queijo":{id:"queijo",kind:"addon",item:{measureUnit:"g",purchasePrice:40,purchaseQuantity:1,purchaseUnit:"kg"}},
 "packaging:pote":{id:"pote",kind:"packaging",item:{measureUnit:"un",purchasePrice:30,purchaseQuantity:100,purchaseUnit:"un"}},
 "beverage:cola":{id:"cola",kind:"beverage",item:{measureUnit:"un",purchasePrice:60,purchaseQuantity:24,purchaseUnit:"un"}}
};
const resolve=(kind,id)=>docs[kind+":"+id];
const base=[
 {kind:"ingredient",id:"batata",quantity:250,unit:"g"},
 {kind:"addon",id:"queijo",quantity:50,unit:"g"},
 {kind:"packaging",id:"pote",quantity:1,unit:"un"},
 {kind:"beverage",id:"cola",quantity:1,unit:"un"}];
test("F02 authoritative ingredients, extras, packaging and beverage cost",()=>{
 const r=authoritativeComponentCost(base,resolve);
 assert.equal(r.materialCostCents,730);
 assert.equal(minimumApprovedPriceCents(r.materialCostCents,100),1460);
 assert.equal(r.details.length,4);
});
test("F02 repeated extra quantities increase material cost",()=>{
 const single=authoritativeComponentCost(base,resolve).materialCostCents;
 const doubled=authoritativeComponentCost([...base,base[1]],resolve).materialCostCents;
 assert.equal(doubled-single,200);
});
test("F02 unknown, archived and estimated costs fail closed",()=>{
 for(const resolveBad of [()=>null,()=>({...docs["addon:queijo"],archived:true}),
  ()=>({...docs["addon:queijo"],hasUnknownCosts:true}),
  ()=>({...docs["addon:queijo"],costEstimateMode:"estimated"})])
  assert.throws(()=>authoritativeComponentCost([base[1]],resolveBad),
   {code:"cost_review_required"});
});
test("F02 rejects incompatible units and impossible yields",()=>{
 for(const line of [{...base[3],unit:"ml"},{...base[0],quantity:0},
  {...base[0],quantity:NaN},{...base[0],kind:"combo"}])
  assert.throws(()=>authoritativeComponentCost([line],resolve));
 const bad={...docs["addon:queijo"],item:{...docs["addon:queijo"].item,yield:120}};
 assert.throws(()=>authoritativeComponentCost([base[1]],()=>bad));
});
test("F02 reject unknown price and invalid margin",()=>{
 for(const cost of [0,-1,NaN,1.2])assert.throws(()=>minimumApprovedPriceCents(cost,100));
 for(const margin of [-1,501,NaN])assert.throws(()=>minimumApprovedPriceCents(730,margin));
});
