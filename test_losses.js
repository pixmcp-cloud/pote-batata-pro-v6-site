const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=x=>fs.readFileSync(x,"utf8");
const potato={id:"batata",name:"Batata",measureUnit:"g",category:"Base",
 stock:20000,purchasePrice:100,purchaseQuantity:20,purchaseUnit:"kg"};
const bacon={id:"bacon",name:"Bacon",measureUnit:"g",category:"Proteína",
 stock:3000,purchasePrice:90,purchaseQuantity:3,purchaseUnit:"kg"};
const pot={id:"pote",name:"Pote 500g",measureUnit:"un",category:"Embalagem",
 stock:200,purchasePrice:100,purchaseQuantity:100,purchaseUnit:"un"};
const soda={id:"cola",name:"Cola",measureUnit:"un",stock:50,
 purchasePrice:40,purchaseQuantity:10,purchaseUnit:"un",sellPrice:7};
const order={id:"prepared1",status:"entregue",stockDeducted:true,name:"Frango",
 recipeId:"r1",qty:2,price:50,deliveryFee:5,profit:25,unitContribution:30,
 items:[{id:"batata",g:500,yieldPct:100},{id:"bacon",g:100,yieldPct:100},
 {id:"pote",g:1,yieldPct:100,isPkg:true}],
 beverageItems:[{id:"cola",qty:1}],paymentStatus:"Informado"};
const cancelledOrder={...structuredClone(order),id:"discarded2",qty:1,price:40,
 status:"em_producao",stockDeducted:true,deliveryFee:0};
const pendingOrder={...structuredClone(order),id:"reserved3",qty:1,price:40,
 status:"recebido",stockDeducted:false,deliveryFee:0};
const data={ingredients:[potato,bacon,pot],beverages:[soda],
 orders:[order,cancelledOrder,pendingOrder],losses:[],stockMovements:[],
 recipes:[{id:"r1",name:"Frango",items:[{id:"batata",g:500}]}],addons:[],
 settings:{usePackagingStock:false},expenses:[]};
const state={data,tab:"losses"};
const elements=new Map(),calls=[];
function el(id){
 if(!elements.has(id))elements.set(id,{id,value:"",innerHTML:"",textContent:"",
 hidden:false,disabled:false,focus(){},addEventListener(){},remove(){},
 classList:{add(){},remove(){}}});
 return elements.get(id);
}
const document={
 getElementById(id){return elements.get(id)||null},
 createElement(){return {id:"",innerHTML:"",hidden:false,addEventListener(){},remove(){}}},
 body:{appendChild(node){elements.set(node.id,node)}}
};
const window={POTE_AUTH:{uid:"test",role:"admin"},POTE_CANCEL:{wasDeducted:o=>o.stockDeducted===true},
 addEventListener(){},confirm(){return true}};
let saved=0,rendered=0,sequence=0;
const ctx={window,document,state,console,Number,Math,Date,Array,Map,Set,String,JSON,
 Intl,structuredClone,
 uid(){return "loss-t-"+(++sequence)},
 persist(){saved++},render(){rendered++},
 toast(m){calls.push(m)},alert(m){calls.push(m)},confirm(){return true},
 canOperate(){return true}};
vm.createContext(ctx);
vm.runInContext(read("stock_math.js"),ctx);
vm.runInContext(read("losses.js"),ctx);
const L=window.POTE_LOSSES;
assert(L,"Perdas deve estar disponível");
assert.equal(L.costUnit(potato).cost,.005,"R$ 100 por 20 kg -> 0,005/g");
assert.equal(L.costUnit(bacon).cost,.03,"R$ 90 por 3 kg -> 0,03/g");
assert.equal(L.costUnit(pot).cost,1);
assert.equal(L.costUnit(soda).cost,4);
let result=L.stockLoss({kind:"ingredient",id:"batata",quantity:"1,5",unit:"kg",
 reason:"vencimento",note:"Apodreceu"});
assert.equal(result.ok,true);
assert.equal(result.event.quantityBase,1500);
assert.equal(result.event.costLost,7.5);
assert.equal(potato.stock,18500);
assert.equal(data.stockMovements[0].quantity,-1500);
assert.equal(data.stockMovements[0].referenceId,result.event.id);
let no=L.stockLoss({kind:"ingredient",id:"batata",quantity:30000,unit:"g",reason:"queda",note:""});
assert.equal(no.ok,false,"Não pode subtrair mais do que o estoque físico");
assert.equal(potato.stock,18500);
result=L.stockLoss({kind:"beverage",id:"cola",quantity:2,unit:"un",reason:"avaria",note:"Lata estourou"});
assert.equal(result.ok,true);
assert.equal(result.event.costLost,8);
assert.equal(soda.stock,48);
result=L.stockLoss({kind:"ingredient",id:"pote",quantity:1,unit:"un",reason:"higiene",note:"Descartar"});
assert.equal(result.ok,true);
assert.equal(result.event.costLost,1);
assert.equal(pot.stock,199);
const consumedCost=2*(500*.005+100*.03+1+4);
assert.equal(consumedCost,21);
assert.equal(L.orderCost(order).cost,consumedCost);
const snapshot={potato:potato.stock,bacon:bacon.stock,pot:pot.stock,soda:soda.stock};
result=L.markNonPayment(order.id,"Cliente levou sem pagar");
assert.equal(result.ok,true);
assert.equal(result.event.costLost,21);
assert.equal(result.event.uncollectedSale,105);
assert.equal(order.paymentStatus,"nao_pago");
assert.equal(L.markNonPayment(order.id).ok,false,"Inadimplência não duplicada");
assert.deepEqual({potato:potato.stock,bacon:bacon.stock,pot:pot.stock,soda:soda.stock},snapshot,
 "Pedido não pago não baixa estoque novamente");
assert.equal(L.totals().cost,7.5+8+1+21);
assert.equal(L.totals().uncollected,105);
assert.equal(L.totals().count,4);
assert(L.page().includes("Perdas e prejuízos"));
assert(L.page().includes("Vendas que não entraram"));
assert(L.page().includes("Pedido produzido, mas não pago"));
result=L.recoverPayment(order.id);
assert.equal(result.ok,true);
assert.equal(order.paymentStatus,"pago");
assert.equal(L.totals().cost,16.5);
assert.equal(L.totals().uncollected,0);
assert.equal(L.recoverPayment(order.id).ok,false,"Pagamento não pode ser recuperado duas vezes");
pendingOrder.status="cancelado";
pendingOrder.stockReturnDeclined=false;
assert.equal(L.recordCancelled(pendingOrder).ok,false,"Pedido sem baixa não deve gerar perda");
cancelledOrder.status="cancelado";
cancelledOrder.stockReturnDeclined=true;
const sum=structuredClone(snapshot);
result=L.recordCancelled(cancelledOrder);
assert.equal(result.ok,true);
assert.equal(result.event.costLost,10.5);
assert.equal(result.event.uncollectedSale,40);
assert.equal(L.recordCancelled(cancelledOrder).ok,false);
assert.deepEqual({potato:potato.stock,bacon:bacon.stock,pot:pot.stock,soda:soda.stock},sum,
 "Perda por pedido produzido jamais desconta o estoque pela segunda vez");
assert.equal(L.totals().cost,27);
assert.equal(L.totals().uncollected,40);
assert.equal(L.totals().count,4);
const saveCount=data.losses.length;
assert.equal(saveCount,5);
assert(saved>0&&rendered>0);
const moduleUniv=read("universe_core.js");
assert(moduleUniv.includes('"losses"]'),"Universos devem isolar as perdas");
const build=read("public/index.html");
assert(build.includes("losses.js?v=losses-20261116"));
assert(build.includes("losses.css?v=losses-20261116"));
assert(build.includes("losses:pageLosses"));
assert(build.includes("losses:'Perdas'"));
assert(build.includes('window.POTE_LOSSES?.totals?.()'));
assert(build.includes("x.paymentStatus!=='nao_pago'"),
 "Receita não paga não pode ser considerada faturamento recebido");
assert(read("cancel_order_flow.js").includes("POTE_LOSSES?.recordCancelled?.(order)"));
const legacy={...structuredClone(order),id:"old-cancel-loss",name:"Batata antiga",
 status:"cancelado",stockDeducted:true,stockRestored:false,stockReturnDeclined:false};
data.orders.push(legacy);
assert(L.page().includes("Pedidos cancelados anteriormente"));
const beforeLegacyStock=potato.stock,oldCount=L.totals().count;
assert.equal(L.submitLegacyLoss(legacy.id).ok,true);
assert.equal(potato.stock,beforeLegacyStock,"Classificação de perda antiga não move estoque novamente");
assert.equal(L.totals().count,oldCount+1);
assert.equal(legacy.stockReturnDeclined,true);
assert.equal(L.submitLegacyLoss(legacy.id).ok,false,"Não registrar a mesma perda duas vezes");
console.log("PASS: perdas físicas, pedido cancelado atual/antigo, não pagamento, estorno, financeiro e histórico sem dupla baixa.");
