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
