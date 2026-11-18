import test from "node:test";
import assert from "node:assert/strict";
import {serverPricePath,verifyServerPrice} from "../src/server_price.mjs";
const universe="batataria",recipeId="r1",price=3000;
const item={id:recipeId,serverPriceVersion:1,
 serverSalePriceCents:price,items:[{id:"batata",g:100}]};
const approval={data:{version:1,universe,recipeId,
 salePriceCents:price,minimumGainPct:100,revision:1,
 items:[{id:"batata",g:100}]}};
test("F02 approval uses privileged tenant/recipe specific document",()=>{
 const a=serverPricePath("owner1",universe,recipeId);
 assert.match(a,/^users\/owner1\/serverPrices\//);
 assert.notEqual(a,serverPricePath("other",universe,recipeId));
 assert.notEqual(a,serverPricePath("owner1","pizzaria",recipeId));
});
test("F02 only approved same-price same-ingredients recipe accepted",()=>{
 assert.deepEqual({...verifyServerPrice(approval,item,universe,recipeId)},
 {salePriceCents:3000,minimumGainPct:100,revision:1});
});
test("F02 reject missing or forged approvals",()=>{
 for(const a of [null,{}, {data:{...approval.data,universe:"pizzaria"}},
  {data:{...approval.data,recipeId:"r2"}},
  {data:{...approval.data,salePriceCents:1}},
  {data:{...approval.data,revision:0}},
  {data:{...approval.data,minimumGainPct:-1}}])
  assert.throws(()=>verifyServerPrice(a,item,universe,recipeId));
});
test("F02 reject client-side price and ingredient tampering",()=>{
 for(const r of [{...item,serverSalePriceCents:1},
  {...item,serverPriceVersion:2},
  {...item,serverPriceRevision:4},
  {...item,items:[{id:"batata",g:1}]},
  {...item,items:[{id:"fake",g:100}]},
  {...item,items:[{id:"batata",g:100},{id:"extra",g:10}]},
  {...item,serverMinimumGainPct:0}])
  assert.throws(()=>verifyServerPrice(approval,r,universe,recipeId));
});
