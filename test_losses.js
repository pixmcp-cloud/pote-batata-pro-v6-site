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
vm.runInContext(read("cost_history.js"),ctx);
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
const captured=window.POTE_COST_HISTORY.capture(order,data);
assert.equal(captured.totalMaterialCost,21);
potato.purchasePrice=200;
assert.equal(L.orderCost(order).cost,21,
 "Perda em pedido antigo não pode ser recalculada com preço de compra novo");
potato.purchasePrice=100;
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
assert(/const LISTS=[\s\S]*?"losses"/.test(moduleUniv),"Universos devem isolar as perdas");
const build=read("public/index.html");
assert(build.includes("losses.js?v=order-sequence-20261119"));
assert(build.includes("losses.css?v=losses-20261116"));
assert(build.includes("losses:pageLosses"));
assert(build.includes("losses:'Perdas'"));
assert(build.includes('window.POTE_LOSSES?.totals?.()'));
assert(build.includes("x.paymentStatus!=='nao_pago'"),
 "Receita não paga não pode ser considerada faturamento recebido");
assert(read("cancel_order_flow.js").includes("POTE_LOSSES.recordCancelled(order)"));
assert(read("cancel_order_flow.js").includes("state.data=rollback"),
 "Falha em perda deve reverter cancelamento antes da persistência");
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

/* Regressão UI: alternar bebida, embalagem, alimento sólido e líquido muda a unidade sem herdar kg. */
for(const id of ["lossStockKind","lossStockId","lossStockQty","lossStockUnit",
 "lossStockReason","lossStockNote","lossStockPreview","poteLossFormError"])el(id);
const milk={id:"leite",name:"Leite",measureUnit:"ml",category:"Laticínio",stock:3000,
 purchasePrice:10,purchaseQuantity:1,purchaseUnit:"L"};
data.ingredients.push(milk);
const water={id:"agua-500",name:"Água mineral sem gás",size:"500 ml",category:"agua",
 stock:12,purchasePrice:48,purchaseQuantity:12,purchaseUnit:"un"};
data.beverages.push(water);
assert.equal(L.costUnit(water).cost,4,"Bebida de catálogo sem measureUnit deve ter custo por unidade.");
el("lossStockKind").value="ingredient";
el("lossStockId").value="batata";
L.updateStockForm("kind");
assert.equal(el("lossStockUnit").value,"kg");
assert(el("lossStockUnit").innerHTML.includes('value="g"'));
assert(!el("lossStockId").innerHTML.includes("Pote 500g"),"Embalagens não devem misturar com alimentos");
el("lossStockQty").value="1,5";
L.preview();
assert(el("lossStockPreview").textContent.includes("1,5 kg"));
el("lossStockId").value="leite";
L.updateStockForm("item");
assert.equal(el("lossStockUnit").value,"L");
assert(el("lossStockUnit").innerHTML.includes('value="ml"'));
assert.equal(el("lossStockQty").value,"","Trocar alimento precisa limpar quantidade anterior");
el("lossStockUnit").value="ml";
el("lossStockQty").value="250";
L.preview();
assert(el("lossStockPreview").textContent.includes("250 ml"));
assert(el("lossStockPreview").textContent.includes("R$"));
el("lossStockKind").value="beverage";
L.updateStockForm("kind");
assert(el("lossStockId").innerHTML.includes("Água mineral"));
assert(!el("lossStockId").innerHTML.includes("Leite"));
el("lossStockId").value="agua-500";
L.updateStockForm("item");
assert.equal(el("lossStockUnit").value,"un","Água mineral em garrafa é estocada por unidade");
assert(el("lossStockUnit").innerHTML.includes("Unidade"));
assert(!el("lossStockUnit").innerHTML.includes("Quilograma"));
assert(!el("lossStockUnit").innerHTML.includes('value="kg"'));
assert.equal(el("lossStockQty").value,"");
el("lossStockQty").value="1";
el("lossStockReason").value="avaria";
el("lossStockNote").value="Garrafa quebrada";
L.preview();
assert(el("lossStockPreview").textContent.includes("500 ml"));
assert(el("lossStockPreview").textContent.includes("1 un"));
let waterLoss=L.submitStock();
assert.equal(waterLoss.ok,true,"Registro de perda de 1 garrafa de água");
assert.equal(waterLoss.event.measureUnit,"un");
assert.equal(waterLoss.event.itemKind,"beverage");
assert.equal(waterLoss.event.costLost,4);
assert.equal(water.stock,11);
assert.equal(data.stockMovements[0].quantity,-1);
assert.equal(data.stockMovements[0].referenceId,waterLoss.event.id);
assert.equal(L.stockLoss({kind:"beverage",id:water.id,quantity:1,unit:"kg",
 reason:"avaria"}).ok,false,"Não aceitar kg para uma garrafa de água");
assert.equal(L.stockLoss({kind:"beverage",id:water.id,quantity:"0,5",unit:"un",
 reason:"avaria"}).ok,false,"Não aceitar meia garrafa como quantidade física");
assert.equal(water.stock,11,"Tentar unidade inválida não modifica estoque");
el("lossStockKind").value="packaging";
L.updateStockForm("kind");
assert(el("lossStockId").innerHTML.includes("Pote 500g"));
assert(!el("lossStockId").innerHTML.includes("Batata"));
assert.equal(el("lossStockUnit").value,"un");
assert(!el("lossStockUnit").innerHTML.includes('value="kg"'));
let packageLoss=L.stockLoss({kind:"packaging",id:"pote",quantity:1,
 unit:"un",reason:"queda"});
assert.equal(packageLoss.ok,true);
assert.equal(packageLoss.event.itemKind,"packaging");
assert.equal(packageLoss.event.measureUnit,"un");
assert.equal(pot.stock,198);
assert(L.page().includes("Bebida · lata, garrafa ou água"));
assert(L.page().includes("Embalagem / descartável"));
console.log("PASS: seleção contextual de unidade: alimento g/kg, líquidos ml/L, bebidas por garrafa/lata, embalagem un; água 500 ml sem kg ou baixa incorreta.");

const originalDrinks=data.beverages;
data.beverages=[];
el("lossStockKind").value="beverage";
L.updateStockForm("kind");
assert.equal(el("lossStockUnit").value,"","Categoria sem produtos não pode oferecer kg por padrão");
assert.equal(el("lossStockQty").disabled,true,"Bloquear quantidade enquanto não houver item cadastrado");
assert(el("lossStockPreview").textContent.includes("Selecione um produto"));
data.beverages=originalDrinks;
L.updateStockForm("kind");
assert.equal(el("lossStockUnit").value,"un");
assert.equal(el("lossStockQty").disabled,false);
console.log("PASS: categoria vazia não mostra unidades inventadas nem permite baixar estoque sem item.");
