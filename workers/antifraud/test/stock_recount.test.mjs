import test from "node:test";
import assert from "node:assert/strict";
import {planStockRecount} from "../src/stock_recount.mjs";
const base={group:"ingredients",itemId:"batata",previousStock:1000,
 countedStock:750,note:"Diferença registrada na conferência",universe:"batataria",
 operationId:"c34dd054-e049-4aa9-a02c-aa512944af60",at:"2026-11-20T23:00:00Z"};
test("F05 contagem: redução física gera movimento, perda e custo histórico",()=>{
 const stock={id:"batata",name:"Batata",stock:1000,measureUnit:"g",
  purchasePrice:8,purchaseQuantity:1,purchaseUnit:"kg"};
 const r=planStockRecount({...base,stock});
 assert.equal(r.item.stock,750);
 assert.equal(r.movement.quantity,-250);
 assert.equal(r.movement.previousStock,1000);
 assert.equal(r.loss.costLost,2);
 assert.equal(r.loss.costKnown,true);
 assert.equal(r.loss.quantityBase,250);
 assert.equal(r.movement.referenceId,r.loss.id);
 assert.equal(stock.stock,1000,"Não altera estoque antes do commit");
});
test("F05 contagem: saldo maior adiciona movimento, nunca compra fictícia",()=>{
 const r=planStockRecount({...base,countedStock:1050,
  stock:{id:"batata",stock:1000,name:"Batata"}});
 assert.equal(r.item.stock,1050);
 assert.equal(r.movement.quantity,50);
 assert.equal(r.loss,null);
 assert(r.recountId.startsWith("cf-recount-"));
});
test("F05 contagem: bebida por garrafa inteira; nunca aceitar frações",()=>{
 const stock={id:"agua",stock:5,name:"Água"};
 const r=planStockRecount({...base,group:"beverages",itemId:"agua",
  previousStock:5,countedStock:3,stock});
 assert.equal(r.item.stock,3);
 assert.equal(r.loss.measureUnit,"un");
 assert.equal(r.movement.quantity,-2);
 assert.throws(()=>planStockRecount({...base,group:"beverages",itemId:"agua",
  previousStock:5,countedStock:2.5,stock}),/inteira/);
});
test("F05 contagem: recusa saldo obsoleto, sem justificativa, duplicado e inválido",()=>{
 const stock={id:"batata",stock:1000};
 for(const patch of [{previousStock:900},{countedStock:-1},
  {countedStock:NaN},{countedStock:Infinity},{note:""},
  {countedStock:1000},{group:"purchases"},
  {stock:{...stock,stock:-5}},{stock:{...stock,archived:true}},
  {countedStock:1000000001},{previousStock:1000.000011}]
 ){
  assert.throws(()=>planStockRecount({...base,stock,...patch}),
   JSON.stringify(Object.keys(patch)));
 }
});
