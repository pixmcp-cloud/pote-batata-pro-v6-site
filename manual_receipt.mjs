/* Manual Pix receipt for a ten-business subscription pilot; bank is checked by operator. */
export function parseBRLPaymentCents(value){
 const text=String(value??"").trim().replace(/^R\$\s*/i,"").replace(/\s+/g,"");
 if(!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(text))throw Error("Informe o valor, por exemplo 39,90.");
 const [whole,decimal=""]=text.replace(",",".").split(".");
 const cents=Number(whole)*100+Number((decimal+"00").slice(0,2));
 if(!Number.isSafeInteger(cents)||cents<=0)throw Error("O valor Pix deve ser maior que zero.");
 return cents;
}
export function manualLicensePayment({mode,amount,reference,confirmed}={}){
 const ref=String(reference||"").trim();
 if(ref.length<6||ref.length>120)
  throw Error("Informe referencia do Pix ou motivo da cortesia (6 a 120 caracteres).");
 if(confirmed!==true)
  throw Error("Confirme expressamente a conferencia no banco ou cortesia.");
 if(mode==="courtesy")
  return Object.freeze({paymentMethod:"courtesy",paymentAmountCents:0,paymentReference:ref});
 if(mode!=="pix_manual")throw Error("Forma de pagamento desconhecida.");
 return Object.freeze({paymentMethod:"pix_manual",
  paymentAmountCents:parseBRLPaymentCents(amount),paymentReference:ref});
}
