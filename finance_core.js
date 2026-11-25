/* Shared pure financial calculations. No persistence, UI or Firebase dependencies. */
(function(root){
"use strict";
if(root.POTE_FINANCE)return;
function parseNumber(v){
 if(typeof v==="number")return Number.isFinite(v)?v:NaN;
 let raw=String(v??"").trim().replace(/^R\$\s*/i,"");
 if(!raw)return NaN;
 // Dots alone remain decimal, to preserve existing programmatically formatted inputs.
 if(/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(raw))raw=raw.replace(/\./g,"").replace(",",".");
 else if(/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(raw))raw=raw.replace(/,/g,"");
 else if(/^[+-]?\d+,\d+$/.test(raw))raw=raw.replace(",",".");
 if(!/^[+-]?\d+(?:\.\d+)?$/.test(raw))return NaN;
 const value=Number(raw);return Number.isFinite(value)?value:NaN;
}
const n=v=>{const result=parseNumber(v);return Number.isFinite(result)?result:0};
const round2=v=>Math.round((n(v)+Number.EPSILON)*100)/100;
const nonNegative=v=>Math.max(0,n(v));
const qty=v=>Math.max(1,n(v));
function unitCost(item,basis="replacement"){
 if(!item)return 0;
 if(basis==="average"&&item.averageCostKnown===true&&n(item.averageUnitCost)>0)return n(item.averageUnitCost);
 const price=nonNegative(item.purchasePrice??item.price);
 const purchased=nonNegative(item.purchaseQuantity)||1;
 const unit=String(item.purchaseUnit||"kg");
 return price/(purchased*((unit==="kg"||unit==="L")?1000:1));
}
function beverageCost(item){
 return item?nonNegative(item.purchasePrice??item.price)/qty(item.purchaseQuantity):0;
}
function roundPrice(value){
 const amount=n(value);if(amount<=0)return 0;
 const cents=Math.ceil(amount*100-1e-8);
 const whole=Math.floor(cents/100),fraction=cents%100;
 return round2(whole+(fraction<=50?0.5:fraction<=90?0.9:1.5));
}
function fees(settings,channel){
 const s=settings||{};
 return (channel==="marketplace"?n(s.marketplaceFee??19):n(s.fee))+n(s.tax);
}
function suggest({cost,feePct,mode="gain",gainPct=100,marginPct=50}={}){
 const base=nonNegative(cost),charges=n(feePct);
 const raw=mode==="gain"?
  base*(1+nonNegative(gainPct)/100)/Math.max(.05,1-charges/100):
  base/Math.max(.05,1-(charges+n(marginPct))/100);
 return roundPrice(raw);
}
function recipeMaterialCost(recipe,ingredients,basis="replacement"){
 if(!recipe||!Array.isArray(recipe.items))return 0;
 const records=new Map((ingredients||[]).map(i=>[i.id,i]));
 return recipe.items.reduce((sum,row)=>{
  const i=records.get(row.id);
  if(!i)return sum;
  return sum+nonNegative(row.g)*unitCost(i,basis)/Math.max(.01,nonNegative(i.yield||100)/100);
 },0);
}
function result({unitPrice,unitVariableCost,unitFixedCost,feePct,quantity=1,deliveryRevenue=0,deliveryCost=0,paymentStatus="pago",lossCost=0}={}){
 const count=qty(quantity);
 const gross=nonNegative(unitPrice)*count+nonNegative(deliveryRevenue);
 const commission=round2(gross*nonNegative(feePct)/100);
 const variableCost=round2(nonNegative(unitVariableCost)*count+nonNegative(deliveryCost));
 const fixed=round2(nonNegative(unitFixedCost)*count);
 const contribution=round2(gross-commission-variableCost);
 const estimatedProfit=round2(contribution-fixed-nonNegative(lossCost));
 const status=String(paymentStatus||"").toLocaleLowerCase("pt-BR").trim();
 const unpaid=status==="nao_pago",settled=["pago","confirmado","pago em dinheiro"].includes(status);
 return {grossRevenue:round2(gross),receivedRevenue:settled?round2(gross):0,
  outstandingRevenue:!settled&&!unpaid?round2(gross):0,
  uncollectedSale:unpaid?round2(gross):0,
  fees:commission,variableCost,fixedAllocation:fixed,
  contributionBeforeFixed:contribution,estimatedProfit,
  marginPct:gross>0?round2(estimatedProfit/gross*100):0,
  markupPct:variableCost+fixed>0?round2(estimatedProfit/(variableCost+fixed)*100):0,
  costKnown:Number.isFinite(Number(unitVariableCost))&&Number.isFinite(Number(unitFixedCost))};
}
root.POTE_FINANCE={n,parseNumber,round2,unitCost,beverageCost,roundPrice,fees,suggest,recipeMaterialCost,result};
})(typeof window!=="undefined"?window:globalThis);
