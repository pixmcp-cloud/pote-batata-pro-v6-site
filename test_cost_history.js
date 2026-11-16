const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const context={window:{},Date,Map,Math,Number,String,Array,JSON};
vm.createContext(context);vm.runInContext(fs.readFileSync("cost_history.js","utf8"),context);
const C=context.window.POTE_COST_HISTORY;
assert(C&&C.capture);
const data={ingredients:[
 {id:"potato",name:"Batata",measureUnit:"g",purchasePrice:100,purchaseQuantity:20,purchaseUnit:"kg"},
 {id:"bacon",name:"Bacon",measureUnit:"g",purchasePrice:90,purchaseQuantity:3,purchaseUnit:"kg",costSource:"franchise-estimate-40"},
 {id:"box",name:"Pote",measureUnit:"un",purchasePrice:100,purchaseQuantity:100,purchaseUnit:"un"}
],beverages:[{id:"drink",name:"Cola",purchasePrice:40,purchaseQuantity:10}],settings:{costBasis:"replacement"}};
const makeOrder=()=>({id:"o",qty:2,price:50,status:"em_producao",stockDeducted:true,
 items:[{id:"potato",g:500,yieldPct:100},{id:"bacon",g:100,yieldPct:100},{id:"box",g:1,yieldPct:100}],
 beverageItems:[{id:"drink",qty:1}]});
let order=makeOrder();
const first=C.capture(order,data,"2026-11-16T20:00:00Z");
assert.equal(first.totalMaterialCost,21);
assert.equal(first.costKnown,true);
assert.equal(first.estimated,true);
assert.equal(first.rows.length,4);
data.ingredients[0].purchasePrice=200;
assert.equal(C.capture(order,data).totalMaterialCost,21,
 "Snapshot já gravado precisa manter custo histórico após nova compra");
assert.equal(order.costSnapshot.totalMaterialCost,21);
const short=makeOrder();
short.stockOverrideApproved=true;
short.stockActualConsumed={ingredients:{potato:800,bacon:100,box:2},beverages:{drink:1}};
assert.equal(C.capture(short,data).totalMaterialCost,17,
 "Snapshot contabiliza apenas o consumo físico real com override");
const unknown=makeOrder();data.ingredients[1].purchasePrice=0;
const snap=C.capture(unknown,data);
assert.equal(snap.costKnown,false);
assert(snap.missingCosts.includes("Bacon"));
assert.equal(snap.totalMaterialCost,20,"Custos desconhecidos não são inventados");
const missing=makeOrder();
missing.items.push({id:"inexistente",g:100,yieldPct:100});
assert.equal(C.capture(missing,data).costKnown,false);
assert.equal(C.capture(missing,data).missingCosts.length,2);
console.log("PASS V3: snapshot de custo real/simulado na produção, override físico, histórico estável e desconhecidos sinalizados.");
