import assert from "node:assert/strict";
import {computeFranchiseFinances} from "./franchise_financial_report.mjs";
const now=new Date("2026-11-18T12:00:00.000Z");
const data={
 orders:[
  {id:"a",createdAt:"2026-11-18T09:00:00.000Z",qty:2,price:20,paymentStatus:"pago",
   paymentMethod:"Pix",paymentConfirmedAt:"2026-11-18T09:00:00.000Z",unitVariableCost:8,costEstimatePct:40},
  {id:"b",createdAt:"2026-11-17T09:00:00.000Z",qty:1,price:30,
   paymentMethod:"Cartão",paymentStatus:"nao_pago",unitVariableCost:10},
  {id:"c",createdAt:"2026-11-18T10:00:00.000Z",qty:1,price:10,
   paymentStatus:"pago",paymentMethod:"Dinheiro",paymentConfirmedAt:"2026-11-18T10:00:00.000Z",
   status:"cancelado"},
  {id:"old",createdAt:"2026-10-10T12:00:00.000Z",qty:1,price:60,paymentStatus:"nao_pago"}
 ],
 expenses:[{id:"e",at:"2026-11-18T09:00:00.000Z",amount:5},
  {id:"bad",at:"2026-11-18T09:00:00.000Z",amount:"none"}],
 cashMovements:[
  {kind:"late_payment",at:"2026-11-17T15:00:00.000Z",amount:60,paymentMethod:"card",orderId:"old"},
  {kind:"reembolso",at:"2026-11-18T12:00:00.000Z",amount:10,orderId:"c"}
 ]
};
const x=computeFranchiseFinances(data,7,now);
assert.equal(x.totals.sales,70);
assert.equal(x.totals.variableCost,26);
assert.equal(x.totals.expenses,5);
assert.equal(x.totals.estimatedResult,39);
assert.equal(x.totals.received,110);
assert.equal(x.totals.refunds,10);
assert.equal(x.totals.netReceived,100);
assert.equal(x.totals.payments.pix,40);
assert.equal(x.totals.payments.card,60);
assert.equal(x.totals.payments.cash,10);
assert.equal(x.totals.pending,30);
assert.equal(x.totals.canceledCount,1);
assert.equal(x.labels.length,7);
assert.equal(x.totals.estimatedCount,1);
const m=computeFranchiseFinances(data,30,now);
assert.equal(m.labels.length,30);
assert.equal(m.totals.sales,70);
assert.throws(()=>computeFranchiseFinances(data,365,now),/Período inválido/);
console.log("PASS franchise finance: weekly/monthly, paid vs pending, cash/Pix/card, refunds, estimated cost and result.");