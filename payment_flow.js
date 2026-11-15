/* Pagamento e troco em centavos; nenhuma alteração de estoque ou preço. */
(function(){
"use strict";
if(window.POTE_PAYMENT)return;
const $=id=>document.getElementById(id);
const money=x=>Number(x||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function toCents(x){
 let s=String(x??"").trim().replace(/^R\$/i,"").replace(/\s/g,"");
 if(!s)return NaN;
 if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");
 else if(s.includes(","))s=s.replace(",",".");
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
 if(!/^\d+(\.\d{1,2})?$/.test(s))return NaN;
 const cents=Math.round(Number(s)*100);
 return Number.isSafeInteger(cents)&&cents>=0?cents:NaN;
}
function calculate(total,received){
 const owing=toCents(total),paid=toCents(received);
 if(!Number.isFinite(owing)||!Number.isFinite(paid))return {valid:false,reason:"Informe valores monetários válidos."};
 if(paid<owing)return {valid:false,reason:"Dinheiro insuficiente: faltam "+money((owing-paid)/100)+".",
   total:owing/100,received:paid/100,missing:(owing-paid)/100};
 return {valid:true,total:owing/100,received:paid/100,change:(paid-owing)/100};
}
function orderTotal(){
 const price=toCents($("orderPrice")?.value||"0");
 const delivery=toCents($("orderDelivery")?.value||"0");
 const qty=Number($("orderQty")?.value||0);
 if(!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||!Number.isFinite(delivery))return NaN;
 return ((price*qty)+delivery)/100;
}
function sync(){
 const method=$("orderPayment")?.value||"pix",cash=method==="dinheiro";
 const box=$("potePaymentCash"),preview=$("potePaymentPreview"),delivery=$("orderHasDelivery")?.value;
 if(box)box.hidden=!cash;
 const address=$("orderAddress"),fee=$("orderDelivery");
 if(fee){
  if(delivery==="nao"){fee.value="0";fee.disabled=true}
  else if(delivery==="sim"){fee.disabled=false}
 }
 if(address&&delivery==="nao")address.placeholder="Retirada no balcão";
 if(address&&delivery==="sim")address.placeholder="Endereço completo para tele-entrega";
 if(!preview)return;
 const total=orderTotal();
 if(!Number.isFinite(total)){preview.textContent="Informe um preço e uma quantidade válidos.";return}
 if(!cash){preview.innerHTML="<strong>Total previsto: "+money(total)+"</strong><span>Pagamento: "+
   ({pix:"Pix",cartao:"Cartão",entrega:"Na entrega",outro:"Outro"}[method]||method)+
   ". O recibo registrará a forma escolhida.</span>";return}
 const calc=calculate(String(total.toFixed(2)),$("orderCashReceived")?.value||"");
 preview.innerHTML="<strong>Valor total: "+money(total)+"</strong><span>"+
 (Number.isFinite(calc.received)?"Dinheiro recebido: "+money(calc.received)+" · ":"")+
 (calc.valid?"Troco a devolver: <b>"+money(calc.change)+"</b>":calc.reason)+"</span>";
 preview.dataset.valid=String(calc.valid);
}
function validate(){
 const delivery=$("orderHasDelivery")?.value||"nao",
 method=$("orderPayment")?.value||"pix";
 const total=orderTotal();
 if(!Number.isFinite(total)||total<=0){alert("Informe o valor total do pedido corretamente.");return null}
 if(delivery==="sim"){
  if(!Number.isFinite(toCents($("orderDelivery")?.value))){alert("Informe a taxa de tele-entrega.");return null}
  if(!String($("orderAddress")?.value||"").trim()){alert("Informe o endereço para a tele-entrega.");return null}
 }
 const result={paymentMethod:{pix:"Pix",dinheiro:"Dinheiro",cartao:"Cartão",
  entrega:"Na entrega",outro:"Outro"}[method]||"Não informado",
  deliveryType:delivery==="sim"?"Tele-entrega":"Retirada",
  paidAmount:null,changeGiven:null,paymentStatus:method==="entrega"?"Pendente":"Informado"};
 if(method==="dinheiro"){
  const calculated=calculate(String(total.toFixed(2)),$("orderCashReceived")?.value||"");
  if(!calculated.valid){alert(calculated.reason);return null}
  result.paidAmount=calculated.received;result.changeGiven=calculated.change;
  result.paymentStatus="Pago em dinheiro";
 }
 return result;
}
function vitrineTotal(){
 const cartArray=typeof cart==="undefined"?[]:cart;
 const sub=cartArray.reduce((x,i)=>x+(Number(i.price)||0)*(Number(i.qty)||0),0);
 return sub+Number($("vitrineDeliv")?.value||0);
}
function vitrineSync(){
 const method=$("vitrinePay")?.value||"Pix",cash=method.toLocaleLowerCase("pt-BR").includes("dinheiro"),
 box=$("vitrineCashFields"),preview=$("vitrineCashPreview");
 if(box)box.hidden=!cash;
 const delivery=$("vitrineHasDelivery")?.value||"nao";
 const fee=$("vitrineDeliv");
 if(fee){if(delivery==="nao"){fee.value="0";fee.disabled=true}
   else fee.disabled=false}
 const addr=$("vitrineAddr");
 if(addr)addr.placeholder=delivery==="sim"?"Endereço de tele-entrega":"Retirada no balcão";
 const sum=$("vitrineSummary");if(sum){
  const total=vitrineTotal(),deliveryCost=Number(fee?.value)||0;
  sum.innerHTML="Subtotal: <b>"+money(total-deliveryCost)+"</b> · Entrega: <b>"+money(deliveryCost)+
    "</b> · Total: <b>"+money(total)+"</b>";
 }
 if(!preview)return;
 if(!cash){preview.textContent="O recibo indicará a forma de pagamento escolhida.";return}
 const calc=calculate(vitrineTotal().toFixed(2),$("vitrineCashReceived")?.value||"");
 preview.textContent=calc.valid?"Troco previsto: "+money(calc.change):calc.reason;
}
function vitrineValidate(){
 const pay=$("vitrinePay")?.value||"Não informado";
 if(!String(pay).toLowerCase().includes("dinheiro"))
  return {paymentMethod:pay,paidAmount:null,changeGiven:null,paymentStatus:"Informado"};
 const result=calculate(vitrineTotal().toFixed(2),$("vitrineCashReceived")?.value||"");
 if(!result.valid){alert(result.reason);return null}
 return {paymentMethod:pay,paidAmount:result.received,changeGiven:result.change,paymentStatus:"Pago em dinheiro"};
}
window.POTE_PAYMENT={money,toCents,calculate,orderTotal,sync,validate,
 vitrineTotal,vitrineSync,vitrineValidate};
})();
