import assert from 'node:assert/strict';
import {splitState,combineState,recordId,createMockState} from './v2_store_core.mjs';
import {freeSlotKey,modelRecordKey,isBundledTemplate} from './free_id_policy.mjs';
const base=createMockState({businessType:'batataria'});
base.data.recipes=[
 {id:'r01',name:'Modelo de Frango'},
 {id:'custom-1',name:'Receita Minha'}
];
let free=splitState(base,new Map(),{free:true});
const model={universe:'batataria',group:'recipes',id:'r01'};
const mine={universe:'batataria',group:'recipes',id:'custom-1'};
assert(free.records.has(modelRecordKey(model)));
assert(free.records.has(freeSlotKey(mine)));
assert.equal(freeSlotKey(mine),'free~base~recipes');
assert.equal(free.records.size,2);
assert.equal(combineState(free.meta,free.records).data.recipes.length,2);
base.data.recipes.push({id:'custom-2',name:'Segundo'});
assert.throws(()=>splitState(base,new Map(),{free:true}),/duplicado/, 'second custom Free must not be silently lost');
const paid=splitState(base,new Map(),{free:false});
assert(paid.records.has(recordId('batataria','recipes','custom-1')));
assert(paid.records.has(recordId('batataria','recipes','custom-2')));
assert.equal(paid.records.size,3);
const legacyRecordId=recordId('batataria','recipes','r01');
const legacyMap=new Map([[legacyRecordId,{universe:'batataria',group:'recipes',id:'r01',rank:0,item:base.data.recipes[0]}]]);
const retain=splitState(base,legacyMap,{free:false});
assert(retain.records.has(legacyRecordId),'Pro/ADM legacy model key must remain stable');
const modelFraud={universe:'batataria',group:'recipes',id:'my-fake',templateOrigin:'batataria'};
assert(!isBundledTemplate(modelFraud),'client flags must not grant model privilege');
const extras=createMockState({businessType:'pastelaria'});
extras.data.recipes=[{id:'ps-01',name:'Pastel Modelo'},{id:'mine-1',name:'Meu Pastel'}];
const encoded=splitState(extras,new Map(),{free:true});
assert(encoded.records.has(modelRecordKey({universe:'pastelaria',group:'recipes',id:'ps-01'})));
assert(encoded.records.has('free~extra~recipes'));
console.log('PASS F19 canonical V2 codec: models, Free singleton, duplicate prevention, Pro unbounded, legacy compatibility, extra universes.');
