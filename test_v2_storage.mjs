import assert from "node:assert/strict";
import {createV2Store} from "./v2_storage.mjs";
const copy=x=>JSON.parse(JSON.stringify(x));
const db=new Map(),listeners=new Map();
let fullCollectionReads=0;
const ref=(prefix,...parts)=>parts.join("/");
const snap=path=>({
 exists:()=>db.has(path),data:()=>db.has(path)?copy(db.get(path)):undefined,
 metadata:{hasPendingWrites:false}
});
const fire={
 doc:ref,
 collection:ref,
 getDoc:async path=>snap(path),
 getDocs:async path=>{fullCollectionReads++;return {docs:[...db.entries()].filter(([key])=>key.startsWith(path+"/"))
  .map(([key])=>({id:key.slice(path.length+1),data:()=>copy(db.get(key))}))}},
 serverTimestamp:()=>({timestamp:"SERVER"}),
 runTransaction:async(database,fn)=>{
  const mutations=[];
  const tx={
   get:async path=>snap(path),
   set:(path,value,options)=>mutations.push({path,value,merge:options?.merge}),
   delete:path=>mutations.push({path,remove:true})
  };
  const result=await fn(tx);
  for(const m of mutations){
   if(m.remove)db.delete(m.path);
   else db.set(m.path,{...(m.merge?db.get(m.path)||{}:{}),...copy(m.value)});
  }
  for(const m of mutations)if(m.path.endsWith("/v2Pulse")){
   for(const cb of listeners.get(m.path)||[])cb(snap(m.path));
  }
  return result;
 },
 onSnapshot:(path,cb)=>{
  if(!listeners.has(path))listeners.set(path,new Set());
  listeners.get(path).add(cb);
  cb(snap(path));
  return ()=>listeners.get(path)?.delete(cb);
 }
};
const empty=()=>({data:{businessType:"batataria",businessUniverses:{},settings:{margin:50},brand:{name:"Potê"},
 orders:[],ingredients:[],beverages:[],recipes:[],clients:[],suppliers:[],expenses:[],
 purchases:[],stockMovements:[],losses:[]}});
const make=(uid="u")=>{
 let state=empty(),messages=[];
 const store=createV2Store({uid,db:null,sdk:fire,
  fresh(){state=empty()},
  snapshot(){return copy(state)},
  apply(value){state=copy(value)},
  status:x=>messages.push(x)});
 return {store,read:()=>copy(state),mutate:fn=>fn(state),messages};
};
const frozenLegacy={state:{data:{orders:[{id:"old-order"}]}}};
db.set("users/legacy/appState/main",frozenLegacy);
const legacy=make("legacy");
await assert.rejects(legacy.store.load(),/conta tem dados no formato anterior/);
assert.deepEqual(db.get("users/legacy/appState/main"),frozenLegacy);
assert(!db.has("users/legacy/appState/v2"));
assert(!db.has("users/legacy/appState/v2InventoryGuard"));
legacy.store.dispose();
const a=make(),b=make();
const loaded=await a.store.load();
assert.equal(loaded.created,true);
assert.equal(db.has("users/u/appState/main"),false,"Legacy document must remain untouched");
await b.store.load();
a.mutate(s=>s.data.ingredients.push({id:"batata",stock:20000,measureUnit:"g"}));
let result=await a.store.save();
assert(result.ok&&result.changed===1);
assert.equal(a.store.guardRevision,1);
b.mutate(s=>s.data.orders.push({id:"venda2",qty:1,status:"recebido"}));
result=await b.store.save();
assert.equal(result.code,"sync/conflict","Concurrent sale must fail if inventory guard changed");
assert.equal([...db.keys()].filter(k=>k.includes("/records/")).length,1);
const update=await b.store.refresh();
assert.equal(update.code,"sync/conflict","Sessão com rascunho não pode receber atualização destrutiva");
const b2=make();await b2.store.load();
assert.equal(b2.read().data.ingredients[0].stock,20000);
// Parallel independent changes must not overwrite each other.
a.mutate(s=>s.data.clients.push({id:"cliente1",name:"Ana"}));
b2.mutate(s=>s.data.suppliers.push({id:"fornecedor1",name:"Mercado"}));
assert((await a.store.save()).ok);
assert((await b2.store.save()).ok);
await a.store.refresh();
assert.equal(a.read().data.clients.length,1);
assert.equal(a.read().data.suppliers.length,1);
// Two devices attempt to consume the same inventory.
await b2.store.refresh();
a.mutate(s=>{s.data.ingredients[0].stock=10000;s.data.orders.unshift({id:"o10",status:"em_producao",stockDeducted:true})});
b2.mutate(s=>{s.data.ingredients[0].stock=8000;s.data.orders.unshift({id:"o11",status:"em_producao",stockDeducted:true})});
assert((await a.store.save()).ok);
const clash=await b2.store.save();
assert.equal(clash.code,"sync/conflict");
const verified=make();await verified.store.load();
assert.equal(verified.read().data.orders.length,1);
assert.equal(verified.read().data.orders[0].id,"o10");
assert.equal(verified.read().data.ingredients[0].stock,10000);
const incremental=make();await incremental.store.load();
const incrementalSignals=[];incremental.store.subscribe(x=>incrementalSignals.push(x));
const beforeIncremental=fullCollectionReads;
a.mutate(s=>s.data.suppliers.push({id:"new-supplier",name:"Supplier"}));
assert((await a.store.save()).ok);
await new Promise(resolve=>setTimeout(resolve,20));
assert(incrementalSignals.some(x=>x.ok&&x.incremental),"adjacent pulse should use incremental refresh");
assert.equal(incremental.read().data.suppliers.length,2);
assert.equal(fullCollectionReads,beforeIncremental,"adjacent pulse must not read the full records collection");
const missed=make();await missed.store.load();
a.mutate(s=>s.data.clients.push({id:"second-client",name:"Carol"}));
assert((await a.store.save()).ok);
a.mutate(s=>s.data.clients.push({id:"third-client",name:"Dave"}));
assert((await a.store.save()).ok);
const beforeFallback=fullCollectionReads;
const missedResults=[];missed.store.subscribe(x=>missedResults.push(x));
await new Promise(resolve=>setTimeout(resolve,20));
assert(missedResults.some(x=>x.ok&&!x.incremental),"missed pulses must reload complete records");
assert(fullCollectionReads>beforeFallback,"missing pulse chain should fetch records once");
assert.equal(missed.read().data.clients.length,3);
a.store.dispose();b.store.dispose();b2.store.dispose();verified.store.dispose();incremental.store.dispose();missed.store.dispose();
console.log("PASS: Firebase V2 simulado cria conta limpa, separa documentos, preserva edições independentes e bloqueia corrida de estoque.");
