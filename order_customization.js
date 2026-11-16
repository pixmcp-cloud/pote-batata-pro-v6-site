/* Personalização temporária por pedido. Não altera a receita-base.
   Cada pedido mantém sua lista própria de ingredientes retirados e extras. */
(function(){
"use strict";
if(window.POTE_ORDER_CUSTOM)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const n=v=>Number(v)||0;
let key="",excluded=new Set(),extraCounts=new Map(),lastAdded=false;
function quoteKey(){
 return String($("orderItem")?.value||"")+":"+String($("orderComboRecipe")?.value||"");
}
function baseQuote(){
 return typeof optionQuote==="function"?optionQuote(quoteKey(),$("orderChannel")?.value||"direto",
   $("orderExtraBev")?.value||"",""):null;
}
function ensure(){
 const current=quoteKey();
 if(key!==current){key=current;excluded=new Set();extraCounts=new Map();lastAdded=false}
}
function options(){
 ensure();
 const q=baseQuote();
 if(!q?.recipe)return {q:null,ingredients:[],addons:[]};
 const ingredients=(q.recipe.items||[]).map(item=>({
  id:item.id,name:state.data.ingredients.find(i=>i.id===item.id)?.name||item.id,
  amount:n(item.g),measure:state.data.ingredients.find(i=>i.id===item.id)?.measureUnit||"g"
 }));
 const addons=(state.data.addons||[]).filter(a=>
  state.data.ingredients.some(i=>i.id===a.ingredientId) && n(a.quantity)>0);
 return {q,ingredients,addons};
}
function render(){
 const {q,ingredients,addons}=options();
 if(!q)return '<p class="order-custom-empty">Escolha primeiro uma receita para personalizar.</p>';
 const removed=ingredients.filter(i=>excluded.has(i.id));
 return '<div class="order-custom">'+
  '<div class="order-custom-title"><div><small>MONTE O PEDIDO DO CLIENTE</small><h3>Personalização por unidade</h3></div>'+
  '<span>Sem alterar a receita original</span></div>'+
  '<p>Marque ingredientes que o cliente não quer. Ex.: <strong>sem milho</strong>. Escolha também quantos adicionais extras ele deseja. A comanda e o estoque serão ajustados.</p>'+
  '<div class="order-custom-columns"><section><h4>Retirar ingredientes</h4>'+
  (ingredients.length?ingredients.map(i=>
   '<label class="order-custom-option"><input type="checkbox" data-remove-ingredient="'+esc(i.id)+'" '+
   (excluded.has(i.id)?"checked":"")+' onchange="POTE_ORDER_CUSTOM.remove(this.dataset.removeIngredient,this.checked)">'+
   '<span><b>'+esc(i.name)+'</b><small>'+n(i.amount)+' '+esc(i.measure)+' por unidade</small></span>'+
   '<em>'+ (excluded.has(i.id)?"SEM":"Retirar") +'</em></label>').join(""):
   '<p class="order-custom-empty">Sem ingredientes cadastrados.</p>')+
  '</section><section><h4>Adicionar extras · sem limite de tipos ou repetições</h4>'+
  (addons.length?addons.map(a=>'<div class="order-custom-option">'+
   '<span><b>'+esc(a.name)+'</b><small>'+n(a.quantity)+' '+
   esc(state.data.ingredients.find(i=>i.id===a.ingredientId)?.measureUnit||"g")+
   ' · '+esc(money(a.sellPrice))+' cada</small></span>'+
   '<div class="order-custom-counter"><button type="button" aria-label="Remover um '+esc(a.name)+'" data-addon="'+esc(a.id)+'" onclick="POTE_ORDER_CUSTOM.delta(this.dataset.addon,-1)">−</button>'+
   '<output>'+n(extraCounts.get(a.id))+'</output>'+
   '<button type="button" aria-label="Adicionar um '+esc(a.name)+'" data-addon="'+esc(a.id)+'" onclick="POTE_ORDER_CUSTOM.delta(this.dataset.addon,1)">+</button></div></div>').join(""):
   '<p class="order-custom-empty">Nenhum adicional cadastrado. <button type="button" class="btn mini line" onclick="go(\'combos\')">Cadastrar adicionais</button></p>')+
   '</section></div>'+
  '<div class="order-custom-feedback"><strong>Pedido personalizado:</strong> '+
  (removed.length?'<span>SEM '+removed.map(x=>esc(x.name)).join(", ")+'</span>':
   '<span>Receita completa</span>')+
  (extraCounts.size?'<span>+ '+[...extraCounts].filter(([,qty])=>qty>0).map(([id,qty])=>
   esc((state.data.addons.find(a=>a.id===id)?.name||id)+' ×'+qty)).join(", ")+'</span>':"")+
  '</div></div>';
}
function mount(){const target=$("poteOrderCustomization");if(target)target.innerHTML=render()}
function update(){
 mount();
 if(typeof updateOrderSuggestedPrice==="function")updateOrderSuggestedPrice();
}
function remove(id,checked){
 ensure();
 if(checked)excluded.add(String(id));else excluded.delete(String(id));
 update();
}
function delta(id,by){
 ensure();
 const a=state.data.addons.find(x=>x.id===id);if(!a)return;
 const raw=n(extraCounts.get(id))+n(by);
 const qty=Number.isSafeInteger(raw)&&raw>=0?raw:raw<0?0:Number.MAX_SAFE_INTEGER;
 if(qty)extraCounts.set(id,qty);else extraCounts.delete(id);
 update();
}
function reset(){key="";excluded=new Set();extraCounts=new Map();lastAdded=false}
function adjustQuote(q){
 if(!q?.recipe)return q;
 ensure();
 const items=(q.recipe.items||[]).filter(item=>!excluded.has(item.id));
 const removed=(q.recipe.items||[]).filter(item=>excluded.has(item.id)).map(item=>{
  const ingredient=state.data.ingredients.find(i=>i.id===item.id);
  return {id:item.id,name:ingredient?.name||item.id,quantity:n(item.g),
    unit:ingredient?.measureUnit||"g"};
 });
 const addOns=[...(q.addons||[])],added=[];
 let extraValue=0,extraCost=0;
 for(const [id,qty] of extraCounts){
  const a=state.data.addons.find(x=>x.id===id);
  if(!a||!qty)continue;
  const ing=state.data.ingredients.find(i=>i.id===a.ingredientId);
  if(!ing)continue;
  addOns.push({...a,quantity:n(a.quantity)*qty,extraCount:qty});
  added.push({id:a.id,name:a.name,count:qty,unitPrice:n(a.sellPrice),ingredientId:a.ingredientId,
    quantity:n(a.quantity)*qty});
  extraValue+=n(a.sellPrice)*qty;
  extraCost+=(typeof addonCost==="function"?addonCost(a):0)*qty;
 }
 const removedCost=removed.reduce((sum,item)=>{
  const ingredient=state.data.ingredients.find(i=>i.id===item.id);
  if(!ingredient)return sum;
  const q=Math.max(.0001,n(ingredient.purchaseQuantity)||1),
   factor=ingredient.purchaseUnit==="kg"||ingredient.purchaseUnit==="L"?1000:1;
  return sum+n(item.quantity)*n(ingredient.purchasePrice??ingredient.price)/(q*factor)/
   Math.max(.01,n(ingredient.yield||100)/100);
 },0);
 const adjusted={...q,recipe:{...q.recipe,items},addons:addOns,
  removedIngredients:removed,customAddons:added,
  extraPrice:extraValue,extraCost,removedCost};
 // Retirar insumo reduz o custo, mas não concede desconto automaticamente.
 adjusted.price=typeof roundUpCommercial==="function"?
   roundUpCommercial(n(q.price)+extraValue):Number((n(q.price)+extraValue).toFixed(2));
 adjusted.fullPrice=n(q.fullPrice)+extraValue;
 adjusted.variable=n(q.variable)-removedCost+extraCost;
 const channel=$("orderChannel")?.value||"direto";
 const rate=typeof feeRate==="function"?feeRate(channel):0;
 adjusted.contribution=adjusted.price*(1-rate/100)-adjusted.variable;
 adjusted.estimatedProfit=adjusted.contribution-
  (typeof fixedPerUnit==="function"?fixedPerUnit():0);
 return adjusted;
}
function summary(){
 const {ingredients}=options();
 const removed=ingredients.filter(x=>excluded.has(x.id)).map(x=>x.name);
 const added=[...extraCounts].filter(([,qty])=>qty>0).map(([id,qty])=>{
  const a=state.data.addons.find(x=>x.id===id);
  return {name:a?.name||id,count:qty}
 });
 return {removed,added};
}
window.POTE_ORDER_CUSTOM={render,mount,remove,delta,reset,adjustQuote,summary,options};
})();
