/* Frente de caixa do Potê Batata Pro.
   Movimentações financeiras por turno, recibo NÃO fiscal e comanda. */
import {activeSession,openCash,calculateCash,closeCash,registerCashMovement,
 confirmRecordedPayment,settleDeliveryPayment,paymentConfirmed,paymentKind,orderAmountCents} from "./pdv_cash_core.mjs?v=pdv-20261116";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=x=>Number(x||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=x=>{try{return new Date(x).toLocaleString("pt-BR")}catch{return String(x||"")}};
const id=()=>globalThis.crypto?.randomUUID?.()||("pdv-"+Date.now()+"-"+Math.random().toString(36).slice(2));
const access=()=>!!window.POTE_APP_READY&&!!window.POTE_AUTH?.uid&&
 (window.POTE_AUTH.role==="admin"||window.POTE_AUTH.proActive===true||window.POTE_AUTH.franchiseActive===true);
const snapshot=()=>window.POTE_APP?.snapshot?.()||null;
const status=msg=>{let element=document.getElementById("potePdvMessage");if(element)element.textContent=msg};
let trigger=null,modal=null,visible=false,delay=null;
function ensure(){
 if(trigger)return;
 trigger=document.createElement("button");
 trigger.id="potePdvTrigger";trigger.type="button";
 trigger.innerHTML='<span aria-hidden="true">▣</span><strong>Caixa PDV</strong><small id="potePdvTurn">Fechado</small>';
 trigger.title="Abrir frente de caixa e conferir pagamentos";
 trigger.setAttribute("aria-controls","potePdvDialog");trigger.setAttribute("aria-haspopup","dialog");
 trigger.addEventListener("click",()=>visible?close():open());
 document.body.appendChild(trigger);
 modal=document.createElement("div");
 modal.id="potePdvDialog";modal.hidden=true;
 modal.innerHTML='<section class="pote-pdv-container" role="dialog" aria-modal="true" aria-labelledby="potePdvTitle">'+
 '<header><div><small>GESTÃO + PDV</small><h2 id="potePdvTitle">Caixa e comandas</h2></div>'+
 '<button type="button" data-pdv-action="hide" aria-label="Fechar painel de caixa">✕</button></header>'+
 '<p class="pote-pdv-disclaimer">Registros operacionais. Não confirma Pix/cartão automaticamente e não emite NFC-e. '+
 '<a href="https://www.sef.sc.gov.br/orientacoes/nff-nota-fiscal-facil-mei-microempreendedor-individual" target="_blank" rel="noopener noreferrer">MEI/SC: emissão gratuita pelo aplicativo oficial Nota Fiscal Fácil (quando habilitado)</a>.</p>'+
 '<p id="potePdvMessage" aria-live="polite"></p><div id="potePdvBody"></div></section>';
 document.body.appendChild(modal);
 modal.addEventListener("click",event=>{
  if(event.target===modal)close();
  const button=event.target.closest?.("[data-pdv-action]");if(!button)return;
  event.preventDefault();action(button.dataset.pdvAction,button.dataset.orderId);
 });
 modal.addEventListener("submit",event=>{event.preventDefault();submit(event.target)});
}
function currentSession(){return activeSession(snapshot()?.data)}
function getSessionId(){return access()?currentSession()?.id||null:null}
function editable(){
 if(window.POTE_SYNC_GUARD?.blocked)throw Error("Conflito de sincronização. Resolva antes de movimentar o caixa.");
 if(navigator.onLine===false)throw Error("Sem conexão: não altere movimentações do caixa enquanto estiver offline.");
 if(!access())throw Error("Caixa PDV disponível apenas para conta licenciada.");
}
function mutate(fn){
 editable();
 const state=snapshot();
 if(!state?.data)throw Error("Sessão não inicializada");
 const result=fn(state.data);
 window.POTE_APP.applyState(state,{preserveNavigation:true});
 window.dispatchEvent(new Event("pote:changed"));
 render();
 return result;
}
function textField(label,name,placeholder="",type="text"){
 return '<label>'+esc(label)+'<input type="'+esc(type)+'" name="'+esc(name)+'" placeholder="'+esc(placeholder)+'" required></label>';
}
function render(){
 ensure();
 trigger.hidden=!access();
 const s=currentSession();
 trigger.querySelector("#potePdvTurn").textContent=s?"Aberto":"Fechado";
 trigger.classList.toggle("open",!!s);
 if(!access()){close();return}
 if(!visible)return;
 const data=snapshot()?.data||{orders:[]};
 const body=modal.querySelector("#potePdvBody");
 if(!s){
  body.innerHTML='<div class="pote-pdv-box"><h3>Abrir turno</h3>'+
   '<form id="potePdvOpen" data-pdv-form="open">'+textField("Fundo inicial de troco (R$)","openingCash","Ex.: 100,00")+
   '<button type="submit">Abrir caixa</button></form></div>'+
   '<h3>Últimos turnos</h3>'+sessionHistory(data);
  return;
 }
 const summary=calculateCash(data,s.id);
 const methodNames={cash:"Dinheiro",pix:"Pix",card:"Cartão",delivery:"Na entrega",other:"Outros"};
 const methodRows=Object.entries(summary.confirmedByMethod).map(([key,total])=>
  '<div class="pote-pdv-stat"><span>'+methodNames[key]+'</span><b>'+brl(total)+'</b></div>').join("");
 const recent=(data.orders||[]).filter(o=>o.cashSessionId===s.id).slice(0,40);
 const pending=recent.filter(o=>o.status!=="cancelado"&&!paymentConfirmed(o));
 body.innerHTML='<div class="pote-pdv-box">'+
  '<p class="pote-pdv-session">Turno aberto em '+esc(date(s.openedAt))+' · '+esc(s.operator)+'</p>'+
  '<div class="pote-pdv-figures"><div><small>Dinheiro esperado no caixa</small><strong>'+brl(summary.expectedCash)+'</strong></div>'+
  '<div><small>A receber / sem confirmação</small><strong>'+brl(summary.pending)+'</strong></div></div>'+
  '<div class="pote-pdv-stat"><span>Troco de abertura</span><b>'+brl(summary.openingCash)+'</b></div>'+
  methodRows+
  '<div class="pote-pdv-stat"><span>Suprimentos / Sangrias / Reembolsos</span><b>'+
    brl(summary.supply)+' / '+brl(summary.withdraw)+' / '+brl(summary.refunds)+'</b></div>'+
  (summary.cancelledCashAwaitingRefund>0?
   '<p class="pote-pdv-warn">Pedidos cancelados com dinheiro ainda não reembolsado: '+
   brl(summary.cancelledCashAwaitingRefund)+'. Registre a devolução para baixar o caixa.</p>':'')+
  '<p class="pote-pdv-note">Pix e cartão só entram como confirmados depois de conferência manual; não alteram o dinheiro físico do caixa.</p></div>'+
  '<div class="pote-pdv-box"><h3>Movimentar dinheiro</h3><form data-pdv-form="movement">'+
  '<label>Tipo<select name="kind"><option value="sangria">Sangria (retirada)</option><option value="suprimento">Suprimento (entrada)</option></select></label>'+
  textField("Valor (R$)","amount","Ex.: 50,00")+
  textField("Justificativa","reason","Ex.: retirada para banco")+
  '<button type="submit">Registrar movimentação</button></form></div>'+
  '<div class="pote-pdv-box"><h3>Conferência e fechamento</h3>'+
  '<form data-pdv-form="close">'+textField("Dinheiro contado fisicamente (R$)","countedCash","Ex.: 150,00")+
  '<button type="submit">Fechar caixa e conferir diferença</button></form></div>'+
  '<div class="pote-pdv-box"><h3>Pagamentos aguardando conferência ('+pending.length+')</h3>'+
  (pending.length?pending.map(o=>
    '<div class="pote-pdv-order"><div><strong>#'+esc(String(o.id).slice(-8))+'</strong> · '+esc(o.name)+
    '<small>'+esc(o.paymentMethod)+' · '+brl(orderAmountCents(o)/100)+'</small></div>'+
    (["pix","card"].includes(paymentKind(o.paymentMethod))?
      '<button type="button" data-pdv-action="confirm" data-order-id="'+esc(o.id)+'">Marcar conferido</button>':
      (["delivery","other"].includes(paymentKind(o.paymentMethod))?
       '<button type="button" data-pdv-action="delivery" data-order-id="'+esc(o.id)+'">Registrar recebimento</button>':
       '<span class="pote-pdv-warn">Conferir forma de pagamento</span>'))+'</div>'
  ).join(""):'<p>Sem pagamentos pendentes neste turno.</p>')+'</div>'+
  '<div class="pote-pdv-box"><h3>Comandas e recibos não fiscais</h3>'+
  (recent.length?recent.map(o=>
   '<div class="pote-pdv-order"><div><b>'+esc(o.name)+'</b><small>'+esc(o.status)+' · '+
    brl(orderAmountCents(o)/100)+'</small></div><div class="pote-pdv-actions">'+
   '<button type="button" data-pdv-action="kitchen" data-order-id="'+esc(o.id)+'">Cozinha</button>'+
   '<button type="button" data-pdv-action="receipt" data-order-id="'+esc(o.id)+'">Recibo</button>'+
   (o.status==="cancelado"&&paymentKind(o.paymentMethod)==="cash"&&paymentConfirmed(o)&&
    !(data.cashMovements||[]).some(m=>m.kind==="reembolso"&&m.orderId===o.id)?
    '<button type="button" data-pdv-action="refund" data-order-id="'+esc(o.id)+'">Devolver dinheiro</button>':"")+
   '</div></div>').join(""):'<p>Nenhum pedido vinculado a este turno.</p>')+'</div>'+
  '<h3>Histórico</h3>'+sessionHistory(data);
}
function sessionHistory(data){
 const past=(data.cashSessions||[]).filter(s=>s.status==="closed").slice(0,8);
 return past.length?past.map(s=>
  '<div class="pote-pdv-history"><strong>'+esc(date(s.openedAt))+'</strong>'+
  ' · esperado '+brl(s.expectedCash)+' · contado '+brl(s.countedCash)+
  ' · diferença <b>'+brl(s.difference)+'</b></div>').join(""):'<p>Sem turnos encerrados.</p>';
}
function submit(form){
 try{
  const payload=Object.fromEntries(new FormData(form).entries());
  const type=form.dataset.pdvForm;
  if(type==="open"){
   const operator=window.POTE_AUTH?.email||"Operador";
   mutate(data=>openCash(data,{id:id(),operator,openingCash:parseMoney(payload.openingCash)}));
   status("Caixa aberto. Valores são registros operacionais, não comprovantes bancários.");
  }else if(type==="movement"){
   const movement=mutate(data=>registerCashMovement(data,{
    id:id(),kind:payload.kind,amount:parseMoney(payload.amount),reason:payload.reason}));
   status("Movimentação "+movement.kind+" registrada: "+brl(movement.amount));
  }else if(type==="close"){
   const data=snapshot()?.data;
   const s=activeSession(data);
   const report=calculateCash(data,s.id);
   const counted=parseMoney(payload.countedCash);
   if(!window.confirm("Fechar o caixa? Dinheiro esperado: "+brl(report.expectedCash)+
    ". Conferido: "+brl(counted)+". A diferença ficará registrada no histórico."))return;
   const result=mutate(d=>closeCash(d,{countedCash:counted,operator:window.POTE_AUTH?.email}));
   status("Turno encerrado. Diferença: "+brl(result.difference));
  }
 }catch(error){status(error.message)}
}
function parseMoney(value){
 const clean=String(value??"").trim().replace(/\s/g,"").replace(/^R\$/i,"");
 const normal=clean.includes(",")?clean.replace(/\./g,"").replace(",","."):clean;
 const amount=Number(normal);
 if(!/^\d+(?:\.\d{1,2})?$/.test(normal)||!Number.isFinite(amount)||amount<0)
  throw Error("Valor monetário inválido (use 0,00)");
 return amount;
}
function action(name,orderId){
 if(name==="hide"){close();return}
 const data=snapshot()?.data,order=data?.orders?.find(x=>x.id===orderId);
 if(!order)return;
 if(name==="kitchen"||name==="receipt"){
  try{printOrder(order,{kitchen:name==="kitchen",brand:data?.brand?.name})}
  catch(error){status(error.message)}
  return;
 }
 try{
  if(name==="delivery"){
   const selected=window.prompt("Recebido na entrega: escolha dinheiro, Pix ou cartão:","Pix");
   if(selected===null)return;
   const kind=paymentKind(selected);
   if(!["cash","pix","card"].includes(kind))throw Error("Forma inválida: dinheiro, Pix ou cartão");
   if(!window.confirm("Você recebeu "+brl(orderAmountCents(order)/100)+" via "+selected+
    " e conferiu o pagamento?"))return;
   const reference=kind==="cash"?"pagamento em espécie":
     window.prompt("Informe a referência do comprovante confirmado:");
   if(reference===null)return;
   mutate(d=>settleDeliveryPayment(d,{orderId,method:selected,reference}));
   status("Pagamento na entrega registrado após conferência manual.");
  }else if(name==="confirm"){
   if(!window.confirm("Você conferiu esse "+esc(paymentKind(order.paymentMethod))+
    " no comprovante do banco ou da operadora? O aplicativo NÃO verificou o pagamento automaticamente."))return;
   const reference=window.prompt("Informe uma referência da conferência (código da transação, quatro últimos dígitos ou observação):");
   if(reference===null)return;
   mutate(d=>confirmRecordedPayment(d,{orderId,reference}));
   status("Pagamento registrado como conferido MANUALMENTE.");
  }else if(name==="refund"){
   if(!window.confirm("Você realmente DEVOLVEU "+brl(orderAmountCents(order)/100)+
    " em dinheiro ao cliente? Esta ação não transfere dinheiro."))return;
   mutate(d=>registerCashMovement(d,{id:id(),kind:"reembolso",
     amount:orderAmountCents(order)/100,orderId}));
   status("Devolução física de dinheiro registrada.");
  }
 }catch(error){status(error.message)}
}
function ticketHtml(order,{kitchen=false,brand}={}){
 const rows=(order.items||[]).map(item=>{
  const qty=Number(item.g)||0;
  const amount=qty*(Number(order.qty)||1);
  return '<li>'+esc(item.ingredientName||item.addonName||item.id)+
    (qty>0?' — '+esc(amount.toLocaleString("pt-BR"))+' '+esc(item.measureUnit||"g"):"")+'</li>';
 }).join("");
 const drinks=(order.beverageItems||[]).map(item=>
  '<li>'+esc(item.name||item.id)+' — '+esc((Number(item.qty)||0)*(Number(order.qty)||0))+' un</li>').join("");
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
  '<title>'+(kitchen?'Comanda de cozinha':'Recibo não fiscal')+'</title>'+
  '<style>@page{size:80mm auto;margin:4mm}body{font:12px Arial,sans-serif;width:70mm;color:black}'+
  'h1{font-size:16px}hr{border:none;border-top:1px dashed #777}ul{padding-left:16px}'+
  'li{margin:3px 0}.stamp{text-align:center;border:2px solid black;padding:6px;margin:8px 0}'+
  '@media screen{body{margin:30px auto;box-shadow:0 0 0 1px #ccc;padding:14px}}</style></head><body>'+
  '<h1>'+esc(brand||"Potê Batata")+'</h1>'+
  '<div class="stamp">'+(kitchen?'COMANDA INTERNA — COZINHA':'COMPROVANTE NÃO FISCAL')+'</div>'+
  '<p><b>Pedido #'+esc(order.id)+'</b><br>'+esc(date(order.createdAt||order.date))+'</p><hr>'+
  '<p><b>'+esc(order.qty)+' × '+esc(order.name)+'</b></p><ul>'+rows+drinks+'</ul>'+
  (order.note?'<p><b>Observações:</b> '+esc(order.note)+'</p>':"")+
  (order.clientName?'<p><b>Cliente:</b> '+esc(order.clientName)+'</p>':"")+
  (kitchen?'':('<hr><p>Total: <b>'+brl(orderAmountCents(order)/100)+
   '</b><br>Pagamento: '+esc(order.paymentMethod||"não informado")+
   '<br>Status de pagamento: '+esc(order.paymentStatus||"não confirmado")+'</p>'+
   '<p>Não substitui NFC-e, NF-e ou outro documento fiscal exigido.</p>'))+
  '<script>window.addEventListener("load",()=>window.print())<\/script></body></html>';
}
function printOrder(order,options){
 const popup=window.open("","_blank");
 if(!popup)throw Error("O navegador bloqueou a impressão. Autorize pop-ups para esta página.");
 popup.document.open();popup.document.write(ticketHtml(order,options));popup.document.close();
 return true;
}
function open(){
 if(!access())return;
 ensure();visible=true;modal.hidden=false;render();
 modal.querySelector('button[data-pdv-action="hide"]')?.focus();
}
function close(){visible=false;if(modal)modal.hidden=true}
function refresh(){ensure();render()}
for(const event of ["pote:user-ready","pote:changed","pote:license-updated","pote:user-logout"])
 window.addEventListener(event,()=>{
  clearTimeout(delay);delay=setTimeout(refresh,120);
 });
window.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&visible)close()});
ensure();refresh();
window.POTE_PDV={open,close,refresh,getSessionId,currentSession,printOrder,ticketHtml};
