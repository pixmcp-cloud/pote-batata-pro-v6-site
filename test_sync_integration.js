const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
(async()=>{
 const {stableJson,matchesRemote,nextRevision,jsonBytes,MAX_APPSTATE_BYTES,pendingKey,makePending,pendingMatchesLoadedState}=await import("./sync_guard.mjs");
 const source=fs.readFileSync("firebase_integration.js","utf8").split("\n").filter(s=>!/^import /.test(s)).join("\n");
 const copy=x=>JSON.parse(JSON.stringify(x));
 const mk=()=>({data:{orders:[],ingredients:[],recipes:[],clients:[],suppliers:[],expenses:[],losses:[]}});
 let local=mk(),reloads=0;
 const cloud={};
 cloud["users/u"]={email:"test@example.com"};
 cloud["users/u/appState/main"]={state:copy(local),updatedAt:{seconds:100}};
 const elements=new Map(),listens={},subs=new Map();
 const fakeParent={appendChild(b){elements.set(b.id,b)}};
 for(const name of ["poteAuthGate","poteGoogleLogin","poteExit","poteSyncStatus","poteLoginMessage","poteBrowserHint","poteLoggedAs","poteAdminOpen","potePlanBadge","potePlanCountdown"]){
  elements.set(name,{hidden:false,disabled:false,textContent:"",parentElement:fakeParent,
    style:{},classList:{toggle(){}},addEventListener(name,cb){this[name+"Handler"]=cb}});
 }
 const store=new Map();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const auth={currentUser:null};let authCallback=null,saveTimer=null;
 const snapshot=path=>({exists:()=>Object.hasOwn(cloud,path),data:()=>copy(cloud[path]||{}),metadata:{hasPendingWrites:false}});
 let transactions=0,writes=0;
 const context={
  console:{...console,warn(){}},JSON,Number,String,Date,Array,Object,Math,Promise,Map,Set,Intl,Error,Blob,URL,
  stableJson,matchesRemote,nextRevision,jsonBytes,MAX_APPSTATE_BYTES,pendingKey,makePending,pendingMatchesLoadedState,
  localStorage:storage,navigator:{userAgent:""},
  document:{getElementById:id=>elements.get(id)||null,createElement:()=>({style:{},addEventListener(){},click(){},remove(){}}),body:{classList:{toggle(){}},appendChild(){}}},
  window:{POTE_USE_V2:false,confirm:()=>true,location:{reload(){reloads++}},
   POTE_APP:{snapshot:()=>copy(local),applyState:x=>{local=copy(x)},reset:()=>{local=mk()},isPristineDemo:()=>false},
   POTE_BUSINESS:{refresh(){}},addEventListener:(name,cb)=>{listens[name]=cb},
   dispatchEvent(){}},
  Event:class {constructor(type){this.type=type}},
  CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},
  initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),GoogleAuthProvider:class {setCustomParameters(){}},
  getIdTokenResult:async()=>({claims:{email_verified:true,firebase:{sign_in_provider:"google.com"}}}),
  resolveLicense:()=>({active:false,kind:"free",label:"FREE",expiresAt:null}),
  dateBR:()=>"",licenseCountdown:()=>({state:"inactive",expiresAt:null}),
  doc:(db,...paths)=>paths.join("/"),
  getDoc:async path=>snapshot(path),
  setDoc:async(path,payload)=>{cloud[path]={...(cloud[path]||{}),...copy(payload)};writes++},
  serverTimestamp:()=>({seconds:Date.now()/1000}),
  onSnapshot:(path,cb)=>{subs.set(path,cb);return ()=>subs.delete(path)},
  onAuthStateChanged:(a,cb)=>{authCallback=cb},
  runTransaction:async(db,fn)=>{
   transactions++;
   const queued=[];
   const tx={
    get:async path=>snapshot(path),
    set:(path,payload)=>queued.push([path,payload])
   };
   const out=await fn(tx);
   for(const [path,payload] of queued){cloud[path]={...cloud[path],...copy(payload)};writes++}
   return out;
  },
  signInWithPopup:async()=>{},signOut:async()=>{},
  setTimeout:(fn,delay)=>{if(delay===1300){saveTimer=fn;return {save:true}}return setTimeout(fn,delay)},
  clearTimeout:t=>{if(t?.save)saveTimer=null;else if(t)clearTimeout(t)},
  setInterval:()=>1,clearInterval:()=>{}
 };
 vm.createContext(context);
 vm.runInContext(source,context);
 auth.currentUser={uid:"u",email:"test@example.com",displayName:"Test"};
 await authCallback(auth.currentUser);
 assert.equal(elements.get("poteAuthGate").hidden,true);
 assert.equal(elements.get("poteSyncStatus").textContent,"Dados salvos na nuvem");
 assert(!context.window.POTE_SYNC_GUARD.blocked);
 assert.equal(context.window.POTE_APP_READY,true);
 assert(elements.has("poteFullAccountBackup"),"Full backup must be available after login");
 // Single-device write commits once, with an optimistic revision.
 local.data.orders.push({id:"a",price:29});
 listens["pote:changed"]();
 assert(saveTimer);
 let next=saveTimer;saveTimer=null;
 assert.equal(await next(),true);
 assert.equal(cloud["users/u/appState/main"].state.data.orders.length,1);
 assert.equal(cloud["users/u/appState/main"].syncRevision,1);
 assert.equal(writes,1);
 // A second device writes before this client sends its next update.
 cloud["users/u/appState/main"].state.data.orders.push({id:"b",price:31});
 local.data.orders.push({id:"c",price:40});
 listens["pote:changed"]();
 next=saveTimer;saveTimer=null;
 assert.equal(await next(),false,"Concurrent data must not be overwritten");
 assert.equal(cloud["users/u/appState/main"].state.data.orders.length,2);
 assert.equal(cloud["users/u/appState/main"].state.data.orders[1].id,"b");
 assert.equal(context.window.POTE_SYNC_GUARD.blocked,true);
 const pending=JSON.parse(store.get(pendingKey("u")));
 assert.equal(pending.state.data.orders.length,2);
 assert.equal(pending.state.data.orders[1].id,"c");
 assert.equal(cloud["users/u/appState/main"].syncRevision,1);
 assert(elements.get("poteSyncStatus").textContent.includes("CONFLITO"));
 const previous=transactions;
 listens["pote:changed"]();
 assert.equal(transactions,previous,"Blocked state must never attempt new transactions");
 assert(elements.get("potePendingSyncBackup").hidden===false);
 assert(elements.get("poteSyncResolve").hidden===false);
 assert.equal(context.window.POTE_SYNC_GUARD.resolvePendingConflict(),true);
 assert.equal(reloads,1);
 assert.equal(store.has(pendingKey("u")),false);
 assert.equal(context.window.POTE_SYNC_GUARD.blocked,false);
 console.log("PASS: login real simulado, escrita atômica, conflito entre dispositivos bloqueado, rascunho local isolado e exportação.");
})().catch(e=>{console.error(e);process.exitCode=1});
