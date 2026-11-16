import assert from "node:assert/strict";
import {openCash,calculateCash,closeCash,registerCashMovement,confirmRecordedPayment,settleDeliveryPayment,settlePreviousPayment,listOutstandingPrevious} from "./pdv_cash_core.mjs";
const data={orders:[],cashSessions:[],cashMovements:[]};
openCash(data,{id:"s1",openingCash:100,operator:"Teste"});
data.orders.push(
 {id:"pix1",cashSessionId:"s1",qty:1,price:50,paymentMethod:"Pix",paymentStatus:"Informado",status:"entregue"},
 {id:"cash1",cashSessionId:"s1",qty:1,price:40,paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro",status:"entregue"},
 {id:"cancelledPix",cashSessionId:"s1",qty:1,price:15,paymentMethod:"Pix",paymentStatus:"pago",status:"cancelado"},
 {id:"deliveryLate",cashSessionId:"s1",qty:1,price:30,paymentMethod:"Na entrega",paymentStatus:"Pendente",status:"entregue"}
);
const before=calculateCash(data,"s1");
assert.equal(before.expectedCash,140);
assert.equal(before.sales,40,"Pix de venda cancelada não pode ser lançado como venda");
assert.equal(before.cancelledPaid,15,"Recebimentos cancelados precisam continuar rastreáveis");
assert.equal(before.pending,80);
const closed=closeCash(data,{countedCash:140});
assert.equal(closed.closedSummary.sales,40);
assert.throws(()=>confirmRecordedPayment(data,{orderId:"pix1",reference:"conferido"}),/encerrado/);
assert.throws(()=>settleDeliveryPayment(data,{orderId:"deliveryLate",method:"Pix",reference:"conferido"}),/encerrado/);
assert.equal(data.orders[0].paymentStatus,"Informado");
assert.deepEqual(calculateCash(data,"s1"),closed.closedSummary,
 "Relatório histórico precisa ser imutável quando caixa já fechou");
data.orders[1].status="cancelado";
assert.deepEqual(calculateCash(data,"s1"),closed.closedSummary,
 "Uma alteração no pedido não pode reescrever fechamento histórico");
openCash(data,{id:"s2",openingCash:100,operator:"Segundo turno"});
const refund=registerCashMovement(data,{id:"refund1",kind:"reembolso",orderId:"cash1",amount:40});
assert.equal(refund.sessionId,"s2");
assert.equal(refund.originSessionId,"s1");
assert.equal(calculateCash(data,"s2").expectedCash,60);
assert.throws(()=>registerCashMovement(data,{id:"refund2",kind:"reembolso",orderId:"cash1",amount:40}),/já recebeu/);
assert.deepEqual(calculateCash(data,"s1"),closed.closedSummary);
assert.equal(calculateCash(data,"s1").sales,40);
assert.equal(calculateCash(data,"s2").refunds,40);
assert.equal(calculateCash(data,"s2").sales,0);

// After closing s1, receive an old Pix in the current shift through a compensating event.
const outstanding= listOutstandingPrevious(data);
assert(outstanding.some(o=>o.id==="pix1")&&outstanding.some(o=>o.id==="deliveryLate"));
const late=settlePreviousPayment(data,{
 id:"late-s2-pix",orderId:"pix1",method:"Pix",reference:"comprovante no banco"
});
assert.equal(late.originSessionId,"s1");
assert.equal(late.sessionId,"s2");
assert.equal(calculateCash(data,"s2").receivedFromPrevious,50);
assert.equal(calculateCash(data,"s2").sales,0);
assert.equal(calculateCash(data,"s2").expectedCash,60,"Pix recebido não altera dinheiro físico");
assert.throws(()=>settlePreviousPayment(data,{
 id:"dup",orderId:"pix1",method:"Pix",reference:"duplicado"
}),/não elegível|já registrado/);
assert.deepEqual(calculateCash(data,"s1"),closed.closedSummary,
 "Recebimento tardio não reabre ou altera turno encerrado");
const lateCash=settlePreviousPayment(data,{
 id:"late-s2-cash",orderId:"deliveryLate",method:"Dinheiro",reference:"caixa conferido"
});
assert.equal(lateCash.paymentMethod,"cash");
assert.equal(calculateCash(data,"s2").expectedCash,90);
assert.equal(calculateCash(data,"s2").receivedFromPrevious,80);

console.log("PASS V3: fechamento congelado, recebimento tardio compensatório, sem venda duplicada nem reembolso duplo.");
