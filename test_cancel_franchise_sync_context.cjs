const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("source/pote_app_base.html","utf8");
function portion(start,terminator){
 const i=source.indexOf(start),j=source.indexOf(terminator,i+start.length);
 assert(i>=0&&j>i,"Cannot find source span "+start);
 return source.slice(i,j);
}
const cancellation=portion("function cancelOrder(id){","function showReceipt(id,type)");
const guard=portion("function operationReady(", "function canOperate(");
const toastMessages=[],opened=[],moved=[];
const warning={hidden:true,scrollIntoView(){moved.push("scroll")}};
const gate={blocked:true,diagnosis:()=>({title:"Backup local difere do estoque na nuvem"}),
 showRecovery(){moved.push("recovery")}};
const window={POTE_AUTH:{uid:"test-franchise",franchiseActive:true,proActive:true},
 POTE_APP_READY:true,POTE_MODULE_HEALTH:{safeToOperate:true},
 POTE_SYNC_GUARD:gate,POTE_CANCEL:{open:id=>{opened.push(id);return true;}}};
const ctx={window,navigator:{onLine:true},document:{getElementById:id=>id==="poteOrderSyncWarning"?warning:null},
 toast:(msg,type)=>toastMessages.push({msg,type}),console,Number,Map,Array,Date};
vm.createContext(ctx);vm.runInContext(guard+"\n"+cancellation,ctx);
assert.equal(ctx.cancelOrder("order1"),false);
assert.equal(opened.length,0);
assert.match(toastMessages[0].msg,/Cancelamento não realizado: Backup local difere do estoque/);
assert.match(toastMessages[0].msg,/Nenhum pedido, recebimento ou estoque foi alterado/);
assert(!toastMessages[0].msg.includes("Venda NÃO registrada"));
assert(moved.includes("recovery"));
assert.equal(warning.hidden,false);
gate.blocked=false;
assert.equal(ctx.cancelOrder("order1"),true);
assert.deepEqual(opened,["order1"]);
assert.match(source,/function newOrder\(\)\{\s*if\(!operationReady\("Pedido"\)\)/);
assert.match(source,/function produce\(id\)\{\s*if\(!operationReady\("Produção"\)\)/);
assert.match(source,/function finishOrder\(id\)\{if\(!operationReady\("Entrega"\)\)/);
console.log("PASS franchise: cancel conflict gives specific diagnosis, no stock/order mutation, current synced cancellation works; new order/production/delivery have action context.");
