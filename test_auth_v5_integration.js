const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
(async()=>{
 const [guard,v2]=await Promise.all([import("./sync_guard.mjs"),import("./v5_storage.mjs")]);
 const source=fs.readFileSync("firebase_integration.js","utf8").split("\n").filter(line=>!/^import /.test(line)).join("\n");
 const copy=x=>JSON.parse(JSON.stringify(x));
 let state={data:{businessType:"batataria",businessUniverses:{},recipes:[],ingredients:[],orders:[],
  clients:[],suppliers:[],expenses:[],beverages:[],purchases:[],stockMovements:[],losses:[],
  brand:{name:"Potê"},settings:{}},creatives:[]};
 const fresh=()=>copy({data:{...state.data,recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],
  expenses:[],beverages:[],purchases:[],stockMovements:[],losses:[]},creatives:[]});
 const records=new Map();
 const elements=new Map(),listeners={},subscriptions=new Map(),timers=new Map();
 let login=null,transactCount=0,legalAllowed=true,legalChecks=[];
 const el={hidden:true,disabled:false,textContent:"",parentElement:{appendChild(child){elements.set(child.id,child)}},
  style:{},classList:{toggle(){}},addEventListener(){},append(){},appendChild(child){elements.set(child.id,child)}};
 for(const name of ["poteAuthGate","poteGoogleLogin","poteExit","poteSyncStatus",
 "poteLoginMessage","poteBrowserHint","poteLoggedAs","poteAdminOpen","potePlanBadge","potePlanCountdown"])
  elements.set(name,{...el,classList:{toggle(){}},style:{}});
 const cloud=new Map();
 cloud.set("users/u",{email:"test@example.com",displayName:"Canário F05",photoURL:"https://images.example/canario.jpg"});
 cloud.set("users/new-user",{email:"new@example.com",displayName:"Conta Separada",photoURL:"https://images.example/outra.jpg"});
 cloud.set("users/master",{email:"pixmcp@gmail.com",displayName:"Administrador",photoURL:"https://images.example/adm.jpg"});
 cloud.set("users/u/appState/main",{state:{data:{orders:[{id:"old-test-order"}]}},updatedAt:"LEGACY"});
 const snap=path=>({exists:()=>cloud.has(path),data:()=>cloud.has(path)?copy(cloud.get(path)):undefined,metadata:{hasPendingWrites:false}});
 const sdk={
  doc:(_,...parts)=>parts.join("/"),collection:(_,...parts)=>parts.join("/"),
  getDoc:async path=>snap(path),
  setDoc:async(path,value,options)=>{cloud.set(path,{...(options?.merge?cloud.get(path)||{}:{}),...copy(value)});},
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
  ...guard,app:{},createV5Store:v2.createV5Store,
  ensureLegalAcceptance:async({auth})=>{legalChecks.push(auth.currentUser.uid);if(!legalAllowed)throw Error("legal_declined");return true;},
  createWorkerBridge:opts=>({enabled:false,stagingEndpoint:opts.endpoint}),
  console:{...console,warn(){}},window:{
   POTE_USE_V5:true,
   POTE_APP:{snapshot:()=>copy(state),reset:()=>{state=fresh()},applyState:newState=>{state=copy(newState)},
    isPristineDemo:()=>false},POTE_BUSINESS:{refresh(){}},addEventListener:(n,fn)=>{listeners[n]=fn},dispatchEvent(){}
  },
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  document:{getElementById:key=>elements.get(key)||null,createElement:()=>({style:{},hidden:false,setAttribute(){},append(){},addEventListener(){},click(){},remove(){}}),
   body:{classList:{toggle(){}},appendChild(){}}},
  initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),GoogleAuthProvider:class{setCustomParameters(){}},
  getIdTokenResult:async user=>({claims:{email_verified:true,potebatataAdmin:user?.uid==="master",
   firebase:{sign_in_provider:"google.com"}}}),
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
 legalAllowed=false;await login(auth.currentUser);
 assert.equal(ctx.window.POTE_APP_READY,false,"Recusa de termos impede abertura do V5");
 assert.equal(cloud.has("users/u/appState/v5"),false,"Recusa não inicializa banco");
 legalAllowed=true;await login(auth.currentUser);
 assert.deepEqual(legalChecks,["u","u"],"Aceite verificado em cada login");
 assert.equal(ctx.window.POTE_APP_READY,true,"V5 deve abrir mesmo que haja V1 anterior");
 assert.equal(state.data.orders.length,0,"V1 nao deve ser importado");
 assert.equal(ctx.window.POTE_ACCOUNT_PROFILE?.uid,"u","Perfil pertence ao UID autenticado");
 assert.equal(ctx.window.POTE_PROFILE_API.getCurrent().displayName,"Canário F05");
 await ctx.window.POTE_PROFILE_API.save({name:"Nome Editável"});
 assert.equal(cloud.get("users/u").displayName,"Nome Editável","Nome salvo exclusivamente no documento do usuário");
 assert.equal(cloud.get("users/u").photoURL,"https://images.example/canario.jpg","Edição de nome mantém foto atual");
 assert.equal(cloud.has("users/u/appState/v5"),true,"Conta V5 criada");
 assert.equal(cloud.get("users/u/appState/main").state.data.orders.length,1);
 auth.currentUser={uid:"new-user",email:"new@example.com"};
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_APP_READY,true);
 assert.equal(state.data.orders.length,0,"Uma conta nova deve iniciar sem pedidos");
 assert.equal(ctx.window.POTE_ACCOUNT_PROFILE?.uid,"new-user","Não reutilizar UID do canário");
 assert.equal(ctx.window.POTE_PROFILE_API.getCurrent().displayName,"Conta Separada","Nome da outra conta não pode ser herdado");
 assert.equal(ctx.window.POTE_PROFILE_API.getCurrent().photoURL,"https://images.example/outra.jpg","Foto da outra conta não pode ser herdada");
 assert.equal(ctx.window.POTE_AUTH.role,"free","Outra conta não herda a função ADM");
 assert.equal(cloud.get("users/u").displayName,"Nome Editável","Troca de conta não altera perfil anterior");
 assert(cloud.has("users/new-user/appState/v5"));
 assert.deepEqual(cloud.get("users/u/appState/main").state.data.orders,[{id:"old-test-order"}],"Legacy data must be untouched");
 assert.equal(elements.get("poteAuthGate").hidden,true);

 // A browser that merely changed tabs must not trap the account in conflict.
 const pristine=copy(state);
 store.set((uid=>"pote-sync-pending-v5:"+uid)("new-user"),JSON.stringify(guard.makePending("new-user",
  {...pristine,tab:"orders",mode:"adm",expansion:{panel:true}},"navegador fechado")));
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false,"Navigation-only backup must self-heal");
 assert.equal(store.has((uid=>"pote-sync-pending-v5:"+uid)("new-user")),false,"Harmless pending marker must clear");
 // However a truly unsynced sale must stay isolated; no false confirmation.
 const unsaved={...copy(state),data:{...copy(state.data),
  orders:[{id:"must-preserve-offline",status:"recebido",qty:1,price:21.9}]}};
 store.set((uid=>"pote-sync-pending-v5:"+uid)("new-user"),JSON.stringify(guard.makePending("new-user",
  unsaved,"conflito anterior")));
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,true,"Real draft must remain guarded");
 assert.match(ctx.window.POTE_SYNC_GUARD.diagnosis().cause,/Pedidos/);
 assert(store.has((uid=>"pote-sync-pending-v5:"+uid)("new-user")));
 assert.equal(state.data.orders.length,0,"Never import unverified sale as paid");
 store.delete((uid=>"pote-sync-pending-v5:"+uid)("new-user"));
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false);


 // Test actual login recovery of a stale notification-read-only backup.
 // Both locally acknowledged and remotely acknowledged notices must survive.
 const noticeBackup={...copy(state),data:{...copy(state.data),
  notificationCenter:{version:1,read:{
   "broadcast:local-test":"2026-11-19T00:00:00.000Z",
   "broadcast:shared":"2026-11-19T00:01:00.000Z"}}}};
 const beforeNotices=copy(state);
 beforeNotices.data.notificationCenter={version:1,read:{
  "broadcast:remote-test":"2026-11-19T00:03:00.000Z",
  "broadcast:shared":"2026-11-19T00:04:00.000Z"}};
 // Persist a remote-only mark first through the normal V5 store.
 state=beforeNotices;
 listeners["pote:changed"]();
 const flushNotices=timers.get("sync");timers.delete("sync");await flushNotices();
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false);
 store.set((uid=>"pote-sync-pending-v5:"+uid)("new-user"),JSON.stringify(guard.makePending("new-user",
  noticeBackup,"sync/conflict")));
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false,"Notification receipts must not block a sale");
 assert.equal(store.has((uid=>"pote-sync-pending-v5:"+uid)("new-user")),false,"Remove backup only after merged read receipts commit");
 assert.equal(Object.keys(state.data.notificationCenter.read).length,3);
 assert.equal(state.data.notificationCenter.read["broadcast:shared"],"2026-11-19T00:04:00.000Z");
 const cloudReads=cloud.get("users/new-user/appState/v5").state.data.notificationCenter.read;
 assert.equal(Object.keys(cloudReads).length,3,"Cloud must have union of receipts");
 assert.equal(cloudReads["broadcast:local-test"],"2026-11-19T00:00:00.000Z");
 assert.equal(cloudReads["broadcast:remote-test"],"2026-11-19T00:03:00.000Z");
 // A simultaneous unsaved order, even alongside only cosmetic differences,
 // is still a real business conflict and must remain backed up and blocked.
 const unconfirmed={...copy(state),data:{...copy(state.data),
  notificationCenter:{version:1,read:{"broadcast:extra":"2026-11-19T00:06:00.000Z"}},
  orders:[{id:"never-overwrite",status:"recebido",qty:1,price:21.9}]}};
 store.set((uid=>"pote-sync-pending-v5:"+uid)("new-user"),JSON.stringify(guard.makePending("new-user",
  unconfirmed,"sync/conflict")));
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,true,"Real order cannot be cleared by notification exception");
 assert(store.has((uid=>"pote-sync-pending-v5:"+uid)("new-user")));
 store.delete((uid=>"pote-sync-pending-v5:"+uid)("new-user"));
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false);

 state.data.ingredients.push({id:"batata",stock:12000,measureUnit:"g"});
 state.data.orders.push({id:"order1",status:"recebido",stockDeducted:false});
 listeners["pote:changed"]();
 assert(timers.get("sync"));
 const fn=timers.get("sync");timers.delete("sync");await fn();
 assert.equal(cloud.get("users/new-user/appState/v5InventoryGuard").revision,1);
 assert.equal([...cloud.keys()].filter(x=>x.includes("/recordsV5/")).length,2);
 assert.equal(ctx.window.POTE_SYNC_GUARD.blocked,false);
 assert.equal(cloud.get("users/u/appState/main").state.data.orders[0].id,"old-test-order");
 auth.currentUser={uid:"master",email:"pixmcp@gmail.com",displayName:"Google ADM"};
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_AUTH.role,"admin","Só email Google mestre com claim assinada é ADM");
 assert.equal(ctx.window.POTE_ACCOUNT_PROFILE.uid,"master");
 assert.equal(ctx.window.POTE_ACCOUNT_PROFILE.displayName,"Administrador");
 auth.currentUser={uid:"u",email:"test@example.com"};
 await login(auth.currentUser);
 assert.equal(ctx.window.POTE_AUTH.role,"free","Após sair do ADM, canário não herda privilégios");
 assert.equal(ctx.window.POTE_ACCOUNT_PROFILE.displayName,"Nome Editável");
 assert.equal(ctx.window.POTE_ACCOUNT_PROFILE.photoURL,"https://images.example/canario.jpg");
 assert.equal(cloud.get("users/master").displayName,"Administrador","Canário não contamina perfil ADM");
 console.log("PASS: V5 sem estado cruzado; nome/foto isolados por UID; ADM apenas com claim.");
})().catch(e=>{console.error(e);process.exitCode=1});
