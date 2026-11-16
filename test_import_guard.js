const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const src=fs.readFileSync("source/pote_app_base.html","utf8");
const f=src.indexOf("function validateImportData("),e=src.indexOf("\nfunction uid(",f);
const a=src.indexOf("async function importData("),b=src.indexOf("\nfunction resetAll(",a);
assert(f>0&&e>f&&a>0&&b>a);
const initial={recipes:[{id:"r1"}],ingredients:[{id:"i1",stock:1000}],orders:[{id:"o1"}],
 clients:[],suppliers:[],expenses:[],settings:{fee:4},brand:{name:"Original"}};
let state={data:JSON.parse(JSON.stringify(initial)),expansion:null};
let resets=0,downloads=0,lastToast="",allow=true;
const window={POTE_AUTH:{uid:"u1"},POTE_SYNC_GUARD:{blocked:false,downloadPending(){downloads++}}};
const ctx={state,window,TextEncoder,JSON,Array,Object,String,Set,Error,confirm:()=>allow,
 exportData(){downloads++},render(){resets++},toast:s=>lastToast=s};
vm.createContext(ctx);vm.runInContext(src.slice(f,e)+"\n"+src.slice(a,b),ctx);
const bad={...initial,orders:[{id:"dup"},{id:"dup"}]};
assert.equal(ctx.validateImportData(bad).ok,false);
assert.equal(ctx.validateImportData({...initial,orders:"notarray"}).ok,false);
const file=data=>({size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)});
(async()=>{
 await ctx.importData(file(bad));
 assert.equal(downloads,0);assert.equal(resets,0);
 allow=false;
 await ctx.importData(file({...initial,orders:[{id:"replacement"}]}));
 assert.equal(downloads,0);assert.equal(resets,0);
 allow=true;
 await ctx.importData(file({backupVersion:1,uid:"u1",state:{data:{
  recipes:[{id:"new"}],ingredients:[{id:"newi",stock:50}],orders:[{id:"replacement"}],
  clients:[],suppliers:[],expenses:[],brand:{name:"Restaurado"}
 }}}));
 assert.equal(downloads,1);assert.equal(resets,1);
 assert.equal(state.data.orders[0].id,"replacement");
 assert.equal(state.data.brand.name,"Restaurado");
 assert.equal(state.data.settings.fee,4,"Missing settings must retain old compatible defaults");
 window.POTE_SYNC_GUARD.blocked=true;
 await ctx.importData(file(initial));
 assert.equal(downloads,1);assert.equal(resets,1,"Pending cloud conflict must prevent replacement");
 console.log("PASS: importação de backup completo/legado validada, cópia anterior obrigatória, sem substituição em conflito.");
})().catch(e=>{console.error(e);process.exitCode=1});
