const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const elements=new Map(),listeners=new Map(),seen=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{
  id,value:"",hidden:false,disabled:false,innerHTML:"",textContent:"",dataset:{},
  checked:false,scrolled:false,
  focus(){this.focused=true},scrollIntoView(){this.scrolled=true},querySelectorAll(){return []},
  addEventListener(type,callback){this["on_"+type]=callback},
  querySelectorAll(){return []},remove(){elements.delete(this.id)}
 });
 return elements.get(id);
}
const document={
 getElementById(id){if((id==="poteReleaseNews"||id==="poteOrderAlerts")&&!elements.has(id))return null;return element(id)},
 createElement(){return {id:"",hidden:true,innerHTML:"",addEventListener(){},
  focus(){},remove(){elements.delete(this.id)}}},
 querySelectorAll(){return []},
 body:{appendChild(child){elements.set(child.id,child)}}
};
const localStorage={getItem(k){return seen.get(k)||null},setItem(k,v){seen.set(k,v)},
 removeItem(k){seen.delete(k)}};
const data={
 businessType:"batataria",
 settings:{usePackagingStock:true},
 recipes:[{id:"recipe",name:"Batata recheada",items:[{id:"batata",g:500}],
  packagingIngredientIds:["pote"]}],
 ingredients:[
  {id:"pote",name:"Pote térmico 500 ml",category:"Embalagem",measureUnit:"un",
   stock:1,minimum:0,yield:100,purchaseQuantity:10,purchasePrice:10,purchaseUnit:"un"},
  {id:"milho",name:"Milho",category:"Vegetal",measureUnit:"g",
   stock:300,minimum:500,yield:100,purchaseQuantity:1,purchasePrice:5,purchaseUnit:"kg"},
  {id:"batata",name:"Batata",category:"Base",measureUnit:"g",
   stock:10000,minimum:500,yield:100,purchaseQuantity:1,purchasePrice:4,purchaseUnit:"kg"}],
 beverages:[
  {id:"agua0",name:"Água sem gás",size:"500 ml",stock:0,minimum:5,sellPrice:4},
  {id:"cola3",name:"Refrigerante Cola",size:"Lata",stock:3,minimum:5,sellPrice:7},
  {id:"refri10",name:"Guaraná",size:"Lata",stock:10,minimum:5,sellPrice:7}],
 orders:[{id:"order1",status:"recebido",stockDeducted:false,qty:1,
  items:[{id:"pote",g:1,yieldPct:100},{id:"batata",g:500,yieldPct:100}],
  beverageItems:[]}],stockMovements:[],purchases:[]
};
const state={tab:"orders",data};
element("orderItem").value="recipe:recipe";
element("orderQty").value="2";
element("orderClient").value="Cliente teste";
element("orderPayment").value="pix";
let navigated="",opened="";
const window={
 POTE_AUTH:{uid:"user1",email:"customer@example.com"},
 POTE_APP_READY:false,
 addEventListener(type,handler){listeners.set(type,handler)},
 dispatchEvent(event){listeners.get(event.type)?.(event)}
};
const ctx={
 window,document,localStorage,state,console,Date,Number,String,JSON,Math,
 Array,Map,Set,Intl,alert(){},confirm(){return true},
 field(){return '<input>'},select(){return '<select>'},uid(){return "tx1"},
 toast(){},persist(){},render(){},go(tab){state.tab=tab;navigated=tab},
 optionQuote(){return {recipe:data.recipes[0],addons:[],beverages:[]}},
 updateOrderSuggestedPrice(){}
};
vm.createContext(ctx);
for(const module of ["stock_math.js","stock_status.js","stock_ui.js","stock_ext.js","order_guard.js"])
 vm.runInContext(read(module),ctx,{filename:module});
const T=window.POTE_STOCK_STATUS,UI=window.POTE_STOCK_UI,O=window.POTE_ORDER;
assert(T&&UI&&O);
const nativeOpen=UI.openPurchase,nativeSelect=window.POTE_STOCK_EXT.selectBeverage;
UI.openPurchase=id=>{opened=id;return nativeOpen(id)};
window.POTE_STOCK_EXT.selectBeverage=id=>{opened=id;return nativeSelect(id)};
const reserved=T.reserved(data);
assert.equal(reserved.ingredients.get("pote"),1);
assert.equal(T.classify(data.ingredients[0],1).level,"missing");
assert.equal(T.classify(data.ingredients[1],0).level,"low");
assert.equal(T.classify(data.ingredients[2],500).level,"good");
assert.equal(T.classify(data.beverages[0],0).label,"FALTANTE");
assert.equal(T.classify(data.beverages[1],0).label,"ESTOQUE BAIXO");
assert.equal(T.classify(data.beverages[2],0).label,"ESTOQUE BOM");
assert(T.recipeLowIds(data).has("pote")===false,"Pote reservado fica faltante, não apenas baixo");
let inventory=UI.renderPanel(state,data.ingredients);
for(const name of ["stock-status-missing","stock-status-low","stock-status-good",
 "stock-balance-missing","stock-balance-low","stock-balance-good",
 "Pote térmico 500 ml","FALTANTE","ESTOQUE BAIXO","ESTOQUE BOM"]){
 assert(inventory.includes(name),"Estoque deve mostrar "+name);
}
const report=O.calc(ctx.optionQuote(),2);
assert.equal(report.ok,false);
assert(report.errors.some(x=>x.id==="pote"),"A ausência de pote deve identificar o item corretamente");
O.showAlert("Produção bloqueada — estoque comprometido","Falta embalagem",report);
assert(element("poteOrderAlertItems").innerHTML.includes("FALTANTE: Pote térmico 500 ml"));
assert(element("poteOrderAlertRestock").hidden===false);
assert(element("poteOrderAlertRestock").disabled===false);
element("orderQty").value="2";
element("orderNote").value="Sem milho";
O.restock();
assert.equal(navigated,"ingredients");
assert.equal(opened,"pote","Botão deve selecionar exatamente o pote faltante");
assert.equal(window.POTE_RESTOCK_CONTEXT.items[0].id,"pote");
inventory=UI.renderPanel(state,data.ingredients);
assert(inventory.includes("Reposição necessária para o pedido"));
assert(inventory.includes("Repor este item"));
assert(inventory.includes('data-need-id="pote"'));
element("orderQty").value="";
element("orderNote").value="";
state.tab="orders";
assert.equal(O.restoreDraft(),true);
assert.equal(element("orderQty").value,"2","A quantidade digitada não pode sumir ao repor");
assert.equal(element("orderNote").value,"Sem milho","As observações do pedido devem ser restauradas");
UI.returnToOrder();
assert.equal(state.tab,"orders");
assert.equal(window.POTE_RESTOCK_CONTEXT,null);
const lowReport={errors:[],low:[{id:"milho",name:"Milho",kind:"ingredient",
 level:"low",available:300,unit:"g",capacity:3,after:1}]};
O.showAlert("Estoque baixo","Repor em breve",lowReport);
assert(element("poteOrderAlertItems").innerHTML.includes("ESTOQUE BAIXO: Milho"));
assert(element("poteOrderAlertItems").innerHTML.includes("low"));
assert.equal(element("poteOrderAlertRestock").hidden,false);
// A mesma ação deve selecionar o registro de bebida, se esse for o item em falta.
O.showAlert("Bebida faltando","",{
 errors:[{id:"agua0",name:"Água sem gás",kind:"beverage",unit:"un",missing:1,available:0}]});
O.restock();assert.equal(opened,"agua0");
const drinks=window.POTE_STOCK_EXT.renderBeverages();
assert(drinks.includes("stock-status-missing"));
assert(drinks.includes("stock-status-low"));
assert(drinks.includes("stock-status-good"));
window.POTE_APP_READY=false;
vm.runInContext(read("release_news.js"),ctx,{filename:"release_news.js"});
window.POTE_APP_READY=true;
const N=window.POTE_RELEASE_NEWS;
assert(N,"News module loaded");
assert.equal(N.open(),true,"Novidade deve aparecer após autenticação");
assert.equal(element("poteReleaseNews").hidden,false);
assert(element("poteReleaseNews").innerHTML.includes("Não mostrar novamente esta notícia"));
assert(element("poteReleaseNews").innerHTML.includes("Estoque e pedidos mais protegidos"));
element("poteNewsDontShow").checked=true;
N.close();
assert.equal(N.dismissed(),true);
assert.equal(element("poteReleaseNews").hidden,true);
listeners.get("pote:user-logout")?.();
window.POTE_AUTH.uid="user1";
assert.equal(N.open(),false,"A mesma notícia deve permanecer dispensada nesta conta");
window.POTE_AUTH.uid="user2";
assert.equal(N.open(),true,"Outra conta deve receber o aviso");
N.close();
// Uma versão nova deve reabrir o aviso mesmo para quem dispensou a anterior.
delete window.POTE_RELEASE_NEWS;
const next=read("release_news.js").replace(
 'id:"2026-11-16-franquia-custos60-02"',
 'id:"2026-11-16-outro-aviso-02"');
window.POTE_AUTH.uid="user1";
vm.runInContext(next,ctx,{filename:"next-release-news.js"});
assert.equal(window.POTE_RELEASE_NEWS.dismissed(),false);
assert.equal(element("poteReleaseNews").hidden,false,"Nova versão deve aparecer");
const built=read("public/index.html");
for(const path of ["stock_status.js?v=audit-20261115",
 "stock_ui.js?v=estimativa-franquia-60-20261116",
 "stock_ext.js?v=estimativa-franquia-60-20261116",
 "order_guard.js?v=audit-20261115",
 "release_news.js?v=franquia-custos60-20261116",
 "release_news.css?v=news-20261115-06",
 "stock_triage.css?v=stock-priority-20261115"]){
 assert(built.includes(path),"Build público sem "+path);
}
assert(read("make_beta.py").includes("POTE_ORDER?.restoreDraft?.()"));
console.log("PASS: semáforo estoque, reservas, destaque vermelho/laranja/verde, botão reposição, pedido preservado e notícia por usuário/versão.");
