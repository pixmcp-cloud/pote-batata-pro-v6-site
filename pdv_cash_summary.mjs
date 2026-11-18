/* Resumo financeiro para o operador: não mistura dinheiro físico com recibos Pix/cartão. */
const toCents=v=>Math.round(Number(v||0)*100);
const money=c=>Math.round(c)/100;
export function summarizePdvReceipts(summary){
 if(!summary||typeof summary!=="object")throw Error("Resumo do turno indisponível.");
 const verified=summary.confirmedByMethod||{},late=summary.previousByMethod||{};
 const cash=toCents(verified.cash)+toCents(late.cash);
 const pix=toCents(verified.pix)+toCents(late.pix);
 const card=toCents(verified.card)+toCents(late.card);
 const other=toCents(verified.delivery)+toCents(verified.other);
 const gross=cash+pix+card;
 const refunds=toCents(summary.refunds);
 return {
  cash:money(cash),pix:money(pix),card:money(card),
  gross:money(gross),refunds:money(refunds),
  netRecorded:money(gross-refunds),
  unclassified:money(other),pending:money(toCents(summary.pending)),
  openingCash:money(toCents(summary.openingCash)),
  expectedCash:money(summary.expectedCashCents??toCents(summary.expectedCash)),
  lateCash:money(toCents(late.cash)),latePix:money(toCents(late.pix)),lateCard:money(toCents(late.card))
 };
}
/* Rendered preview only. Never mutates a session or books a payment. */
export function countCashDifference(summary,countedAmount){
 if(!summary)throw Error("Não há caixa aberto.");
 const count=Number(countedAmount);
 if(!Number.isFinite(count)||count<0||count>100000000)throw Error("Informe o valor contado em dinheiro.");
 const countedCents=Math.round(count*100);
 const expectedCents=summary.expectedCashCents??toCents(summary.expectedCash);
 const difference=money(countedCents-expectedCents);
 return {expected:money(expectedCents),counted:money(countedCents),difference,
  status:difference===0?"certo":difference>0?"sobra":"falta",
  label:difference===0?"Caixa conferido: valores iguais":difference>0?"Sobra de dinheiro":"Falta dinheiro no caixa"};
}
