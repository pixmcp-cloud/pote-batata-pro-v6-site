/* Immutable per-order material cost reference captured at production.
   Uses actual consumed quantities when stock override is approved.
   Does not invent purchase prices: estimated inputs are labeled. */
(function(root){
"use strict";
if(root.POTE_COST_HISTORY)return;
const num=x=>{const n=Number(x);return Number.isFinite(n)&&n>=0?n:0};
const money=x=>Math.round((num(x)+Number.EPSILON)*100)/100;
function unitCost(item,isBeverage,settings){
 if(!item)return {value:0,known:false,estimated:false};
 const estimated=/^franchise-estimate-/i.test(String(item.costSource||""));
 if(settings?.costBasis==="average"&&item.averageCostKnown===true&&num(item.averageUnitCost)>0)
  return {value:num(item.averageUnitCost),known:true,estimated};
 const quantity=num(item.purchaseQuantity);
 const price=num(item.purchasePrice??item.price);
 if(!quantity||!price)return {value:0,known:false,estimated};
 if(isBeverage)return {value:price/quantity,known:true,estimated};
 const base=item.measureUnit==="ml"?"ml":item.measureUnit==="un"?"un":"g";
 const unit=item.purchaseUnit||"kg";
 const valid=(base==="g"&&(unit==="g"||unit==="kg"))||
             (base==="ml"&&(unit==="ml"||unit==="L"))||
             (base==="un"&&unit==="un");
 if(!valid)return {value:0,known:false,estimated};
 return {value:price/(quantity*((unit==="kg"||unit==="L")?1000:1)),known:true,estimated};
}
function capture(order,data,at){
 if(!order||!data)throw Error("Pedido ou estoque indisponível para snapshot");
 if(order.costSnapshot?.version===1)return order.costSnapshot;
 const ins=new Map((data.ingredients||[]).map(x=>[String(x.id),x]));
 const drinks=new Map((data.beverages||[]).map(x=>[String(x.id),x]));
 const quantity=Math.max(1,num(order.qty)||1);
 const grouped=new Map();
 for(const row of order.items||[]){
  const id=String(row.id||"");
  if(!id)continue;
  const base=num(row.g)*quantity/Math.max(.01,num(row.yieldPct||100)/100);
  grouped.set(id,(grouped.get(id)||0)+base);
 }
 const beverageGroup=new Map();
 for(const row of order.beverageItems||[]){
  const id=String(row.id||"");
  if(!id)continue;
  beverageGroup.set(id,(beverageGroup.get(id)||0)+num(row.qty)*quantity);
 }
 const rows=[];
 for(const [kind,group,lookup] of [
  ["ingredient",grouped,ins],["beverage",beverageGroup,drinks]
 ]){
  for(const [id,original] of group){
   const item=lookup.get(id);
   const actual=order.stockOverrideApproved&&order.stockActualConsumed?
    order.stockActualConsumed[kind==="beverage"?"beverages":"ingredients"]?.[id]:undefined;
   const consumed=actual===undefined?original:Math.min(original,num(actual));
   const per=unitCost(item,kind==="beverage",data.settings);
   rows.push({kind,id,name:String(item?.name||id),quantityBase:consumed,
    unit:kind==="beverage"?"un":item?.measureUnit||"g",
    unitCost:per.known?per.value:null,
    extendedCost:per.known?money(per.value*consumed):null,
    known:per.known,estimated:per.estimated&&per.known});
  }
 }
 const missing=rows.filter(x=>!x.known).map(x=>x.name);
 const material=money(rows.reduce((total,row)=>total+num(row.extendedCost),0));
 const result={version:1,capturedAt:at||new Date().toISOString(),
  totalMaterialCost:material,costKnown:missing.length===0,
  estimated:rows.some(row=>row.estimated),missingCosts:missing,rows};
 order.costSnapshot=result;
 return result;
}
root.POTE_COST_HISTORY={unitCost,capture};
})(typeof window!=="undefined"?window:globalThis);
