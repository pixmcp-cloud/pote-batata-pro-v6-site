import {planStockAdjustment} from "./stock_adjustment_lab.mjs";
function run(plan,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=(fn,code)=>{let e;try{fn()}catch(x){e=x}eq(e?.code,code)};
 const base={beforeUnits:1000,expectedUnits:1000,kind:"purchase",quantityUnits:500,reason:"Entrada",scale:1};
 const a=plan(base);eq(a.afterUnits,1500);eq(a.deltaUnits,500);eq(a.lossUnits,0);
 eq(plan({...base,kind:"count",quantityUnits:750}).lossUnits,250);
 eq(plan({...base,kind:"count",quantityUnits:0}).afterUnits,0);
 eq(plan({...base,kind:"count",quantityUnits:1200}).deltaUnits,200);
 const loss=plan({...base,kind:"loss",quantityUnits:250});eq(loss.afterUnits,750);eq(loss.lossCostCents,null);eq(loss.costKnown,false);
 eq(plan({...base,kind:"loss",quantityUnits:250,unitCostCents:0.5}).lossCostCents,125);
 eq(plan({...base,kind:"loss",quantityUnits:500,scale:100,unitCostCents:10}).lossCostCents,50);
 reject(()=>plan({...base,expectedUnits:900}),"stock_changed");
 reject(()=>plan({...base,kind:"loss",quantityUnits:1001}),"insufficient_stock");
 reject(()=>plan({...base,kind:"count",quantityUnits:1000}),"no_stock_change");
 reject(()=>plan({...base,quantityUnits:0}),"invalid_stock_adjustment");
 reject(()=>plan({...base,quantityUnits:1.5}),"invalid_stock_adjustment");
 reject(()=>plan({...base,reason:" "}),"invalid_stock_adjustment");
 reject(()=>plan({...base,kind:"loss",unitCostCents:0}),"invalid_stock_cost");
 reject(()=>plan({...base,scale:3}),"invalid_stock_adjustment");
 reject(()=>plan({...base,beforeUnits:1000000000,expectedUnits:1000000000}),"invalid_stock_precision");
 log("PASS B02.15 stock",n,"assertivas");
}
run(planStockAdjustment,console.log);
