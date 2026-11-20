import test from "node:test";
import assert from "node:assert/strict";
import {quantities,planOperation} from "../src/domain.mjs";
const order={id:"complex-1",qty:2,status:"em_producao",stockDeducted:true,
 items:[{id:"potato",g:100,yieldPct:100}],
 packagingItems:[{id:"pot",quantity:1,yieldPct:100}],
 addonItems:[{id:"bacon",quantity:5,yieldPct:100},{id:"bacon",quantity:5,yieldPct:100}],
 beverageItems:[{id:"juice",qty:1}],price:20,unitVariableCost:6};
test("F02 complex reservation and cancellation aggregate all component groups",()=>{
 const qty=quantities(order);
 assert.deepEqual([...qty],[["ingredients:potato",200],["packaging:pot",2],["addons:bacon",20],["beverages:juice",2]]);
 const stock=new Map([...qty].map(([k,n])=>[k,{stock:n,name:k}]));
 const plan=planOperation({action:"cancel",decision:"return",order,stock,
  universe:"qa",operationId:"complex-cancel-0000000001",at:"2026-11-20T01:00:00Z"});
 assert.equal(plan.stockUpdates.length,4);
 assert.deepEqual(plan.stockUpdates.map(x=>[x.group,x.id,x.item.stock]),[
  ["ingredients","potato",400],["packaging","pot",4],
  ["addons","bacon",40],["beverages","juice",4]]);
 assert.deepEqual(plan.movements.map(x=>x.stockGroup),
  ["ingredients","packaging","addons","beverages"]);
 assert.equal(plan.movements.length,4);
 assert.equal(plan.order.stockRestored,true);
});
test("F02 complex cancellation fails without component stock",()=>{
 assert.throws(()=>planOperation({action:"cancel",decision:"return",order,
  stock:new Map(),universe:"qa",operationId:"complex-cancel-0000000002",at:"2026-11-20T01:00:00Z"}));
});
