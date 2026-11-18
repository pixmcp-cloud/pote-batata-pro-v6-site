import assert from "node:assert/strict";
import {parseBRLPaymentCents,manualLicensePayment} from "./manual_receipt.mjs";
assert.equal(parseBRLPaymentCents("39,90"),3990);
assert.equal(parseBRLPaymentCents("R$ 49.9"),4990);
assert.equal(parseBRLPaymentCents("120"),12000);
for(const s of ["0","0,00","abc","1,234","-4",""])assert.throws(()=>parseBRLPaymentCents(s));
assert.deepEqual(manualLicensePayment({
 mode:"pix_manual",amount:"39,90",reference:"Pix-20261118-01",confirmed:true
}),{paymentMethod:"pix_manual",paymentAmountCents:3990,paymentReference:"Pix-20261118-01"});
assert.deepEqual(manualLicensePayment({
 mode:"courtesy",reference:"Parceiro piloto",confirmed:true
}),{paymentMethod:"courtesy",paymentAmountCents:0,paymentReference:"Parceiro piloto"});
for(const x of [{mode:"pix_manual",amount:"39,90",reference:"Pix123",confirmed:false},
 {mode:"pix_manual",amount:"39,90",reference:"x",confirmed:true},
 {mode:"pix_manual",amount:"0,00",reference:"Pix123",confirmed:true},
 {mode:"courtesy",reference:"Parceiro",confirmed:false}])assert.throws(()=>manualLicensePayment(x));
console.log("PASS manual billing: BRL cents, Pix verified by operator, courtesy, denied invalid.");
