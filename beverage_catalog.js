/* Catálogo inicial do universo Batataria, sem movimentos fictícios ou preço de compra inventado. */
(function(){
"use strict";
if(window.POTE_DRINKS)return;
const BASE=[
 ["agua-sem-gas","Água mineral sem gás","500 ml",4,"agua"],
 ["agua-com-gas","Água mineral com gás","500 ml",5,"agua"],
 ["guarana-lata","Refrigerante Guaraná","Lata 350 ml",7,"refrigerante"],
 ["cola-lata","Refrigerante Cola","Lata 350 ml",7,"refrigerante"],
 ["laranja-lata","Refrigerante Laranja","Lata 350 ml",7,"refrigerante"],
 ["guarana-600","Refrigerante Guaraná","600 ml",9,"refrigerante"],
 ["cola-600","Refrigerante Cola","600 ml",9,"refrigerante"],
 ["laranja-600","Refrigerante Laranja","600 ml",9,"refrigerante"],
 ["guarana-zero-600","Refrigerante Guaraná Zero Açúcar","600 ml",10,"refrigerante"],
 ["cola-zero-600","Refrigerante Cola Zero Açúcar","600 ml",10,"refrigerante"],
 ["laranja-zero-600","Refrigerante Laranja Zero Açúcar","600 ml",10,"refrigerante"]
];
const COMBO_ID="starter-potato-soda";
const clean=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fullName=b=>clean((b.name||"")+" "+(b.size||""));
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function preset(r){
 return {id:"preset-"+r[0],name:r[1],size:r[2],sellPrice:r[3],
   purchasePrice:0,purchaseQuantity:1,stock:0,minimum:5,
   category:r[4],catalogPreset:true,catalogKey:r[0],
   source:"Modelo comercial: informe custo e quantidade reais quando comprar"};
}
function recipeIds(recipes){
 const ids=["r01","r03","r21"];
 return ids.filter(id=>recipes.some(r=>r.id===id));
}
function ensure(state){
 const data=state?.data;
 if(!data)return {beveragesAdded:0,combosAdded:0};
 if(data.businessType!=="batataria")
  return {beveragesAdded:0,combosAdded:0};
 data.beverages??=[];data.combos??=[];data.recipes??=[];
 let beveragesAdded=0,combosAdded=0;
 for(const r of BASE){
  const item=preset(r);
  const found=data.beverages.some(x=>x.catalogKey===item.catalogKey||
    (fullName(x)===fullName(item)));
  if(!found){data.beverages.push(item);beveragesAdded++}
 }
 const ids=recipeIds(data.recipes);
 if(ids.length===3&&!data.combos.some(c=>c.id===COMBO_ID||c.catalogPreset==="starter-potato-soda")){
  const drinkIds=data.beverages.filter(b=>b.category==="refrigerante"||
    /refrigerante/i.test(b.name)).map(b=>b.id);
  data.combos.push({id:COMBO_ID,name:"1 Batata + Refrigerante",
   recipeId:ids[0],beverageId:drinkIds.find(id=>id.includes("guarana-lata"))||drinkIds[0]||"",
   recipeOptions:ids,beverageOptions:drinkIds,addonIds:[],
   discountType:"percent",discountValue:5,catalogPreset:"starter-potato-soda"});
  combosAdded=1;
 }
 return {beveragesAdded,combosAdded};
}
function isStarter(c){return !!c&&c.catalogPreset==="starter-potato-soda"}
function configuredOptions(c){
 const recipes=(c?.recipeOptions||[]).map(id=>state.data.recipes.find(r=>r.id===id))
  .filter(r=>r&&!r.unavailable&&(typeof canSell==="undefined"||canSell(r)));
 const drinks=(c?.beverageOptions||[]).map(id=>state.data.beverages.find(b=>b.id===id)).filter(Boolean);
 return {recipes,drinks};
}
function variantForOrder(c){
 if(!isStarter(c))return c;
 const {recipes,drinks}=configuredOptions(c);
 const chosenRecipe=document.getElementById("orderComboRecipe")?.value;
 const chosenDrink=document.getElementById("orderComboBeverage")?.value;
 return {...c,recipeId:recipes.find(r=>r.id===chosenRecipe)?.id||recipes[0]?.id||c.recipeId,
  beverageId:drinks.find(d=>d.id===chosenDrink)?.id||drinks[0]?.id||c.beverageId};
}
function mount(){
 const host=document.getElementById("poteComboChoice");if(!host)return;
 const value=document.getElementById("orderItem")?.value||"";
 const id=value.startsWith("combo:")?value.slice(6):null;
 const combo=state.data.combos.find(c=>c.id===id);
 if(!isStarter(combo)){host.innerHTML="";host.dataset.comboId="";return}
 const {recipes,drinks}=configuredOptions(combo);
 if(!recipes.length||!drinks.length){
  host.innerHTML='<div class="notice red">Combo indisponível: verifique os três sabores e as bebidas cadastradas.</div>';
  host.dataset.comboId=combo.id;return;
 }
 if(host.dataset.comboId===combo.id&&document.getElementById("orderComboRecipe"))return;
 host.dataset.comboId=combo.id;
 host.innerHTML='<section class="starter-combo-choice"><h3>Personalize seu combo</h3>'+
  '<p>1 batata recheada + 1 refrigerante. Escolha somente entre os três sabores clássicos. Desconto de 5% aplicado sobre os dois itens.</p>'+
  '<div class="fields"><label>Sabor da batata<select id="orderComboRecipe" onchange="updateOrderSuggestedPrice()">'+
  recipes.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join("")+
  '</select></label><label>Escolha o refrigerante<select id="orderComboBeverage" onchange="updateOrderSuggestedPrice()">'+
  drinks.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name+" · "+b.size+" · "+money(b.sellPrice))+'</option>').join("")+
  '</select></label></div></section>';
}
function vitrineControls(c){
 if(!isStarter(c))return "";
 const {recipes,drinks}=configuredOptions(c);
 if(!recipes.length||!drinks.length)return '<p>Combo indisponível: confira os itens disponíveis.</p>';
 return '<div class="starter-combo-vitrine"><label>Sabor clássico<select id="vitrineComboRecipe-'+esc(c.id)+'">'+
  recipes.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join("")+
  '</select></label><label>Refrigerante<select id="vitrineComboDrink-'+esc(c.id)+'">'+
  drinks.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name+" · "+b.size+" · "+money(b.sellPrice))+'</option>').join("")+
  '</select></label><small>5% de desconto no conjunto</small></div>';
}
function vitrineVariant(c){
 if(!isStarter(c))return c;
 const {recipes,drinks}=configuredOptions(c);
 const recipeId=document.getElementById("vitrineComboRecipe-"+c.id)?.value;
 const beverageId=document.getElementById("vitrineComboDrink-"+c.id)?.value;
 return {...c,recipeId:recipes.some(r=>r.id===recipeId)?recipeId:recipes[0]?.id||c.recipeId,
  beverageId:drinks.some(b=>b.id===beverageId)?beverageId:drinks[0]?.id||c.beverageId};
}
function quoteForCart(item,channel="direto"){
 if(item?.kind!=="combo"||!item.recipeId)return null;
 const original=state.data.combos.find(c=>c.id===item.id);
 if(!original)return null;
 const c={...original,recipeId:item.recipeId,beverageId:item.bevId||original.beverageId};
 const q=comboQuote(c,channel);
 if(!q.recipe)return null;
 return {type:"combo",id:item.id,combo:original,recipe:q.recipe,
  beverages:q.beverage?[q.beverage]:[],addons:q.addons,price:q.price,
  variable:q.variable,contribution:q.contribution,estimatedProfit:q.estimatedProfit,
  discount:q.discount,fullPrice:q.subtotal};
}
function isPresetBeverage(x){return !!x?.catalogPreset}
function duplicateBeverage(data,name,size,except){
 const key=clean(name+" "+size);
 return (data?.beverages||[]).find(b=>b.id!==except&&fullName(b)===key)||null;
}
window.POTE_DRINKS={BASE,COMBO_ID,preset,ensure,recipeIds,isStarter,
 configuredOptions,variantForOrder,mount,vitrineControls,vitrineVariant,quoteForCart,duplicateBeverage,isPresetBeverage,clean};
})();
