const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const events={},win={addEventListener:(name,fn)=>events[name]=fn,POTE_APP_READY:true};
const ctx={window:win,document:{getElementById:()=>({textContent:"",setAttribute(){}})},
 console:{error(){}},Date,Object};
vm.createContext(ctx);vm.runInContext(fs.readFileSync("module_health.js","utf8"),ctx);
assert.equal(win.POTE_MODULE_CONTRACTS.version,1);
let result=win.POTE_HEALTH.scan();
assert.equal(result.safeToOperate,false);
assert(result.missing.includes("estoque"));
for(const contract of Object.values(win.POTE_MODULE_CONTRACTS.critical))win[contract.name]={};
result=win.POTE_HEALTH.scan();
assert.equal(result.safeToOperate,false,"A placeholder module must not allow a sale");
assert(result.invalid.some(x=>x.module==="pagamentos"&&x.missingMethods.includes("calculate")));
for(const contract of Object.values(win.POTE_MODULE_CONTRACTS.critical)){
 for(const fn of contract.methods)win[contract.name][fn]=()=>{};
}
result=win.POTE_HEALTH.scan();
assert.equal(result.safeToOperate,true);
assert(result.warnings.includes("radar"));
delete win.POTE_LOSSES.recordCancelled;
assert.equal(win.POTE_HEALTH.scan().safeToOperate,false,"Missing cancellation must fail closed");
win.POTE_LOSSES.recordCancelled=()=>{};
events["pote:user-ready"]();
assert.equal(win.POTE_MODULE_HEALTH.safeToOperate,true);
console.log("PASS F07/F15: versioned method contracts, failure isolation, safe recovery.");
