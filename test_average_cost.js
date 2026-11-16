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
const simulated={id:"fr-batata",name:"Batata demo",measureUnit:"g",stock:18000,
 purchasePrice:110,purchaseQuantity:20,purchaseUnit:"kg",
 costSource:"franchise-estimate-40",source:"Saldo inicial demonstrativo da franquia"};
const buy=stock.purchase({...args,ingredient:simulated,quantity:2,unit:"kg",paidTotal:20});
assert.equal(buy.next,20000);
assert.equal(simulated.averageCostKnown,false,
 "Saldo fictício não pode entrar na média ponderada como compra comprovada");
assert.equal(simulated.requiresPhysicalRecount,true);
assert.equal(simulated.averageUnitCost,.01);
assert.equal(simulated.costSource,"real-purchase");
assert.equal(finance.unitCost(simulated,"average"),.01);
console.log("PASS: custo médio, estoque demonstrativo excluído da média, compra real preservada e conferência física pendente.");
