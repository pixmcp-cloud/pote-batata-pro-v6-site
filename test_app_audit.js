const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=f=>fs.readFileSync(f,"utf8");
const regular={id:"potato",name:"Batata",measureUnit:"g",category:"Base",stock:"20.000",
 purchaseQuantity:1,purchaseUnit:"kg",purchasePrice:10,minimum:500,yield:100};
const caseA={id:"bag-a",name:"Pote térmico 500 ml",category:"Embalagem",
 measureUnit:"un",stock:2,minimum:0,yield:100};
const caseB={id:"bag-b",name:"Pote Térmico 500 ml",category:"Embalagem",
 measureUnit:"un",stock:3,minimum:0,yield:100};
const invalid={id:"bad",name:"Tomate",category:"Vegetal",measureUnit:"g",stock:"20kg",yield:100};
const data={businessType:"batataria",ingredients:[regular,caseA,caseB,invalid],
 beverages:[],addons:[],settings:{usePackagingStock:true},
 recipes:[
 {id:"r1",name:"Batata recheada",items:[{id:"potato",g:500}]},
 {id:"r2",name:"Sem cadastro",items:[{id:"ghost",g:80}]}
 ],
 orders:[{id:"o1",name:"Pedido anterior",status:"recebido",qty:50,stockDeducted:false,
 items:[{id:"potato",g:500,yieldPct:100}],beverageItems:[]}]
};
const doc={getElementById(id){return {value:"r1"}},querySelectorAll(){return []}};
let jumped="";
const state={data,tab:"ingredients"};
const window={POTE_STOCK_UI:{openPurchase(id){jumped=id}},
 POTE_PRICING:{mount(){}},POTE_STOCK_EXT:{selectBeverage(id){jumped=id}}};
const ctx={window,state,document:doc,console,Math,Date,JSON,Number,Array,Set,Map,String,Intl,
 canSell(){return true},go(tab){state.tab=tab}};
vm.createContext(ctx);
for(const f of ["stock_math.js","stock_inventory.js","stock_status.js","app_audit.js","order_guard.js"])
 vm.runInContext(source(f),ctx,{filename:f});
const S=window.POTE_STOCK,A=window.POTE_APP_AUDIT,O=window.POTE_ORDER;
assert(S&&A&&O);
const before=A.scan(data);
for(const code of ["invalid-stock","missing-ingredient","unlinked-package",
 "duplicate","over-reserved"])assert(before.issues.some(i=>i.code===code),"Deveria detectar "+code);
assert(before.errors>=3);
assert(A.panel(data).includes("Auditoria automática"));
assert(A.panel(data).includes("Ir para item"));
A.jump("ingredient","ghost");assert.equal(jumped,"ghost");
A.jump("recipe","r1","r1");assert.equal(state.tab,"pricing");
const normalized=S.normalizeInventory(data);
assert.equal(normalized.changes.length,1);
assert.equal(regular.stock,20000,"Texto 20.000 representa 20 mil gramas");
assert.equal(normalized.invalid.length,1);
const quote={recipe:data.recipes[0],addons:[],beverages:[]};
const results=O.calc(quote,1);
assert.equal(results.maxUnits,0,"Reserves of 25,000 g must block 20 kg physical stock");
assert.equal(results.ok,false);
assert.equal(results.errors[0].physical,20000);
assert.equal(results.errors[0].reserved,25000);
assert(results.errors[0].id==="potato");
data.orders=[];
const sufficient=O.calc(quote,1);
assert.equal(sufficient.ok,true,"20 kg de batata devem permitir pedido de 500g");
assert.equal(sufficient.maxUnits,40);
const nonsense={id:"none",name:"Cenoura",stock:"invalid",measureUnit:"g",yield:100};
data.ingredients.push(nonsense);
const bad=O.calc({recipe:{items:[{id:"none",g:10}]},addons:[],beverages:[]},1);
assert.equal(bad.ok,false,"Saldo inválido não pode liberar venda");
data.recipes[0].packagingIngredientIds=["bag-a"];
const linked=A.scan(data);
assert(!linked.issues.some(i=>i.code==="unlinked-package"&&i.recipeId==="r1"));
const built=source("public/index.html");
assert(built.includes("app_audit.js?v=audit-20261115"));
assert(built.includes("stock_math.js?v=custo-medio-20261116"));
console.log("PASS: auditoria detecta órfãos, duplicados, inválidos, embalagens sem vínculo e reservas; 20 kg liberam 40 batatas quando não reservados.");
