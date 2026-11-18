import assert from "node:assert/strict";
import {createV2Store} from "./v2_storage.mjs";
const copy=x=>JSON.parse(JSON.stringify(x));
const db=new Map();let writes=0,failOn=0;
const snapshot=path=>({
 exists:()=>db.has(path),
 data:()=>db.has(path)?copy(db.get(path)):undefined,
 metadata:{hasPendingWrites:false}
});
const sdk={
 doc:(...args)=>args.slice(1).join("/"),
 collection:(...args)=>args.slice(1).join("/"),
 getDoc:async key=>snapshot(key),
 getDocs:async key=>({docs:[...db.entries()].filter(([id])=>id.startsWith(key+"/"))
  .map(([id,v])=>({id:id.slice(key.length+1),data:()=>copy(v)}))}),
 serverTimestamp:()=>({stamp:"SERVER"}),
 runTransaction:async(_db,callback)=>{
  writes++;const operations=[];
  const tx={
   get:async key=>snapshot(key),
   set:(key,value,options)=>operations.push({key,value,merge:options?.merge}),
   delete:key=>operations.push({key,remove:true})
  };
  const result=await callback(tx);
  if(writes===failOn)throw Object.assign(new Error("simulated network failure"),{code:"unavailable"});
  for(const op of operations){
   if(op.remove)db.delete(op.key);
   else db.set(op.key,{...(op.merge?db.get(op.key)||{}:{}),...copy(op.value)});
  }
  return result;
 },
 onSnapshot:(_path,callback)=>{callback({data:()=>null,metadata:{hasPendingWrites:false}});return ()=>{}}
};
function empty(){return {data:{businessType:"batataria",businessUniverses:{},settings:{},brand:{name:"Teste"},
 recipes:[],clients:[],suppliers:[],ingredients:[],orders:[],stockMovements:[]}}}
function actor(uid){
 let state=empty();let messages=[];
 const store=createV2Store({uid,db:null,sdk,
  fresh:()=>{state=empty()},
  snapshot:()=>copy(state),apply:next=>{state=copy(next)},
  status:s=>messages.push(s)});
 return {store,read:()=>copy(state),mutate:fn=>fn(state),messages};
}
function populate(actor,count,group="recipes"){
 actor.mutate(s=>{
  for(let i=0;i<count;i++)s.data[group].push({id:group+"-"+i,name:group+" "+i});
 });
}
let a=actor("bulk-happy");await a.store.load();populate(a,650);
let r=await a.store.save();
assert(r.ok&&r.changed===650&&r.batches>=5,JSON.stringify(r));
assert.equal(a.store.documentCount,650);
const reopened=actor("bulk-happy");await reopened.store.load();
assert.equal(reopened.read().data.recipes.length,650);
assert((await a.store.save()).unchanged);
a.store.dispose();reopened.store.dispose();

const b=actor("bulk-interrupted");await b.store.load();populate(b,380);
failOn=writes+2;
r=await b.store.save();
assert.equal(r.partial,true,JSON.stringify(r));
assert.equal(r.savedChanges,150);
assert.equal(b.store.documentCount,150);
assert.equal(b.read().data.recipes.length,380,"Uncommitted local drafts must survive");
const interrupted=actor("bulk-interrupted");await interrupted.store.load();
assert.equal(interrupted.read().data.recipes.length,150,"No phantom successful records");
failOn=0;
r=await b.store.save();
assert(r.ok&&r.changed===230&&r.batches===1,JSON.stringify(r));
const verified=actor("bulk-interrupted");await verified.store.load();
assert.equal(verified.read().data.recipes.length,380);
assert.equal(new Set(verified.read().data.recipes.map(x=>x.id)).size,380);
b.store.dispose();interrupted.store.dispose();verified.store.dispose();

const c=actor("bulk-sensitive");await c.store.load();populate(c,330,"orders");
r=await c.store.save();
assert.equal(r.code,"sync/invalid-state",JSON.stringify(r));
assert.equal(c.store.documentCount,0);
c.store.dispose();
console.log("PASS F06 V2: 650 imported, interrupted batch preserves 150 committed + 230 pending, retry idempotent; >290 orders blocked atomically.");
