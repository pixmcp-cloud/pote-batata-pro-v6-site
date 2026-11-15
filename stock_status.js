/* Saúde de estoque: disponibilidade física descontando pedidos ainda não produzidos. */
(function(){
"use strict";
if(window.POTE_STOCK_STATUS)return;
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const fmt=v=>n(v).toLocaleString("pt-BR",{maximumFractionDigits:2});
function reserved(data){
 const ingredients=new Map(),beverages=new Map();
 for(const order of data?.orders||[]){
  if(order.status!=="recebido"||order.stockDeducted===true)continue;
  const q=Math.max(0,n(order.qty));
  for(const item of order.items||[]){
   const pct=Math.max(.01,n(item.yieldPct||100)/100);
   ingredients.set(item.id,(ingredients.get(item.id)||0)+q*n(item.g)/pct);
  }
  for(const drink of order.beverageItems||[]){
   beverages.set(drink.id,(beverages.get(drink.id)||0)+q*n(drink.qty));
  }
 }
 return {ingredients,beverages};
}
function recipeLowIds(data,held=reserved(data)){
 const low=new Set();
 for(const r of data?.recipes||[]){
  if(!Array.isArray(r.items)||!r.items.length||r.unavailable||r.franchiseLocked)continue;
  const ingredients=[...r.items];
  if(data.settings?.usePackagingStock){
   for(const x of data.ingredients||[]){
    if(x.category!=="Embalagem")continue;
    if(Array.isArray(r.packagingIngredientIds)&&!r.packagingIngredientIds.includes(x.id))continue;
    ingredients.push({id:x.id,g:1});
   }
  }
  for(const item of ingredients){
   const ing=(data.ingredients||[]).find(x=>x.id===item.id);
   if(!ing)continue;
   const unitNeed=n(item.g)/Math.max(.01,n(ing.yield||100)/100);
   if(unitNeed<=0)continue;
   const available=Math.max(0,n(ing.stock)-n(held.ingredients.get(item.id)));
   const capacity=Math.floor((available+1e-7)/unitNeed);
   if(capacity>=1&&capacity<5)low.add(item.id);
  }
 }
 return low;
}
function classify(item,held=0,{risk=false,shortage=false}={}){
 const stock=Math.max(0,n(item?.stock)),reservation=Math.max(0,n(held));
 const available=Math.max(0,stock-reservation);
 const minimum=Math.max(0,n(item?.minimum));
 if(shortage||available<=0)return {level:"missing",label:"FALTANTE",stock,reservation,available,minimum};
 if((minimum>0&&available<=minimum)||risk)
  return {level:"low",label:"ESTOQUE BAIXO",stock,reservation,available,minimum};
 return {level:"good",label:"ESTOQUE BOM",stock,reservation,available,minimum};
}
function context(){
 const list=window.POTE_RESTOCK_CONTEXT?.items;
 return Array.isArray(list)?list:[];
}
function requested(id,kind){
 return context().find(i=>String(i.id)===String(id)&&i.kind===kind)||null;
}
window.POTE_STOCK_STATUS={reserved,recipeLowIds,classify,requested,fmt};
})();
