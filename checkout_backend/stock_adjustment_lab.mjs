// B02.15: stock adjustment in physical base units, not purchase accounting.
const fail=code=>{throw Object.assign(Error(code),{code})};
const int=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
export function planStockAdjustment({beforeUnits,expectedUnits,kind,quantityUnits,reason,scale,unitCostCents=null}={}){
 if(!int(beforeUnits)||!int(expectedUnits)||!int(quantityUnits)||!["purchase","count","loss"].includes(kind)||! [1,10,100,1000,10000,100000].includes(scale)||typeof reason!=="string"||!reason.trim()||reason.length>220)fail("invalid_stock_adjustment");
 if(beforeUnits!==expectedUnits)fail("stock_changed");
 if(kind!=="count"&&!quantityUnits)fail("invalid_stock_adjustment");
 const afterUnits=kind==="purchase"?beforeUnits+quantityUnits:kind==="loss"?beforeUnits-quantityUnits:quantityUnits;
 if(afterUnits<0)fail("insufficient_stock");if(!int(afterUnits))fail("invalid_stock_precision");
 const deltaUnits=afterUnits-beforeUnits;
 if(!deltaUnits)fail("no_stock_change");
 if(unitCostCents!==null&&(!Number.isFinite(unitCostCents)||unitCostCents<=0))fail("invalid_stock_cost");
 const lossUnits=kind==="loss"||kind==="count"&&deltaUnits<0?-deltaUnits:0;
 const lossCostCents=lossUnits&&unitCostCents!==null?Math.round(lossUnits/scale*unitCostCents):null;
 if(lossCostCents!==null&&!int(lossCostCents))fail("invalid_stock_cost");
 return {kind,beforeUnits,afterUnits,deltaUnits,scale,reason:reason.trim(),lossUnits,lossCostCents,costKnown:lossUnits>0&&lossCostCents!==null};
}

// Value raw physical units, never divide by cooking yield a second time.
// Replacement cost is an estimate, not proof of historical FIFO acquisition.
export function replacementUnitCostCents(item,group){
 const price=item?.purchasePrice??item?.price,quantity=item?.purchaseQuantity;
 if(typeof price!=="number"||!Number.isFinite(price)||price<=0||typeof quantity!=="number"||!Number.isFinite(quantity)||quantity<=0)return null;
 const unit=group==="beverages"?"un":item.purchaseUnit;
 const factor={kg:1000,L:1000,g:1,ml:1,un:1,unidade:1}[unit];
 if(!factor||!["ingredients","beverages"].includes(group))return null;
 const measure=String(item.measureUnit??({kg:"g",L:"ml",unidade:"un"}[unit]??unit)).toLowerCase();
 const normalized=({kg:"g",L:"ml",unidade:"un"}[unit]??unit).toLowerCase();
 if(measure!==normalized&&!(measure==="unidade"&&normalized==="un"))return null;
 const cost=price*100/(quantity*factor);return Number.isFinite(cost)&&cost>0&&cost<=1e9?cost:null;
}
export function purchaseEvidence({kind,quantityUnits,scale,purchaseCostCents,purchaseReference,supplierId}={}){
 const supplied=[purchaseCostCents,purchaseReference,supplierId].some(x=>x!==undefined);
 if(!supplied)return null;
 if(kind!=="purchase"||!int(purchaseCostCents)||purchaseCostCents===0||!int(quantityUnits)||quantityUnits===0||![1,10,100,1000,10000,100000].includes(scale)||typeof purchaseReference!=="string"||!purchaseReference.trim()||purchaseReference.length>120||supplierId!==undefined&&(typeof supplierId!=="string"||! /^[A-Za-z0-9_~:-]{1,700}$/.test(supplierId)))fail("invalid_purchase_evidence");
 return {totalCents:purchaseCostCents,reference:purchaseReference.trim(),supplierId:supplierId??null,unitCostCents:purchaseCostCents*scale/quantityUnits,source:"declared-acquisition"};
}
export function valueReservedLoss(required,valuations){
 if(!Array.isArray(required)||!required.length||!Array.isArray(valuations))return {costCents:null,costKnown:false};
 let sum=0;
 for(const n of required){const matches=valuations.filter(v=>v.stockId===n.stockId);const v=matches[0];if(matches.length!==1||!int(n.units)||!v||v.unitCostCents===null||!Number.isFinite(v.unitCostCents)||v.unitCostCents<=0||![1,10,100,1000,10000,100000].includes(v.scale))return {costCents:null,costKnown:false};sum+=n.units/v.scale*v.unitCostCents;}
 const costCents=Math.round(sum);return int(costCents)?{costCents,costKnown:true,costBasis:"replacement-at-reservation"}:{costCents:null,costKnown:false};
}
