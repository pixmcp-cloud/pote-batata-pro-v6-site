const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const ctx={window:{},Number,Math,String,Array,Map,Set,Date,Intl,console,JSON};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("stock_math.js","utf8"),ctx);
vm.runInContext(fs.readFileSync("finance_core.js","utf8"),ctx);
const stock=ctx.window.POTE_STOCK,finance=ctx.window.POTE_FINANCE;
let id=0;
const item={id:"batata",name:"Batata",measureUnit:"g",stock:3000,
 purchasePrice:30,purchaseQuantity:3,purchaseUnit:"kg",yield:100};
const purchases=[],moves=[],args={ingredient:item,quantity:20,unit:"kg",paidTotal:180,
 purchases,movements:moves,makeId:()=>String(++id)};
const actual=stock.purchase(args);
assert.equal(actual.next,23000);
assert.equal(item.purchasePrice,180);
assert.equal(item.purchaseQuantity,20);
assert.equal(item.averageCostKnown,true);
assert(Math.abs(item.averageUnitCost*1000-210/23)<.001);
assert.equal(finance.unitCost(item,"replacement"),.009);
assert.equal(finance.unitCost(item,"average"),item.averageUnitCost);
assert.equal(purchases[0].averageCostKnown,true);
assert.equal(purchases[0].averageUnitCost,item.averageUnitCost);
const oldUnknown={id:"x",name:"Sem histórico",measureUnit:"g",stock:1000,
 purchasePrice:0,purchaseQuantity:0,purchaseUnit:"kg"};
stock.purchase({...args,ingredient:oldUnknown,quantity:1,unit:"kg",paidTotal:20});
assert.equal(oldUnknown.averageCostKnown,false);
assert.equal(finance.unitCost(oldUnknown,"average"),.02,"Sem média confiável usa última compra");
console.log("PASS: custo médio ponderado, última compra preservada, perdas sem inventar histórico e escolha de critério.");
