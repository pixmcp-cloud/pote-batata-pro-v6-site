const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const html=fs.readFileSync("public/index.html","utf8");
const betaBuilder=fs.readFileSync("make_beta.py","utf8");
const firebaseTag=betaBuilder.split("firebase_integration.js?v=")[1]?.split('"')[0];
assert(firebaseTag&&html.includes("firebase_integration.js?v="+firebaseTag),
 "Build de outra branch ou desatualizado: execute python build_hosting.py antes do teste.");
const backup=html.match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/);
assert(backup,"Modelo de dados embutido ausente");
const SEED=JSON.parse(backup[1]),elements=new Map(),errors=[];
function el(id){
 if(!elements.has(id)){
  const o={id,textContent:"",innerHTML:"",value:"",hidden:false,disabled:false,
   src:"",dataset:{},style:{},className:"",classList:{
    add(){},remove(){},toggle(){},contains(){return false}},
   focus(){},addEventListener(){},removeEventListener(){},scrollIntoView(){},click(){},
   setAttribute(){},getAttribute(){return null},querySelectorAll(){return []},querySelector(){return null},
   insertBefore(){},appendChild(){},remove(){},select(){},parentElement:null,
   firstChild:{nodeType:3,textContent:""},
   getBoundingClientRect(){return {width:300,height:200}}};
  elements.set(id,o);
 }
 return elements.get(id);
}
el("backup").textContent=JSON.stringify(SEED);
const doc={
 body:{classList:{add(){},remove(){},toggle(){}},appendChild(){},style:{},querySelector(){return null}},
 documentElement:{classList:{toggle(){},add(){},remove(){}}},
 getElementById:el,createElement:()=>el("generated_"+elements.size),
 querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},
 createTreeWalker(){return {nextNode(){return false}}}
};
let stockApproval=false;
const window={POTE_AUTH:{uid:"test-admin",email:"admin@example.com",role:"admin",proActive:true,
 franchiseActive:false},POTE_RECIPE_IMAGES:{},POTE_RECIPE_LABELS:{},
 POTE_APP_READY:false,addEventListener(){},dispatchEvent(){},open(){},
 confirm(){return stockApproval},scrollTo(){},NodeFilter:{SHOW_TEXT:4},Node:{TEXT_NODE:3}};
const sandbox={window,document:doc,location:{href:"http://localhost/test"},history:{pushState(){}},
 navigator:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},
 console,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},
 clearInterval(){},requestAnimationFrame(fn){fn()},scrollTo(){},
 alert(){},confirm(){return true},prompt(){return null},Date,Intl,Math,Number,JSON,String,
 Array,Object,Map,Set,URL,Blob,Event:class{constructor(type){this.type=type}},Node:{TEXT_NODE:3},
 NodeFilter:{SHOW_TEXT:4}};
vm.createContext(sandbox);
const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(x=>!x[1].includes("application/json"));
assert(inline.length>=1);
for(let i=0;i<inline.length;i++){
 try{vm.runInContext(inline[i][2],sandbox,{filename:"app-inline-"+i+".js",timeout:5000})}
 catch(e){errors.push({page:"boot",error:String(e.stack||e)});}
}
assert(errors.length===0,JSON.stringify(errors.slice(0,3)));
for(const module of ["universe_templates.js","universe_core.js","business_setup.js",
 "stock_math.js","stock_ui.js","stock_delete.js","losses.js","beverage_catalog.js","payment_flow.js","stock_inventory.js","stock_ext.js","pricing_explainer.js","order_customization.js","receipt_enhanced.js","order_guard.js","cancel_order_flow.js","garimpo.js"]){
 try{vm.runInContext(fs.readFileSync(module,"utf8"),sandbox,{filename:module,timeout:5000})}
 catch(e){errors.push({page:module,error:String(e.stack||e)})}
}
assert(errors.length===0,JSON.stringify(errors.slice(0,3)));
const tabs=["home","vitrine","recipes","builder","pricing","ingredients","expenses","losses",
 "suppliers","garimpo","motoboy","deliveryhub","clients","orders","combos","reports","creative","brand","settings","tests","admin"];
const pages={};
for(const tab of tabs){
 try{
  sandbox.window.POTE_APP.applyState(sandbox.window.POTE_APP.snapshot());
  vm.runInContext("state.tab="+JSON.stringify(tab)+"; render();",sandbox,{timeout:5000});
  pages[tab]=el("page").innerHTML;
  assert.equal(typeof pages[tab],"string");
  assert(pages[tab].length>0,"Página vazia");
 }catch(e){errors.push({page:tab,error:String(e.stack||e).slice(0,1400)})}
}
assert(errors.length===0,"Falha ao abrir área(s): "+JSON.stringify(errors));
assert(html.includes('id="poteHomeShortcut"')&&html.includes('onclick="poteGoHome()"'),"Casinha do cabeçalho deve ser um botão de Início");
assert(html.includes('id="poteOpsCards"'),"Os cards da Central de Operações precisam de destino de navegação");
let homeScrollCount=0;
el("poteOpsCards").scrollIntoView=()=>{homeScrollCount++};
for(const tab of tabs){
 vm.runInContext("state.tab="+JSON.stringify(tab)+";render();poteGoHome();",sandbox,{timeout:5000});
 assert.equal(vm.runInContext("state.tab",sandbox),"home","Casinha não voltou ao início a partir de "+tab);
 assert(el("page").innerHTML.includes("poteOpsCards"),"Cards não foram renderizados a partir de "+tab);
}
assert.equal(homeScrollCount,tabs.length,"Atalho deve rolar até os cards, não só ao topo da página");
assert(pages.ingredients.includes("Registrar nova compra"),"Estoque deve apresentar compra real");
assert(pages.ingredients.includes("Estoque existente"),"Estoque deve mostrar saldos");
assert(pages.garimpo.includes("Garimpo"),"Garimpo deve abrir na navegação");
assert(pages.orders.includes("poteOrderAvailability"),"Pedidos devem exibir capacidade durante digitação");
assert(pages.orders.includes("ordersHistoryTitle"),"Pedidos devem conter lista de finalizados");
assert(pages.home.includes("Central de Operações"));
assert(pages.losses.includes("Perdas e prejuízos"));
assert(pages.expenses.includes("go(\'losses\')"),"Despesas deve ter atalho para Perdas");
assert(pages.vitrine.includes("Cardápio"));
assert(pages.reports.includes("Relatórios")||pages.reports.includes("Matriz BCG"));
console.log("PASS: "+tabs.length+" áreas renderizadas sem erro de JavaScript:",tabs.join(", "));

const testState=window.POTE_APP.snapshot();
testState.data.recipes=[{id:"route-r1",name:"Lanche teste",category:"Salgado",
 items:[{id:"route-potato",g:500}],steps:["Preparar"],pricingMode:"gain",targetGainPct:100}];
testState.data.ingredients=[{id:"route-potato",name:"Batata física",category:"Base",
 purchaseQuantity:1,purchaseUnit:"kg",purchasePrice:5,yield:100,stock:3000,minimum:0,measureUnit:"g"}];
testState.data.orders=[];testState.data.beverages=[];testState.data.addons=[];testState.data.combos=[];
testState.data.clients=[];testState.data.expenses=[];testState.data.stockMovements=[];
testState.data.settings.usePackagingStock=false;
window.POTE_APP.applyState(testState);
function setOrder(q){
 el("orderItem").value="recipe:route-r1";
 el("orderChannel").value="direto";el("orderQty").value=String(q);
 el("orderPrice").value="50";el("orderDelivery").value="0";
 el("orderExtraBev").value="";el("orderExtraAddon").value="";
 el("orderClient").value="";el("orderAddress").value="";
 el("orderNote").value="Teste de fluxo integrado";
 vm.runInContext('state.tab="orders";render();',sandbox);
}
function current(){return window.POTE_APP.snapshot()}
setOrder(2);
vm.runInContext("newOrder();",sandbox);
let fresh=current();
assert.equal(fresh.data.orders.length,1,"Pedido válido deve ser criado");
assert.equal(fresh.data.orders[0].status,"recebido");
assert.equal(fresh.tab,undefined,"Snapshot não deve conter página atual");
assert.equal(fresh.data.ingredients[0].stock,3000,"Registrar pedido reserva, mas não baixa antes da produção");
assert.equal(vm.runInContext("state.tab",sandbox),"orders","Registro não pode sair da página Pedidos");
let orderId=fresh.data.orders[0].id;
vm.runInContext("produce("+JSON.stringify(orderId)+");",sandbox);
fresh=current();
assert.equal(fresh.data.orders[0].status,"em_producao");
assert.equal(fresh.data.ingredients[0].stock,2000);
assert.equal(vm.runInContext("state.tab",sandbox),"orders");
vm.runInContext("finishOrder("+JSON.stringify(orderId)+");",sandbox);
fresh=current();
assert.equal(fresh.data.orders[0].status,"entregue");
assert.equal(vm.runInContext("state.tab",sandbox),"orders","Finalizar deve permanecer em Pedidos");
vm.runInContext("finishOrder("+JSON.stringify(orderId)+");",sandbox);
assert.equal(current().data.ingredients[0].stock,2000,"Concluir duas vezes não pode duplicar baixa");
setOrder(5);
vm.runInContext("newOrder();",sandbox);
assert.equal(current().data.orders.length,1,"Pedido acima do saldo deve ser bloqueado antes de ser salvo");
setOrder(1);
vm.runInContext("newOrder();",sandbox);
assert.equal(current().data.orders.length,2);
setOrder(4);
vm.runInContext("newOrder();",sandbox);
assert.equal(current().data.orders.length,2,"Sem confirmação o pedido excessivo não deve ser registrado");
stockApproval=true;
vm.runInContext("newOrder();",sandbox);
assert.equal(current().data.orders.length,3,"Confirmação explícita deve permitir registro com divergência");
stockApproval=false;
console.log("PASS: fluxo real de pedidos — registrar, reservar, produzir, concluir, bloquear excesso e permanecer na sessão Pedidos.");

const vitState=structuredClone(testState);
vitState.data.orders=[];
vitState.data.settings.usePackagingStock=true;
vitState.data.recipes[0].packagingIngredientIds=["vit-box"];
vitState.data.ingredients.push(
 {id:"vit-cheese",name:"Queijo extra",category:"Laticínio",purchaseQuantity:1,
  purchaseUnit:"kg",purchasePrice:30,measureUnit:"g",yield:100,stock:1000},
 {id:"vit-box",name:"Embalagem",category:"Embalagem",purchaseQuantity:1,
  purchaseUnit:"un",purchasePrice:1,measureUnit:"un",yield:100,stock:10}
);
vitState.data.beverages=[{id:"vit-soda",name:"Refrigerante",sellPrice:5,
 purchaseQuantity:10,purchasePrice:40,stock:10}];
vitState.data.addons=[{id:"vit-addon",name:"Queijo extra",ingredientId:"vit-cheese",
 quantity:40,sellPrice:3}];
window.POTE_APP.applyState(vitState);
vm.runInContext('state.tab="vitrine";render();',sandbox);
vm.runInContext("addToCart('recipe','route-r1');",sandbox);
vm.runInContext("addToCart('recipe','route-r1');",sandbox);
vm.runInContext("addToCart('addon','vit-addon');",sandbox);
vm.runInContext("addToCart('bev','vit-soda');",sandbox);
assert.equal(vm.runInContext("cart.length",sandbox),3,"Sacola deve conter lanche, adicional e bebida");
assert.equal(vm.runInContext("cart.find(x=>x.kind==='recipe').qty",sandbox),2);
for(const id of ["vitrineName","vitrinePhone","vitrineAddr","vitrinePay","vitrineObs","vitrineDeliv"])
 el(id).value="";
el("vitrineDeliv").value="0";
vm.runInContext("checkoutVitrine(false);",sandbox);
let vit=current();
assert.equal(vit.data.orders.length,1,"Cardápio deve registrar pedido após validação de estoque");
assert.equal(vm.runInContext("state.tab",sandbox),"orders","O Cardápio deve mostrar Pedidos após registrar");
assert.equal(vm.runInContext("cart.length",sandbox),0,"Sacola deve ser limpa somente após registro confirmado");
let vitOrder=vit.data.orders[0];
assert.equal(vitOrder.qty,2);
assert.equal(vitOrder.items.find(x=>x.id==="vit-cheese").g,20,
 "Adicional de 40g total para duas unidades deve ser rateado, sem dobrar o estoque");
assert.equal(vitOrder.items.find(x=>x.id==="vit-box").g,1,
 "Embalagem deve ser incluída na venda pela vitrine");
assert.equal(vitOrder.beverageItems.find(x=>x.id==="vit-soda").qty,0.5,
 "Bebida adicional única deve ser rateada por unidade");
vm.runInContext("produce("+JSON.stringify(vitOrder.id)+");",sandbox);
vit=current();
assert.equal(vit.data.ingredients.find(x=>x.id==="vit-cheese").stock,960,
 "Produção deve descontar 40g de queijo, não 80g");
assert.equal(vit.data.ingredients.find(x=>x.id==="vit-box").stock,8,
 "Produção deve descontar 2 embalagens");
assert.equal(vit.data.beverages[0].stock,9,
 "Produção deve descontar 1 bebida extra, não 2");
assert.equal(vm.runInContext("state.tab",sandbox),"orders");
vm.runInContext('state.tab="vitrine";render();',sandbox);
vitState.data.ingredients[0].stock=0;
window.POTE_APP.applyState(vitState);
vm.runInContext('state.tab="vitrine";render();',sandbox);
vm.runInContext("addToCart('recipe','route-r1');",sandbox);
assert.equal(vm.runInContext("cart.length",sandbox),0,
 "Vitrine deve impedir adicionar produto sem estoque, antes de oferecer registrar pedido");
console.log("PASS: sacola validada antes da compra, itens extras rateados, embalagens e bebidas descontadas corretamente, sem contornar o bloqueio.");

const customState=structuredClone(testState);
customState.data.businessType="batataria";
customState.data.recipes[0].category="Gourmet";
customState.data.recipes[0].items.push({id:"custom-corn",g:60});
customState.data.ingredients.push({id:"custom-corn",name:"Milho",category:"Vegetal",
 purchaseQuantity:1,purchaseUnit:"kg",purchasePrice:10,yield:100,stock:0,measureUnit:"g"});
customState.data.ingredients.push({id:"custom-bacon",name:"Bacon",category:"Proteína",
 purchaseQuantity:1,purchaseUnit:"kg",purchasePrice:40,yield:100,stock:300,measureUnit:"g"});
customState.data.addons=[{id:"custom-addon",name:"Bacon extra",ingredientId:"custom-bacon",
 quantity:40,sellPrice:5}];
customState.data.orders=[];
window.POTE_APP.applyState(customState);
setOrder(2);
el("orderWeight").value="500";
el("orderNote").value="Caprichar no tempero";
window.POTE_ORDER_CUSTOM.reset();
window.POTE_ORDER_CUSTOM.remove("custom-corn",true);
window.POTE_ORDER_CUSTOM.delta("custom-addon",1);
window.POTE_ORDER_CUSTOM.delta("custom-addon",1);
vm.runInContext("newOrder();",sandbox);
const personalized=current();
assert.equal(personalized.data.orders.length,1,"Pedido sem milho e com bacon deve ser registrado");
const customized=personalized.data.orders[0];
assert(!customized.items.some(i=>i.id==="custom-corn"),"Milho removido não pode aparecer na separação");
assert.equal(customized.items.find(i=>i.id==="custom-bacon").g,80);
assert.equal(customized.removedIngredients[0].name,"Milho");
assert.equal(customized.customAddons[0].count,2);
assert.equal(customized.approxWeightG,500);
assert.equal(vm.runInContext("state.tab",sandbox),"orders");
assert.equal(personalized.data.recipes[0].items.length,2,"Receita original preservada");
const customReceipt=vm.runInContext("receiptHTML(state.data.orders[0],'customer')",sandbox);
const customKitchen=vm.runInContext("receiptHTML(state.data.orders[0],'kitchen')",sandbox);
for(const label of ["SEM Milho","Bacon extra","aprox. 500 g","aprox. 1 kg"])
 assert(customReceipt.includes(label),"Recibo não mostra "+label);
assert(customKitchen.includes("RETIRAR / NÃO COLOCAR"));
const id=customized.id;
vm.runInContext("showReceipt("+JSON.stringify(id)+",'customer');",sandbox);
assert.equal(vm.runInContext("state.tab",sandbox),"orders","Abrir recibo não pode sair de Pedidos");
vm.runInContext("produce("+JSON.stringify(id)+");",sandbox);
const made=current();
assert.equal(made.data.ingredients.find(i=>i.id==="custom-corn").stock,0);
assert.equal(made.data.ingredients.find(i=>i.id==="custom-bacon").stock,140);
assert.equal(made.data.ingredients.find(i=>i.id==="route-potato").stock,2000);
vm.runInContext('state.tab="ingredients";',sandbox);
window.POTE_APP.applyState(current(),{preserveNavigation:true});
assert.equal(vm.runInContext("state.tab",sandbox),"ingredients","Sync remoto não deve levar de Estoque para Home");
console.log("PASS: personalizar sem milho, dois adicionais, baixa do estoque, recibo detalhado e permanência em Pedidos/Estoque.");

window.POTE_AUTH={email:"pixmcp@gmail.com",uid:"test-admin",role:"admin",proActive:true,franchiseActive:false};
const comboState=structuredClone(testState);
comboState.data.businessType="batataria";
comboState.data.recipes=structuredClone(SEED.recipes).filter(r=>["r01","r03","r21"].includes(r.id));
comboState.data.ingredients=structuredClone(SEED.ingredients);
comboState.data.ingredients.forEach(i=>{i.stock=100000;i.yield=100});
comboState.data.orders=[];comboState.data.beverages=[];comboState.data.combos=[];
comboState.data.addons=[];comboState.data.settings.usePackagingStock=false;
window.POTE_APP.applyState(comboState);
vm.runInContext('state.tab="orders";render();',sandbox);
let business=window.POTE_APP.snapshot().data;
assert.equal(business.beverages.length,11,"Batataria cria 11 opções comerciais sem estoque fictício");
assert.equal(business.combos.length,1,"Um combo inicial somente");
assert(business.beverages.every(b=>b.stock===0));
el("orderItem").value="combo:starter-potato-soda";
window.POTE_DRINKS.mount();
el("orderComboRecipe").value="r03";
el("orderComboBeverage").value="preset-cola-lata";
const comboQuote=vm.runInContext("optionQuote('combo:starter-potato-soda','direto')",sandbox);
assert.equal(comboQuote.recipe.id,"r03");
assert.equal(comboQuote.beverages[0].id,"preset-cola-lata");
const expected=Math.round((vm.runInContext("sellPrice(recipe('r03'),'direto')",sandbox)+7)*.95*100)/100;
assert.equal(comboQuote.price,expected,"O desconto de 5% deve ser exato, sem arredondamento comercial adicional");
assert.equal(window.POTE_ORDER.calc(comboQuote,1).ok,false,"Sem refrigerante em estoque o combo é bloqueado");
el("stockBeverageId").value="preset-cola-lata";
el("stockBeverageQty").value="12";
el("stockBeveragePaid").value="42,00";
el("stockBeverageSupplier").value="Distribuidora teste";
window.POTE_STOCK_EXT.saveBeveragePurchase();
business=window.POTE_APP.snapshot().data;
assert.equal(business.beverages.find(b=>b.id==="preset-cola-lata").stock,12);
el("orderItem").value="combo:starter-potato-soda";
window.POTE_DRINKS.mount();
el("orderComboRecipe").value="r03";
el("orderComboBeverage").value="preset-cola-lata";
for(const [id,value] of Object.entries({
 orderQty:"1",orderPrice:comboQuote.price.toFixed(2),orderDelivery:"8",
 orderHasDelivery:"sim",orderAddress:"Rua Teste 20",orderPayment:"dinheiro",
 orderCashReceived:"1000,00",orderChannel:"direto",orderExtraBev:"",orderExtraAddon:"",
 orderClient:"",orderNote:"Combo com Bacon",orderWeight:"500"}))el(id).value=value;
vm.runInContext("newOrder();",sandbox);
let finalCombo=window.POTE_APP.snapshot().data.orders[0];
assert(finalCombo,"O combo deve ser registrável após repor o refrigerante");
assert.equal(finalCombo.recipeId,"r03");
assert.equal(finalCombo.comboId,"starter-potato-soda");
assert.equal(finalCombo.beverageItems[0].id,"preset-cola-lata");
assert.equal(finalCombo.deliveryFee,8);
assert.equal(finalCombo.deliveryType,"Tele-entrega");
assert.equal(finalCombo.paymentMethod,"Dinheiro");
assert.equal(finalCombo.paidAmount,1000);
assert.equal(finalCombo.changeGiven,Number((1000-(finalCombo.price+8)).toFixed(2)));
let kitchenCombo=vm.runInContext("receiptHTML(state.data.orders[0],'kitchen')",sandbox);
let customerCombo=vm.runInContext("receiptHTML(state.data.orders[0],'customer')",sandbox);
assert(kitchenCombo.includes("Taxa de tele-entrega"));
assert(/R\$\s*8,00/.test(kitchenCombo),"Valor da tele-entrega precisa aparecer na comanda");
assert(customerCombo.includes("Troco devolvido"));
assert(customerCombo.includes("Valor recebido"));
assert(customerCombo.includes("aprox. 500 g"));
vm.runInContext("produce("+JSON.stringify(finalCombo.id)+");",sandbox);
business=window.POTE_APP.snapshot().data;
assert.equal(business.beverages.find(b=>b.id==="preset-cola-lata").stock,11);
assert.equal(vm.runInContext("state.tab",sandbox),"orders");
console.log("PASS: combo 5% com sabor/Bebida selecionáveis, compra de refri, troco e tele-entrega no recibo/comanda.");

el("stockBeverageId").value="preset-cola-600";
el("stockBeverageQty").value="4";
el("stockBeveragePaid").value="24,00";
window.POTE_STOCK_EXT.saveBeveragePurchase();
vm.runInContext('state.tab="vitrine";render();',sandbox);
el("vitrineComboRecipe-starter-potato-soda").value="r21";
el("vitrineComboDrink-starter-potato-soda").value="preset-cola-600";
vm.runInContext("addToCart('combo','starter-potato-soda');",sandbox);
const comboCart=vm.runInContext("cart",sandbox);
assert.equal(comboCart.length,1);
assert.equal(comboCart[0].recipeId,"r21","Cardápio deve respeitar sabor Cachorro-Quente escolhido");
assert.equal(comboCart[0].bevId,"preset-cola-600","Cardápio deve respeitar refrigerante Cola 600ml escolhido");
for(const [id,val] of Object.entries({vitrineName:"Cliente vitrine",vitrinePhone:"48999998888",
 vitrineAddr:"Rua Vitrine 42",vitrinePay:"Dinheiro",vitrineCashReceived:"300",
 vitrineHasDelivery:"sim",vitrineDeliv:"8,00",vitrineObs:"Sem gelo"}))el(id).value=val;
vm.runInContext("checkoutVitrine(false);",sandbox);
const fromCart=window.POTE_APP.snapshot().data.orders.find(o=>o.clientName==="Cliente vitrine");
assert(fromCart,"Combo com variações precisa registrar pela vitrine");
assert.equal(fromCart.recipeId,"r21");
assert.equal(fromCart.beverageItems[0].id,"preset-cola-600");
assert.equal(fromCart.deliveryType,"Tele-entrega");
assert.equal(fromCart.deliveryFee,8);
assert.equal(fromCart.paymentMethod,"Dinheiro");
assert.equal(fromCart.paidAmount,300);
assert.equal(fromCart.changeGiven,Number((300-(fromCart.price+8)).toFixed(2)));
assert.equal(vm.runInContext("state.tab",sandbox),"orders","Vitrine não deve retornar à Home");
console.log("PASS: Cardápio Digital preserva sabor, refrigerante 600 ml, dinheiro, troco e tele-entrega.");

const lossStateBefore=window.POTE_APP.snapshot().data;
const toCancel=lossStateBefore.orders.find(o=>o.clientName==="Cliente vitrine");
assert(toCancel&&toCancel.status==="recebido","Pedido do Cardápio deve estar recebido");
vm.runInContext("produce("+JSON.stringify(toCancel.id)+")",sandbox);
let afterProduction=window.POTE_APP.snapshot().data;
assert.equal(afterProduction.orders.find(o=>o.id===toCancel.id).status,"em_producao");
const potatoAfterProduction=afterProduction.ingredients.find(i=>i.id==="batata");
const colaAfterProduction=afterProduction.beverages.find(b=>b.id==="preset-cola-600");
assert(colaAfterProduction,"Bebida do combo permanece registrada");
assert.equal(window.POTE_CANCEL.open(toCancel.id),true);
assert.equal(window.POTE_CANCEL.perform("discard"),true);
const afterLostOrder=window.POTE_APP.snapshot().data;
const lostOrder=afterLostOrder.orders.find(o=>o.id===toCancel.id);
assert.equal(lostOrder.status,"cancelado");
assert.equal(lostOrder.stockReturnDeclined,true);
assert.equal(afterLostOrder.beverages.find(b=>b.id==="preset-cola-600").stock,
 colaAfterProduction.stock,"Cancelar com perda não pode baixar refrigerante novamente");
const events=afterLostOrder.losses.filter(x=>x.orderId===toCancel.id&&!x.voidedAt);
assert.equal(events.length,1,"Perda de produção contabilizada uma vez");
assert.equal(events[0].stockAlreadyDeducted,true);
assert.equal(events[0].stockMovement,false);
assert.equal(window.POTE_CANCEL.perform("discard"),false,"Não pode registrar a mesma perda duas vezes");
const financial=vm.runInContext("totals()",sandbox);
assert.equal(financial.lossCost,events[0].costLost);
assert(financial.lossCount>=1);
assert(!afterLostOrder.losses.some(l=>l.orderId===toCancel.id&&l.type==="stock"));
console.log("PASS: cancelamento real depois da produção registra prejuízo sem estorno ou segunda baixa, e financeiro separa perdas.");
