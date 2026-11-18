/* Frente de caixa do Potê Batata Pro.
   Movimentações financeiras por turno, recibo NÃO fiscal e comanda. */
import {activeSession,openCash,calculateCash,closeCash,registerCashMovement,
 confirmRecordedPayment,settleDeliveryPayment,settlePreviousPayment,confirmPaymentOnSaleCompletion,listOutstandingPrevious,paymentConfirmed,paymentKind,orderAmountCents} from "./pdv_cash_core.mjs?v=sale-done-auto-20261118";
import {summarizePdvReceipts,countCashDifference} from "./pdv_cash_summary.mjs";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=x=>Number(x||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=x=>{try{return new Date(x).toLocaleString("pt-BR")}catch{return String(x||"")}};
const id=()=>globalThis.crypto?.randomUUID?.()||("pdv-"+Date.now()+"-"+Math.random().toString(36).slice(2));
const access=()=>!!window.POTE_APP_READY&&!!window.POTE_AUTH?.uid&&
 (window.POTE_AUTH.role==="admin"||window.POTE_AUTH.proActive===true||window.POTE_AUTH.franchiseActive===true);
const snapshot=()=>window.POTE_APP?.snapshot?.()||null;
const status=msg=>{let element=document.getElementById("potePdvMessage");if(element)element.textContent=msg};
let trigger=null,modal=null,visible=false,delay=null,lastModalFingerprint=null;
const expandedCashDetails=new Set();
let movementEditorKind=null;
function ensure(){
 if(trigger){if(!trigger.isConnected)document.body.appendChild(trigger);return}
 trigger=document.createElement("button");
 trigger.id="potePdvTrigger";trigger.type="button";
 trigger.innerHTML='<span aria-hidden="true">▣</span><strong>PDV</strong><small id="potePdvTurn">Fechado</small>';
 trigger.title="Abrir frente de caixa e conferir pagamentos";
 trigger.setAttribute("aria-controls","potePdvDialog");trigger.setAttribute("aria-haspopup","dialog");
 trigger.addEventListener("click",()=>visible?close():open());
 document.body.appendChild(trigger);
 modal=document.createElement("div");
 modal.id="potePdvDialog";modal.hidden=true;
 modal.innerHTML='<section class="pote-pdv-container" role="dialog" aria-modal="true" aria-labelledby="potePdvTitle">'+
 '<header><div><small>CONTROLE DE VENDAS</small><h2 id="potePdvTitle">Meu caixa PDV</h2></div>'+
 '<button type="button" data-pdv-action="hide" aria-label="Fechar painel de caixa">✕</button></header>'+
 '<p id="potePdvMessage" aria-live="polite"></p><div id="potePdvBody"></div>'+
 '<details class="pote-pdv-disclaimer-details"><summary>Sobre comprovantes e documentos fiscais</summary>'+
 '<p>Este PDV é um registro operacional, não verifica Pix/cartão automaticamente e não emite NFC-e. '+
 '<a href="https://www.sef.sc.gov.br/orientacoes/nff-nota-fiscal-facil-mei-microempreendedor-individual" target="_blank" rel="noopener noreferrer">MEI/SC: veja a emissão gratuita pelo Nota Fiscal Fácil, quando habilitado</a>.</p></details></section>';
 document.body.appendChild(modal);
 modal.addEventListener("click",event=>{
  if(event.target===modal){close();return}
  const summary=event.target.closest?.('details[data-pdv-detail] > summary');
  if(summary&&modal.contains(summary)){
   event.preventDefault();event.stopPropagation();
   const detail=summary.parentElement,key=detail.dataset.pdvDetail;
   const opening=!expandedCashDetails.has(key);
   if(opening)expandedCashDetails.add(key);else expandedCashDetails.delete(key);
   detail.open=opening;
   summary.setAttribute("aria-expanded",String(opening));
   if(opening)requestAnimationFrame(()=>revealCashSection(detail));
   return;
  }
  const button=event.target.closest?.("[data-pdv-action]");if(!button)return;
  event.preventDefault();event.stopPropagation();
  action(button.dataset.pdvAction,button.dataset.orderId);
 });
 modal.addEventListener("submit",event=>{event.preventDefault();submit(event.target)});
 modal.addEventListener("input",event=>{if(event.target?.name==="countedCash")updateCountPreview(event.target.value)});
}
function completeSalePayment(order,data){
 if(!access()||!order||!data)return null;
 if(window.POTE_SYNC_GUARD?.blocked)throw Error("Sincronização bloqueada: não registre uma venda antes de resolver o conflito.");
 return confirmPaymentOnSaleCompletion(data,{
  orderId:order.id,operator:window.POTE_AUTH?.email||"Operador",at:new Date().toISOString()
 });
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
 const isAmount=type==="money"||["openingCash","countedCash","amount"].includes(name);
 const inputType=isAmount?"text":type;
 return '<label>'+esc(label)+'<input type="'+esc(inputType)+'" name="'+esc(name)+'" placeholder="'+esc(placeholder)+'"'+
  (isAmount?' inputmode="decimal" enterkeyhint="done" autocomplete="off" data-numeric="decimal"':'')+
  ' required></label>';
}
function receiptChart(receipts){
 const methods=[
  {key:"cash",label:"Dinheiro",hint:"Recebido em espécie",className:"cash"},
  {key:"pix",label:"Pix",hint:"Comprovantes confirmados",className:"pix"},
  {key:"card",label:"Cartão",hint:"Transações confirmadas",className:"card"}
 ];
 const max=Math.max(1,Number(receipts.gross)||0);
 return '<div class="pote-pdv-chart" aria-label="Gráfico de recebimentos confirmados por forma de pagamento">'+
  methods.map(m=>{
   const value=Number(receipts[m.key]||0);
   const width=Math.max(0,Math.min(100,value/max*100));
   const share=receipts.gross>0?(100*value/receipts.gross).toFixed(1).replace(".",","):"0,0";
   return '<div class="pote-pdv-chart-row '+m.className+'"><div class="pote-pdv-chart-caption">'+
     '<span><i aria-hidden="true"></i><b>'+m.label+'</b><small>'+m.hint+'</small></span>'+
     '<strong>'+brl(value)+' <em class="pote-pdv-chart-share">('+share+'%)</em></strong></div>'+
     '<div class="pote-pdv-chart-track" role="progressbar" aria-label="'+m.label+
     '" aria-valuemin="0" aria-valuemax="'+Math.max(1,receipts.gross)+'" aria-valuenow="'+value+
     '"><div class="pote-pdv-chart-fill" style="width:'+width.toFixed(2)+'%"></div></div></div>';
  }).join("")+
  '<p class="pote-pdv-note">O gráfico usa apenas recebimentos <strong>confirmados</strong> neste turno, incluindo pagamentos antigos recebidos hoje. Comprovantes Pix e cartão não são dinheiro da gaveta.</p></div>';
}
function cashEquation(summary){
 const prev=summary.previousByMethod||{};
 const items=[
  ["Troco inicial",summary.openingCash,"+"],
  ["Vendas em dinheiro",summary.confirmedByMethod?.cash||0,"+"],
  ["Dinheiro recebido de outros turnos",prev.cash||0,"+"],
  ["Entradas extras (suprimento)",summary.supply,"+"],
  ["Retirada (sangria)",summary.withdraw,"−"],
  ["Dinheiro devolvido ao cliente",summary.refunds,"−"]
 ];
 return '<div class="pote-pdv-equation" aria-label="Cálculo do dinheiro esperado">'+
  items.map(([label,val,sign])=>'<div><span>'+label+'</span><strong>'+sign+' '+brl(val)+'</strong></div>').join("")+
  '<div class="pote-pdv-equation-total"><b>DINHEIRO QUE DEVE ESTAR NA GAVETA</b><strong>'+brl(summary.expectedCash)+'</strong></div></div>';
}
function lastClosedSession(data){
 return [...(data.cashSessions||[])].filter(x=>x.status==="closed").sort((a,b)=>
  Date.parse(b.closedAt||b.openedAt||0)-Date.parse(a.closedAt||a.openedAt||0))[0]||null;
}
function reportForDisplay(data,session){
 if(!session)return {
  openingCash:0,expectedCash:0,expectedCashCents:0,pending:0,pendingCount:0,
  confirmedByMethod:{cash:0,pix:0,card:0},previousByMethod:{cash:0,pix:0,card:0}
 };
 return calculateCash(data,session.id);
}
function renderPage(){
 const data=snapshot()?.data||{orders:[],cashSessions:[],cashMovements:[]};
 const active=activeSession(data);
 const last=active?null:lastClosedSession(data);
 if(!access())return '<section class="pote-pdv-page" id="potePdvPage">'+
  '<div class="pote-pdv-page-heading"><small>CAIXA PDV</small><h2>Seu caixa, sem complicação</h2>'+
  '<p>Para abrir e conferir caixa, entre com uma conta com acesso Pro ou administrativo.</p></div></section>';
 const reference=active||last;
 const summary=reportForDisplay(data,reference);
 const receipts=summarizePdvReceipts(summary);
 const label=active?"Turno em andamento":last?"Último caixa fechado":"Nenhum caixa registrado";
 const dateLabel=reference?esc(date(active?reference.openedAt:reference.closedAt||reference.openedAt)):"";
 const extra=active?
  '<div class="pote-pdv-page-foot"><span>Dinheiro que deverá estar na gaveta</span><strong>'+brl(summary.expectedCash)+'</strong></div>'+
  '<div class="pote-pdv-page-foot"><span>Pagamentos ainda pendentes</span><strong>'+brl(receipts.pending)+'</strong></div>':
  last?'<div class="pote-pdv-page-foot"><span>Dinheiro esperado no fechamento</span><strong>'+brl(last.expectedCash)+'</strong></div>'+
    '<div class="pote-pdv-page-foot"><span>Dinheiro contado no fechamento</span><strong>'+brl(last.countedCash)+'</strong></div>'+
    '<div class="pote-pdv-page-foot"><span>Diferença registrada</span><strong>'+brl(last.difference)+'</strong></div>':
    '<p class="pote-pdv-note">Os valores ainda estão zerados porque nenhum turno foi aberto. Abra o caixa e registre suas vendas para preencher o gráfico.</p>';
 return '<section class="pote-pdv-page" id="potePdvPage" aria-label="Relatório do Caixa PDV">'+
  '<div class="pote-pdv-page-heading"><small>CONTROLE DE VENDAS</small><h2>Caixa PDV</h2>'+
  '<p>Veja quanto entrou em dinheiro, Pix e cartão, e quanto deve haver na gaveta ao fechar.</p>'+
  (active?.autoStarted?'<p class="pote-pdv-note">Este caixa foi iniciado automaticamente com <strong>R$ 0,00</strong> de troco. Se já havia dinheiro na gaveta, registre um suprimento para que o fechamento fique correto.</p>':'')+
  '<div class="pote-pdv-page-status '+(active?'running':'stopped')+'">'+
  '<strong>'+(active?'● ABERTO':'● FECHADO')+'</strong><span>'+label+(dateLabel?' · '+dateLabel:'')+'</span></div></div>'+
  '<div class="pote-pdv-page-summary"><small>Total de recebimentos confirmados</small>'+
  '<strong>'+brl(receipts.gross)+'</strong>'+
  '<p>Somatório do dinheiro recebido, Pix confirmado e cartão confirmado. Não inclui pagamentos pendentes.</p></div>'+
  '<div class="pote-pdv-page-chart"><h3>Entradas por forma de pagamento</h3>'+
  receiptChart(receipts)+'</div>'+
  '<div class="pote-pdv-page-equation">'+extra+'</div>'+
  (active?'<div class="pote-pdv-page-cash-actions" aria-label="Movimentações de dinheiro do caixa">'+
   '<button type="button" class="pote-pdv-page-withdraw" onclick="window.POTE_PDV.openMovement(&quot;sangria&quot;)">Retirada / Sangria</button>'+
   '<button type="button" class="pote-pdv-page-supply" onclick="window.POTE_PDV.openMovement(&quot;suprimento&quot;)">Reforço / Suprimento</button></div>':'')+
  '<div class="pote-pdv-page-controls"><button type="button" class="pote-pdv-page-action" onclick="window.POTE_PDV?.open?.()">'+
  (active?'Conferir recebimentos e fechar caixa':last?'Abrir novo caixa ou consultar histórico':'Abrir meu primeiro caixa')+
  '</button><button type="button" class="pote-pdv-page-secondary" onclick="goOrdersSection(\'new\')">Registrar novo pedido</button></div>'+
  '<p class="pote-pdv-page-help">Como funciona: 1. Abra o caixa com o dinheiro para troco. 2. Registre vendas. '+
  '3. Confira Pix/cartão e marque o recebimento. 4. Conte notas e moedas para fechar o turno.</p></section>';
}
function refreshPage(){
 const el=document.getElementById("potePdvPage");
 if(!el)return;
 if(el.contains(document.activeElement)&&document.activeElement?.matches?.("input,textarea,select,[contenteditable=true]"))return;
 const wrapper=document.createElement("div");
 wrapper.innerHTML=renderPage();
 const next=wrapper.firstElementChild;
 if(!next||el.innerHTML===next.innerHTML)return;
 el.replaceWith(next);
}
/* An unrelated app autosave must NOT recreate an expanded <details> in the
   cashier. Browser-native open state belongs to the user until they tap it. */
function captureCashDetails(body){return new Set(expandedCashDetails)}
function updateMovementPanel(){
 const panel=modal?.querySelector?.("#potePdvMovementEditor");
 if(!panel)return;
 panel.hidden=!movementEditorKind;
 const kind=panel.querySelector?.('input[name="kind"]');
 if(kind)kind.value=movementEditorKind||"sangria";
 const title=panel.querySelector?.("#potePdvMovementTitle");
 if(title)title.textContent=movementEditorKind==="suprimento"?
  "Adicionar troco / suprimento":"Registrar retirada / sangria";
}
function revealCashSection(section){
 const scroller=modal?.querySelector?.("#potePdvBody");
 if(!scroller||!section?.getBoundingClientRect)return;
 const bounds=section.getBoundingClientRect(),parent=scroller.getBoundingClientRect();
 const delta=bounds.top-parent.top-12;
 if(delta>0||bounds.top<parent.top+8)
  scroller.scrollTop=Math.max(0,scroller.scrollTop+delta);
}
function restoreCashDetails(body,openDetails,scrollY){
 for(const item of body.querySelectorAll?.('details[data-pdv-detail]')||[]){
  item.open=openDetails.has(item.dataset.pdvDetail);
  item.querySelector?.("summary")?.setAttribute?.("aria-expanded",String(item.open));
 }
 if(scrollY!==null&&Number.isFinite(scrollY))body.scrollTop=scrollY;
 updateMovementPanel();
}
function fingerprintCash(data,session){
 return JSON.stringify([
  window.POTE_AUTH?.uid||'',session?.id||null,session?.status||null,
  data.cashSessions||[],data.cashMovements||[],data.orders||[]
 ]);
}
function render(){
 ensure();
 const heading=document.querySelector(".ops-heading");
 if(heading&&trigger.parentElement!==heading)heading.appendChild(trigger);
 else if(!heading&&trigger.parentElement!==document.body)document.body.appendChild(trigger);
 trigger.hidden=!access()||!heading;
 const s=currentSession();
 trigger.querySelector("#potePdvTurn").textContent=s?"Aberto":"Fechado";
 trigger.classList.toggle("open",!!s);
 trigger.setAttribute("aria-label","Caixa PDV "+(s?"aberto":"fechado")+". Abrir frente de caixa");
 trigger.title="Caixa PDV "+(s?"aberto":"fechado")+" — Ver turno e pagamentos";
 if(!access()){close();return}
 if(!visible)return;
 const data=snapshot()?.data||{orders:[]};
 const body=modal.querySelector("#potePdvBody");
 const nextFingerprint=fingerprintCash(data,s);
 if(nextFingerprint===lastModalFingerprint)return; // No data change: leave details and forms intact.
 const openedDetails=captureCashDetails(body);
 const scroller=body;
 const scrollY=scroller?.scrollTop??null;
 lastModalFingerprint=nextFingerprint;
 if(!s){
  const latest=lastClosedSession(data);
  const last=latest?'<div class="pote-pdv-last"><strong>Último fechamento</strong>'+
   '<span>Esperado: '+brl(latest.expectedCash)+' · Contado: '+brl(latest.countedCash)+'</span>'+
   '<span>Diferença: '+brl(latest.difference)+'</span></div>':"";
  body.innerHTML=
   '<section class="pote-pdv-intro"><span class="pote-pdv-step">PASSO 1 DE 4</span>'+
   '<h3>Vamos começar o dia?</h3><p>Primeiro, conte o dinheiro que já está na gaveta para dar troco. '+
   'Não inclua Pix, cartão ou o dinheiro que está no banco.</p></section>'+
   '<section class="pote-pdv-box"><h3>1. Abrir o caixa</h3>'+
   '<form id="potePdvOpen" data-pdv-form="open">'+
   textField("Dinheiro inicial para troco (R$)","openingCash","Ex.: 100,00")+
   '<p class="pote-pdv-note">Se a gaveta estiver vazia, digite 0,00.</p>'+
   '<button type="submit" class="pote-pdv-primary">Abrir caixa e começar</button></form></section>'+
   last+'<details class="pote-pdv-details" data-pdv-detail="closed-history"><summary>Consultar fechamentos anteriores</summary>'+
   sessionHistory(data)+'</details>'+
   '<section class="pote-pdv-box"><div class="pote-pdv-box-header"><span class="pote-pdv-step">RELATÓRIO DO PDV</span>'+
   '<h3>Recebimentos do '+(latest?'último caixa':'primeiro caixa')+'</h3>'+
   '<p>'+(latest?'Valores do último turno fechado, separados por forma de pagamento.':
   'O gráfico começa em zero e será preenchido quando houver vendas confirmadas.')+'</p></div>'+
   receiptChart(summarizePdvReceipts(reportForDisplay(data,latest)))+'</section>';
  restoreCashDetails(body,openedDetails,scrollY);
  return;
 }
 const summary=calculateCash(data,s.id);
 const receipts=summarizePdvReceipts(summary);
 const all=(data.orders||[]).filter(o=>o.cashSessionId===s.id);
 const recent=all.slice(0,40);
 const pending=all.filter(o=>o.status!=="cancelado"&&!paymentConfirmed(o));
 const overdue=listOutstandingPrevious(data).slice(0,40);
 const count=Number(pending.length+overdue.length);
 const pendingList=pending.length?pending.map(o=>{
  const kind=paymentKind(o.paymentMethod);
  const label=kind==="pix"?"Pix":kind==="card"?"Cartão":kind==="cash"?"Dinheiro":kind==="delivery"?"Na entrega":"Outro";
  const button=kind==="pix"||kind==="card"?
   '<button type="button" data-pdv-action="confirm" data-order-id="'+esc(o.id)+'">Confirmar recebimento</button>':
   kind==="delivery"||kind==="other"?
   '<button type="button" data-pdv-action="delivery" data-order-id="'+esc(o.id)+'">Confirmar recebimento</button>':
   '<span class="pote-pdv-warn">Verificar dinheiro recebido</span>';
  return '<div class="pote-pdv-order"><div><strong>'+esc(o.name)+'</strong>'+
    '<small>Pedido #'+esc(String(o.id).slice(-8))+' · '+label+' · '+brl(orderAmountCents(o)/100)+'</small>'+
    '<span class="pote-pdv-pending-status">Aguardando recebimento</span></div>'+button+'</div>';
 }).join(""):'<p class="pote-pdv-ok">Nenhum pagamento pendente deste turno.</p>';
 const pastList=overdue.length?overdue.map(o=>
  '<div class="pote-pdv-order"><div><strong>'+esc(o.name)+'</strong>'+
  '<small>Pedido anterior #'+esc(String(o.id).slice(-8))+' · '+brl(orderAmountCents(o)/100)+'</small></div>'+
  '<button type="button" data-pdv-action="late" data-order-id="'+esc(o.id)+'">Confirmar recebimento</button></div>'
 ).join(""):'<p class="pote-pdv-ok">Sem pagamentos antigos pendentes.</p>';
 const figures='<div class="pote-pdv-kpis">'+
  '<div class="pote-pdv-kpi receipts"><small>Recebimentos confirmados</small><strong>'+brl(receipts.gross)+
  '</strong><span>Dinheiro + Pix + cartão, incluindo pagamentos antigos recebidos neste turno. Valor bruto registrado.</span></div>'+
  '<div class="pote-pdv-kpi drawer"><small>Dinheiro esperado na gaveta</small><strong>'+brl(summary.expectedCash)+
  '</strong><span>É este valor que você deverá contar ao fechar.</span></div>'+
  '<div class="pote-pdv-kpi pending"><small>Ainda falta confirmar</small><strong>'+brl(receipts.pending)+
  '</strong><span>'+summary.pendingCount+' pagamento'+(summary.pendingCount===1?'':'s')+' do turno aguardando conferência.</span></div></div>';
 body.innerHTML=
  '<div class="pote-pdv-intro"><span class="pote-pdv-step">CAIXA ABERTO · PASSOS 2, 3 E 4</span>'+
  '<h3>Seu caixa está funcionando</h3><p>Você abriu o turno em '+esc(date(s.openedAt))+'. '+
  'As vendas entram no relatório automaticamente. Confira os pagamentos e depois conte a gaveta para fechar.</p></div>'+
  figures+
  '<section class="pote-pdv-box"><div class="pote-pdv-box-header"><span class="pote-pdv-step">PASSO 2</span>'+
  '<h3>Veja quanto entrou em cada meio</h3><p>O gráfico soma somente pagamentos registrados como recebidos.</p></div>'+
  receiptChart(receipts)+
  (receipts.refunds>0?'<p class="pote-pdv-note">Reembolsos em dinheiro: '+brl(receipts.refunds)+'. Total líquido registrado após esses reembolsos: <strong>'+brl(receipts.netRecorded)+'</strong>.</p>':'')+
  (receipts.unclassified>0?'<p class="pote-pdv-warn">Existem '+brl(receipts.unclassified)+' de pagamentos classificados como outros. Confira a forma de pagamento.</p>':'')+
  '</section>'+
  '<section class="pote-pdv-box pote-pdv-pending"><div class="pote-pdv-box-header"><span class="pote-pdv-step">PASSO 3</span>'+
  '<h3>Confirme os pagamentos <span class="pote-pdv-count">'+count+'</span></h3>'+
  '<p>Ao tocar em <strong>Concluir</strong> no pedido, o pagamento em dinheiro, Pix ou cartão entra automaticamente no relatório, sem mais nenhuma ação. Os itens abaixo são pedidos ainda não concluídos ou pendências antigas.</p></div>'+
  pendingList+
  (overdue.length?'<details class="pote-pdv-details" data-pdv-detail="old-receivables"><summary>Ver '+overdue.length+
     ' recebimento(s) de turnos antigos</summary><p class="pote-pdv-note">Após conferir, eles entram no total de hoje sem mudar o fechamento anterior.</p>'+pastList+'</details>':'')+
  '</section>'+
   '<section class="pote-pdv-box pote-pdv-cash-tools" data-pdv-detail="movements">'+
   '<div class="pote-pdv-box-header"><span class="pote-pdv-step">MOVIMENTAÇÃO DO CAIXA</span>'+
   '<h3>Retirada e reforço de dinheiro</h3>'+
   '<p>Registre o dinheiro físico que sai ou entra na gaveta. Pix e cartão não são sangria.</p></div>'+
   '<div class="pote-pdv-quick-actions">'+
   '<button type="button" data-pdv-action="withdraw" class="pote-pdv-quick-withdraw">− Retirada / Sangria</button>'+
   '<button type="button" data-pdv-action="supply" class="pote-pdv-quick-supply">+ Reforço / Suprimento</button></div>'+
   '<div class="pote-pdv-movement-editor" id="potePdvMovementEditor" hidden>'+
   '<h3 id="potePdvMovementTitle">Registrar retirada / sangria</h3>'+
   '<form data-pdv-form="movement"><input type="hidden" name="kind" value="sangria">'+
   textField("Valor em dinheiro (R$)","amount","Ex.: 50,00")+
   textField("Motivo obrigatório","reason","Ex.: depósito bancário")+
   '<div class="pote-pdv-movement-buttons"><button type="submit" class="pote-pdv-primary">Salvar movimentação</button>'+
   '<button type="button" data-pdv-action="cancel-movement" class="pote-pdv-movement-cancel">Cancelar</button></div></form></div>'+
   '<p class="pote-pdv-note">O saldo da gaveta será atualizado; a movimentação ficará registrada no turno.</p></section>'+
  '<section class="pote-pdv-box pote-pdv-closing"><div class="pote-pdv-box-header"><span class="pote-pdv-step">PASSO 4</span>'+
  '<h3>Conferir e fechar o caixa</h3>'+
  '<p>Conte somente <strong>notas e moedas</strong>. Pix e cartão aparecem no relatório acima, mas não ficam na gaveta.</p></div>'+
  '<div class="pote-pdv-check-number"><small>DINHEIRO QUE DEVE TER NA GAVETA</small>'+
  '<strong>'+brl(summary.expectedCash)+'</strong></div>'+
  '<details class="pote-pdv-details" data-pdv-detail="cash-equation"><summary>Entenda de onde veio esse valor</summary>'+
  cashEquation(summary)+'</details>'+
  (summary.cancelledCashAwaitingRefund>0?
   '<p class="pote-pdv-warn">Atenção: '+brl(summary.cancelledCashAwaitingRefund)+
   ' de pedidos cancelados e pagos em dinheiro ainda aguardam reembolso registrado.</p>':'')+
  '<form data-pdv-form="close">'+textField("Quanto você contou em notas e moedas? (R$)","countedCash","Ex.: 150,00")+
  '<div class="pote-pdv-difference" id="potePdvCountPreview" role="status" aria-live="polite">'+
  'Digite o dinheiro contado acima para ver se há sobra ou falta antes de fechar.</div>'+
  '<button type="submit" class="pote-pdv-primary">Conferir e fechar caixa</button></form>'+
  '<p class="pote-pdv-note">A diferença ficará no histórico. Fechar o turno não confirma nem cobra pagamentos pendentes.</p></section>'+
  '<details class="pote-pdv-details" data-pdv-detail="receipts"><summary>Comandas e recibos não fiscais · '+recent.length+
  ' pedido(s) mostrado(s)</summary>'+
  (recent.length?recent.map(o=>
   '<div class="pote-pdv-order"><div><b>'+esc(o.name)+'</b><small>'+esc(o.status)+' · '+
    brl(orderAmountCents(o)/100)+'</small></div><div class="pote-pdv-actions">'+
   '<button type="button" data-pdv-action="kitchen" data-order-id="'+esc(o.id)+'">Cozinha</button>'+
   '<button type="button" data-pdv-action="receipt" data-order-id="'+esc(o.id)+'">Recibo</button>'+
   (o.status==="cancelado"&&paymentKind(o.paymentMethod)==="cash"&&paymentConfirmed(o)&&
    !(data.cashMovements||[]).some(m=>m.kind==="reembolso"&&m.orderId===o.id)?
    '<button type="button" data-pdv-action="refund" data-order-id="'+esc(o.id)+'">Devolver dinheiro</button>':"")+
   '</div></div>').join(""):'<p>Nenhum pedido vinculado ao turno.</p>')+'</details>'+
  '<details class="pote-pdv-details" data-pdv-detail="closed-history"><summary>Histórico de caixas já fechados</summary>'+
  sessionHistory(data)+'</details>';
 restoreCashDetails(body,openedDetails,scrollY);
}
function sessionHistory(data){
 const past=(data.cashSessions||[]).filter(s=>s.status==="closed").slice(0,8);
 return past.length?past.map(s=>{
  const details=s.closedSummary?summarizePdvReceipts(s.closedSummary):null;
  const methods=details?
   '<div class="pote-pdv-history-methods"><span>Dinheiro recebido '+brl(details.cash)+'</span>'+
   '<span>Pix confirmado '+brl(details.pix)+'</span><span>Cartão confirmado '+brl(details.card)+'</span>'+
   '<strong>Total recebido '+brl(details.gross)+'</strong></div>':
   '<p class="pote-pdv-note">Turno antigo sem detalhamento de pagamentos.</p>';
  const difference=Number(s.difference||0);
  return '<div class="pote-pdv-history"><strong>'+esc(date(s.openedAt))+'</strong>'+
   '<div>Dinheiro esperado: '+brl(s.expectedCash)+' · Contado: '+brl(s.countedCash)+'</div>'+
   '<div>Diferença: <b>'+brl(difference)+'</b> · '+(difference===0?'Caixa certo':difference>0?'Sobrou dinheiro':'Faltou dinheiro')+'</div>'+
   methods+'</div>';
 }).join(""):'<p>Sem turnos encerrados.</p>';
}
function updateCountPreview(raw){
 const el=document.getElementById("potePdvCountPreview");
 if(!el)return;
 const session=currentSession();
 if(!session)return;
 if(!String(raw??"").trim()){
  el.textContent="Digite quanto você contou em notas e moedas para conferir a diferença.";
  el.dataset.result="waiting";return;
 }
 try{
  const counted=parseMoney(raw);
  const report=calculateCash(snapshot()?.data,session.id);
  const difference=countCashDifference(report,counted);
  el.dataset.result=difference.status;
  el.innerHTML='<span>Esperado: <b>'+brl(difference.expected)+'</b> · Você contou: <b>'+brl(difference.counted)+
  '</b></span><strong>'+difference.label+(difference.status!=="certo"?': '+brl(Math.abs(difference.difference)):'')+'</strong>';
 }catch(error){el.dataset.result="invalid";el.textContent="Confira o valor digitado. Exemplo: 150,00."}
}
function submit(form){
 try{
  const payload=Object.fromEntries(new FormData(form).entries());
  const type=form.dataset.pdvForm;
  if(type==="open"){
   const operator=window.POTE_AUTH?.email||"Operador";
   mutate(data=>openCash(data,{id:id(),operator,openingCash:parseMoney(payload.openingCash)}));
   status("Caixa aberto! Registre as vendas, confirme Pix/cartão e conte o dinheiro ao encerrar.");
  }else if(type==="movement"){
   const movement=mutate(data=>registerCashMovement(data,{
    id:id(),kind:payload.kind,amount:parseMoney(payload.amount),reason:payload.reason}));
   movementEditorKind=null;updateMovementPanel();
   status(({sangria:"Retirada (sangria)",suprimento:"Entrada (suprimento)",reembolso:"Reembolso"}[movement.kind]||"Movimentação")+" registrada: "+brl(movement.amount));
  }else if(type==="close"){
   const data=snapshot()?.data;
   const s=activeSession(data);
   const report=calculateCash(data,s.id);
   const counted=parseMoney(payload.countedCash);
   if(!window.confirm("Fechar o caixa? Dinheiro esperado: "+brl(report.expectedCash)+
    ". Conferido: "+brl(counted)+". A diferença ficará registrada no histórico."))return;
   const result=mutate(d=>closeCash(d,{countedCash:counted,operator:window.POTE_AUTH?.email}));
   status("Caixa fechado. Dinheiro esperado: "+brl(result.expectedCash)+". Contado: "+brl(result.countedCash)+". Diferença: "+brl(result.difference)+". Consulte o histórico para ver também Pix e cartão.");
  }
 }catch(error){status(error.message)}
}
function parseMoney(value){
 const input=String(value??"").trim();
 const digits=input.replace(/^R\$\s*/i,"");
 if(!/^(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2})$/.test(digits))
  throw Error("Valor monetário inválido (use 0,00)");
 const amount=window.POTE_FINANCE?.parseNumber(input);
 if(!Number.isFinite(amount))throw Error("Não foi possível validar o valor monetário. Recarregue o aplicativo.");
 return amount;
}
function action(name,orderId){
 if(name==="hide"){close();return}
 if(name==="withdraw"||name==="supply"){
  movementEditorKind=name==="withdraw"?"sangria":"suprimento";
  updateMovementPanel();
  const panel=modal?.querySelector?.("#potePdvMovementEditor");
  if(panel)requestAnimationFrame(()=>revealCashSection(panel));
  return;
 }
 if(name==="cancel-movement"){
  movementEditorKind=null;updateMovementPanel();return;
 }
 const data=snapshot()?.data,order=data?.orders?.find(x=>x.id===orderId);
 if(!order)return;
 if(name==="kitchen"||name==="receipt"){
  try{printOrder(order,{kitchen:name==="kitchen",brand:data?.brand?.name})}
  catch(error){status(error.message)}
  return;
 }
 try{
  if(name==="late"){
   const selected=window.prompt("Recebimento de turno anterior: dinheiro, Pix ou cartão?","Pix");
   if(selected===null)return;
   const method=paymentKind(selected);
   if(!["cash","pix","card"].includes(method))throw Error("Forma inválida: dinheiro, Pix ou cartão");
   if(!window.confirm("Você conferiu o recebimento de "+brl(orderAmountCents(order)/100)+
    "? Este pagamento NÃO modificará o fechamento original."))return;
   const reference=window.prompt("Referência obrigatória do comprovante/registro da conferência:");
   if(reference===null)return;
   mutate(d=>settlePreviousPayment(d,{id:id(),orderId,method:selected,reference}));
   status("Recebimento anterior conciliado no turno atual; fechamento original preservado.");
  }else if(name==="delivery"){
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
   status("Recebimento confirmado após conferência manual. O valor já aparece no relatório do PDV.");
  }else if(name==="confirm"){
   if(!window.confirm("Confirmar recebimento: você conferiu esse "+esc(paymentKind(order.paymentMethod))+
    " no comprovante do banco ou da operadora? O aplicativo NÃO verificou o pagamento automaticamente."))return;
   const reference=window.prompt("Informe uma referência da conferência (código da transação, quatro últimos dígitos ou observação):");
   if(reference===null)return;
   mutate(d=>confirmRecordedPayment(d,{orderId,reference}));
   status("Recebimento confirmado! O valor já aparece na barra de "+(paymentKind(order.paymentMethod)==="pix"?"Pix":"Cartão")+" e no total do turno.");
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
function openMovement(kind){
 if(!access())return false;
 const actionName=kind==="sangria"?"withdraw":kind==="suprimento"?"supply":null;
 if(!actionName||!currentSession())return false;
 open();
 action(actionName);
 const panel=modal?.querySelector("#potePdvMovementEditor");
 if(!panel||panel.hidden)return false;
 requestAnimationFrame(()=>{
  revealCashSection(panel);
  panel.querySelector('input[name="amount"]')?.focus({preventScroll:true});
 });
 return true;
}
function open(){
 if(!access())return;
 ensure();expandedCashDetails.clear();movementEditorKind=null;
 lastModalFingerprint=null;visible=true;modal.hidden=false;render();
 modal.querySelector('button[data-pdv-action="hide"]')?.focus();
}
function close(){visible=false;lastModalFingerprint=null;expandedCashDetails.clear();movementEditorKind=null;if(modal)modal.hidden=true}
function refresh(){
 ensure();
 // Evita substituir o input focado no celular: isso fecharia/reabriria o teclado.
 // Renderização completa ocorre após qualquer ação efetiva no formulário.
 const active=document.activeElement;
 if(visible&&access()&&modal?.contains?.(active)&&
    active?.matches?.("input,textarea,select,[contenteditable=true]"))return;
 render();
 refreshPage();
}
for(const event of ["pote:user-ready","pote:changed","pote:license-updated","pote:user-logout"])
 window.addEventListener(event,()=>{
  clearTimeout(delay);delay=setTimeout(refresh,120);
 });
window.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&visible)close()});
ensure();refresh();
/* Reattach the same button when Home is rebuilt, preserving its click handler. */
const pageRoot=document.getElementById("page");
if(pageRoot)new MutationObserver(()=>{
 const heading=pageRoot.querySelector(".ops-heading");
 if(heading&&trigger.parentElement!==heading)refresh();
 else if(!heading&&(!trigger.hidden||!trigger.isConnected))refresh();
}).observe(pageRoot,{childList:true,subtree:false});
window.POTE_PDV={open,openMovement,close,refresh,renderPage,completeSalePayment,getSessionId,currentSession,printOrder,ticketHtml};
if(window.POTE_ROUTE_BRIDGE?.current?.().tab==="pdv")window.requestAnimationFrame(()=>window.render?.());
