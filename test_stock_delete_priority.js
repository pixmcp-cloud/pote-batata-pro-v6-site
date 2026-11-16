const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const elements=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{
  id,value:"",textContent:"",innerHTML:"",dataset:{},hidden:false,disabled:false,
  classList:{add(){},remove(){}},checked:false,
  addEventListener(type,fn){this["on_"+type]=fn},focus(){},scrollIntoView(){},
  querySelectorAll(){return []}
 });
 return elements.get(id);
}
const document={getElementById(id){if(id==="poteDeleteStockModal"&&!elements.has(id))return null;return el(id)},
 createElement(){return {id:"",innerHTML:"",hidden:true,addEventListener(){}}},body:{appendChild(child){elements.set(child.id,child)}},
 querySelectorAll(){return []}};
const make=(id,name,stock,category="Embalagem",minimum=0)=>({
 id,name,stock,category,minimum,measureUnit:"un",yield:100,
 purchasePrice:20,purchaseQuantity:10,purchaseUnit:"un"
});
const p1=make("p500a","Pote térmico 500 ml",2,"Embalagem",2);
const p2=make("p500b","Pote térmico 500 ml",4,"Embalagem",2);
const missing=make("miss","Tampa de reposição",0,"Embalagem",0);
const low=make("low","Colher avulsa",4,"Embalagem",10);
const good=make("good","Caixa pizza G",25,"Embalagem",4);
const spare=make("spare","Saco plástico extra",3,"Embalagem",0);
const recipes=[{id:"r1",name:"Batata recheada",items:[{id:"base",g:300}],
  packagingIngredientIds:["p500a","p500b"]}];
const base={id:"base",name:"Batata",stock:9000,minimum:1000,category:"Base",measureUnit:"g",
 yield:100,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"};
const pending={id:"pending1",status:"recebido",stockDeducted:false,qty:2,
 items:[{id:"p500a",g:1,yieldPct:100}],beverageItems:[]};
const historical={id:"old1",status:"entregue",stockDeducted:true,qty:1,
 items:[{id:"p500b",g:1,yieldPct:100}],beverageItems:[]};
const data={ingredients:[p1,p2,missing,low,good,spare,base],beverages:[],
 recipes,addons:[],orders:[pending,historical],purchases:[],stockMovements:[],
 settings:{usePackagingStock:true}};
const state={tab:"ingredients",data};
let confirmed=0,persisted=0,rendered=0,toasts=[];
const window={POTE_AUTH:{uid:"admin1",role:"admin",franchiseActive:false},
 confirm(){confirmed++;return true},
 addEventListener(){}};
const sandbox={window,document,state,console,JSON,Array,Set,Map,String,Number,Math,Intl,Date,
 alert(){},confirm(){return true},prompt(){return null},
 persist(){persisted++},render(){rendered++},toast(v){toasts.push(v)},
 field(label){return "<label>"+label+"</label>"},select(label){return "<select>"+label+"</select>"},
 uid(){return "test-"+(++persisted)},go(x){state.tab=x},canSell(){return true}};
vm.createContext(sandbox);
for(const module of ["stock_math.js","stock_inventory.js","stock_status.js",
 "stock_ui.js","stock_delete.js"])
 vm.runInContext(read(module),sandbox,{filename:module});
const S=window.POTE_STOCK,T=window.POTE_STOCK_STATUS,UI=window.POTE_STOCK_UI,
 D=window.POTE_STOCK_DELETE,I=window.POTE_INVENTORY;
assert(S&&T&&UI&&D&&I);
window.POTE_RESTOCK_CONTEXT={items:[
 {id:"p500a",kind:"ingredient",name:p1.name,needed:2,available:0,missing:2,
 level:"missing",unit:"un"}]};
let held=T.reserved(data);
assert.equal(held.ingredients.get(p1.id),2);
assert.equal(T.currentContext().length,1);
assert.equal(T.requested("p500a","ingredient").level,"missing");
let panel=UI.renderPanel(state,data.ingredients);
assert(panel.includes("stock-urgent-list"));
assert(panel.includes("FALTANTES · REPOR PRIMEIRO"));
assert(panel.includes('data-need-id="miss"'));
assert(panel.includes("stock-delete-button"));
assert(panel.includes("POTE_STOCK_DELETE.open"));
const list=panel.split('class="stock-card-list">')[1];
assert(list.indexOf('data-stock-status="missing"')<list.indexOf('data-stock-status="low"'),
 "Faltantes antes de baixo");
assert(list.indexOf('data-stock-status="low"')<list.indexOf('data-stock-status="good"'),
 "Baixos antes de bons");
assert(panel.includes('data-stock-id="p500a"'));
const receipt=S.purchase({ingredient:p1,quantity:"6",unit:"un",paidTotal:"9,00",
 purchases:data.purchases,movements:data.stockMovements,makeId:()=>"purchase-test"});
assert.equal(receipt.next,8);
assert.equal(T.reserved(data).ingredients.get(p1.id),2);
assert.equal(T.currentContext().length,0,"Repor 6 potes deve limpar o aviso desatualizado");
panel=UI.renderPanel(state,data.ingredients);
assert(panel.includes("Reposição atendida para este pedido"));
const statusP1=T.classify(p1,2,{shortage:!!T.requested(p1.id,"ingredient")});
assert.equal(statusP1.level,"good","Após a reposição suficiente, o pote deve ficar verde");
const legacy=I.duplicates(data.ingredients);
assert.equal(legacy.length,1);
assert.equal(legacy[0].length,2);
const dependency=D.dependencies("p500a");
assert.equal(dependency.recipes.length,1);
assert.equal(dependency.pending.length,1,"Pedido pendente impede exclusão");
assert.equal(D.mergeTo("p500a","p500b").ok,false,"Não pode migrar estoque com pedidos pendentes");
pending.status="entregue";
const oldHistoricID=historical.items[0].id;
const results=D.mergeTo("p500b","p500a");
assert.equal(results.ok,true);
assert.equal(p1.stock,12);
assert.equal(p2.stock,0);
assert.equal(p2.archived,true);
assert.equal(p2.mergedInto,"p500a");
assert.deepEqual([...recipes[0].packagingIngredientIds],["p500a"]);
assert.equal(historical.items[0].id,oldHistoricID,
 "Comanda antiga não pode sofrer alteração na auditoria");
assert(!UI.renderPanel(state,data.ingredients).includes('data-stock-id="p500b"'));
assert.equal(I.duplicates(data.ingredients).length,0);
assert(D.trashHtml().includes("Pote térmico 500 ml"));
assert(data.stockMovements.some(i=>i.oldIngredientId==="p500b"&&i.newIngredientId==="p500a"));
assert(read("source/pote_app_base.html").includes("i.category==='Embalagem'&&!i.archived"),
 "A embalagem excluída não pode continuar sendo exigida em todas as receitas");
D.open("spare");
assert.equal(el("poteDeleteStockModal").hidden,false);
assert.equal(D.archiveSelected(),true);
assert.equal(spare.archived,true);
assert(!UI.renderPanel(state,data.ingredients).includes('data-stock-id="spare"'));
assert(D.trashHtml().includes("Saco plástico extra"));
assert.equal(D.restore("spare"),true);
assert.equal(spare.archived,false);
assert(UI.renderPanel(state,data.ingredients).includes('data-stock-id="spare"'));
assert(confirmed>=1&&persisted>=1&&rendered>=1);
const built=read("public/index.html");
for(const v of ["stock_delete.js?v=stock-priority-20261115",
 "stock_inventory.js?v=stock-priority-20261115",
 "stock_ui.js?v=kitchen-motoboy-20261116",
 "stock_status.js?v=audit-20261115",
 "stock_triage.css?v=stock-priority-20261115",
 "release_news.js?v=pdv-20261116"]){
 assert(built.includes(v),"Página gerada sem "+v);
}
console.log("PASS: reposição remove aviso antigo; faltantes no topo; nome clicável; lixeira, mesclagem protegida, histórico preservado e restauração.");
