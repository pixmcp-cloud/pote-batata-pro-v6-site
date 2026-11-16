import assert from "node:assert/strict";
import {splitState,diffState,combineState,validateChangeSet} from "./v2_store_core.mjs";
const make=(recipes=[],orders=[])=>({
 data:{businessType:"batataria",businessUniverses:{},recipes,orders,
 ingredients:[],beverages:[],clients:[],suppliers:[],expenses:[],settings:{},brand:{}}
});
const ids=rows=>rows.map(x=>x.id);
const originals=[{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"}];
const old=splitState(make(originals));
const same=splitState(make(originals),old.records);
assert.equal(diffState(old,same).changes.length,0,"No-op must not create writes");
const reorder=splitState(make([originals[1],originals[0],originals[2]]),old.records);
const diff=diffState(old,reorder);
assert.equal(diff.changes.length,1,"One swap should require one record update");
assert.deepEqual(ids(combineState(reorder.meta,reorder.records).data.recipes),["b","a","c"]);
assert.equal(diffState(reorder,splitState(combineState(reorder.meta,reorder.records),reorder.records)).changes.length,0);
const addAtHead=splitState(make([{id:"new"},...originals]),old.records);
assert.equal(diffState(old,addAtHead).changes.length,1,"Inserting first must not rewrite old records");
assert.deepEqual(ids(combineState(addAtHead.meta,addAtHead.records).data.recipes),["new","a","b","c"]);
const addInMiddle=splitState(make([originals[0],{id:"middle"},originals[1],originals[2]]),old.records);
assert.equal(diffState(old,addInMiddle).changes.length,1,"Inserting in middle should be one write");
assert.deepEqual(ids(combineState(addInMiddle.meta,addInMiddle.records).data.recipes),["a","middle","b","c"]);
// The app routinely prepends orders. A new sale cannot rewrite 350 existing orders.
const orders=Array.from({length:350},(_,i)=>({id:"order-"+i,qty:1,status:"entregue"}));
const initialOrders=splitState(make([],orders));
const newOrders=splitState(make([],[{id:"fresh",qty:1,status:"recebido"},...orders]),initialOrders.records);
assert.equal(diffState(initialOrders,newOrders).changes.length,1);
assert(validateChangeSet(diffState(initialOrders,newOrders)));
// Out-of-order collections must recover in exactly the requested sequence.
let shuffled=originals.map(x=>({...x}));
for(let i=0;i<20;i++){
 shuffled=shuffled.slice().reverse();
 const next=splitState(make(shuffled),old.records);
 assert.deepEqual(ids(combineState(next.meta,next.records).data.recipes),ids(shuffled));
}
console.log("PASS V3: reorder persists, no-op is stable, insert does not rewrite old orders, 350 orders safe.");
