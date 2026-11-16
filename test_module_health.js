const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const events={},out={};
const win={addEventListener:(name,fn)=>events[name]=fn,POTE_APP_READY:true};
const ctx={window:win,document:{getElementById:()=>({textContent:"",setAttribute(){}})},
 console:{error(){}},Date,Object};
vm.createContext(ctx);vm.runInContext(fs.readFileSync("module_health.js","utf8"),ctx);
let result=win.POTE_HEALTH.scan();
assert.equal(result.safeToOperate,false);
assert(result.missing.includes("estoque"));
for(const mod of ["POTE_STOCK","POTE_ORDER","POTE_CANCEL","POTE_LOSSES","POTE_PAYMENT","POTE_FINANCE"])
 win[mod]={};
result=win.POTE_HEALTH.scan();
assert.equal(result.safeToOperate,true);
assert(result.warnings.includes("radar"));
events["pote:user-ready"]();
assert.equal(win.POTE_MODULE_HEALTH.safeToOperate,true);
console.log("PASS: falha explícita de módulos críticos e bloqueio de operações parciais.");
