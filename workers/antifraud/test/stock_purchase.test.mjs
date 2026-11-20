import test from "node:test";
import assert from "node:assert/strict";
import {planStockPurchase} from "../src/stock_purchase.mjs";
const base={group:"ingredients",itemId:"batata",delta:1500,paidTotal:12,
 enteredQuantity:1.5,enteredUnit:"kg",supplier:"Mercado",universe:"batataria",
 operationId:"c7769fbc-ad34-4d89-bf7d-ea195705b92b",
 at:"2026-11-20T22:55:00Z"};
test("F05 compra: peso em kg vira gramas, registra preço e custo médio ponderado",()=>{
 const stock={id:"batata",name:"Batata",stock:500,measureUnit:"g",
  purchasePrice:3,purchaseQuantity:0.5,purchaseUnit:"kg",costSource:"real-purchase"};
 const p=planStockPurchase({...base,stock});
 assert.equal(p.item.stock,2000);
 assert.equal(p.item.purchaseQuantity,1.5);
 assert.equal(p.item.purchaseUnit,"kg");
 assert.equal(p.item.purchasePrice,12);
 assert.equal(p.item.averageUnitCost,0.0075);
 assert.equal(p.item.averageCostKnown,true);
 assert.equal(p.purchase.totalPaid,12);
 assert.equal(p.purchase.added,1500);
 assert.equal(p.purchase.unitPrice,8);
 assert.equal(p.movement.quantity,1500);
 assert.equal(p.movement.referenceId,p.purchase.id);
 assert.equal(stock.stock,500,"Planejador não altera objeto existente");
});
test("F05 compra: bebida por unidade com recibo e custo da compra",()=>{
 const stock={id:"lata",stock:8,name:"Cola",purchasePrice:24,
  purchaseQuantity:6,purchaseUnit:"un"};
 const p=planStockPurchase({...base,stock,group:"beverages",itemId:"lata",
  delta:12,enteredQuantity:12,enteredUnit:"un",paidTotal:60});
 assert.equal(p.item.stock,20);
 assert.equal(p.item.averageUnitCost,4.6);
 assert.equal(p.purchase.itemKind,"beverage");
 assert.equal(p.movement.ingredientId,"bev:lata");
 assert.equal(p.item.purchaseUnit,"un");
});
test("F05 compra: custo anterior desconhecido não fabrica média",()=>{
 const p=planStockPurchase({...base,stock:{id:"batata",name:"Batata",stock:500,
  source:"Saldo inicial demonstrativo",measureUnit:"g"}});
 assert.equal(p.item.averageCostKnown,false);
 assert.equal(p.item.requiresPhysicalRecount,true);
 assert.equal(p.item.averageUnitCost,0.008);
});
test("F05 compra: bloquear unidades divergentes, fraude no total e estoque maior que limite",()=>{
 const stock={id:"batata",name:"Batata",stock:1000,measureUnit:"g"};
 for(const patch of [
  {enteredQuantity:1},{enteredUnit:"L"},{delta:-100},
  {delta:1499},{paidTotal:0},{paidTotal:NaN},{paidTotal:"12"},
  {enteredUnit:"un"},{supplier:"x".repeat(131)},{stock:{...stock,archived:true}},
  {stock:{...stock,stock:999999000}}
 ])assert.throws(()=>planStockPurchase({...base,stock,...patch}),
  JSON.stringify(Object.keys(patch)));
 assert.throws(()=>planStockPurchase({...base,stock:{...stock,stock:NaN}}));
 assert.throws(()=>planStockPurchase({...base,stock:{...stock,stock:-1}}));
});
