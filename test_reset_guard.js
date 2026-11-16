const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const html=fs.readFileSync("public/index.html","utf8");
const start=html.indexOf("resetAll=function(){"),end=html.indexOf("const poteOriginalRender",start);
assert(start>0&&end>start,"Reset must use verified backup guard from production build");
let downloads=0,resets=0,promptAnswer="NÃO",confirmed=true,backupFails=false;
const window={
 POTE_AUTH:{uid:"test-u"},
 POTE_SYNC_GUARD:{blocked:false,downloadPending(){downloads++;if(backupFails)throw Error("storage denied")}},
 POTE_APP:{reset(){resets++}},
 confirm:()=>confirmed,prompt:()=>promptAnswer
};
const ctx={window,console:{warn(){}},toast(){}};
vm.createContext(ctx);
vm.runInContext(html.slice(start,end),ctx);
ctx.resetAll();
assert.equal(downloads,1);
assert.equal(resets,0,"Wrong confirmation must preserve data");
promptAnswer="ZERAR";window.POTE_SYNC_GUARD.blocked=true;
ctx.resetAll();
assert.equal(resets,0,"Outstanding sync conflict must prohibit reset");
window.POTE_SYNC_GUARD.blocked=false;backupFails=true;
ctx.resetAll();
assert.equal(resets,0,"Failed backup must prohibit reset");
backupFails=false;confirmed=false;
ctx.resetAll();
assert.equal(resets,0,"First confirmation cancel must preserve data");
confirmed=true;
ctx.resetAll();
assert.equal(resets,1,"Only two confirmations plus backup may reset");
console.log("PASS: zerar conta exige backup completo, confirmação textual e sincronização sem conflitos.");
