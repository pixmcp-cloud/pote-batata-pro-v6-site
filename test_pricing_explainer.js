const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const elements=new Map(),alerts=[];
function el(id){
 if(!elements.has(id))elements.set(id,{id,value:"",disabled:false,innerHTML:"",
  addEventListener(){},dataset:{},parentElement:null,checked:false,focus(){}});
 return elements.get(id)
}
const ingredient={id:"batata",name:"Batata",category:"Base",yield:100,
 purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",stock:20000};
const pack1={id:"pot500",name:"Pote 500g",category:"Embalagem",purchasePrice:5,purchaseQuantity:10,
 purchaseUnit:"un",measureUnit:"un",stock:50};
const pack2={id:"pot250",name:"Pote 250g",category:"Embalagem",purchasePrice:4,purchaseQuantity:10,
 purchaseUnit:"un",measureUnit:"un",stock:50};
const recipe={id:"r",name:"Batata exemplo",category:"Salgado",items:[{id:"batata",g:500}],
 targetGainPct:100,pricingMode:"gain"};
const state={tab:"pricing",expansion:"r",data:{recipes:[recipe],ingredients:[ingredient,pack1,pack2],
 settings:{usePackagingStock:true,packageCost:0,otherCost:1,fee:2,tax:1,marketplaceFee:19,
  margin:50,channel:"direto",estimatedMonthlyUnits:100,deliveryCostPerOrder:8},
 expenses:[{enabled:true,mode:"mensal",amount:100,repeat:1},
 {enabled:true,mode:"unidade",amount:2,repeat:1}]}};
let rendered=0;
const ctx={document:{
 getElementById:el,querySelectorAll(sel){return sel==="[data-pote-package]"?[el("ck1"),el("ck2")]:[]},
 createElement(){return {id:"",innerHTML:"",parentElement:null}},
 },
 window:{},state,JSON,Math,Date,Number,String,Array,Set,Map,console,Intl,
 alert(x){alerts.push(x)},toast(){},render(){rendered++},persist(){},
 allowed(){return true},
 costOf(r){return r.items.reduce((t,x)=>t+x.g*.01,0)},
 packagingForRecipe(r){return state.data.ingredients.filter(i=>i.category==="Embalagem").filter(i=>
 Array.isArray(r.packagingIngredientIds)&&r.packagingIngredientIds.includes(i.id))},
 effectivePackageCost(r){return ctx.packagingForRecipe(r).reduce((t,i)=>t+i.purchasePrice/i.purchaseQuantity,0)},
 fixedPerUnit(){return 1},
 totalCost(r){return ctx.costOf(r)+ctx.effectivePackageCost(r)+1+2+1},
 sellPrice(r){return 21.9}
};
vm.createContext(ctx);
vm.runInContext(read("pricing_explainer.js"),ctx);
const P=ctx.window.POTE_PRICING;
assert(P);
let r=P.report(recipe);
assert.equal(r.ingredient,5);
assert.equal(r.packageCost,0,"Sem seleção explícita nenhuma embalagem deve ser cobrada automaticamente");
assert.equal(r.fixed,1);
assert.equal(r.other,1);
assert.equal(r.variable,2);
assert.equal(r.cost,9);
assert.equal(r.price,21.9);
assert(Math.abs(r.fees-0.657)<1e-9);
assert(r.contribution>10);
assert(r.margin>0&&r.markup>0);
assert.equal(r.missing.length,0);
el("ck1").checked=true;el("ck1").value="pot500";el("ck1").dataset.potePackage="pot500";
el("ck2").checked=false;el("ck2").value="pot250";el("ck2").dataset.potePackage="pot250";
el("priceRecipe").value="r";
P.choosePackaging();
assert.equal(recipe.packagingIngredientIds.length,1);
assert.equal(recipe.packagingIngredientIds[0],"pot500");
assert.equal(ctx.effectivePackageCost(recipe),.5,"Selecionar embalagem individual evita dupla cobrança");
assert.equal(rendered,1);
el("poteCostBasis").value="average";
assert.equal(P.chooseCostBasis(),true);
assert.equal(state.data.settings.costBasis,"average");
assert.equal(rendered,2);
ingredient.purchasePrice=0;
assert(P.missingCosts(recipe).some(x=>x.includes("Batata")));
ingredient.purchasePrice=10;
for(const [id,value] of Object.entries({priceGain:"100",priceMargin:"50",priceUnits:"100",
 pricePkg:"0",priceOther:"1",priceDelivCost:"8",priceFee:"2",priceMktFee:"19",
 priceTax:"1",priceChannel:"direto",priceMode:"gain"}))el(id).value=value;
assert.equal(P.validateForm(),true);
el("priceFee").value="105";
assert.equal(P.validateForm(),false);
assert(alerts.pop().includes("Taxa de cartão"));
el("priceFee").value="2";
el("priceMode").value="margin";
el("priceMargin").value="99";
assert.equal(P.validateForm(),false,"Margem mais taxa não pode ultrapassar 100%");
const src=read("source/pote_app_base.html");
assert(src.includes("POTE_PRICING?.validateForm"));
assert(src.includes("Sobra após custos variáveis"),"Precificação deve separar sobra de lucro");
assert(src.includes("Lucro estimado por unidade"),"Lucro após despesas fixas precisa ser explícito");
ingredient.costSource="franchise-estimate-40";
ingredient.costEstimateOriginalPrice=10;
recipe.costEstimatePct=40;
ctx.recipeCostIsEstimated=()=>true;
const page=el("page");
page.firstChild={};
page.insertBefore=child=>{child.parentElement=page;elements.set(child.id,child)};
P.mount();
const guide=el("potePricingGuide").innerHTML;
assert(guide.includes("40%"),"Aviso de custo deve refletir os 40% do modelo atual");
assert(!guide.includes("custo estimado em 60%"),"Aviso obsoleto de 60% deve ser removido");
assert(P.missingCosts(recipe).some(x=>x.includes("estimado")),
 "Custos simulados não devem ser apresentados como compras reais");
const build=read("public/index.html");
for(const part of ["pricing_explainer.js?v=auditoria-v3-20261116","pricing_explainer.css?v=price-guide-20261115"]){
 assert(build.includes(part),"Asset ausente: "+part)
}
console.log("PASS: preço discriminado, referência de embalagem individual, custos incompletos e prevenção de taxas/margens inválidas.");
