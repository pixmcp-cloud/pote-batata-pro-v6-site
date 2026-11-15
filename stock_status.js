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
    if(x.category!=="Embalagem"||x.archived)continue;
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
function currentContext(data=typeof state!=="undefined"?state.data:null){
 if(!data)return [];
 const held=reserved(data);
 const result=[];
 for(const x of context()){
  const kind=x.kind==="beverage"?"beverage":"ingredient";
  const collection=kind==="beverage"?data.beverages:data.ingredients;
  const item=(collection||[]).find(i=>!i.archived&&String(i.id)===String(x.id));
  if(!item&&(collection||[]).some(i=>i.archived&&String(i.id)===String(x.id)))continue;
  const reservedQty=Math.max(0,n((kind==="beverage"?held.beverages:held.ingredients).get(x.id)));
  const physicallyPresent=Math.max(0,n(item?.stock));
  const available=Math.max(0,physicallyPresent-reservedQty);
  const originallyNeeded=Math.max(0,n(x.needed)||n(x.missing)+n(x.available));
  const missing=Math.max(0,originallyNeeded-available);
  const perUnit=Math.max(0,n(x.perUnit));
  const capacity=perUnit>0?Math.floor((available+1e-7)/perUnit):null;
  let level=null;
  if(!item||missing>1e-7)level="missing";
  else if((n(item.minimum)>0&&available<=n(item.minimum))||
          (capacity!==null&&capacity<5))level="low";
  // If the item was originally low without a known requirement, mark resolved
  // as soon as the physical stock exceeds its configured minimum.
  if(!level)continue;
  result.push({...x,kind,level,available,physicalStock:physicallyPresent,
   reserved:reservedQty,missing,capacity,
   unit:item?.measureUnit||x.unit||"un",name:item?.name||x.name});
 }
 return result.sort((a,b)=>(a.level==="missing"?0:1)-(b.level==="missing"?0:1)||
   String(a.name).localeCompare(String(b.name),"pt-BR",{sensitivity:"base"}));
}
function requested(id,kind){
 return currentContext().find(i=>String(i.id)===String(id)&&i.kind===kind)||null;
}
window.POTE_STOCK_STATUS={reserved,recipeLowIds,classify,requested,currentContext,fmt};
})();
