import assert from "node:assert/strict";
import {splitState,combineState,diffState,recordId,recordPathParts,INVENTORY_GROUPS,validateChangeSet,MAX_CHANGES_PER_TX} from "./v2_store_core.mjs";
const active={data:{businessType:"batataria",businessUniverses:{pizzaria:{
 recipes:[{id:"r1",name:"Pizza"}],ingredients:[{id:"a",stock:10}],orders:[{id:"o0"}],brand:{name:"Pizzaria"}
}},recipes:[{id:"r1",name:"Potê"}],ingredients:[{id:"a",stock:250}],orders:[
 {id:"o1",qty:2,stockDeducted:false},{id:"o2",qty:1,stockDeducted:true}],
 clients:[{id:"c1",name:"Teste"}],suppliers:[],expenses:[],brand:{name:"Potê Batata"},settings:{fee:3}},creatives:[]};
const before=JSON.stringify(active);
const split=splitState(active);
assert.equal(JSON.stringify(active),before,"Split must never mutate original");
assert.equal(split.records.size,8);
assert(!JSON.stringify(split.meta).includes("stockDeducted"),"No orders inside metadata");
assert.equal(recordPathParts(recordId("potê/batata","orders","pedido⚡")).id,"pedido⚡");
const joined=combineState(split.meta,split.records);
assert.deepEqual(joined.data.orders,active.data.orders,"Round-trip preserves order of active orders");
assert.deepEqual(joined.data.businessUniverses.pizzaria.orders,active.data.businessUniverses.pizzaria.orders);
assert.equal(joined.data.brand.name,active.data.brand.name);
const updated=JSON.parse(JSON.stringify(joined));
updated.data.orders.unshift({id:"o3",qty:5});
updated.data.ingredients[0].stock=100;
const after=splitState(updated,split.records);
const change=diffState(split,after);
assert(change.sensitive);
assert.equal(change.changes.length,2,"One new order and one ingredient update");
assert.equal(combineState(after.meta,after.records).data.orders[0].id,"o3","New order must remain at front");
assert(validateChangeSet(change));
const onlyPrice=JSON.parse(JSON.stringify(joined));
onlyPrice.data.settings.fee=5;
const feeChange=diffState(split,splitState(onlyPrice,split.records));
assert.equal(feeChange.changes.length,1);
assert.equal(feeChange.changes[0].kind,"meta");
assert.equal(feeChange.sensitive,false);
assert.equal(diffState(split,splitState(joined,split.records)).changes.length,0);
console.log("PASS: Firestore V2 normalizado, sem documentos duplicados, universos isolados, baixa e pedidos atômicos, diff seguro.");
