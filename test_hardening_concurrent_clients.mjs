import assert from 'node:assert/strict';
import {createV2Store} from './v2_storage.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const docs=new Map(),versions=new Map(),listeners=new Map();
const snap=key=>({exists:()=>docs.has(key),data:()=>docs.has(key)?clone(docs.get(key)):undefined,metadata:{hasPendingWrites:false}});
const version=key=>versions.get(key)||0;
const sdk={
 doc:(_db,...part)=>part.join('/'),
 collection:(_db,...part)=>part.join('/'),
 serverTimestamp:()=>({time:'local-virtual'}),
 getDoc:async key=>snap(key),
 getDocs:async prefix=>({docs:[...docs.entries()].filter(([id])=>id.startsWith(prefix+'/')).map(([id,value])=>({id:id.slice(prefix.length+1),data:()=>clone(value)}))}),
 onSnapshot:(key,listener)=>{
  if(!listeners.has(key))listeners.set(key,new Set());
  listeners.get(key).add(listener);listener(snap(key));
  return()=>listeners.get(key)?.delete(listener);
 },
 runTransaction:async (_db,body)=>{
  const reads=new Map(),writes=[];
  const tx={
   get:async key=>{reads.set(key,version(key));await Promise.resolve();return snap(key)},
   set:(key,value,options)=>writes.push({key,value,merge:options?.merge}),
   delete:key=>writes.push({key,remove:true})
  };
  const result=await body(tx);
  // Check and write atomically in this single JS task, like Firestore optimistic concurrency.
  for(const [key,v] of reads)if(v!==version(key)){
   const e=new Error('ABORTED: transaction conflict');e.code='sync/conflict';throw e;
  }
  for(const w of writes){
   if(w.remove)docs.delete(w.key);
   else docs.set(w.key,{...(w.merge?docs.get(w.key)||{}:{}),...clone(w.value)});
   versions.set(w.key,version(w.key)+1);
  }
  for(const w of writes)if(w.key.endsWith('/v2Pulse'))
   queueMicrotask(()=>{for(const fn of listeners.get(w.key)||[])fn(snap(w.key))});
  return result;
 }
};
const fresh=()=>({data:{businessType:'batataria',businessUniverses:{},recipes:[],ingredients:[],
 orders:[],clients:[],suppliers:[],expenses:[],stockMovements:[],purchases:[],losses:[],
 settings:{},brand:{name:'Pote'}}});
function actor(uid){
 let state=fresh();
 const store=createV2Store({uid,db:null,sdk,fresh:()=>{state=fresh()},snapshot:()=>clone(state),apply:v=>{state=clone(v)},status:()=>{}});
 return {store,mutate:fn=>fn(state),read:()=>clone(state)};
}
const first=actor('shop-1');await first.store.load();
first.mutate(s=>s.data.ingredients.push({id:'batata',stock:10,measureUnit:'g'}));
assert((await first.store.save()).ok);
const a=actor('shop-1'),b=actor('shop-1');
await Promise.all([a.store.load(),b.store.load()]);
a.mutate(s=>{s.data.ingredients[0].stock=2;s.data.orders.push({id:'order-a',qty:8,status:'confirmado',stockDeducted:true})});
b.mutate(s=>{s.data.ingredients[0].stock=2;s.data.orders.push({id:'order-b',qty:8,status:'confirmado',stockDeducted:true})});
const results=await Promise.all([a.store.save(),b.store.save()]);
const successful=results.filter(x=>x.ok).length;
assert.equal(successful,1,'only one stale-stock checkout can commit');
assert.equal(results.filter(x=>!x.ok).length,1,'conflicting checkout must be rejected');
const audit=actor('shop-1');await audit.store.load();
assert.equal(audit.read().data.orders.length,1,'must not create double-sale with one inventory batch');
assert.equal(audit.read().data.ingredients[0].stock,2);
const isolated=actor('shop-2');await isolated.store.load();
assert.equal(isolated.read().data.orders.length,0);
assert.equal(isolated.read().data.ingredients.length,0);
console.log('PASS simulated concurrent Firestore transactions: 2 devices compete for 8/10 stock, exactly 1 order commits; different UID isolated.');
for(const x of [first,a,b,audit,isolated])x.store.dispose();
