const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=f=>fs.readFileSync(f,"utf8");
const inputs=new Map(),messages=[];
function el(id){
 if(!inputs.has(id))inputs.set(id,{id,value:"",innerHTML:"",textContent:"",hidden:false,
 disabled:false,dataset:{},checked:false,addEventListener(){},focus(){},scrollIntoView(){}});
 return inputs.get(id);
}
const receiptHtml=read("public/index.html");
const seed=JSON.parse(receiptHtml.match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const recipes=seed.recipes.filter(r=>["r01","r03","r21"].includes(r.id));
const state={tab:"orders",data:{businessType:"batataria",brand:{name:"Potê Batata"},
 ingredients:structuredClone(seed.ingredients),beverages:[],combos:[],addons:[],
 recipes,orders:[],stockMovements:[],purchases:[],settings:{usePackagingStock:false}}};
let persisted=0,rendered=0;
const document={getElementById:el,createElement:()=>({id:"",innerHTML:"",dataset:{},addEventListener(){}}),
 querySelectorAll(){return []},body:{appendChild(){}}};
const ctx={window:{POTE_AUTH:{uid:"c1",role:"free"},confirm(){return true}},document,console,JSON,Number,
 Array,String,Math,Set,Map,Date,Intl,structuredClone,state,
 alert(msg){messages.push(msg)},confirm(){return true},prompt(){return null},
 uid(){return "id"+Math.random()},persist(){persisted++},render(){rendered++},toast(){}};
vm.createContext(ctx);
for(const file of ["stock_math.js","beverage_catalog.js","payment_flow.js","stock_inventory.js","stock_ext.js"])
 vm.runInContext(read(file),ctx,{filename:file});
const B=ctx.window.POTE_DRINKS,P=ctx.window.POTE_PAYMENT,I=ctx.window.POTE_INVENTORY,X=ctx.window.POTE_STOCK_EXT;
assert(B&&P&&I&&X);
const init=B.ensure(state);assert.equal(init.beveragesAdded,11);assert.equal(init.combosAdded,1);
assert.equal(state.data.beverages.length,11);
assert.equal(state.data.combos.length,1);
assert(state.data.beverages.every(b=>b.stock===0&&b.purchasePrice===0),"Não inventar saldo/custo");
assert.equal(B.ensure(state).beveragesAdded,0,"Modelos não podem duplicar");
const drinks=state.data.beverages;
const byKey=id=>drinks.find(b=>b.catalogKey===id);
for(const [id,expected] of [["agua-sem-gas",4],["agua-com-gas",5],["guarana-lata",7],
["cola-lata",7],["laranja-lata",7],["guarana-600",9],["cola-600",9],
["laranja-600",9],["guarana-zero-600",10],["cola-zero-600",10],["laranja-zero-600",10]]){
 assert.equal(byKey(id).sellPrice,expected,id);
}
const c=state.data.combos[0];
assert.equal(c.name,"1 Batata + Refrigerante");
assert.equal(c.discountValue,5);
assert.equal(c.recipeOptions.join(","),"r01,r03,r21");
assert.equal(c.recipeOptions.length,3);
assert.equal(c.beverageOptions.length,9);
assert(B.vitrineControls(c).includes("Frango Cremoso"));
el("vitrineComboRecipe-"+c.id).value="r21";
el("vitrineComboDrink-"+c.id).value=byKey("cola-600").id;
const variant=B.vitrineVariant(c);
assert.equal(variant.recipeId,"r21");
assert.equal(variant.beverageId,byKey("cola-600").id);
assert.equal(B.duplicateBeverage(state.data,"Refrigerante Cola","600 ml").id,byKey("cola-600").id);
assert.equal(B.duplicateBeverage(state.data,"Refrigerante Cola","Lata 350 ml").id,byKey("cola-lata").id);
const outside={...state,data:{...state.data,businessType:"pizzaria",beverages:[],combos:[]}};
assert.equal(B.ensure(outside).beveragesAdded,0);
assert.equal(outside.data.beverages.length,0);
assert.equal(outside.data.combos.length,0);
assert.equal(P.toCents("1.234,50"),123450);
assert.equal(P.toCents("100,00"),10000);
assert.equal(P.calculate("50,50","100,00").change,49.50);
assert.equal(P.calculate("50,50","50,49").valid,false);
assert.equal(P.calculate("50,50","50,50").change,0);
el("orderPrice").value="22,50";
el("orderQty").value="2";
el("orderHasDelivery").value="sim";
el("orderDelivery").value="5,00";
el("orderAddress").value="Rua Teste 10";
el("orderPayment").value="dinheiro";
el("orderCashReceived").value="100,00";
assert.equal(P.orderTotal(),50);
const pay=P.validate();
assert.equal(pay.paidAmount,100);
assert.equal(pay.changeGiven,50);
assert.equal(pay.deliveryType,"Tele-entrega");
assert.equal(pay.paymentMethod,"Dinheiro");
el("orderCashReceived").value="49,99";
assert.equal(P.validate(),null,"Dinheiro insuficiente deve bloquear");
assert(messages.at(-1).includes("insuficiente"));
el("orderCashReceived").value="100,00";
el("orderHasDelivery").value="nao";
P.sync();
assert.equal(el("orderDelivery").disabled,true);
assert.equal(el("orderDelivery").value,"0");
assert.equal(P.validate().deliveryType,"Retirada");
el("orderPayment").value="pix";P.sync();
assert.equal(P.validate().paidAmount,null);
assert.equal(P.validate().changeGiven,null);
const coffee={id:"a",name:"Pote 500 ml",category:"Embalagem",measureUnit:"un",
 stock:2,purchasePrice:20,purchaseQuantity:20,purchaseUnit:"un"};
const coffee2={id:"b",name:"  pôte  500 ML ",category:"Embalagem",measureUnit:"un",
 stock:3,purchasePrice:15,purchaseQuantity:15,purchaseUnit:"un"};
const cbox={id:"box",name:"Caixa Pizza",category:"Embalagem",measureUnit:"un",stock:8};
state.data.ingredients=[coffee,coffee2,cbox];
state.data.recipes=[{id:"test",name:"Batata",items:[{id:"a",g:1},{id:"b",g:1}],packagingIngredientIds:["a","b"]}];
state.data.addons=[{id:"addon",name:"Extra pote",ingredientId:"b"}];
state.data.orders=[{id:"oldOrder",status:"recebido",items:[{id:"b",g:1}]}];
assert(I.duplicate(state.data,{name:"Pote 500 ml",category:"Embalagem",measureUnit:"un"}));
assert.equal(I.duplicates(state.data.ingredients).length,1);
I.merge("a");
assert.equal(state.data.ingredients.length,2);
assert.equal(coffee.stock,5,"A soma dos dois potes deve resultar em 5");
assert.equal(state.data.recipes[0].items.length,1,"Referências devem ser mescladas");
assert.equal(state.data.recipes[0].items[0].g,2);
assert.equal(state.data.addons[0].ingredientId,"a");
assert.equal(state.data.orders[0].items[0].id,"a");
assert(state.data.stockMovements.some(x=>x.oldIngredientId==="b"));
assert.equal(I.duplicates(state.data.ingredients).length,0);
state.data.beverages=drinks;
const water=byKey("agua-sem-gas");
el("stockBeverageId").value=water.id;
el("stockBeverageQty").value="12";
el("stockBeveragePaid").value="42,00";
el("stockBeverageSupplier").value="Mercado teste";
X.saveBeveragePurchase();
assert.equal(water.stock,12);
assert.equal(water.purchasePrice,42);
assert.equal(water.purchaseQuantity,12);
assert.equal(state.data.purchases[0].itemKind,"beverage");
assert.equal(state.data.stockMovements[0].itemKind,"beverage");
assert.equal(persisted>=2,true);
const enhanced=read("receipt_enhanced.js");
for(const expected of ["Valor recebido","Troco devolvido","Taxa de tele-entrega","Pagamento"]){
 assert(enhanced.includes(expected),expected);
}
const src=read("source/pote_app_base.html");
for(const expected of ["POTE_PAYMENT?.validate","POTE_PAYMENT?.vitrineValidate",
 "POTE_INVENTORY?.duplicate","POTE_DRINKS?.variantForOrder",
 "POTE_DRINKS?.quoteForCart","orderHasDelivery","vitrineHasDelivery"]){
 assert(src.includes(expected),"Integração ausente "+expected);
}
const page=read("public/index.html");
for(const expected of ["beverage_catalog.js?v=commerce-20261115","payment_flow.js?v=commerce-20261115",
 "stock_inventory.js?v=stock-priority-20261115","stock_ext.js?v=audit-20261115",
 "commerce_update.css?v=commerce-20261115"]){assert(page.includes(expected),expected)}
console.log("PASS: 11 bebidas com estoque zero, combo 3 sabores/5%, dinheiro/troco, entrega, duplicados e compras físicas.");
