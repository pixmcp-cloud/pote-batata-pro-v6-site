// Franchise finance overview: pure local aggregation over one franchise's own records.
// Figures are indicative, not a settlement or bank reconciliation.
const cents=v=>Math.round(Number(v||0)*100);
const money=n=>Math.round(n)/100;
const amount=o=>Number.isFinite(Number(o?.total))&&Number(o.total)>0?Number(o.total):
 Math.max(0,Number(o?.qty||0)*Number(o?.price||0)+Number(o?.deliveryFee||0));
const day=v=>{
 const t=v?.toDate?.()||new Date(v||0);
 return Number.isFinite(t?.getTime?.())?t.toISOString().slice(0,10):null;
};
const when=(o,...fields)=>{
 for(const key of fields){if(o?.[key]){const d=day(o[key]);if(d)return d}}
 return null;
};
const method=v=>{const k=String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return k.includes("pix")?"pix":k.includes("cart")||k.includes("card")||k.includes("credit")||k.includes("debit")?"card":
 k.includes("dinheiro")||k.includes("cash")?"cash":"other"};
const isPaid=o=>o?.paymentStatus!=="nao_pago"&&(
 Boolean(o?.paymentConfirmedAt)||["pago","confirmado","pago em dinheiro"].includes(
 String(o?.paymentStatus||"").toLowerCase()));
export function computeFranchiseFinances({orders=[],expenses=[],cashMovements=[]},days=7,now=new Date()){
 if(![7,30].includes(days))throw Error("Período inválido");
 const end=new Date(now),utc=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate()));
 const labels=Array.from({length:days},(_,i)=>new Date(utc.getTime()-(days-1-i)*86400000).toISOString().slice(0,10));
 const entries=new Map(labels.map(k=>[k,{day:k,sales:0,received:0,expenses:0,cost:0,refunds:0}]));
 const tender={cash:0,pix:0,card:0,other:0};
 let ordersCount=0,canceledCount=0,estimatedCount=0,pending=0,expenseCount=0;
 for(const o of orders){
  const saleDay=when(o,"createdAt","date","at");
  const isCancelled=o?.status==="cancelado";
  if(entries.has(saleDay)){
   if(isCancelled)canceledCount++;
   else{
    const p=entries.get(saleDay),value=cents(amount(o));
    p.sales+=value;ordersCount++;
    const quantity=Number(o.qty)||0,unit=Number(o.unitVariableCost);
    if(quantity>0&&Number.isFinite(unit)&&unit>=0){
     p.cost+=cents(unit*quantity+Math.max(0,Number(o.deliveryCost)||0));
     if(o.costEstimatePct||o.costEstimateMode==="estimated")estimatedCount++;
    }
    if(!isPaid(o))pending+=value;
   }
  }
  if(isPaid(o)){
   const paymentDay=when(o,"paymentConfirmedAt","createdAt","date");
   if(entries.has(paymentDay)){
    const value=cents(amount(o)),k=method(o.paymentMethod);
    entries.get(paymentDay).received+=value;tender[k]+=value;
   }
  }
 }
 // Late payments are separate immutable events; they must not rewrite old orders.
 for(const m of cashMovements){
  const md=when(m,"at","createdAt","date");if(!entries.has(md))continue;
  const amountCents=cents(m.amount);
  if(!(amountCents>0))continue;
  if(m.kind==="late_payment"){
   entries.get(md).received+=amountCents;tender[method(m.paymentMethod)]+=amountCents;
  }else if(m.kind==="reembolso"){
   entries.get(md).refunds+=amountCents;
  }
 }
 for(const x of expenses){
  const date=when(x,"at","date","createdAt","paidAt");
  if(!entries.has(date))continue;
  const value=Number(x.amount??x.value??x.total??x.cost);
  if(Number.isFinite(value)&&value>0){entries.get(date).expenses+=cents(value);expenseCount++}
 }
 const sum=key=>[...entries.values()].reduce((n,e)=>n+e[key],0);
 const totals={
  sales:money(sum("sales")),received:money(sum("received")),refunds:money(sum("refunds")),
  netReceived:money(sum("received")-sum("refunds")),expenses:money(sum("expenses")),
  variableCost:money(sum("cost")),
  estimatedResult:money(sum("sales")-sum("cost")-sum("expenses")),
  pending:money(pending),ordersCount,canceledCount,estimatedCount,expenseCount,
  payments:Object.fromEntries(Object.entries(tender).map(([k,v])=>[k,money(v)]))
 };
 return {days,labels,series:labels.map(d=>{
  const x=entries.get(d);
  return {day:d,sales:money(x.sales),received:money(x.received),expenses:money(x.expenses),
   cost:money(x.cost),refunds:money(x.refunds),result:money(x.sales-x.cost-x.expenses)}
 }),totals,
 notes:["Valores estimados, não são extrato bancário nem lucro contábil definitivo.",
  "Despesas sem data ou valor reconhecível não entram no cálculo.",
  "Custos variáveis ausentes não são inventados; revise as fichas técnicas.",
  "Pagamentos informados pelo operador precisam ser conciliados com Pix/cartão."]
 };
}
