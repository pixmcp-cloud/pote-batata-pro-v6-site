import assert from 'node:assert/strict';
import {splitState,createMockState,recordId,diffState,validateChangeSet,MAX_CHANGES_PER_TX} from './v2_store_core.mjs';
const state=createMockState({businessType:'batataria'});
state.data.recipes=[{id:'first',name:'A'},{id:'inserted',name:'N'},{id:'last',name:'Z'}];
const prior=new Map([
 [recordId('batataria','recipes','first'),{rank:0}],
 [recordId('batataria','recipes','last'),{rank:1e-18}]
]);
const after=splitState(state,prior);
const ranks=state.data.recipes.map(x=>after.records.get(recordId('batataria','recipes',x.id)).rank);
assert.deepEqual(ranks,[0,1000,2000],'saturated fractional ranks must safely rebalance');
const before=splitState(createMockState({businessType:'batataria'}));
const diff=diffState(before,after);
assert(diff.changes.length<=MAX_CHANGES_PER_TX);
assert.equal(validateChangeSet(diff),true);
const large=createMockState({businessType:'batataria'});
large.data.recipes=Array.from({length:MAX_CHANGES_PER_TX+1},(_,i)=>({id:'r'+i,name:'R'+i}));
const old=new Map([
 [recordId('batataria','recipes','r0'),{rank:0}],
 [recordId('batataria','recipes','r'+(MAX_CHANGES_PER_TX)),{rank:1e-18}]
]);
assert.throws(()=>splitState(large,old),/grupo grande|saturada/,'must fail closed for unsafe large rebalance');
console.log('PASS F16: small-group rebalance safe; large-group atomicity preserved.');
