/* Lista de compras persistente para contas de franquia. */
import {shoppingNeeds,formatStockQuantity,STARTER_LANCHES,STARTER_BEVERAGES} from "./franchise_stock_core.mjs?v=starter-20261116";

const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let trigger=null,panel=null,open=false;
const franchise=()=>Boolean(window.POTE_APP_READY&&window.POTE_AUTH?.franchiseActive);
const data=()=>window.POTE_APP?.snapshot?.()?.data||null;
const current=()=>franchise()?shoppingNeeds(data()):[];
function ensure(){
 if(trigger)return;
 trigger=document.createElement("button");
 trigger.type="button";
 trigger.id="poteShoppingListButton";
 trigger.className="pote-shopping-trigger";
 trigger.setAttribute("aria-haspopup","dialog");
 trigger.setAttribute("aria-controls","poteShoppingListDialog");
 trigger.innerHTML='<span aria-hidden="true">🛒</span><strong>Lista de Compras</strong><span class="pote-shopping-count" id="poteShoppingListCount">0</span>';
 trigger.addEventListener("click",()=>open?close():show());
 document.body.appendChild(trigger);
 panel=document.createElement("section");
 panel.id="poteShoppingListDialog";
 panel.className="pote-shopping-cover";
 panel.hidden=true;
 panel.innerHTML='<div class="pote-shopping-dialog" role="dialog" aria-modal="true" aria-labelledby="poteShoppingListTitle">'+
 '<header><div><small>ESTOQUE DA FRANQUIA</small><h2 id="poteShoppingListTitle">Lista de Compras</h2></div>'+
 '<button id="poteShoppingClose" type="button" aria-label="Fechar lista de compras">✕</button></header>'+
 '<p id="poteShoppingSummary"></p><div class="pote-shopping-items" id="poteShoppingItems"></div>'+
 '<footer><button type="button" id="poteShoppingCopy">Copiar lista</button>'+
 '<small>Metas: insumos para 5 unidades de cada lanche oficial e 10 unidades de cada bebida. Considere reservas de pedidos. Os saldos iniciais são demonstrativos: confira o estoque físico antes de vender.</small></footer></div>';
 document.body.appendChild(panel);
 panel.addEventListener("click",event=>{if(event.target===panel)close()});
 panel.querySelector("#poteShoppingClose").addEventListener("click",close);
 panel.querySelector("#poteShoppingCopy").addEventListener("click",copyList);
 panel.querySelector("#poteShoppingItems").addEventListener("click",event=>{
  const button=event.target.closest("[data-stock-id]");if(!button)return;
  const id=button.dataset.stockId,kind=button.dataset.stockKind;
  close();
  if(typeof window.go==="function")window.go("ingredients");
  if(kind==="beverage")window.POTE_STOCK_EXT?.selectBeverage?.(id);
  else window.POTE_STOCK_UI?.jumpToNeed?.(id,kind);
 });
}
function refresh(){
 ensure();
 const visible=franchise();
 trigger.hidden=!visible;
 if(!visible){close();return}
 const needs=current();
 const badge=trigger.querySelector("#poteShoppingListCount");
 if(badge)badge.textContent=needs.length;
 trigger.classList.toggle("has-shortage",needs.length>0);
 trigger.title=needs.length?needs.length+" item(ns) para repor":"Lista em dia — consulte quando quiser";
 if(open)render(needs);
}
function render(needs=current()){
 if(!panel)return;
 const summary=panel.querySelector("#poteShoppingSummary"),body=panel.querySelector("#poteShoppingItems");
 summary.textContent=needs.length?needs.length+" item(ns) abaixo da meta de reposição.":"Tudo em dia: nenhuma compra necessária para atingir as metas.";
 if(!needs.length){body.innerHTML='<div class="pote-shopping-empty">✓ Nenhum item está em falta ou abaixo da meta de estoque.</div>';return}
 body.innerHTML=needs.map(x=>
  '<article class="pote-shopping-item '+(x.level==="missing"?"missing":"low")+'">'+
  '<div><strong>'+escapeHtml(x.name)+'</strong><span>'+
   (x.level==="missing"?"FALTANTE":"ESTOQUE BAIXO")+
   (x.missingRegistration?" · cadastro ausente":"")+'</span></div>'+
  '<p>Disponível: '+escapeHtml(formatStockQuantity(x.available,x.unit))+
   ' · Meta: '+escapeHtml(formatStockQuantity(x.target,x.unit))+
   (x.reserved>0?' · Reservado: '+escapeHtml(formatStockQuantity(x.reserved,x.unit)):'')+'</p>'+
  '<div class="pote-shopping-item-foot"><b>Comprar: '+escapeHtml(formatStockQuantity(x.missing,x.unit))+'</b>'+
  '<button type="button" data-stock-id="'+escapeHtml(x.id)+'" data-stock-kind="'+escapeHtml(x.kind)+'">'+
   (x.missingRegistration?"Cadastrar item":"Registrar compra")+'</button></div></article>'
 ).join("");
}
function show(){
 if(!franchise())return;
 ensure();open=true;panel.hidden=false;
 trigger.setAttribute("aria-expanded","true");
 render();
 panel.querySelector("#poteShoppingClose")?.focus();
}
function close(){
 open=false;
 if(panel)panel.hidden=true;
 if(trigger)trigger.setAttribute("aria-expanded","false");
}
async function copyList(){
 const needs=current();
 const text=needs.length?
  "LISTA DE COMPRAS — POTÊ BATATA\n"+
  "Meta: "+STARTER_LANCHES+" de cada lanche, "+STARTER_BEVERAGES+" de cada bebida\n\n"+
  needs.map(x=>"• "+x.name+": "+formatStockQuantity(x.missing,x.unit)).join("\n"):
  "POTÊ BATATA — Lista de compras em dia.";
 try{
  if(!navigator.clipboard?.writeText)throw Error("clipboard indisponível");
  await navigator.clipboard.writeText(text);
  const button=panel?.querySelector("#poteShoppingCopy");
  if(button){button.textContent="Lista copiada!";setTimeout(()=>{button.textContent="Copiar lista"},1700)}
 }catch(error){
  const view=panel?.querySelector("#poteShoppingItems");
  if(view){const area=document.createElement("textarea");area.value=text;area.readOnly=true;area.className="pote-shopping-text";view.prepend(area);area.focus();area.select()}
 }
}
for(const event of ["pote:user-ready","pote:franchise-updated","pote:changed","pote:user-logout"])
 window.addEventListener(event,refresh);
window.addEventListener("keydown",event=>{if(event.key==="Escape"&&open)close()});
refresh();
window.POTE_SHOPPING_LIST={refresh,show,close,items:current,copyList};
