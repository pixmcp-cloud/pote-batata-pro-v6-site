import assert from "node:assert/strict";
import {planV2Batches,SAFE_V2_BATCH_DOCUMENTS,SAFE_V2_BATCH_BYTES} from "./v2_batch_planner.mjs";
const changes=Array.from({length:650},(_,i)=>({
 kind:"record",key:"recipe-"+i,before:null,
 after:{universe:"batataria",group:"recipes",id:"recipe-"+i,item:{id:"recipe-"+i,name:"Receita "+i},rank:i}
}));
const batches=planV2Batches({changes,sensitive:false});
assert.equal(batches.flat().length,650);
assert(batches.length>1);
assert(batches.every(x=>x.length<=SAFE_V2_BATCH_DOCUMENTS));
assert.deepEqual(batches.flat(),changes,"order and content must be preserved");
const create=(group)=>({kind:"record",key:"g",before:null,
 after:{universe:"batataria",group,id:"g",item:{id:"g"},rank:1}});
assert.throws(()=>planV2Batches({changes:[...changes.slice(0,290),create("orders")],sensitive:true}),
 /não pode ser fracionada/);
assert.throws(()=>planV2Batches({changes:[...changes.slice(0,290),create("expenses")],sensitive:false}),
 /não pode ser fracionada/);
assert.throws(()=>planV2Batches({changes:[...changes.slice(0,290),{kind:"meta",before:{},after:{}}],sensitive:false}),
 /não pode ser fracionada/);
assert.throws(()=>planV2Batches({changes:[...changes.slice(0,290),{...changes[290],after:null}],sensitive:false}),
 /não pode ser fracionada/);
const big=changes.slice(0,340).map(c=>({...c,after:{
 ...c.after,item:{...c.after.item,description:"X".repeat(15000)}}}));
const parts=planV2Batches({changes:big,sensitive:false});
assert(parts.length>1&&parts.length>=4,"Byte budget should force smaller batches");
for(const part of parts)assert(part.reduce((n,c)=>n+JSON.stringify(c.after).length+512,0)<=SAFE_V2_BATCH_BYTES);
assert.equal(planV2Batches({changes:changes.slice(0,290),sensitive:true}).length,1,"Normal sensitive transactions remain atomic");
console.log("PASS F06 planner: 650 independent records chunked, 1.5MB bound, no deletions, no financial or sensitive splitting.");
