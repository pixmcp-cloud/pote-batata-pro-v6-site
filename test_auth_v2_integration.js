const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
(async()=>{
 const [guard,v2]=await Promise.all([import("./sync_guard.mjs"),import("./v2_storage.mjs")]);
 const source=fs.readFileSync("firebase_integration.js","utf8").split("\n").filter(line=>!/^import /.test(line)).join("\n");
 const copy=x=>JSON.parse(JSON.stringify(x));
 let state={data:{businessType:"batataria",businessUniverses:{},recipes:[],ingredients:[],orders:[],
  clients:[],suppliers:[],expenses:[],beverages:[],purchases:[],stockMovements:[],losses:[],
  brand:{name:"Potê"},settings:{}},creatives:[]};
 const fresh=()=>copy({data:{...state.data,recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],
  expenses:[],beverages:[],purchases:[],stockMovements:[],losses:[]},creatives:[]});
 const records=new Map();
 const elements=new Map(),listeners={},subscriptions=new Map(),timers=new Map();
 let login=null,transactCount=0;
 const el={hidden:true,disabled:false,textContent:"",parentElement:{appendChild(child){elements.set(child.id,child)}},
  style:{},classList:{toggle(){}},addEventListener(){}};
 for(const name of ["poteAuthGate","poteGoogleLogin","poteExit","poteSyncStatus",
 "poteLoginMessage","poteBrowserHint","poteLoggedAs","poteAdminOpen","potePlanBadge","potePlanCountdown"])
  elements.set(name,{...el,classList:{toggle(){}},style:{}});
 const cloud=new Map();
 cloud.set("users/u",{email:"test@example.com"});
 cloud.set("users/u/appState/main",{state:{data:{orders:[{id:"old-test-order"}]}},updatedAt:"LEGACY"});
 const snap=path=>({exists:()=>cloud.has(path),data:()=>cloud.has(path)?copy(cloud.get(path)):undefined,metadata:{hasPendingWrites:false}});
 const sdk={
  doc:(_,...parts)=>parts.join("/"),collection:(_,...parts)=>parts.join("/"),
  getDoc:async path=>snap(path),
  getDocs:async path=>({docs:[...cloud.entries()].filter(([key])=>key.startsWith(path+"/")).map(([key,v])=>
    ({id:key.slice(path.length+1),data:()=>copy(v)}))}),
  serverTimestamp:()=>"SERVER",
  onSnapshot:(path,cb)=>{subscriptions.set(path,cb);return ()=>subscriptions.delete(path)},
  runTransaction:async(db,fn)=>{
   transactCount++;const edits=[];
   const tx={get:async path=>snap(path),
    set:(path,value,options)=>edits.push({path,value,merge:options?.merge}),
    delete:path=>edits.push({path,deleted:true})};
   const out=await fn(tx);
   for(const e of edits){
    if(e.deleted)cloud.delete(e.path);
    else cloud.set(e.path,{...(e.merge?cloud.get(e.path)||{}:{}),...copy(e.value)});
   }
   return out;
  }
 };
 const auth={currentUser:null},store=new Map();
 const ctx={
  ...guard,createV2Store:v2.createV2Store,
  console:{...console,warn(){}},window:{
   POTE_USE_V2:true,
   POTE_APP:{snapshot:()=>copy(state),reset:()=>{state=fresh()},applyState:newState=>{state=copy(newState)},
    isPristineDemo:()=>false},POTE_BUSINESS:{refresh(){}},addEventListener:(n,fn)=>{listeners[n]=fn},dispatchEvent(){}
  },
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  document:{getElementById:key=>elements.get(key)||null,createElement:()=>({style:{},addEventListener(){},click(){},remove(){}}),
   body:{classList:{toggle(){}},appendChild(){}}},
  initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),GoogleAuthProvider:class{setCustomParameters(){}},
  getIdTokenResult:async()=>({claims:{email_verified:true,firebase:{sign_in_provider:"google.com"}}}),
  resolveLicense:()=>({active:false,kind:"free",label:"FREE",expiresAt:null}),
  licenseCountdown:()=>({state:"inactive",expiresAt:null}),dateBR:()=>"",
  onAuthStateChanged:(a,callback)=>{login=callback},signInWithPopup:async()=>{},signOut:async()=>{},
  setTimeout:(fn,delay)=>{if(delay===1300){timers.set("sync",fn);return "sync"}return 8},
  clearTimeout:t=>{if(t==="sync")timers.delete("sync")},
  setInterval:()=>1,clearInterval:()=>{},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  Event:class{constructor(type){this.type=type}},
  navigator:{userAgent:""},Number,String,JSON,Array,Object,Date,Math,Map,Set,Promise,Error,URL,Blob,TextEncoder,
  crypto:globalThis.crypto,
  ...sdk
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 auth.currentUser={uid:"u",email:"test@example.com"};
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_APP_READY,true);
 assert.equal(state.data.orders.length,0,"V2 must start empty despite old V1 test orders");
 assert(cloud.has("users/u/appState/v2"));
 assert.deepEqual(cloud.get("users/u/appState/main").state.data.orders,[{id:"old-test-order"}],"Legacy data must be untouched");
 assert.equal(elements.get("poteAuthGate").hidden,true);
 state.data.ingredients.push({id:"batata",stock:12000,measureUnit:"g"});
 state.data.orders.push({id:"order1",status:"recebido",stockDeducted:false});
 listeners["pote:changed"]();
 assert(timers.get("sync"));
 const fn=timers.get("sync");timers.delete("sync");await fn();
 assert.equal(cloud.get("users/u/appState/v2InventoryGuard").revision,1);
 assert.equal([...cloud.keys()].filter(x=>x.includes("/records/")).length,2);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false);
 assert.equal(cloud.get("users/u/appState/main").state.data.orders[0].id,"old-test-order");
 console.log("PASS: login V2 integrado, conta de teste vazia, gravação atômica, regras separadas e V1 intacto.");
})().catch(e=>{console.error(e);process.exitCode=1});
