// B02.14: local synthetic harness only. No live service credentials or deployment.
import {createCheckoutRecovery} from "./checkout_recovery_lab.mjs";
import {queueRow,orderPrintText} from "./pdv_checkout_queue.mjs";
import {checkoutDrawer} from "./checkout_cash_lab.mjs";
import {mountOrderTicker} from "./order_ticker.mjs";
if(location.hostname!=="127.0.0.1"&&location.hostname!=="localhost")throw Error("Local lab only");
const $=id=>document.getElementById(id),money=n=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),op=()=>crypto.randomUUID();
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
const merchantOnly=document.body.dataset.surface==="merchant";
let cfg,tab="counter",quote=null,snapshot=null,activeOrder=null,stopTicker=null,busy=false,cashAction=null,cashRetry=null,stockRetry=null;
const feedback=t=>$("feedback").textContent=t;
const labels={prepare:"Iniciar preparo",ready:"Finalizar preparo",dispatch:"Saiu para entrega",deliver:"Confirmar entrega",cancel:"Cancelar e repor",confirm_payment:"Confirmar recebimento"};
async function request(path,body,token){
 const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});
 const result=await res.json();if(!res.ok)throw Object.assign(Error(result.error??"operation_not_confirmed"),{code:result.error});return result;
}
const api=(kind,body,role="owner")=>request((merchantOnly?"/merchant/api/":"/checkout-lab/")+kind,body,cfg[role+"Token"]);
let queueCursors={};
const ownerSnapshot=()=>request(merchantOnly?"/merchant/api/snapshot":"/lab/snapshot",merchantOnly?{cursors:queueCursors}:{},cfg.ownerToken);
function show(tabName){
 tab=tabName;feedback("");for(const b of document.querySelectorAll("[data-tab]"))b.setAttribute("aria-selected",String(b.dataset.tab===tab));
 $("sale").hidden=!["counter","online"].includes(tab);$("orders").hidden=tab!=="queue";$("cash").hidden=tab!=="cash";$("inventory").hidden=tab!=="stock";
 if(merchantOnly)$("catalog-editor").hidden=tab!=="catalog";
 $("receipt").hidden=true;$("ticker").hidden=tab!=="online"||!activeOrder;
 if(["counter","online"].includes(tab)){clearQuote();$("sale-title").textContent=tab==="counter"?"Venda de balcão":"Cardápio digital";$("customer-note").hidden=tab!=="online";$("method").value=tab==="counter"?"cash":"pix";$("fulfillment").value="pickup";$("fulfillment").disabled=tab==="counter";$("address-label").hidden=true}
 else if(tab==="catalog"){guard(loadCatalogChoices)}
 else {if(tab==="queue"){queueCursors={};}if(tab==="queue")$("queue").replaceChildren();if(tab==="stock")$("inventory-list").replaceChildren();guard(refresh);}
 if(journals[tab]&&pending())guard(()=>consult());
}
const journals={};
function pending(){return ["counter","online"].includes(tab)&&journals[tab]?.pending()}
function syncRecovery(){const p=pending();$("recover").hidden=!p;$("retry-order").hidden=!p;$("quote").disabled=!!p;$("submit").disabled=!!p||!quote}
function clearQuote(){quote=null;$("quote-total").textContent="";syncRecovery()}
function resolved(result,channel){if(result.state==="committed"){clearQuote();for(const e of document.querySelectorAll("[data-product],[data-extra]"))e.value="0";feedback("Pedido #"+result.order.id+" registrado.");if(channel==="online")track(result.order.id)}else if(result.state==="unconfirmed"){feedback("Tentativa não confirmada. Consulte novamente ou repita a mesma confirmação.");}syncRecovery()}
async function consult(retry=false){const channel=tab,j=journals[channel];if(!j)return;resolved(await (retry?j.retry():j.recover()),channel)}

function productView(){
 const parent=$("products");parent.replaceChildren();
 for(const p of cfg.products){const row=el("article");row.className="product";const desc=el("div");desc.append(el("strong",p.title),el("div",money(p.priceCents)));for(const extra of p.extras??[]){const l=el("label",extra.title+" · "+money(extra.priceCents)),q=el("input");q.type="number";q.min=0;q.max=10;q.step=1;q.value="0";q.dataset.extra=extra.id;q.dataset.forProduct=p.id;q.setAttribute("aria-label","Adicional "+extra.title+" em "+p.title);q.oninput=clearQuote;l.append(q);desc.append(l)}const qty=el("input");qty.type="number";qty.min=0;qty.max=99;qty.step=1;qty.value="0";qty.dataset.product=p.id;qty.setAttribute("aria-label","Quantidade "+p.title);qty.oninput=clearQuote;row.append(desc,qty);parent.append(row)}
}
function input(){return {lines:[...document.querySelectorAll("[data-product]")].filter(e=>Number(e.value)>0).map(e=>({productId:e.dataset.product,quantity:Number(e.value),extras:[...document.querySelectorAll("[data-extra]")].filter(a=>a.dataset.forProduct===e.dataset.product&&Number(a.value)>0).map(a=>({id:a.dataset.extra,quantity:Number(a.value)}))})),fulfillment:$("fulfillment").value,paymentMethod:$("method").value,...($("fulfillment").value==="delivery"?{address:$("address").value}:{})}}
async function guard(fn){if(busy)return;busy=true;feedback("");for(const b of document.querySelectorAll("nav button,#quote,#submit,#method,#fulfillment,#address,[data-product],[data-extra]"))b.disabled=true;try{await fn()}catch(e){feedback("Não concluído: "+e.message)}finally{busy=false;for(const b of document.querySelectorAll("nav button,#quote,#method,#fulfillment,#address,[data-product],[data-extra]"))b.disabled=false;$("fulfillment").disabled=tab==="counter";syncRecovery()}}
function track(orderId){
 activeOrder=orderId;if(stopTicker)stopTicker();
 stopTicker=mountOrderTicker($("ticker"),{subscribe:emit=>{let closed=false,timer;
  const poll=async()=>{try{const order=await api("status",{storeId:cfg.online,orderId},"buyer");if(!closed)emit({order,connected:true,serverNowMs:order.createdAt+order.elapsedMs});if(!closed&&["delivered","cancelled"].includes(order.status))clearInterval(timer)}catch{if(!closed)emit({connected:false})}};
  timer=setInterval(poll,1000);poll();return()=>{closed=true;clearInterval(timer)};
 }});$("ticker").hidden=tab!=="online";
}
$("quote").onclick=()=>guard(async()=>{if(pending())throw Error("Recupere o pedido anterior.");clearQuote();const payload=input(),role=tab==="counter"?"owner":"buyer";const q=await api("quote",{storeId:cfg[tab],operationId:op(),input:payload},role);quote={q,payload,channel:tab,role};$("quote-total").textContent="Total confirmado pelo servidor: "+money(q.totalCents);feedback("Confira o valor antes de confirmar.");});
$("submit").onclick=()=>guard(async()=>{if(!quote||pending())return;const {q,channel}=quote;resolved(await journals[channel].begin(q),channel)});
$("recover").onclick=()=>guard(()=>consult());
$("retry-order").onclick=()=>guard(()=>consult(true));
$("method").onchange=clearQuote;$("fulfillment").onchange=()=>{$("address-label").hidden=$("fulfillment").value!=="delivery";clearQuote()};$("address").oninput=clearQuote;
for(const b of document.querySelectorAll("[data-tab]"))b.onclick=()=>{if(!busy)show(b.dataset.tab)};
let refreshVersion=0;
async function refresh(){const version=++refreshVersion,next=await ownerSnapshot();if(version!==refreshVersion)return;snapshot=next;renderQueue();renderCash();renderInventory()}
function renderQueue(){
 const target=$("queue");target.replaceChildren();$("stock").textContent="Estoque físico disponível: "+snapshot.stock+" g";
 for(const o of snapshot.orders){const row=queueRow(o,snapshot.now),article=el("article");article.dataset.order=row.id;article.dataset.channel=o.channel??"online";article.append(el("h3","#"+row.id+" · "+(o.channel==="counter"?"Balcão":"Online")),el("p",row.label+" · "+row.paymentStatus+" · "+money(row.totalCents)),el("p",row.lines.map(l=>l.quantity+"x "+l.title).join(", ")));const actions=el("div");actions.className="actions";let ref;
 if(row.actions.includes("confirm_payment")){ref=el("input");ref.placeholder="Referência do recebimento";ref.setAttribute("aria-label","Referência "+row.id);ref.maxLength=120;actions.append(ref)}
 for(const action of row.actions){const b=el("button",labels[action]);b.dataset.action=action;b.onclick=async()=>{if(busy)return;await guard(async()=>{if(action==="cancel"&&!confirm("Cancelar e devolver a reserva?"))return;const body={storeId:row.storeId,orderId:row.id,action,operationId:op(),...(action==="confirm_payment"?{paymentReference:ref.value}:{})};await api("transition",body);await refresh();feedback("Pedido atualizado.")})};actions.append(b)}
 if(row.status==="delivered"){const b=el("button","Comprovante");b.dataset.action="receipt";b.onclick=()=>{$("receipt-text").textContent=orderPrintText(o);$("receipt").hidden=false;$("receipt").scrollIntoView({block:"nearest"})};actions.append(b)}
 article.append(actions);target.append(article)}
 if(merchantOnly){const pages=$("queue-pages");pages.replaceChildren();for(const [storeId,cursor] of Object.entries(snapshot.nextCursors??{})){const b=el("button","Mais pedidos · "+(storeId===cfg.counter?"Balcão":"Online"));b.onclick=()=>guard(async()=>{queueCursors={...queueCursors,[storeId]:cursor};await refresh()});pages.append(b)}if(Object.keys(queueCursors).length){const b=el("button","Voltar aos mais recentes");b.onclick=()=>guard(async()=>{queueCursors={};await refresh()});pages.append(b)}}
}
function renderCash(){
 const s=snapshot.session,open=s?.status==="open",target=$("metrics");target.replaceChildren();
 const d=open?checkoutDrawer(s):null;
 for(const [label,value] of [["Turno",open?"Aberto":"Fechado"],["Dinheiro",money(s?.totals.cash??0)],["PIX",money(s?.totals.pix??0)],["Cartão",money(s?.totals.card??0)],["Total recebido",money((s?.totals.cash??0)+(s?.totals.pix??0)+(s?.totals.card??0))],["Dinheiro esperado",money(d?.expectedCashCents??snapshot.lastClosed?.expectedCashCents??0)]]){const box=el("div");box.className="metric";box.append(el("small",label),el("strong",value));target.append(box)}
 $("open").disabled=open;for(const id of ["supply","withdraw","close"])$(id).disabled=!open;
 $("closed-summary").textContent=snapshot.lastClosed?"Último fechamento · Dinheiro contado: "+money(snapshot.lastClosed.countedCashCents??0)+" · Diferença: "+money(snapshot.lastClosed.differenceCents??0):"";
}
const names={open:"Abrir caixa · fundo de troco",suprimento:"Suprimento",sangria:"Retirada (sangria)",close:"Fechar caixa · dinheiro contado"};
for(const b of document.querySelectorAll("[data-cash]"))b.onclick=()=>{cashAction=b.dataset.cash;cashRetry=null;$("cash-title").textContent=names[cashAction];$("cash-amount").value="";$("cash-reason").value="";$("cash-error").textContent="";$("cash-reason-label").hidden=["open","close"].includes(cashAction);feedback("");$("cash-dialog").showModal()};
$("cash-form").onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$("cash-confirm").disabled=true;try{
 const raw=$("cash-amount").value.trim().replace(",",".");if(!/^\d+(\.\d{1,2})?$/.test(raw))throw Error("Informe um valor válido.");const cents=Math.round(Number(raw)*100);
 const kind=cashAction==="open"?"openCash":cashAction==="close"?"closeCash":"moveCash";
 const body={epoch:cfg.epoch,sessionId:cashAction==="open"?(cashRetry?.body.sessionId??op()):snapshot.session.id,...(kind==="openCash"?{openingCashCents:cents}:kind==="closeCash"?{countedCashCents:cents}:{kind:cashAction,amountCents:cents,reason:$("cash-reason").value})};
 const key=JSON.stringify(body);if(cashRetry&&cashRetry.key!==key)throw Error("Confira a tentativa anterior antes de alterar os valores.");cashRetry??={key,body:{...body,operationId:op()}};
 await api(kind,cashRetry.body);cashRetry=null;$("cash-dialog").close();await refresh();feedback("Caixa atualizado.");
 }catch(err){$("cash-error").textContent=err.message;if(["insufficient_cash","invalid_movement","invalid_request","invalid_counted_cash"].includes(err.code))cashRetry=null}finally{busy=false;$("cash-confirm").disabled=false}};
$("cash-cancel").onclick=()=>{if(!busy&&!cashRetry)$("cash-dialog").close();else if(!busy)$("cash-error").textContent="Confirme novamente a tentativa anterior antes de sair."};
$("cash-dialog").addEventListener("cancel",e=>{if(busy||cashRetry)e.preventDefault()});
$("refresh").onclick=()=>guard(refresh);$("print").onclick=()=>window.print();
let catalogDraft=null;
async function loadCatalogChoices(){const data=await request("/merchant/catalog/choices",{},cfg.ownerToken);catalogDraft=null;$("catalog-review").replaceChildren();$("catalog-approve").disabled=true;const target=$("catalog-choices");target.replaceChildren();for(const item of data.choices){const label=el("label"),box=el("input");box.type="checkbox";box.checked=item.selected;box.dataset.catalogGroup=item.group;box.value=item.id;box.onchange=()=>{catalogDraft=null;$("catalog-approve").disabled=true;$("catalog-review").replaceChildren()};label.append(box,document.createTextNode(" "+item.title+" · "+item.group));target.append(label)}}
if(merchantOnly){$("catalog-preview").onclick=()=>guard(async()=>{const selection={recipeIds:[],beverageIds:[],addonIds:[],comboIds:[]},groups={recipes:"recipeIds",beverages:"beverageIds",addons:"addonIds",combos:"comboIds"};for(const box of document.querySelectorAll("[data-catalog-group]:checked"))selection[groups[box.dataset.catalogGroup]].push(box.value);const operationId=op(),candidate=await request("/merchant/catalog/preview",{selection,operationId,revision:operationId},cfg.ownerToken);catalogDraft={operationId,revision:operationId};$("catalog-review").replaceChildren(...candidate.products.map(p=>el("p",p.title+" · "+money(p.priceCents))));$("catalog-approve").disabled=false;feedback("Confira a revisão antes de aprovar.")});$("catalog-approve").onclick=()=>guard(async()=>{if(!catalogDraft)return;await request("/merchant/catalog/approve",catalogDraft,cfg.ownerToken);await loadCatalogChoices();feedback("Revisão aprovada somente no laboratório.")})}
try{if(merchantOnly){const token=window.__syntheticMerchantToken;delete window.__syntheticMerchantToken;if(typeof token!=="string")throw Error("login_required");cfg={...await request("/merchant/config",{},token),ownerToken:token}}else cfg=await request("/lab/bootstrap",{});for(const channel of (merchantOnly?["counter"]:["counter","online"])){const role=channel==="counter"?"owner":"buyer";journals[channel]=createCheckoutRecovery({storage:sessionStorage,storeId:cfg[channel],getUid:()=>cfg[role+"Uid"],newOperationId:op,send:(kind,body,uid)=>{if(uid!==cfg[role+"Uid"])throw Error("session_changed");return api(kind,body,role)}})}productView();show("counter");await refresh();document.body.dataset.ready="true"}catch(e){feedback("Laboratório indisponível: "+e.message)}

function renderInventory(){
 const rows=snapshot.inventory??[],list=$("inventory-list"),select=$("inventory-item"),old=select.value;list.replaceChildren();select.replaceChildren();
 for(const i of rows){list.append(el("p",i.title+": "+(i.units/i.scale)+" "+i.unit));const option=el("option",i.title+" ("+i.unit+")");option.value=i.id;select.append(option)}
 if(rows.some(i=>i.id===old))select.value=old;$("inventory-save").disabled=!rows.length;
}
$("inventory-item").onchange=()=>{const i=(snapshot?.inventory??[]).find(x=>x.id===$("inventory-item").value);$("inventory-qty").step=String(1/(i?.scale??1))};
$("inventory-kind").onchange=()=>{$("purchase-evidence").hidden=$("inventory-kind").value!=="purchase";$("purchase-cost").value="";$("purchase-reference").value=""};
$("inventory-form").onsubmit=e=>{e.preventDefault();guard(async()=>{
 const i=(snapshot?.inventory??[]).find(x=>x.id===$("inventory-item").value);if(!i)throw Error("Insumo indisponível.");
 const q=Number($("inventory-qty").value)*i.scale;if(!Number.isSafeInteger(q)||q<0)throw Error("Quantidade inválida.");
 const body={storeId:cfg.counter,epoch:cfg.epoch,stockId:i.id,kind:$("inventory-kind").value,quantityUnits:q,expectedUnits:i.units,reason:$("inventory-reason").value};
 const cost=$("purchase-cost").value.trim().replace(",",".");const ref=$("purchase-reference").value.trim();
 if(body.kind==="purchase"&&(cost||ref)){if(!/^\d+(\.\d{1,2})?$/.test(cost)||Number(cost)<=0||!ref)throw Error("Informe valor e referência da compra.");body.purchaseCostCents=Math.round(Number(cost)*100);body.purchaseReference=ref;}
 if(stockRetry&&JSON.stringify(stockRetry.payload)!==JSON.stringify(body))throw Error("Confirme a tentativa anterior antes de mudar os dados.");
 stockRetry??={payload:body,operationId:op()};try{const result=await api("adjustStock",{...stockRetry.payload,operationId:stockRetry.operationId});stockRetry=null;$("inventory-qty").value="";$("inventory-reason").value="";$("purchase-cost").value="";$("purchase-reference").value="";await refresh();feedback("Ajuste de estoque registrado."+(result.lossUnits>0?(result.costKnown?" Perda estimada: "+money(result.lossCostCents):" Custo da perda desconhecido."):(result.purchase?" Compra registrada: "+money(result.purchase.totalCents):"")))}catch(e){if(["stock_changed","insufficient_stock","invalid_stock_adjustment","no_stock_change","invalid_stock_precision","invalid_purchase_evidence","invalid_supplier"].includes(e.code)){stockRetry=null;await refresh()}throw e}
 })};
