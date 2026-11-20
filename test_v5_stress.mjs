import assert from "node:assert/strict";
import {splitState,combineState,diffState,recordId,recordPathParts,MAX_CHANGES_PER_TX} from "./v5_store_core.mjs";
import {planV5Batches} from "./v5_batch_planner.mjs";
import {openCash,activeSession,confirmPaymentOnSaleCompletion,registerCashMovement,
 calculateCash,closeCash,settleDeliveryPayment,paymentConfirmed} from "./pdv_cash_core.mjs";

let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++};
let seed=0x20261120;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const pick=a=>a[Math.floor(random()*a.length)];
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({data:{businessType:"batataria",businessUniverses:{},
 recipes:[],ingredients:[],beverages:[],orders:[],clients:[],suppliers:[],expenses:[],
 purchases:[],stockMovements:[],cashSessions:[],cashMovements:[],losses:[],settings:{},brand:{name:"Teste V5"}}});

for(const id of ["é","汉字","a/b","pacote#1","um🙂","____"]) {
 const key=recordId("pastelaria","recipes",id);
 const back=recordPathParts(key);
 check(back.universe==="pastelaria"&&back.group==="recipes"&&back.id===id,"Roundtrip ID unicode "+id);
}
const st=fresh();let previous=splitState(st);
for(let t=0;t<400;t++){
 const op=Math.floor(random()*4);
 if(op<2||!st.data.recipes.length){
  const id="r-"+t+"-"+Math.floor(random()*1000);
  const index=Math.floor(random()*(st.data.recipes.length+1));
  st.data.recipes.splice(index,0,{id,name:"Receita "+id,items:[],targetGainPct:100});
 }else if(op===2&&st.data.recipes.length>1){
  const from=Math.floor(random()*st.data.recipes.length),item=st.data.recipes.splice(from,1)[0];
  st.data.recipes.splice(Math.floor(random()*(st.data.recipes.length+1)),0,item);
 }else {
  st.data.recipes[Math.floor(random()*st.data.recipes.length)].name="Edit "+t;
 }
 const next=splitState(st,previous.records);
 const restored=combineState(next.meta,next.records);
 check(JSON.stringify(restored.data.recipes.map(x=>x.id))===JSON.stringify(st.data.recipes.map(x=>x.id)),"Ordem de receitas precisa permanecer exata no ciclo "+t);
 const ranks=[...next.records.values()].filter(x=>x.group==="recipes"&&x.universe==="batataria")
  .sort((a,b)=>st.data.recipes.findIndex(x=>x.id===a.id)-st.data.recipes.findIndex(x=>x.id===b.id)).map(x=>x.rank);
 check(ranks.every((x,i)=>Number.isFinite(x)&&(i===0||x>ranks[i-1])),"Ranks nao crescentes no ciclo "+t);
 previous=next;
}
const huge=fresh();
for(let i=0;i<365;i++)huge.data.clients.push({id:"c-"+i,name:"Cliente "+i});
const safeDelta=diffState(splitState(fresh()),splitState(huge));
const lots=planV5Batches(safeDelta);
check(lots.length>=3&&lots.flat().length===365,"Lotes de clientes 365");
check(lots.every(x=>x.length<=150),"Lotes maiores que 150");
const unsafe=fresh();
for(let i=0;i<300;i++)unsafe.data.orders.push({id:"o-"+i,status:"recebido",qty:1,price:24.9});
const dirtyDelta=diffState(splitState(fresh()),splitState(unsafe));
check(dirtyDelta.changes.length>MAX_CHANGES_PER_TX,"Cenario acima do teto de transacao");
assert.throws(()=>planV5Batches(dirtyDelta),/não pode ser fracionada/i);checks++;

const currencies=["Pix","Dinheiro","Cartão","Na entrega"];
let completed=0,declined=0,closed=0,refunds=0,failedDouble=0;
for(let sim=0;sim<40;sim++){
 const data={orders:[],cashSessions:[],cashMovements:[]};
 const initial=Number((random()*120).toFixed(2));
 const turn=openCash(data,{id:"turno-"+sim,openingCash:initial,operator:"QA"});
 check(activeSession(data)?.id===turn.id,"Caixa deve abrir");
 for(let i=0;i<60;i++){
  const method=pick(currencies),price=Number((1+random()*100).toFixed(2));
  const qty=1+Math.floor(random()*6),fee=Number((random()*15).toFixed(2));
  const id="O-"+sim+"-"+i;
  const order={id,status:"entregue",cashSessionId:turn.id,paymentMethod:method,
   paymentStatus:method==="Dinheiro"?"Pago em dinheiro":"Informado",
   price,qty,deliveryFee:fee};
  data.orders.push(order);
  const receipt=confirmPaymentOnSaleCompletion(data,{orderId:id,operator:"QA"});
  if(method==="Na entrega"){
   check(receipt.recorded===false&&!paymentConfirmed(order),"Entrega ainda nao recebida "+id);
   if(random()>.3){
    const settle=pick(["Pix","Dinheiro","Cartão"]);
    settleDeliveryPayment(data,{orderId:id,method:settle,reference:"teste-"+id});
    check(paymentConfirmed(order),"Entrega deve confirmar no caixa "+id);
    completed++;
   }else declined++;
  }else{
   check(paymentConfirmed(order),"Venda concluida deve marcar recebimento "+id);
   const twice=confirmPaymentOnSaleCompletion(data,{orderId:id,operator:"QA"});
   check(twice.recorded===false,"Conclusao duplicada nao pode contar duas vezes "+id);
   failedDouble++;
  }
  if(paymentConfirmed(order)&&random()<.12){
   order.status="cancelado";
   if(order.paymentMethod==="Dinheiro"){
    registerCashMovement(data,{id:"refund-"+id,kind:"reembolso",
     amount:(Math.round(price*qty*100)+Math.round(fee*100))/100,orderId:id});
    assert.throws(()=>registerCashMovement(data,{id:"double-"+id,kind:"reembolso",
     amount:(Math.round(price*qty*100)+Math.round(fee*100))/100,orderId:id}),/já recebeu/);
    refunds++;checks++;
   }
  }
  const summary=calculateCash(data,turn.id);
  check(Number.isFinite(summary.expectedCashCents)&&summary.expectedCashCents>=0,"Saldo nao numerico/negativo "+id);
  const expectedCents=Math.round(initial*100)+data.orders.filter(o=>o.cashSessionId===turn.id&&
    paymentConfirmed(o)&&o.paymentMethod==="Dinheiro").reduce((a,o)=>a+Math.round(o.price*o.qty*100)+Math.round(o.deliveryFee*100),0)
   -data.cashMovements.filter(m=>m.kind==="reembolso").reduce((a,m)=>a+Math.round(m.amount*100),0);
  check(summary.expectedCashCents===expectedCents,"Divergencia de centavos "+id);
 }
 const previous=calculateCash(data,turn.id),closing=closeCash(data,{countedCash:previous.expectedCash,operator:"QA"});
 check(closing.status==="closed"&&activeSession(data)===null,"Fechamento e liberacao da abertura");
 check(calculateCash(data,turn.id).expectedCashCents===previous.expectedCashCents,"Fechamento historico imutavel");
 assert.throws(()=>openCash({...data,cashSessions:[...data.cashSessions,{id:"ghost",status:"open"}]},
  {id:"other",openingCash:0}),/Já existe/);checks++;
 closed++;
}
console.log(JSON.stringify({status:"PASS",checks,codecCycles:400,safeBulkClients:365,
 cashSimulations:40,cashSaleAttempts:40*60,completedDelivery:completed,pendingDelivery:declined,
 closedShifts:closed,refunds,duplicateSaleGuards:failedDouble,seed:0x20261120}));
