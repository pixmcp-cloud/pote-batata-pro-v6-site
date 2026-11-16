/* Cancelamento explícito e rastreável: devolve estoque uma vez quando já houve baixa. */
(function(){
"use strict";
if(window.POTE_CANCEL)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>Number(x||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
const data=()=>state.data;
let selected=null;
function findOrder(id){return (data().orders||[]).find(o=>o.id===id)}
function wasDeducted(order){
 if(order?.stockDeducted===true)return true;
 if(order?.stockDeducted===false)return false;
 const movement=(data().stockMovements||[]).some(m=>m.referenceId===order?.id&&
  Number(m.quantity)<0&&/produ|bebida vendida|baixa/i.test(m.reason||""));
 return movement||order?.status==="em_producao"||order?.status==="entregue";
}
function canRecover(order){return !!order&&order.status==="cancelado"&&wasDeducted(order)&&order.stockRestored!==true&&order.stockReturnDeclined!==true}
function needs(order){
 const qty=Math.max(1,Number(order.qty)||1),ins=new Map(),drinks=new Map();
 if(order.stockOverrideApproved&&order.stockActualConsumed){
  for(const [id,n] of Object.entries(order.stockActualConsumed.ingredients||{}))ins.set(id,Math.max(0,Number(n)||0));
  for(const [id,n] of Object.entries(order.stockActualConsumed.beverages||{}))drinks.set(id,Math.max(0,Number(n)||0));
  return {ins,drinks};
 }
 for(const item of order.items||[]){
  const ratio=Math.max(.01,Number(item.yieldPct||100)/100);
  ins.set(item.id,(ins.get(item.id)||0)+(Number(item.g)||0)*qty/ratio);
 }
 for(const b of order.beverageItems||[])
  drinks.set(b.id,(drinks.get(b.id)||0)+(Number(b.qty)||0)*qty);
 return {ins,drinks};
}
function missingReferences(order){
 const result=[],required=needs(order);
 for(const [id,qty] of required.ins)
  if(qty>0&&!data().ingredients.some(i=>i.id===id))result.push("Ingrediente: "+id);
 for(const [id,qty] of required.drinks)
  if(qty>0&&!data().beverages.some(b=>b.id===id))result.push("Bebida: "+id);
 return result;
}
function modal(){
 let host=$("poteCancelOrderModal");if(host)return host;
 host=document.createElement("div");host.id="poteCancelOrderModal";host.hidden=true;
 host.innerHTML='<section class="pote-cancel-order-sheet" role="dialog" aria-modal="true" aria-labelledby="poteCancelTitle">'+
  '<small>CONTROLE DE PEDIDOS E ESTOQUE</small><h2 id="poteCancelTitle">Cancelar pedido</h2>'+
  '<div id="poteCancelDetails"></div><p id="poteCancelError" role="alert" hidden></p>'+
  '<div class="pote-cancel-buttons">'+
  '<button type="button" class="btn line" id="poteCancelClose">Voltar ao pedido</button>'+
  '<button type="button" class="btn danger" id="poteCancelDiscard">Cancelar sem devolver · perda</button>'+
  '<button type="button" class="btn" id="poteCancelReturn">Cancelar e devolver ao estoque</button>'+
  '</div></section>';
 document.body.appendChild(host);
 $("poteCancelClose").addEventListener("click",close);
 $("poteCancelDiscard").addEventListener("click",()=>perform("discard"));
 $("poteCancelReturn").addEventListener("click",()=>perform("return"));
 return host;
}
function open(id){
 const order=findOrder(id);
 if(!order||typeof canOperate==="function"&&!canOperate(order.recipeId))return false;
 if(order.status==="cancelado"&&!canRecover(order))return false;
 const recovering=order.status==="cancelado",deducted=wasDeducted(order);
 selected=id;
 const dlg=modal();
 $("poteCancelTitle").textContent=recovering?"Regularizar estoque de pedido cancelado":"Cancelar pedido";
 const refs=missingReferences(order);
 const requirement=needs(order);
 const sum=[...requirement.ins].map(([id,qty])=>{
  const it=data().ingredients.find(x=>x.id===id);
  return '<li>'+esc(it?.name||id)+' · '+fmt(qty)+' '+esc(it?.measureUnit||"g")+'</li>';
 }).join("")+
 [...requirement.drinks].map(([id,qty])=>{
  const it=data().beverages.find(x=>x.id===id);
  return '<li>'+esc(it?.name||id)+' · '+fmt(qty)+' un</li>';
 }).join("");
 $("poteCancelDetails").innerHTML='<p><strong>#'+esc(order.id.slice(-8).toUpperCase())+
  '</strong> · '+esc(order.name||"Produto")+' · '+fmt(order.qty)+' unidade(s)</p>'+
  '<p>'+(deducted?
  'O pedido já deu baixa no estoque. Devolver soma novamente os ingredientes, embalagens e bebidas que foram descontados.':
  'Este pedido ainda NÃO deu baixa no estoque. Cancelar apenas libera a reserva; não soma ingredientes nem bebidas.')+'</p>'+
  '<details open><summary>Movimentações relacionadas ao pedido</summary><ul>'+
  sum+'</ul></details>'+
  (refs.length?'<p class="pote-cancel-warning">Itens não encontrados: '+esc(refs.join(", "))+
  '. Recupere o cadastro antes de devolver; a reposição não será parcial.</p>':'');
 const warning=$("poteCancelError");warning.hidden=true;warning.textContent="";
 $("poteCancelReturn").textContent=deducted?
   (recovering?"Devolver estoque deste pedido":"Cancelar e devolver ao estoque"):"Cancelar pedido sem baixa";
 $("poteCancelReturn").disabled=deducted&&refs.length>0;
 $("poteCancelDiscard").hidden=!deducted||recovering;
 dlg.hidden=false;
 $("poteCancelClose").focus?.();
 return true;
}
function close(){
 const dlg=$("poteCancelOrderModal");if(dlg)dlg.hidden=true;
 selected=null;
}
function perform(action){
 window.POTE_STOCK?.normalizeInventory?.(data());
 const order=findOrder(selected);
 if(!order||order.stockRestored===true&&action==="return")return false;
 if(order.status==="cancelado"&&!canRecover(order))return false;
 const recovery=order.status==="cancelado",deducted=wasDeducted(order);
 if(recovery&&action==="discard")return false;
 const shallReturn=deducted&&action==="return";
 const required=needs(order);
 const missing=shallReturn?missingReferences(order):[];
 if(missing.length){
  $("poteCancelError").hidden=false;
  $("poteCancelError").textContent="Não foi possível devolver: "+missing.join(", ");
  return false;
 }
 // No generic confirm: selected action is explicit and describes stock consequences.
 const at=new Date().toISOString();
 const changes=[];
 if(shallReturn){
  for(const [id,qty] of required.ins){
   if(qty<=0)continue;
   const it=data().ingredients.find(x=>x.id===id);
   changes.push({it,qty,id,kind:"ingredient"});
  }
  for(const [id,qty] of required.drinks){
   if(qty<=0)continue;
   const it=data().beverages.find(x=>x.id===id);
   changes.push({it,qty,id,kind:"beverage"});
  }
 }
 data().stockMovements??=[];
 for(const change of changes){
  change.it.stock=Number((Number(change.it.stock||0)+change.qty).toFixed(5));
  data().stockMovements.unshift({
   id:typeof uid==="function"?uid():"refund-"+order.id+"-"+change.id+"-"+Date.now(),
   at,ingredientId:change.kind==="beverage"?"bev:"+change.id:change.id,
   ingredientName:change.it.name,quantity:change.qty,
   reason:change.kind==="beverage"?"Estorno bebida por cancelamento":"Estorno de estoque por cancelamento",
   referenceId:order.id,previousStatus:order.status,afterStock:change.it.stock
  });
 }
 if(shallReturn){order.stockRestored=true;order.stockRestoredAt=at;order.stockReturnDeclined=false}
 if(deducted&&action==="discard")order.stockReturnDeclined=true;
 if(!recovery){order.status="cancelado";order.canceledAt=at}
 order.cancelStockAction=shallReturn?"devolvido":deducted?"perda":"sem-baixa";
 if(deducted&&action==="discard"){
  const event=window.POTE_LOSSES?.recordCancelled?.(order);
  if(event&&!event.ok)console.warn("Perda do pedido pendente:",event.error);
 }
 state.tab="orders";
 if(typeof persist==="function")persist();
 close();
 if(typeof render==="function")render();
 if(window.POTE_ORDER?.scrollToOrders)window.POTE_ORDER.scrollToOrders(order.id);
 if(typeof toast==="function")toast(shallReturn?
  "Pedido cancelado: estoque devolvido com registro de estorno.":
  deducted?"Pedido cancelado: estoque mantido como consumo/perda.":
  "Pedido cancelado: reserva liberada, sem alterar o saldo físico.");
 return true;
}
window.POTE_CANCEL={open,perform,needs,wasDeducted,canRecover,missingReferences,close};
})();
