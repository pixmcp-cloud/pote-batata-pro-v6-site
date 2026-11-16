import assert from "node:assert/strict";
import {createV2Store} from "./v2_storage.mjs";
const copy=v=>JSON.parse(JSON.stringify(v));
const values=new Map(),ref=(db,...parts)=>parts.join("/");
const emptyState=()=>({data:{businessType:"batataria",businessUniverses:{},brand:{name:"Test"},settings:{},orders:[],ingredients:[]}});
const uid="t";
const root="users/t/appState/v2",pulse="users/t/appState/v2Pulse",guard="users/t/appState/v2InventoryGuard";
values.set(root,{schemaVersion:2,state:emptyState()});
values.set(pulse,{eventId:"v1"});
values.set(guard,{revision:0});
let snapshots=0,flipOnce=true,flipAlways=false;
const snap=path=>{const value=values.has(path)?copy(values.get(path)):undefined;return {exists:()=>value!==undefined,data:()=>copy(value)};};
const sdk={
 doc:ref,collection:ref,
 getDoc:async path=>{
  if(path===pulse){
   snapshots++;
   if(flipAlways||flipOnce&&snapshots===2){
    const data=values.get(pulse);
    values.set(pulse,{eventId:"v"+(Number(data.eventId.slice(1))+1)});
   }
  }
  return snap(path);
 },
 getDocs:async()=>({docs:[]}),
 runTransaction:async()=>{throw Error("should not initialize")},
 onSnapshot:()=>()=>{},serverTimestamp:()=>({fake:true})
};
let state=emptyState();
const store=createV2Store({uid,db:null,sdk,
 fresh:()=>{state=emptyState()},snapshot:()=>copy(state),apply:x=>{state=copy(x)}});
const first=await store.load();
assert.equal(first.records,0);
assert(snapshots>=4,"A inconsistência entre pulsos deve provocar nova leitura");
assert.equal(state.data.brand.name,"Test");
store.dispose();
flipOnce=false;flipAlways=true;snapshots=0;
const failing=createV2Store({uid,db:null,sdk,
 fresh:()=>{state=emptyState()},snapshot:()=>copy(state),apply:x=>{state=copy(x)}});
await assert.rejects(()=>failing.load(),/mudou durante a leitura/);
assert.equal(snapshots,8,"A leitura deve ter limite estrito de quatro tentativas");
failing.dispose();
console.log("PASS V3: leitura consistente com retry por pulse e recusa de snapshot instável.");
