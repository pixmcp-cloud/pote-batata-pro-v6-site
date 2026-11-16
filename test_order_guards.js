const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=x=>fs.readFileSync(x,"utf8");
const elements=new Map(),listeners=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{
  id,value:"",innerHTML:"",textContent:"",className:"",hidden:false,disabled:false,title:"",
  classList:{added:[],add(v){this.added.push(v)},remove(){}},dataset:{},
  addEventListener(){},focus(){},scrollIntoView(){this.scrolled=true},
  querySelectorAll(){return []},style:{}
 });
 return elements.get(id)
}
const document={body:{appendChild(){}},
 getElementById(id){return el(id)},
 createElement(){return el("generated"+elements.size)},
 querySelectorAll(sel){
  if(sel==="[data-order-id]")return [el("orderCard")];
  return [];
 }};
const loc={href:"https://example.com/app/"};
let pushed=0,moved=0,confirmCount=0,confirmValue=false;
const history={pushState(){pushed++},go(n){moved=n}};
const recipe={id:"r1",name:"X-Salada",packagingIngredientIds:["pack"],items:[{id:"potato",g:500},{id:"cheese",g:50}]};
const ingredients=[
 {id:"potato",name:"Batata",measureUnit:"g",yield:100,stock:3000,category:"Base"},
 {id:"cheese",name:"Queijo",measureUnit:"g",yield:100,stock:700,category:"Laticínio"},
 {id:"pack",name:"Embalagem",measureUnit:"un",yield:100,stock:20,category:"Embalagem"}
];
const beverage={id:"soda",name:"Refrigerante",stock:10};
const state={tab:"orders",data:{ingredients,beverages:[beverage],orders:[],recipes:[recipe],
 settings:{usePackagingStock:true},businessType:"hamburgueria"}};
const quote={recipe,addons:[],beverages:[]};
el("orderItem").value="recipe:r1";el("orderChannel").value="direto";
el("orderQty").value="1";el("orderExtraBev").value="";el("orderExtraAddon").value="";
el("orderCard").dataset.orderId="o1";
const window={POTE_AUTH:{uid:"u1",role:"free"},location:loc,
 addEventListener(type,fn){listeners.set(type,fn)},
 confirm(){confirmCount++;return confirmValue}};
const ctx={state,window,document,history,location:loc,console,Math,Number,Map,Set,Date,
 String,Array,JSON,Intl,requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),Event:class {},
 optionQuote:()=>quote,canSell:r=>!!r,go(tab){state.tab=tab},confirm:()=>false};
vm.createContext(ctx);
vm.runInContext(read("order_guard.js"),ctx);
const O=window.POTE_ORDER;
assert(O,"Validador não carregou");
let v=O.calc(quote,1);
assert.equal(v.ok,true);
assert.equal(v.maxUnits,6,"Capacidade é limitada por 3kg / 500g");
assert(v.low.length===0,"Restam 5 unidades após um pedido, ainda não está abaixo de 5");
v=O.calc(quote,2);
assert.equal(v.ok,true);
assert.equal(v.maxUnits,6);
assert(v.low.length>0,"Após 2 unidades restam 4, aviso necessário");
assert.equal(O.checkBeforeRegister(),true);
state.data.orders.push({id:"o1",status:"recebido",stockDeducted:false,recipeId:"r1",
 qty:2,items:recipe.items.map(x=>({...x,yieldPct:100})),beverageItems:[]});
v=O.calc(quote,5);
assert.equal(v.ok,false,"Reserva de 2 impede criar pedido de 5");
assert.equal(v.maxUnits,4);
assert(v.errors.some(x=>x.name==="Batata"));
el("orderQty").value="5";
assert.equal(O.checkBeforeRegister(),false,"Cadastro deve ser bloqueado ANTES de salvar");
assert.equal(el("poteOrderAlerts").hidden,false,"Popup precisa abrir para estoque insuficiente");
assert(el("poteOrderAlertDescription").textContent.includes("Batata"));
O.refresh();
assert.equal(el("poteOrderRegister").disabled,true,"Botão deve ser desabilitado enquanto digita");
assert(el("poteOrderAvailability").innerHTML.includes("reservad"),"Aviso deve mencionar reservas");
el("orderQty").value="3";
O.refresh();
assert.equal(el("poteOrderRegister").disabled,false);
assert.equal(O.checkBeforeRegister(),true);
assert.equal(O.checkBeforeProduce(state.data.orders[0]),true,"Produção pode consumir reservas próprias");
state.data.orders.push({id:"o2",status:"recebido",stockDeducted:false,recipeId:"r1",
 qty:3,items:recipe.items.map(x=>({...x,yieldPct:100})),beverageItems:[]});
assert.equal(O.checkBeforeProduce(state.data.orders[0]),true,"Produzir o primeiro pedido preserva saldo dos demais");
ingredients[0].stock=2000;
assert.equal(O.checkBeforeProduce(state.data.orders[0]),false,"Produção deve ser bloqueada se faltar saldo");
ingredients[0].stock=3000;
const qAddon={recipe,addons:[{id:"extra",ingredientId:"cheese",name:"Queijo extra",quantity:200}],
 beverages:[beverage]};
v=O.calc(qAddon,1);
assert.equal(v.maxUnits,1,"Com pedidos pendentes, só uma unidade com adicional ainda cabe no estoque");
state.data.orders=[];ingredients[0].stock=3000;ingredients[1].stock=700;
v=O.calc(qAddon,2);
assert.equal(v.maxUnits,2,"Adicional por unidade limita o máximo");
assert.equal(v.ok,true);
v=O.calc(qAddon,3);
assert.equal(v.ok,false,"Quantidade excessiva com adicional deve ser recusada");
beverage.stock=1;
v=O.calc(qAddon,2);
assert.equal(v.ok,false,"Bebida extra também deve bloquear o registro");
beverage.stock=10;
ingredients[2].stock=1;
v=O.calc(quote,2);
assert.equal(v.ok,false,"Embalagem obrigatória deve bloquear registro se insuficiente");
ingredients[2].stock=20;
state.data.orders=[{id:"o3",status:"em_producao",stockDeducted:true,qty:2,
 items:recipe.items.map(x=>({...x,yieldPct:100})),beverageItems:[]}];
v=O.calc(quote,1);
assert.equal(v.maxUnits,6,"Pedido já produzido não deve continuar reservando estoque");
state.data.orders=[];ingredients[0].stock=1500;
const low=O.scanLowRecipes();
assert.equal(low.length,1);
assert.equal(low[0].maxUnits,3,"Alerta de menos de 5 unidades por receita");
O.scrollToOrders("o1");
assert.equal(state.tab,"orders");
assert.equal(el("ordersHistoryTitle").scrolled,true);
assert(el("orderCard").classList.added.includes("pote-order-focus"));
vm.runInContext(read("exit_guard.js"),ctx);
const E=window.POTE_EXIT;
E.arm();assert.equal(E.isArmed(),true);
assert.equal(pushed,1,"A saída do Android deve poder ser interceptada pela entrada de histórico");
const pop=listeners.get("popstate");
assert(pop);pop();assert.equal(el("poteExitConfirm").hidden,false,"Voltar deve pedir confirmação");
assert.equal(pushed,2);
const unload=listeners.get("beforeunload");
const event={preventDefault(){this.prevented=true},returnValue:null};
unload(event);assert.equal(event.prevented,true,"Recarregar/fechar deve solicitar aviso ao navegador");
assert.equal(E.confirmLogout(),false);
assert.equal(confirmCount,1);
confirmValue=true;assert.equal(E.confirmLogout(),true);
el("poteExitLeave").addEventListener=()=>{};
const src=read("source/pote_app_base.html");
for(const term of ["checkBeforeRegister","checkBeforeProduce","ordersHistoryTitle","scrollToOrders","POTE_ORDER?.lowAfterOrder"]){
 assert(src.includes(term),"Integração do pedido ausente: "+term);
}
const html=read("public/index.html");
for(const path of ["order_guard.js?v=audit-20261115",
 "exit_guard.js?v=exit-v2-20261115","order_ui.css?v=orders-v2-20261115"]){
 assert(html.includes(path),"Falta incluir "+path+" no site final");
}
assert(read("firebase_integration.js").includes("POTE_EXIT?.confirmLogout?.()"),"Sair exige confirmação");
assert(read("stock_ui.js").includes('localeCompare(String(b.name||""),"pt-BR"'),"Estoque deve ficar em ordem alfabética");
const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(m=>!m[1].includes("application/json"));
for(const s of inline)new vm.Script(s[2],{filename:"app-inline.js"});
console.log("PASS: cadastro antecipado, reserva de insumos, embalagens, bebidas, adicionais, 5 unidades, popup, finalização em Pedidos, saída protegida, ordem alfabética.");
