import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {buildFranchiseCatalog,mergeFranchiseCatalog} from "./franchise_catalog.mjs";
import {initializeFranchiseEstimatedCosts,estimateReferenceSale,COST_ESTIMATE_RATE,
 FRANCHISE_SALE_PRICES,COST_ESTIMATE_TAG,LEGACY_COST_TAG} from "./franchise_cost_estimates.mjs";
const source=readFileSync("source/pote_app_base.html","utf8");
const matrix=JSON.parse(source.match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const catalog=buildFranchiseCatalog({data:matrix});
const make=()=>{
 const state={data:{recipes:[],ingredients:[],beverages:[],combos:[],brand:{},
  businessType:"batataria",settings:{...matrix.settings},purchases:[]}};
 mergeFranchiseCatalog(state,catalog);
 const sandbox={window:{},console};vm.createContext(sandbox);
 vm.runInContext(readFileSync("beverage_catalog.js","utf8"),sandbox);
 sandbox.window.POTE_DRINKS.ensure(state);
 return state;
};
assert.equal(COST_ESTIMATE_RATE,0.40);
assert.equal(Object.keys(FRANCHISE_SALE_PRICES).length,26);
const state=make();
const result=initializeFranchiseEstimatedCosts(state,matrix);
assert.equal(result.recipesUpdated,26);
assert.equal(result.ingredientsUpdated,41);
assert.equal(result.beveragesUpdated,11);
assert(state.data.ingredients.every(i=>i.purchasePrice>0&&i.costSource===COST_ESTIMATE_TAG));
assert(state.data.recipes.every(r=>r.estimatedSalePrice>0&&
 Math.abs(r.estimatedUnitCost-Math.round(r.estimatedSalePrice*.4*100)/100)<.001));
assert(state.data.beverages.every(b=>Math.abs(b.purchasePrice-b.sellPrice*.4)<.001));
for(const r of state.data.recipes)
 assert.equal(r.estimatedSalePrice,FRANCHISE_SALE_PRICES[r.id.replace(/^fr-/,"")],r.name);
assert.equal(state.data.recipes.find(r=>r.id==="fr-r01").estimatedSalePrice,29.9);
assert.equal(state.data.recipes.find(r=>r.id==="fr-r01").estimatedUnitCost,11.96);
assert.equal(state.data.recipes.find(r=>r.id==="fr-r16").estimatedSalePrice,44.9);
assert.equal(state.data.recipes.find(r=>r.id==="fr-r24").estimatedSalePrice,18.9);
const batata=state.data.ingredients.find(i=>i.id==="fr-batata");
assert.equal(batata.purchaseUnit,"kg");
assert.equal(batata.purchaseQuantity,1);
assert.equal(state.data.purchases?.length||0,0,"Valores estimados não geram compras");
const originalPrice=batata.purchasePrice;
assert.equal(initializeFranchiseEstimatedCosts(state,matrix).changed,false,"Não reescrever custos a cada login");
assert.equal(batata.purchasePrice,originalPrice);
batata.purchasePrice=8;batata.price=8;batata.costSource="real-purchase";
assert.equal(initializeFranchiseEstimatedCosts(state,matrix).changed,false);
assert.equal(batata.purchasePrice,8,"Uma compra real deve prevalecer");
const empty=initializeFranchiseEstimatedCosts({data:{recipes:[],ingredients:[]}},matrix);
assert.equal(empty.changed,false);
// Simular uma conta antiga de testes com custos gerados a 60%.
const old=make();
initializeFranchiseEstimatedCosts(old,matrix);
for(const i of old.data.ingredients){
 if(i.costSource!==COST_ESTIMATE_TAG)continue;
 i.costSource=LEGACY_COST_TAG;
 i.costEstimateOriginalPrice=i.purchasePrice;
}
for(const r of old.data.recipes){
 r.costEstimatePct=60;
 r.costSource=LEGACY_COST_TAG;
 r.estimatedSalePrice=20.5;
 r.estimatedUnitCost=12.3;
}
for(const b of old.data.beverages)if(b.costSource===COST_ESTIMATE_TAG){
 b.costSource=LEGACY_COST_TAG;
 b.costEstimateOriginalPrice=b.purchasePrice;
}
const preserved=old.data.ingredients.find(i=>i.id==="fr-batata");
preserved.purchasePrice=50;preserved.price=50;preserved.costSource="real-purchase";
const manualRecipe=old.data.recipes.find(r=>r.id==="fr-r02");
manualRecipe.costEstimateMode="manual";manualRecipe.estimatedSalePrice=99.9;
const migrated=initializeFranchiseEstimatedCosts(old,matrix);
assert(migrated.changed);
assert.equal(old.data.recipes.find(r=>r.id==="fr-r01").estimatedSalePrice,29.9);
assert.equal(old.data.recipes.find(r=>r.id==="fr-r01").estimatedUnitCost,11.96);
assert.equal(old.data.recipes.find(r=>r.id==="fr-r02").estimatedSalePrice,99.9);
assert.equal(old.data.ingredients.find(i=>i.id==="fr-batata").purchasePrice,50);
assert(old.data.beverages.every(b=>b.costSource===COST_ESTIMATE_TAG));
assert.equal(initializeFranchiseEstimatedCosts(old,matrix).changed,false,"Migração não deve reocorrer");
console.log("PASS: 26 preços finais por sabor, custos estimados a 40%, 41 ingredientes, 11 bebidas, migração 60% e proteção a custos reais.");
