import assert from 'node:assert/strict';
import {splitState,combineState,createMockState,recordId,diffState,validateChangeSet,MAX_CHANGES_PER_TX} from './v2_store_core.mjs';
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
large.data.recipes=Array.from({length:MAX_CHANGES_PER_TX+20},(_,i)=>({id:'r'+i,name:'R'+i}));
const key=id=>recordId('batataria','recipes',id);
const stored=splitState(large);
const openingRank=stored.records.get(key('r145')).rank;
const tightRank=openingRank+2**-45;
assert(tightRank>openingRank,'the dense anchors must still be distinct');
stored.records.get(key('r146')).rank=tightRank;
large.data.recipes.splice(146,0,{id:'new',name:'Nova'});
const local=splitState(large,stored.records);
const localDiff=diffState(stored,local);
assert.equal(validateChangeSet(localDiff),true);
assert.deepEqual(localDiff.changes.map(change=>change.after.id).sort(),['new','r146'],
 'only the inserted record and the adjacent anchor should be written');
assert.equal(local.records.get(key('r0')).rank,stored.records.get(key('r0')).rank);
assert.equal(local.records.get(key('r309')).rank,stored.records.get(key('r309')).rank);
assert.deepEqual(combineState(local.meta,local.records).data.recipes,large.data.recipes,
 'rebalanced records must load in exactly the desired order');

const oversized=createMockState({businessType:'batataria'});
oversized.data.recipes=Array.from({length:MAX_CHANGES_PER_TX+2},(_,i)=>({id:'r'+i,name:'R'+i}));
const edgeState=createMockState({businessType:'batataria'});
edgeState.data.recipes=[oversized.data.recipes[0],oversized.data.recipes.at(-1)];
const edges=splitState(edgeState);
edges.records.get(key(edgeState.data.recipes[1].id)).rank=1e-18;
assert.throws(()=>splitState(oversized,edges.records),/grupo grande|saturada/,
 'moving either anchor would exceed the transaction limit');
const atLimit=structuredClone(oversized);
atLimit.data.recipes.splice(1,1);
const limitDiff=diffState(edges,splitState(atLimit,edges.records));
assert.equal(limitDiff.changes.length,MAX_CHANGES_PER_TX);
assert.equal(validateChangeSet(limitDiff),true);
atLimit.data.settings.updated=true;
assert.throws(()=>validateChangeSet(diffState(edges,splitState(atLimit,edges.records))),/transação segura/,
 'a simultaneous metadata change also counts toward the global limit');
console.log('PASS F16: bounded local and small-group rebalancing preserve strict order; oversized changes fail closed.');
