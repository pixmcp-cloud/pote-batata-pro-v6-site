const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const src=fs.readFileSync("source/pote_app_base.html","utf8");
const f=src.indexOf("function validateImportData("),e=src.indexOf("\nfunction uid(",f);
const a=src.indexOf("async function importData("),b=src.indexOf("\nfunction resetAll(",a);
assert(f>0&&e>f&&a>0&&b>a);
const initial={recipes:[{id:"r1"}],ingredients:[{id:"i1",stock:1000}],orders:[{id:"o1"}],
 clients:[],suppliers:[],expenses:[],settings:{fee:4},brand:{name:"Original"}};
let state={data:JSON.parse(JSON.stringify(initial)),expansion:null};
let resets=0,downloads=0,lastToast="",allow=true;
const confirmations=[];
const window={POTE_AUTH:{uid:"u1"},POTE_SYNC_GUARD:{blocked:false,downloadPending(){downloads++}}};
const ctx={state,window,TextEncoder,JSON,Array,Object,String,Set,Error,confirm:message=>{confirmations.push(message);return allow},
 exportData(){downloads++},render(){resets++},toast:s=>lastToast=s};
vm.createContext(ctx);vm.runInContext(src.slice(f,e)+"\n"+src.slice(a,b),ctx);
const bad={...initial,orders:[{id:"dup"},{id:"dup"}]};
assert.equal(ctx.validateImportData(bad).ok,false);
assert.equal(ctx.validateImportData({...initial,orders:"notarray"}).ok,false);
const file=data=>({size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)});
async function assertContextChangeCancels(update,expectedMessage){
 const initialSession=window.POTE_AUTH,initialUid=initialSession.uid;
 const initialState=ctx.state,initialData=initialState.data;
 const before=[downloads,resets,confirmations.length];
 let finish;
 const reading=new Promise(resolve=>{finish=resolve});
 const importing=ctx.importData({text:()=>reading});
 update();
 const currentState=ctx.state,currentData=currentState.data;
 finish(JSON.stringify({...initial,orders:[{id:"unexpected-import"}]}));
 await importing;
 assert.deepEqual([downloads,resets,confirmations.length],before);
 assert.equal(ctx.state,currentState);
 assert.equal(ctx.state.data,currentData);
 assert.match(lastToast,expectedMessage);
 window.POTE_AUTH=initialSession;
 initialSession.uid=initialUid;
 ctx.state=initialState;
 initialState.data=initialData;
 window.POTE_SYNC_GUARD.blocked=false;
}
(async()=>{
 await ctx.importData(file(bad));
 assert.equal(downloads,0);assert.equal(resets,0);
 allow=false;
 await ctx.importData(file({...initial,orders:[{id:"replacement"}]}));
 assert.equal(downloads,0);assert.equal(resets,0);
 allow=true;
 await ctx.importData(file({backupVersion:1,uid:"u1",state:{unlocked:"new",creatives:[{id:"art1",name:"Arte"}],audit:["importante"],data:{
  recipes:[{id:"new"}],ingredients:[{id:"newi",stock:50}],orders:[{id:"replacement"}],
  clients:[],suppliers:[],expenses:[],brand:{name:"Restaurado"}
 }}}));
 assert.equal(downloads,1);assert.equal(resets,1);
 assert.equal(state.data.orders[0].id,"replacement");
 assert.equal(state.data.brand.name,"Restaurado");
 assert.equal(state.unlocked,"new");
 assert.equal(state.creatives[0].id,"art1");
 assert.equal(state.audit[0],"importante");
 assert.equal(state.data.settings.fee,4,"Missing settings must retain old compatible defaults");
 window.POTE_SYNC_GUARD.blocked=true;
 await ctx.importData(file(initial));
 assert.equal(downloads,1);assert.equal(resets,1,"Pending cloud conflict must prevent replacement");
 window.POTE_SYNC_GUARD.blocked=false;
 const changed=/conta ou os dados mudaram/;
 await assertContextChangeCancels(()=>{window.POTE_AUTH.uid="u2"},changed);
 await assertContextChangeCancels(()=>{window.POTE_AUTH={uid:"u1"}},changed);
 await assertContextChangeCancels(()=>{ctx.state={...ctx.state}},changed);
 await assertContextChangeCancels(()=>{ctx.state.data={...ctx.state.data}},changed);
 await assertContextChangeCancels(()=>{window.POTE_SYNC_GUARD.blocked=true},/Conflito de sincronização/);
 const start=confirmations.length;
 await ctx.importData(file({backupVersion:1,uid:"u2",state:{data:initial}}));
 assert.equal(confirmations.length,start+2);
 assert.match(confirmations[start],/pertence a outra conta/);
 assert.match(confirmations[start+1],/SUBSTITUI/);
 assert.equal(downloads,2);
 assert.equal(resets,2);
 assert.equal(window.POTE_AUTH.uid,"u1");
 assert.equal(state.data.orders[0].id,"o1");
 console.log("PASS: importação de backup validada, duas confirmações para outro UID e cancelamento se a conta, o estado ou a sincronização mudam durante a leitura.");
})().catch(e=>{console.error(e);process.exitCode=1});
