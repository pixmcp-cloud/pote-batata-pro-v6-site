import test from "node:test";
import assert from "node:assert/strict";
import {complexRecipeComponentLines,authoritativeComponentCost,minimumApprovedPriceCents,complexRecipeSnapshot,assertComplexRecipeSnapshot} from "../src/component_cost.mjs";
const recipe={items:[{id:"potato",g:250}],packagingItems:[{id:"pot",quantity:1}],addons:[{id:"bacon",quantity:2,unit:"g"}],beverages:[{id:"juice",quantity:1}]};
const records={ingredient:{potato:{measureUnit:"g",purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}},packaging:{pot:{measureUnit:"un",purchasePrice:20,purchaseQuantity:10,purchaseUnit:"un"}},addon:{bacon:{measureUnit:"g",purchasePrice:50,purchaseQuantity:1,purchaseUnit:"kg"}},beverage:{juice:{measureUnit:"un",purchasePrice:30,purchaseQuantity:10,purchaseUnit:"un"}}};
const resolve=(kind,id)=>records[kind]?.[id]?{kind,id,item:records[kind][id]}:undefined;
test("F02 complex preflight computes ingredients, packaging, repeat extras and beverage cost",()=>{
 const lines=complexRecipeComponentLines(recipe);
 assert.equal(lines.length,4);
 const cost=authoritativeComponentCost(lines,resolve);
 assert.equal(cost.materialCostCents,760);
 assert.equal(minimumApprovedPriceCents(cost.materialCostCents,100),1520);
});
test("F02 complex preflight rejects combos, ambiguous quantities, unknown cost and invalid units",()=>{
 for(const bad of [{...recipe,comboItems:[{id:"meal"}]},{...recipe,addons:[{id:"bacon",g:2,quantity:2}]},{...recipe,packagingItems:[{id:"pot",quantity:1,unit:"g"}]}]){
  if(bad.packagingItems?.[0]?.unit==="g")assert.throws(()=>authoritativeComponentCost(complexRecipeComponentLines(bad),resolve));
  else assert.throws(()=>complexRecipeComponentLines(bad));
 }
 assert.throws(()=>authoritativeComponentCost(complexRecipeComponentLines(recipe),()=>undefined));
});

test("F02 complex approval snapshot detects every component mutation",()=>{
 const snapshot=complexRecipeSnapshot(recipe);
 assert.equal(assertComplexRecipeSnapshot(structuredClone(recipe),snapshot),true);
 for(const changed of [
  {...recipe,items:[{id:"potato",g:251}]},
  {...recipe,addons:[{id:"bacon",quantity:3,unit:"g"}]},
  {...recipe,packagingItems:[{id:"pot",quantity:2}]},
  {...recipe,beverages:[{id:"juice",quantity:2}]},
  {...recipe,comboItems:[{id:"unknown"}]}
 ])assert.throws(()=>assertComplexRecipeSnapshot(changed,snapshot));
 assert.throws(()=>assertComplexRecipeSnapshot(recipe,""));
});
