const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=x=>fs.readFileSync(x,"utf8");
const elements=new Map();
function dom(id){
 if(!elements.has(id)){
  elements.set(id,{id,value:"",innerHTML:"",disabled:false,hidden:false,
   dataset:{},focus(){},remove(){this.removed=true},addEventListener(){},scrollIntoView(){}});
 }
 return elements.get(id);
}
const document={getElementById:dom,createElement:()=>({innerHTML:"",id:"",addEventListener(){}}),
 body:{appendChild(){}},querySelectorAll(){return []}};
const potato={id:"potato",name:"Batata",measureUnit:"g",purchaseQuantity:1,purchaseUnit:"kg",
 purchasePrice:8,stock:10000,yield:100,category:"Base"};
const corn={id:"corn",name:"Milho",measureUnit:"g",purchaseQuantity:1,purchaseUnit:"kg",
 purchasePrice:6,stock:0,yield:100,category:"Vegetal"};
const bacon={id:"bacon",name:"Bacon",measureUnit:"g",purchaseQuantity:1,purchaseUnit:"kg",
 purchasePrice:30,stock:200,yield:100,category:"Proteína"};
const recipe={id:"r01",name:"Frango com milho",category:"Gourmet",
 items:[{id:"potato",g:220},{id:"corn",g:50}]};
const extra={id:"a1",name:"Bacon extra",ingredientId:"bacon",quantity:40,sellPrice:5};
const data={businessType:"batataria",brand:{name:"Potê Batata",phone:"(48) 99999-9999"},
 ingredients:[potato,corn,bacon],recipes:[recipe],addons:[extra],beverages:[],orders:[],
 settings:{usePackagingStock:false}};
const state={data,tab:"orders"};
dom("orderItem").value="recipe:r01";dom("orderChannel").value="direto";
dom("orderExtraBev").value="";dom("orderExtraAddon").value="";
dom("orderQty").value="2";
const window={print(){this.printed=true},POTE_AUTH:{role:"admin",uid:"u1"}};
const ctx={window,document,state,console,Number,Map,Set,String,Array,Date,JSON,Intl,
 Math,URL,alert(){},confirm(){return true},go(){},toast(){},
 optionQuote(){return {recipe,price:20,variable:8,fullPrice:20,addons:[],
 beverages:[],discount:0,contribution:12,estimatedProfit:10}},
 addonCost(){return 1.2},feeRate(){return 0},fixedPerUnit(){return 2},
 roundUpCommercial(x){return Math.ceil(x*100)/100}};
vm.createContext(ctx);
vm.runInContext(read("order_customization.js"),ctx);
vm.runInContext(read("receipt_enhanced.js"),ctx);
const C=window.POTE_ORDER_CUSTOM,R=window.POTE_RECEIPTS;
assert(C&&R);
const normal=C.adjustQuote(ctx.optionQuote());
assert.equal(normal.recipe.items.length,2);
C.remove("corn",true);
C.delta("a1",1);C.delta("a1",1);
const quoted=C.adjustQuote(ctx.optionQuote());
assert.equal(quoted.recipe.items.length,1,"Milho removido só neste pedido");
assert.equal(quoted.recipe.items[0].id,"potato");
assert.equal(quoted.addons[0].quantity,80,"Dois extras somam 80g por unidade");
assert.equal(quoted.customAddons[0].count,2);
assert.equal(quoted.removedIngredients[0].name,"Milho");
assert(quoted.price>20&&quoted.variable>0);
assert.equal(recipe.items.length,2,"Receita padrão precisa ser preservada");
vm.runInContext(read("order_guard.js"),ctx);
const O=window.POTE_ORDER;
let check=O.calc(ctx.optionQuote(),2);
assert.equal(check.ok,false,"Receita completa bloqueia pedido sem milho");
check=O.calc(quoted,2);
assert.equal(check.ok,true,"Sem milho, o pedido deve ficar possível");
C.reset();
assert.equal(C.adjustQuote(ctx.optionQuote()).recipe.items.length,2);
const order={id:"abcde12345678",name:"Frango com milho",recipeId:"r01",businessType:"batataria",
 recipeCategory:"Gourmet",status:"recebido",createdAt:"2026-11-15T14:30:00-03:00",
 qty:2,price:28.5,deliveryFee:5,channel:"direto",paymentMethod:"Pix",
 clientName:"Cliente teste",clientPhone:"48999999999",clientAddress:"Rua Exemplo, 23",
 removedIngredients:[{name:"Milho"}],customAddons:[{name:"Bacon extra",count:2}],
 items:[{id:"potato",g:220,ingredientName:"Batata",measureUnit:"g"}],
 beverageItems:[],note:"Sem talheres"};
assert.equal(R.weight(order,data).g,500);
const client=R.render(order,"customer",data);
for(const text of ["Potê Batata","COMPROVANTE DO PEDIDO","12345678",
 "aprox. 500 g","aprox. 1 kg","SEM Milho","Bacon extra","Pix",
 "Cliente teste","Rua Exemplo, 23","Sem talheres","TOTAL","Documento não fiscal"]){
 assert(client.includes(text),"Recibo do cliente sem: "+text);
}
assert(!client.includes("Custo de compra"),"Custo interno não pertence ao recibo do cliente");
const kitchen=R.render(order,"kitchen",data);
assert(kitchen.includes("COMANDA DE PREPARO"));
assert(kitchen.includes("RETIRAR / NÃO COLOCAR"));
assert(kitchen.includes("Separação de ingredientes"));
assert(kitchen.includes("440 g"));
const dessert={...order,id:"sweet123",recipeCategory:"Doces",name:"Chocolate",
 qty:1,approxWeightG:0};
assert.equal(R.weight(dessert,data).g,250);
assert(R.render(dessert,"customer",data).includes("aprox. 250 g"));
const configured={...order,businessType:"pizzaria",approxWeightG:650};
const pizzaData={...data,businessType:"pizzaria",recipes:[]};
assert.equal(R.weight(configured,pizzaData).g,650);
assert.equal(R.weight({...configured,approxWeightG:0},pizzaData).g,null);
assert(R.render({...configured,approxWeightG:0},"customer",pizzaData).includes("Não informado para este produto"));
const original=read("source/pote_app_base.html"),built=read("public/index.html");
for(const marker of ["window.POTE_RECEIPTS?.open","removedIngredients:q.removedIngredients",
 "customAddons:q.customAddons","builderApproxWeight","poteOrderCustomization"]){
 assert(original.includes(marker),"Integração em fonte ausente: "+marker);
}
for(const marker of ["order_customization.js?v=base-fixed-v10-20261119",
 "receipt_enhanced.js?v=receipt-20261115",
 "order_customization.css?v=custom-20261115",
 "receipt_enhanced.css?v=receipt-20261115"]){
 assert(built.includes(marker),"Módulo não incluído no site: "+marker);
}
assert(read("firebase_integration.js").includes("preserveNavigation:true"));
assert(read("franchise_sync.js").includes("preserveNavigation:true"));
assert(read("stock_ui.js").includes('stock-search-control'));
console.log("PASS: sem milho, 2 extras, validação de estoque, recibo 250/500g, totais, comanda, comprovante e mesma tela após sync.");

C.reset();
C.remove("corn",true); // O milho continua excluído neste pedido personalizado
const cheeseIngredient={id:"cheese-addon",name:"Queijo",measureUnit:"g",
 purchaseQuantity:1,purchaseUnit:"kg",purchasePrice:25,stock:2000,yield:100,category:"Laticínio"};
data.ingredients.push(cheeseIngredient);
data.addons.push({id:"a2",name:"Queijo extra",ingredientId:"cheese-addon",quantity:30,sellPrice:3});
for(let k=0;k<21;k++)C.delta("a1",1);
C.delta("a2",1);C.delta("a2",1);
const multi=C.adjustQuote(ctx.optionQuote());
assert.equal(multi.customAddons.find(x=>x.id==="a1").count,21);
assert.equal(multi.customAddons.find(x=>x.id==="a2").count,2);
assert.equal(multi.addons.find(x=>x.id==="a1").quantity,840);
assert.equal(multi.addons.find(x=>x.id==="a2").quantity,60);
assert.equal(multi.price,20+21*5+2*3);
assert.equal(O.calc(multi,1).ok,false,"Com 21 porções de bacon o estoque insuficiente bloqueia corretamente");
bacon.stock=1000;
assert.equal(O.calc(multi,1).ok,true,"Depois de repor bacon, o pedido com 21 porções fica possível");
C.delta("a1",-1);
assert.equal(C.adjustQuote(ctx.optionQuote()).customAddons.find(x=>x.id==="a1").count,20);
assert(!original.includes("Adicional extra por unidade"),"Seletor duplicado de um adicional foi retirado");
assert(read("order_customization.js").includes("sem limite de tipos ou repetições"));
console.log("PASS: uma única seção de adicionais, 21× bacon + 2× queijo, precificação e estoque proporcionais.");

const unpaidReceipt=R.render({...order,paymentStatus:"nao_pago",paidAmount:100,changeGiven:10},"customer",data);
assert(unpaidReceipt.includes("NÃO PAGO"),"O recibo deve sinalizar o não pagamento");
assert(!unpaidReceipt.includes("Troco devolvido"),"Não exibir troco de pedido marcado não pago");
assert(!unpaidReceipt.includes("Valor recebido"),"Não indicar dinheiro recebido em pedido não pago");
console.log("PASS: recibo de inadimplência não apresenta recebimento ou troco como concluído.");
