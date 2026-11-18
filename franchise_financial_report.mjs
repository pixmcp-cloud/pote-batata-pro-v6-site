// Franchise finance overview: pure local aggregation over one franchise's own records.
// Figures are indicative, not a settlement or bank reconciliation.
const cents=v=>Math.round(Number(v||0)*100);
const money=n=>Math.round(n)/100;
const amount=o=>Number.isFinite(Number(o?.total))&&Number(o.total)>0?Number(o.total):
 Math.max(0,Number(o?.qty||0)*Number(o?.price||0)+Number(o?.deliveryFee||0));
// Todas as unidades atuais estão no Brasil. Datas próximas à meia-noite
// pertencem ao dia civil local, não ao dia UTC do servidor/navegador.
const timeZoneFormatters=new Map();
const day=(v,timeZone)=>{
 if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
 const t=v?.toDate?.()||new Date(v||0);
 if(!Number.isFinite(t?.getTime?.()))return null;
 if(!timeZoneFormatters.has(timeZone))timeZoneFormatters.set(timeZone,
  new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}));
 const parts=Object.fromEntries(timeZoneFormatters.get(timeZone).formatToParts(t).map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
};
const when=(o,timeZone,...fields)=>{
 for(const key of fields){if(o?.[key]){const d=day(o[key],timeZone);if(d)return d}}
 return null;
};
const method=v=>{const k=String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return k.includes("pix")?"pix":k.includes("cart")||k.includes("card")||k.includes("credit")||k.includes("debit")?"card":
 k.includes("dinheiro")||k.includes("cash")?"cash":"other"};
const isPaid=o=>o?.paymentStatus!=="nao_pago"&&(
 Boolean(o?.paymentConfirmedAt)||["pago","confirmado","pago em dinheiro"].includes(
 String(o?.paymentStatus||"").toLowerCase()));
export function computeFranchiseFinances({orders=[],expenses=[],cashMovements=[]},days=7,now=new Date(),timeZone='America/Sao_Paulo'){
 if(![7,30].includes(days))throw Error("Período inválido");
 const today=day(now,timeZone);
 if(!today)throw Error('Data de referência inválida');
 const noonUtc=Date.parse(today+'T12:00:00.000Z');
 const labels=Array.from({length:days},(_,i)=>new Date(noonUtc-(days-1-i)*86400000).toISOString().slice(0,10));
 const entries=new Map(labels.map(k=>[k,{day:k,sales:0,received:0,expenses:0,cost:0,refunds:0}]));
 const tender={cash:0,pix:0,card:0,other:0};
 const countedPayments=new Set(),countedLateOrders=new Set(),countedRefundOrders=new Set();
 let ordersCount=0,canceledCount=0,estimatedCount=0,pending=0,expenseCount=0;
 for(const o of orders){
  const saleDay=when(o,timeZone,"createdAt","date","at");
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
   const paymentDay=when(o,timeZone,"paymentConfirmedAt","createdAt","date");
   if(entries.has(paymentDay)){
    const value=cents(amount(o)),k=method(o.paymentMethod);
    entries.get(paymentDay).received+=value;tender[k]+=value;
    if(o.id!=null)countedPayments.add(String(o.id));
   }
  }
 }
 // Late payments are separate immutable events; they must not rewrite old orders.
 for(const m of cashMovements){
  const md=when(m,timeZone,"at","createdAt","date");if(!entries.has(md))continue;
  const amountCents=cents(m.amount);
  if(!(amountCents>0))continue;
  if(m.kind==="late_payment"){
   const orderId=String(m.orderId||'');
   // O mesmo recebimento pode estar refletido tanto no pedido pago quanto
   // no evento tardio. Contar duas vezes inflaria o caixa e o lucro aparente.
   if(orderId&&(countedPayments.has(orderId)||countedLateOrders.has(orderId)))continue;
   entries.get(md).received+=amountCents;tender[method(m.paymentMethod)]+=amountCents;
   if(orderId)countedLateOrders.add(orderId);
  }else if(m.kind==="reembolso"){
   const orderId=String(m.orderId||'');
   if(orderId&&countedRefundOrders.has(orderId))continue;
   entries.get(md).refunds+=amountCents;
   if(orderId)countedRefundOrders.add(orderId);
  }
 }
 for(const x of expenses){
  const date=when(x,timeZone,"at","date","createdAt","paidAt");
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
  "Pagamentos informados pelo operador precisam ser conciliados com Pix/cartão.",
  "Período contabilizado pelo calendário local da unidade ("+timeZone+")."]
 };
}
