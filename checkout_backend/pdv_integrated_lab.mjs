// B02.14: local synthetic harness only. No live service credentials or deployment.
import {queueRow,orderPrintText} from "./pdv_checkout_queue.mjs";
import {checkoutDrawer} from "./checkout_cash_lab.mjs";
import {mountOrderTicker} from "./order_ticker.mjs";
if(location.hostname!=="127.0.0.1"&&location.hostname!=="localhost")throw Error("Local lab only");
const $=id=>document.getElementById(id),money=n=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),op=()=>crypto.randomUUID();
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
let cfg,tab="counter",quote=null,pendingSubmit=null,snapshot=null,activeOrder=null,stopTicker=null,busy=false,cashAction=null,cashRetry=null;
const feedback=t=>$("feedback").textContent=t;
const labels={prepare:"Iniciar preparo",ready:"Finalizar preparo",dispatch:"Saiu para entrega",deliver:"Confirmar entrega",cancel:"Cancelar e repor",confirm_payment:"Confirmar recebimento"};
async function request(path,body,token){
 const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});
 const result=await res.json();if(!res.ok)throw Object.assign(Error(result.error??"operation_not_confirmed"),{code:result.error});return result;
}
const api=(kind,body,role="owner")=>request("/checkout-lab/"+kind,body,cfg[role+"Token"]);
const ownerSnapshot=()=>request("/lab/snapshot",{},cfg.ownerToken);
function show(tabName){
 tab=tabName;for(const b of document.querySelectorAll("[data-tab]"))b.setAttribute("aria-selected",String(b.dataset.tab===tab));
 $("sale").hidden=!["counter","online"].includes(tab);$("orders").hidden=tab!=="queue";$("cash").hidden=tab!=="cash";
 $("receipt").hidden=true;$("ticker").hidden=tab!=="online"||!activeOrder;
 if(["counter","online"].includes(tab)){clearQuote();$("sale-title").textContent=tab==="counter"?"Venda de balcão":"Cardápio digital";$("customer-note").hidden=tab!=="online";$("method").value=tab==="counter"?"cash":"pix"}
 else refresh().catch(e=>feedback(e.message));
}
function clearQuote(){quote=null;pendingSubmit=null;$("quote-total").textContent="";$("submit").disabled=true}
function productView(){
 const parent=$("products");parent.replaceChildren();
 for(const p of cfg.products){const row=el("article");row.className="product";const desc=el("div");desc.append(el("strong",p.title),el("div",money(p.priceCents)));const qty=el("input");qty.type="number";qty.min=0;qty.max=99;qty.step=1;qty.value="0";qty.dataset.product=p.id;qty.setAttribute("aria-label","Quantidade "+p.title);qty.onchange=clearQuote;row.append(desc,qty);parent.append(row)}
}
function input(){return {lines:[...document.querySelectorAll("[data-product]")].filter(e=>Number(e.value)>0).map(e=>({productId:e.dataset.product,quantity:Number(e.value),extras:[]})),fulfillment:"pickup",paymentMethod:$("method").value}}
async function guard(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll("nav button,#quote,#submit"))b.disabled=true;try{await fn()}catch(e){feedback("Não concluído: "+e.message)}finally{busy=false;for(const b of document.querySelectorAll("nav button,#quote"))b.disabled=false;$("submit").disabled=!quote}}
function track(orderId){
 activeOrder=orderId;if(stopTicker)stopTicker();
 stopTicker=mountOrderTicker($("ticker"),{subscribe:emit=>{let closed=false,timer;
  const poll=async()=>{try{const order=await api("status",{storeId:cfg.online,orderId},"buyer");if(!closed)emit({order,connected:true,serverNowMs:order.createdAt+order.elapsedMs});if(!closed&&["delivered","cancelled"].includes(order.status))clearInterval(timer)}catch{if(!closed)emit({connected:false})}};
  timer=setInterval(poll,1000);poll();return()=>{closed=true;clearInterval(timer)};
 }});$("ticker").hidden=tab!=="online";
}
$("quote").onclick=()=>guard(async()=>{clearQuote();const payload=input(),role=tab==="counter"?"owner":"buyer";const q=await api("quote",{storeId:cfg[tab],operationId:op(),input:payload},role);quote={q,payload,channel:tab,role};$("quote-total").textContent="Total confirmado pelo servidor: "+money(q.totalCents);feedback("Confira o valor antes de confirmar.");});
$("submit").onclick=()=>guard(async()=>{if(!quote)return;const {q,payload,channel,role}=quote;pendingSubmit??={storeId:cfg[channel],operationId:op(),quoteId:q.quoteId,input:payload,expectedRevision:q.revision,expectedTotalCents:q.totalCents};const result=await api("submit",pendingSubmit,role);clearQuote();for(const e of document.querySelectorAll("[data-product]"))e.value="0";feedback("Pedido #"+result.id+" registrado.");if(channel==="online")track(result.id);});
$("method").onchange=clearQuote;
for(const b of document.querySelectorAll("[data-tab]"))b.onclick=()=>{if(!busy)show(b.dataset.tab)};
async function refresh(){snapshot=await ownerSnapshot();renderQueue();renderCash()}
function renderQueue(){
 const target=$("queue");target.replaceChildren();$("stock").textContent="Estoque físico disponível: "+snapshot.stock+" g";
 for(const o of snapshot.orders){const row=queueRow(o,snapshot.now),article=el("article");article.dataset.order=row.id;article.dataset.channel=o.channel??"online";article.append(el("h3","#"+row.id+" · "+(o.channel==="counter"?"Balcão":"Online")),el("p",row.label+" · "+row.paymentStatus+" · "+money(row.totalCents)),el("p",row.lines.map(l=>l.quantity+"x "+l.title).join(", ")));const actions=el("div");actions.className="actions";let ref;
 if(row.actions.includes("confirm_payment")){ref=el("input");ref.placeholder="Referência do recebimento";ref.setAttribute("aria-label","Referência "+row.id);ref.maxLength=120;actions.append(ref)}
 for(const action of row.actions){const b=el("button",labels[action]);b.dataset.action=action;b.onclick=async()=>{if(busy)return;await guard(async()=>{if(action==="cancel"&&!confirm("Cancelar e devolver a reserva?"))return;const body={storeId:row.storeId,orderId:row.id,action,operationId:op(),...(action==="confirm_payment"?{paymentReference:ref.value}:{})};await api("transition",body);await refresh();feedback("Pedido atualizado.")})};actions.append(b)}
 if(row.status==="delivered"){const b=el("button","Comprovante");b.dataset.action="receipt";b.onclick=()=>{$("receipt-text").textContent=orderPrintText(o);$("receipt").hidden=false;$("receipt").scrollIntoView({block:"nearest"})};actions.append(b)}
 article.append(actions);target.append(article)}
}
function renderCash(){
 const s=snapshot.session,open=s?.status==="open",target=$("metrics");target.replaceChildren();
 const d=open?checkoutDrawer(s):null;
 for(const [label,value] of [["Turno",open?"Aberto":"Fechado"],["Dinheiro",money(s?.totals.cash??0)],["PIX",money(s?.totals.pix??0)],["Cartão",money(s?.totals.card??0)],["Total recebido",money((s?.totals.cash??0)+(s?.totals.pix??0)+(s?.totals.card??0))],["Dinheiro esperado",money(d?.expectedCashCents??snapshot.lastClosed?.expectedCashCents??0)]]){const box=el("div");box.className="metric";box.append(el("small",label),el("strong",value));target.append(box)}
 $("open").disabled=open;for(const id of ["supply","withdraw","close"])$(id).disabled=!open;
 $("closed-summary").textContent=snapshot.lastClosed?"Último fechamento · Dinheiro contado: "+money(snapshot.lastClosed.countedCashCents??0)+" · Diferença: "+money(snapshot.lastClosed.differenceCents??0):"";
}
const names={open:"Abrir caixa · fundo de troco",suprimento:"Suprimento",sangria:"Retirada (sangria)",close:"Fechar caixa · dinheiro contado"};
for(const b of document.querySelectorAll("[data-cash]"))b.onclick=()=>{cashAction=b.dataset.cash;cashRetry=null;$("cash-title").textContent=names[cashAction];$("cash-amount").value="";$("cash-reason").value="";$("cash-error").textContent="";$("cash-reason-label").hidden=["open","close"].includes(cashAction);$("cash-dialog").showModal()};
$("cash-form").onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$("cash-confirm").disabled=true;try{
 const raw=$("cash-amount").value.trim().replace(",",".");if(!/^\d+(\.\d{1,2})?$/.test(raw))throw Error("Informe um valor válido.");const cents=Math.round(Number(raw)*100);
 const kind=cashAction==="open"?"openCash":cashAction==="close"?"closeCash":"moveCash";
 const body={epoch:cfg.epoch,sessionId:cashAction==="open"?(cashRetry?.body.sessionId??op()):snapshot.session.id,...(kind==="openCash"?{openingCashCents:cents}:kind==="closeCash"?{countedCashCents:cents}:{kind:cashAction,amountCents:cents,reason:$("cash-reason").value})};
 const key=JSON.stringify(body);if(cashRetry&&cashRetry.key!==key)throw Error("Confira a tentativa anterior antes de alterar os valores.");cashRetry??={key,body:{...body,operationId:op()}};
 await api(kind,cashRetry.body);cashRetry=null;$("cash-dialog").close();await refresh();feedback("Caixa atualizado.");
 }catch(err){$("cash-error").textContent=err.message;if(["insufficient_cash","invalid_movement","invalid_request","invalid_counted_cash"].includes(err.code))cashRetry=null}finally{busy=false;$("cash-confirm").disabled=false}};
$("cash-cancel").onclick=()=>{if(!busy)$("cash-dialog").close()};
$("refresh").onclick=()=>guard(refresh);$("print").onclick=()=>window.print();
try{cfg=await request("/lab/bootstrap",{});productView();show("counter");await refresh();document.body.dataset.ready="true"}catch(e){feedback("Laboratório indisponível: "+e.message)}
