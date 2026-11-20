import test from "node:test";
import assert from "node:assert/strict";
import {validateStockAdjustment} from "../src/stock_adjust.mjs";
const operationId="f05-physical-loss-000000001";
for(const [group,itemId] of [["ingredients","flour"],["beverages","juice"],["packaging","pot"],["addons","bacon"]]){
 test("F05 accepts physically recorded loss for "+group,()=>{
  const input=validateStockAdjustment({universe:"qa",operationId,group,itemId,
   delta:-1,reason:"loss",note:"Descarte sanitário"});
  assert.equal(input.group,group);
  assert.equal(input.delta,-1);
  assert.equal(input.reason,"loss");
 });
}
test("F05 rejects loss that increases stock or invalid group",()=>{
 assert.throws(()=>validateStockAdjustment({universe:"qa",operationId,
  group:"packaging",itemId:"pot",delta:1,reason:"loss"}));
 assert.throws(()=>validateStockAdjustment({universe:"qa",operationId,
  group:"orders",itemId:"pot",delta:-1,reason:"loss"}));
});
