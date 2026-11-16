/* Auditoria explicável do cálculo de preço. Não sobrescreve preços existentes. */
(function(){
"use strict";
if(window.POTE_PRICING)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=x=>Number(x||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pct=x=>Number(x||0).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%";
const n=x=>Number(x)||0;
const key=id=>String(id||"");
function selectedRecipe(){
 const selected=$("priceRecipe")?.value;
 return (state.data.recipes||[]).find(r=>r.id===(selected||state.expansion))||
  (state.data.recipes||[]).find(r=>typeof allowed==="function"?allowed(r):true)||null;
}
function missingCosts(recipe){
 if(!recipe)return ["Escolha uma receita para precificar."];
 const issues=[];
 for(const item of recipe.items||[]){
  const ing=state.data.ingredients.find(i=>i.id===item.id);
  if(!ing){issues.push("Ingrediente não cadastrado: "+item.id);continue}
  const q=Number(ing.purchaseQuantity),paid=Number(ing.purchasePrice??ing.price);
  if(!Number.isFinite(q)||q<=0||!Number.isFinite(paid)||paid<=0)
   issues.push(ing.name+" sem custo de compra real");
  else if(ing.costSource==="franchise-estimate-60"&&
   Math.abs(Number(ing.purchasePrice)-Number(ing.costEstimateOriginalPrice))<0.001)
   issues.push(ing.name+" com custo estimado, sem nota de compra");
 }
 const pkgs=typeof packagingForRecipe==="function"?packagingForRecipe(recipe):[];
 if(state.data.settings.usePackagingStock)for(const i of pkgs)
  if(!Number.isFinite(Number(i.purchasePrice??i.price))||Number(i.purchasePrice??i.price)<=0)
   issues.push(i.name+" (embalagem) sem custo");
 return issues;
}
function report(recipe){
 if(!recipe)return null;
 const s=state.data.settings||{},
  ingredient=typeof costOf==="function"?costOf(recipe):0,
  packageCost=typeof effectivePackageCost==="function"?effectivePackageCost(recipe):0,
  fixed=typeof fixedPerUnit==="function"?fixedPerUnit():0,
  other=n(s.otherCost),variable=state.data.expenses.filter(e=>e.enabled&&e.mode==="unidade")
   .reduce((t,e)=>t+n(e.amount)*Math.max(1,n(e.repeat)),0),
  cost=typeof totalCost==="function"?totalCost(recipe):ingredient+packageCost+fixed+other+variable,
  channel=s.channel||"direto",
  price=typeof sellPrice==="function"?sellPrice(recipe,channel):0,
  fee=(channel==="marketplace"?n(s.marketplaceFee):n(s.fee))+n(s.tax),
  fees=price*fee/100,
  contribution=price-fees-(ingredient+packageCost+other+variable),
  profit=contribution-fixed,
  margin=price>0?profit/price*100:0,
  markup=cost>0?profit/cost*100:0,
  costs=missingCosts(recipe);
 return {recipe,ingredient,packageCost,fixed,other,variable,cost,channel,price,fee,fees,
  contribution,profit,margin,markup,missing:costs,
  delivery:n(s.deliveryCostPerOrder)};
}
function packageControls(recipe){
 const all=state.data.ingredients.filter(i=>i.category==="Embalagem"&&!i.archived)
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
 if(!all.length)return '<small>Nenhuma embalagem cadastrada. Cadastre potes, tampas ou caixas em Estoque e compras.</small>';
 const selected=new Set(Array.isArray(recipe.packagingIngredientIds)?recipe.packagingIngredientIds:[]);
 return '<div class="pote-price-packages"><strong>Embalagens que acompanham este produto</strong>'+
 '<small>Marque somente as usadas. Sem seleção explícita, nenhuma embalagem será consumida automaticamente. É necessário configurar potes, sacolas e caixas de cada receita para controlar corretamente custo e baixa do estoque.</small>'+
 all.map(i=>'<label class="pote-price-pack"><input type="checkbox" data-pote-package="'+esc(i.id)+'" '+
 (selected.has(i.id)?'checked ':'')+'onchange="POTE_PRICING.choosePackaging()">'+
 '<span>'+esc(i.name)+'</span><small>'+esc(money((Number(i.purchasePrice??i.price)||0)/
  Math.max(0.00001,(Number(i.purchaseQuantity)||1)*
  ((i.purchaseUnit==="kg"||i.purchaseUnit==="L")?1000:1))))+' / unidade cadastrada</small></label>').join("")+'</div>';
}
function panelHtml(r){
 const d=report(r);if(!d)return '';
 const estimated=typeof recipeCostIsEstimated==="function"&&recipeCostIsEstimated(r);
 const invalid=(!estimated&&d.missing.length>0)||!Number.isFinite(d.cost)||d.cost<=0;
 const title=estimated?
  '<div class="pote-price-warning" role="status"><strong>SIMULAÇÃO — custo estimado em 60% do preço final de referência.</strong>'+
  '<p>Os preços dos ingredientes e bebidas são aproximações, não comprovantes de compra. O lucro exibido é estimado; cadastre custos reais antes de operar comercialmente.</p></div>':
  invalid?
  '<div class="pote-price-warning" role="status"><strong>Atenção: o custo não está completo.</strong>'+
  '<p>Não use o preço sugerido para vender até informar os custos reais. '+esc(d.missing.slice(0,7).join("; "))+'</p></div>':
  '<p class="pote-price-ready">Custos da ficha preenchidos. Confira as despesas e taxas da sua operação antes de aplicar o preço.</p>';
 return '<section class="pote-price-guide">'+
  '<div class="pote-price-guide-header"><div><small>PRECIFICAÇÃO EXPLICADA</small><h2>Entenda seu preço de venda</h2></div>'+
  '<span>'+esc(d.recipe.name)+'</span></div>'+
  '<p>O preço é calculado a partir dos ingredientes e embalagens, somando despesas por unidade e uma parcela das despesas fixas. Depois, são considerados taxas, impostos e o ganho desejado.</p>'+
  title+'<label class="field">Critério de custo para precificação'+
   '<select id="poteCostBasis" onchange="POTE_PRICING.chooseCostBasis()">'+
   '<option value="replacement" '+(state.data.settings.costBasis!=="average"?"selected":"")+
   '>Última compra (reposição; recomendado)</option>'+
   '<option value="average" '+(state.data.settings.costBasis==="average"?"selected":"")+
   '>Custo médio ponderado (quando conhecido)</option></select></label>'+
   '<div class="pote-price-grid">'+
   '<div><small>Custo dos ingredientes</small><strong>'+money(d.ingredient)+'</strong></div>'+
   '<div><small>Embalagens</small><strong>'+money(d.packageCost)+'</strong></div>'+
   '<div><small>Despesas fixas por unidade</small><strong>'+money(d.fixed)+'</strong></div>'+
   '<div><small>Outros + variáveis</small><strong>'+money(d.other+d.variable)+'</strong></div>'+
   '<div><small>Custo estimado por unidade</small><strong>'+money(d.cost)+'</strong></div>'+
   '<div><small>Preço sugerido ('+esc(d.channel)+')</small><strong>'+ (invalid?"A conferir":money(d.price))+'</strong></div>'+
   '<div><small>Taxas + impostos estimados</small><strong>'+money(d.fees)+'</strong></div>'+
   '<div><small>Sobra após custos variáveis (contribuição)</small><strong>'+ (invalid?"A conferir":money(d.contribution))+'</strong></div>'+
   '<div><small>Lucro estimado por unidade após rateio fixo</small><strong>'+ (invalid?"A conferir":money(d.profit))+'</strong></div>'+
  '</div><details class="pote-price-explanation"><summary>Qual a diferença entre markup e margem?</summary>'+
  '<p><strong>Markup (ganho sobre custo)</strong> compara o ganho ao custo. Exemplo: custo de R$ 10 com ganho de 100% significa preço de R$ 20 antes de taxas.</p>'+
  '<p><strong>Margem sobre venda</strong> compara o resultado ao preço cobrado. Nesse mesmo exemplo de R$ 20, a margem é 50% antes das taxas.</p>'+
  '<p>Margem estimada desta ficha: <b>'+ (invalid?"a conferir":pct(d.margin))+
  '</b>. Ganho sobre custo estimado: <b>'+ (invalid?"a conferir":pct(d.markup))+
  '</b>. O resultado é estimativo e não inclui automaticamente perdas extraordinárias ou entrega não cobrada.</p></details>'+
  (d.delivery>0?'<p class="pote-price-shipping">Entrega: custo estimado '+money(d.delivery)+
  ' por pedido. O valor cobrado ao cliente deve ser informado separadamente no pedido.</p>':'')+
  packageControls(r)+'</section>';
}
function mount(){
 const page=$("page");if(!page||!page.firstChild)return;
 let box=$("potePricingGuide");
 // Quando a tela for reconstruída, também reconstruir o painel explicativo.
 if(box&&box.parentElement!==page)box=null;
 if(!box){box=document.createElement("div");box.id="potePricingGuide";
   page.insertBefore(box,page.firstChild)}
 box.innerHTML=panelHtml(selectedRecipe());
}
function choosePackaging(){
 const r=selectedRecipe();if(!r)return;
 r.packagingIngredientIds=[...document.querySelectorAll("[data-pote-package]")]
  .filter(input=>input.checked).map(input=>key(input.dataset.potePackage||input.getAttribute?.("data-pote-package")));
 if(typeof persist==="function")persist();
 if(typeof render==="function")render();
 if(typeof toast==="function")toast("Embalagens atualizadas para este produto.");
}
function chooseCostBasis(){
 const basis=$("poteCostBasis")?.value;
 if(basis!=="average"&&basis!=="replacement")return false;
 state.data.settings.costBasis=basis;
 if(typeof persist==="function")persist();
 if(typeof render==="function")render();
 return true;
}
function validateForm(){
 const recipes=state.data.recipes||[],r=selectedRecipe();
 if(!r){alert("Selecione uma receita válida.");return false}
 const mode=$("priceMode")?.value||r.pricingMode||"gain";
 const validations=[
 ["priceGain",0,5000,"Ganho sobre custo (%)"],
 ["priceMargin",0,99,"Margem sobre venda (%)"],
 ["priceUnits",1,10000000,"Meta mensal de unidades"],
 ["pricePkg",0,1000000000,"Embalagem manual"],
 ["priceOther",0,1000000000,"Outros custos"],
 ["priceDelivCost",0,1000000000,"Custo de entrega"],
 ["priceFee",0,99,"Taxa de cartão"],
 ["priceMktFee",0,99,"Taxa de marketplace"],
 ["priceTax",0,99,"Impostos"]
 ];
 const errors=[];
 for(const [id,min,max,label] of validations){
  const el=$(id);if(!el||el.disabled)continue;
  const raw=String(el.value||"").trim().replace(",",".");
  const v=Number(raw);
  if(!raw||!Number.isFinite(v)||v<min||v>max)errors.push(label+" deve ficar entre "+min+" e "+max+".");
 }
 const s=state.data.settings||{};
 const fee=Number($("priceChannel")?.value==="marketplace"?$("priceMktFee")?.value:$("priceFee")?.value)||0;
 const tax=Number($("priceTax")?.value??s.tax)||0;
 const margin=Number($("priceMargin")?.value??s.margin)||0;
 if(fee+tax+(mode==="margin"?margin:0)>=100)
  errors.push("A soma de margem, impostos e taxas precisa ser inferior a 100%.");
 if(errors.length){alert("Revise os dados da precificação:\n\n"+errors.join("\n"));return false}
 return true;
}
window.POTE_PRICING={report,missingCosts,mount,choosePackaging,chooseCostBasis,validateForm};
})();
