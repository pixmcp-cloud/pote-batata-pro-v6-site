import test from "node:test";
import assert from "node:assert/strict";
import {planStockLoss,stockCostUnit} from "../src/stock_loss.mjs";
const base={group:"ingredients",itemId:"batata",universe:"batataria",
 operationId:"b84665d0-0014-45b4-a888-a032f5d81234",
 delta:-150,lossReason:"higiene",note:"Descartado",at:"2026-11-20T22:20:00Z"};
test("F05 V5: custo exato e estoque em gramas sem confiar em valor enviado",()=>{
 const p=planStockLoss({...base,stock:{id:"batata",stock:1000,name:"Batata",
  measureUnit:"g",purchasePrice:7,purchaseQuantity:1,purchaseUnit:"kg"}});
 assert.equal(p.item.stock,850);
 assert.equal(p.loss.costLost,1.05);
 assert.equal(p.loss.costKnown,true);
 assert.equal(p.movement.quantity,-150);
 assert.equal(p.movement.referenceId,p.loss.id);
});
test("F05 V5: bebida contada por unidades, não por peso",()=>{
 const item={id:"lata",stock:4,name:"Refri",purchasePrice:36,purchaseQuantity:12,
  purchaseUnit:"un"};
 const p=planStockLoss({...base,group:"beverages",itemId:"lata",
  delta:-2,stock:item});
 assert.equal(p.item.stock,2);
 assert.equal(p.loss.costLost,6);
 assert.equal(p.loss.measureUnit,"un");
 assert.equal(p.movement.ingredientId,"bev:lata");
 assert.throws(()=>planStockLoss({...base,group:"beverages",itemId:"lata",
  delta:-0.5,stock:item}),/inteiro/);
});
test("F05 V5: preço ausente gera custo desconhecido, não inventado",()=>{
 const p=planStockLoss({...base,stock:{id:"batata",stock:1000,name:"Batata"}});
 assert.equal(p.loss.costKnown,false);
 assert.equal(p.loss.costLost,0);
 assert.equal(stockCostUnit({purchasePrice:6,purchaseQuantity:1,
  purchaseUnit:"kg"},"ingredients",{costBasis:"average"}).value,0.006);
});
test("F05 V5: rejeita perdas acima do disponível, item arquivado e números inválidos",()=>{
 const stock={id:"batata",stock:1000};
 for(const opts of [{delta:-1100},{delta:1},{delta:-0.000001},
  {delta:NaN},{delta:-Infinity},{lossReason:"falso"},
  {lossReason:"outro",note:""},{group:"cashSessions"}])
  assert.throws(()=>planStockLoss({...base,stock,...opts}));
 assert.throws(()=>planStockLoss({...base,stock:{...stock,archived:true}}));
});
