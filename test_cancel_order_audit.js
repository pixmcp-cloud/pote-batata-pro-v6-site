const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=f=>fs.readFileSync(f,"utf8");
const elements=new Map(),notifications=[];
function el(id){
 if(!elements.has(id))elements.set(id,{id,innerHTML:"",textContent:"",hidden:false,
 disabled:false,value:"",focus(){},addEventListener(){},classList:{add(){},remove(){}},
 querySelectorAll(){return []}});
 return elements.get(id);
}
const document={
 getElementById(id){return id==="poteCancelOrderModal"&&!elements.has(id)?null:el(id)},
 createElement(){return {id:"",hidden:true,innerHTML:"",addEventListener(){}}},
 body:{appendChild(x){elements.set(x.id,x)}}
};
const potato={id:"batata",name:"Batata",stock:15000,measureUnit:"g",yield:100};
const bacon={id:"bacon",name:"Bacon",stock:400,measureUnit:"g",yield:100};
const pot={id:"pote",name:"Pote térmico 500 g",stock:8,measureUnit:"un",yield:100};
const drink={id:"cola",name:"Refrigerante Cola",stock:9,measureUnit:"un"};
function order(id,status,deducted){
 return {id,name:"Batata com bacon",recipeId:"r1",qty:2,status,stockDeducted:deducted,
  items:[{id:"batata",g:500,yieldPct:100},{id:"bacon",g:40,yieldPct:100},
   {id:"pote",g:1,yieldPct:100}],
  beverageItems:[{id:"cola",qty:1}]};
}
const pending=order("pending","recebido",false);
const produced=order("produced","em_producao",true);
const completed=order("completed","entregue",true);
const legacy=order("legacy","cancelado",true);
const lost=order("lost","em_producao",true);
const missing=order("missing","em_producao",true);
missing.items.push({id:"invalid-missing",g:100,yieldPct:100});
const state={data:{ingredients:[potato,bacon,pot],beverages:[drink],
 orders:[pending,produced,completed,legacy,lost,missing],
 stockMovements:[],purchases:[]},tab:"orders"};
const window={POTE_AUTH:{role:"admin"},POTE_ORDER:{scrollToOrders(){}},};
let persists=0,renders=0,id=0;
const ctx={window,document,state,console,Math,Date,JSON,Number,String,Map,Set,Intl,
 canOperate(){return true},persist(){persists++},render(){renders++},toast(v){notifications.push(v)},
 uid(){return "move-"+(++id)}};
vm.createContext(ctx);
vm.runInContext(read("stock_math.js"),ctx);
vm.runInContext(read("cancel_order_flow.js"),ctx);
const C=window.POTE_CANCEL;
assert(C);
const baseline={potato:potato.stock,bacon:bacon.stock,pot:pot.stock,drink:drink.stock};
assert.equal(C.open("pending"),true);
assert.equal(C.perform("return"),true,"Pedido não produzido deve liberar reserva");
assert.equal(pending.status,"cancelado");
assert.equal(pending.cancelStockAction,"sem-baixa");
assert.equal(potato.stock,baseline.potato);
assert.equal(pot.stock,baseline.pot);
assert.equal(drink.stock,baseline.drink);
assert.equal(C.open("produced"),true);
assert(el("poteCancelDetails").innerHTML.toLowerCase().includes("devolver"));
assert.equal(C.perform("return"),true);
assert.equal(produced.status,"cancelado");
assert.equal(produced.stockRestored,true);
assert.equal(produced.cancelStockAction,"devolvido");
assert.equal(potato.stock,baseline.potato+1000);
assert.equal(bacon.stock,baseline.bacon+80);
assert.equal(pot.stock,baseline.pot+2);
assert.equal(drink.stock,baseline.drink+2);
assert.equal(C.canRecover(produced),false);
assert.equal(C.open("produced"),false,"Estorno duplo bloqueado");
assert.equal(C.perform("return"),false);
const movements=state.data.stockMovements.length;
assert.equal(movements,4);
assert(state.data.stockMovements.every(x=>x.reason.includes("Estorno")));
assert.equal(C.open("completed"),true);
assert.equal(C.perform("return"),true);
assert.equal(completed.status,"cancelado");
assert.equal(potato.stock,baseline.potato+2000);
assert.equal(C.open("legacy"),true,"Pedido cancelado antes sem retorno pode regularizar");
assert.equal(C.perform("return"),true);
assert.equal(legacy.stockRestored,true);
assert.equal(potato.stock,baseline.potato+3000);
assert.equal(C.open("lost"),true);
const originalLossStatus=lost.status,lossMoves=state.data.stockMovements.length;
window.POTE_LOSSES={recordCancelled:()=>({ok:false,error:"Banco de perdas falhou"})};
assert.equal(C.perform("discard"),false,"Falha no registro de perda deve impedir cancelamento");
assert.equal(state.data.orders.find(o=>o.id==="lost").status,originalLossStatus);
assert.equal(state.data.stockMovements.length,lossMoves);
window.POTE_LOSSES={recordCancelled:o=>({ok:true,event:{id:"loss-"+o.id}})};
assert.equal(C.perform("discard"),true);
assert.equal(lost.stockReturnDeclined,true);
assert.equal(C.canRecover(lost),false,"Perda confirmada não pode gerar estorno posterior");
const beforeFail=potato.stock,oldCount=state.data.stockMovements.length;
assert.equal(C.open("missing"),true);
assert.equal(el("poteCancelReturn").disabled,true);
assert.equal(C.perform("return"),false,"Sem cadastro de ingrediente não pode estornar parcialmente");
assert.equal(potato.stock,beforeFail);
assert.equal(state.data.stockMovements.length,oldCount);
assert(persists>=5&&renders>=5);
const src=read("source/pote_app_base.html"),pub=read("public/index.html");
assert(src.includes("POTE_CANCEL?.open"));
assert(pub.includes("cancel_order_flow.js?v=v3-wave1-20261116"));
console.log("PASS: reserva sem baixa, restituição de batata/bacon/pote/refri, cancelamento de entregue, recuperação legada, perda, sem duplo estorno e sem estorno parcial.");
