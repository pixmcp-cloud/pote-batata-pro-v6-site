import assert from "node:assert/strict";
import {recordId} from "./v2_store_core.mjs";
import {validateProductionJournalDiff,validateCancellationJournalDiff,validateCashJournalDiff} from "./operation_integrity.mjs";
import {confirmPaymentOnSaleCompletion} from "./pdv_cash_core.mjs";
const universe="batataria";
const rec=(group,id,item)=>({universe,group,id,rank:1,item:{id,...item}});
const change=(before,after)=>({kind:"record",key:recordId(universe,(after||before).group,(after||before).id),before,after});
const old=rec("orders","order-1",{status:"em_producao",stockRestored:false,
 qty:2,items:[{id:"batata",g:100,yieldPct:100}],
 beverageItems:[{id:"agua",qty:1}],stockDeducted:true,cashSessionId:"s1",
 price:50,paymentMethod:"Dinheiro",paymentStatus:"pago"});
const cancelled=rec("orders","order-1",{...old.item,status:"cancelado",stockRestored:true,cancelStockAction:"devolvido"});
const oldPotato=rec("ingredients","batata",{stock:500}),newPotato=rec("ingredients","batata",{stock:700});
const oldWater=rec("beverages","agua",{stock:10}),newWater=rec("beverages","agua",{stock:12});
const move=(id,ingredientId,quantity,reason)=>rec("stockMovements",id,{
 ingredientId,quantity,reason,referenceId:"order-1"});
const good={changes:[
 change(old,cancelled),change(oldPotato,newPotato),change(oldWater,newWater),
 change(null,move("m1","batata",200,"Estorno de estoque por cancelamento")),
 change(null,move("m2","bev:agua",2,"Estorno bebida por cancelamento"))
]};
assert.equal(validateCancellationJournalDiff(good).returns,1);
assert.throws(()=>validateCancellationJournalDiff({changes:good.changes.slice(0,-1)}),/incompleto/i);
assert.throws(()=>validateCancellationJournalDiff({changes:[
 ...good.changes.slice(0,2),change(oldWater,rec("beverages","agua",{stock:11})),...good.changes.slice(3)
]}),/reposição física/);
assert.throws(()=>validateCancellationJournalDiff({changes:[
 ...good.changes.slice(0,-1),change(null,move("m2","bev:agua",3,"Estorno bebida por cancelamento"))
]}),/incompleto/);
const lossOrder=rec("orders","order-1",{...old.item,status:"cancelado",stockReturnDeclined:true,lossEventId:"loss-1"});
assert.throws(()=>validateCancellationJournalDiff({changes:[change(old,lossOrder)]}),/evento de prejuízo/);
assert.equal(validateCancellationJournalDiff({changes:[change(old,lossOrder),
 change(null,rec("losses","loss-1",{type:"order",orderId:"order-1"}))]}).losses,1);

const unpaidCancelled=rec("orders","order-1",{...old.item,status:"cancelado"});
const before={meta:{},records:new Map([[recordId(universe,"orders","order-1"),unpaidCancelled]])};
const newRefund=rec("cashMovements","refund-1",{kind:"reembolso",orderId:"order-1",originSessionId:"s1",sessionId:"s2",
 amount:100,reason:"Devolução",at:"2026-11-18T10:00:00Z"});
const next={meta:{},records:new Map([...before.records,[recordId(universe,"cashMovements","refund-1"),newRefund]])};
const changes={changes:[change(null,newRefund)]};
assert.equal(validateCashJournalDiff(before,next,changes).checked,1);
assert.throws(()=>validateCashJournalDiff(before,next,{changes:[change(null,rec("cashMovements","refund-1",
 {...newRefund.item,amount:99}))]}),/Valor financeiro divergente/);
const dup=rec("cashMovements","refund-2",{...newRefund.item,id:"refund-2"});
const duplicate={...next,records:new Map([...next.records,[recordId(universe,"cashMovements","refund-2"),dup]])};
assert.throws(()=>validateCashJournalDiff(before,duplicate,{changes:[change(null,dup)]}),/duplicado/);
const late=rec("cashMovements","late-1",{kind:"late_payment",orderId:"order-1",originSessionId:"s1",
 sessionId:"s2",amount:100,paymentMethod:"pix",reference:"comprovante",at:"2026-11-18T10:00:00Z"});
const live=rec("orders","order-1",{...old.item,status:"recebido",paymentStatus:"nao_pago",paymentConfirmedAt:null});
const past={meta:{},records:new Map([[recordId(universe,"orders","order-1"),live]])};
const now={meta:{},records:new Map([...past.records,[recordId(universe,"cashMovements","late-1"),late]])};
assert.equal(validateCashJournalDiff(past,now,{changes:[change(null,late)]}).checked,1);
assert.throws(()=>validateCashJournalDiff(past,now,{changes:[change(null,rec("cashMovements","late-1",
 {...late.item,originSessionId:"wrong"}))]}),/Turno/);
const initial=rec("orders","order-1",{...old.item,status:"recebido",stockDeducted:false});
const inProduction=rec("orders","order-1",{...old.item,status:"em_producao",stockDeducted:true});
const negativeMoves=[
 change(null,move("prod-1","batata",-200,"Produção")),
 change(null,move("prod-2","bev:agua",-2,"Bebida vendida"))
];
assert.equal(validateProductionJournalDiff({changes:[change(initial,inProduction),...negativeMoves]}).produced,1);
assert.throws(()=>validateProductionJournalDiff({changes:[change(initial,inProduction),negativeMoves[0]]}),/Consumo sem baixa/);
assert.throws(()=>validateProductionJournalDiff({changes:[change(initial,inProduction),negativeMoves[0],
 change(null,move("prod-2","bev:agua",-3,"Bebida vendida"))]}),/Consumo sem baixa/);
const pixOrder=rec("orders","order-1",{...unpaidCancelled.item,paymentMethod:"Pix"});
const invalidRefundState={...next,records:new Map([...next.records,[recordId(universe,"orders","order-1"),pixOrder]])};
assert.throws(()=>validateCashJournalDiff(before,invalidRefundState,changes),/Reembolso/);
// Caso real: pedido feito em turno que já fechou; o próprio clique em
// "Concluir" cria o late_payment e confirma recebimento na MESMA transação.
const oldTurnData={
 orders:[{id:"late-order",status:"entregue",qty:2,price:50,
  paymentMethod:"Pix",paymentStatus:"nao_pago",cashSessionId:"closed-shift"}],
 cashSessions:[{id:"closed-shift",status:"closed",closedAt:"2026-11-17T23:00:00Z",
  closedSummary:{expectedCash:0}},
 {id:"current-shift",status:"open",openingCash:0}],
 cashMovements:[]
};
const originalOrder=structuredClone(oldTurnData.orders[0]);
const completed=confirmPaymentOnSaleCompletion(oldTurnData,{
 orderId:"late-order",operator:"Caixa QA",at:"2026-11-18T10:00:00Z"});
assert.equal(completed.recorded,true);
assert.equal(completed.late,true);
assert.equal(oldTurnData.cashMovements.length,1);
assert.equal(oldTurnData.orders[0].paymentStatus,"pago");
assert.equal(oldTurnData.cashSessions[0].status,"closed");
const originOrder=rec("orders","late-order",originalOrder);
const confirmedOrder=rec("orders","late-order",oldTurnData.orders[0]);
const settlement=rec("cashMovements",oldTurnData.cashMovements[0].id,oldTurnData.cashMovements[0]);
const originState={meta:{},records:new Map([
 [recordId(universe,"orders","late-order"),originOrder]])};
const confirmedState={meta:{},records:new Map([
 ...originState.records,
 [recordId(universe,"orders","late-order"),confirmedOrder],
 [recordId(universe,"cashMovements",settlement.id),settlement]])};
const settlementDiff={changes:[change(originOrder,confirmedOrder),change(null,settlement)]};
assert.equal(validateCashJournalDiff(originState,confirmedState,settlementDiff).checked,1,
 "Pagamento confirmado e evento tardio devem ser aceitos juntos");
assert.equal(confirmPaymentOnSaleCompletion(oldTurnData,{orderId:"late-order"}).recorded,false,
 "Repetir conclusão não pode criar cobrança nova");
assert.equal(oldTurnData.cashMovements.length,1);
const alreadyPaidOrigin=rec("orders","late-order",{
 ...originalOrder,paymentStatus:"pago",paymentConfirmedAt:"2026-11-17T22:00:00Z"});
const alreadyPaidState={meta:{},records:new Map([[recordId(universe,"orders","late-order"),alreadyPaidOrigin]])};
assert.throws(()=>validateCashJournalDiff(alreadyPaidState,confirmedState,settlementDiff),
 /Pagamento antigo sem comprovante|já confirmado|duplicado/,
 "Uma cobrança já paga anteriormente deve continuar rejeitada");
console.log("PASS F02/F05/F20: produção, estornos e recebimento tardio idempotente junto à conclusão do pedido.");
