/* Pedidos com reserva de estoque antes da confirmação, avisos críticos e navegação previsível. */
(function(){
"use strict";
if(window.POTE_ORDER)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=x=>Number(x)||0;
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0;
const fmtQty=x=>Number(x).toLocaleString("pt-BR",{maximumFractionDigits:2});
function joinNeeds(quote,qty,settings,ingredients){
 const q=Math.max(0,Number(qty)||0);
 const rows=[...(quote?.recipe?.items||[]).map(i=>({...i})),
  ...(quote?.addons||[]).filter(a=>a?.ingredientId).map(a=>({id:a.ingredientId,g:n(a.quantity)}))];
 if(settings?.usePackagingStock){
  const ids=quote?.recipe?.packagingIngredientIds;
  for(const i of ingredients.filter(x=>x.category==="Embalagem"&&!x.archived&&
       (!Array.isArray(ids)||ids.includes(x.id))))rows.push({id:i.id,g:1,isPkg:true});
 }
 const needs=new Map();
 for(const x of rows){
  const ing=ingredients.find(i=>i.id===x.id);
  const key=String(x.id??"");
  if(!key)continue;
  const yieldRatio=Math.max(.01,n(ing?.yield||100)/100);
  const units=n(x.g)/yieldRatio;
  needs.set(key,(needs.get(key)||0)+units*q);
 }
 const drinks=new Map();
 for(const b of quote?.beverages||[])if(b?.id)drinks.set(b.id,(drinks.get(b.id)||0)+q);
 return {ingredients:needs,beverages:drinks};
}
function reserved(orders,excludeOrderId){
 const ins=new Map(),bevs=new Map();
 for(const o of orders||[]){
  if(!o||o.status!=="recebido"||o.stockDeducted===true||o.id===excludeOrderId)continue;
  const q=Math.max(0,n(o.qty));
  for(const row of o.items||[]){
   const id=String(row.id??"");if(!id)continue;
   const ratio=Math.max(.01,n(row.yieldPct||100)/100);
   ins.set(id,(ins.get(id)||0)+n(row.g)*q/ratio);
  }
  for(const b of o.beverageItems||[]){
   const id=String(b.id??"");if(!id)continue;
   bevs.set(id,(bevs.get(id)||0)+n(b.qty)*q);
  }
 }
 return {ingredients:ins,beverages:bevs};
}
function checkOrder(stock,quote,qty,{excludeOrderId=null}={}){
 const requested=Math.floor(Number(qty));
 if(!quote?.recipe||!Number.isFinite(requested)||requested<1||requested>1000)
  return {ok:false,maxUnits:0,errors:[{name:"Selecione uma receita válida e quantidade entre 1 e 1000.",missing:1}],low:[]};
 if(!Array.isArray(quote.recipe.items)||!quote.recipe.items.length)
  return {ok:false,maxUnits:0,errors:[{name:"Esta receita ainda não tem ingredientes cadastrados.",missing:1}],low:[]};
 const items=stock?.ingredients||[],beverages=stock?.beverages||[];
 const needs=joinNeeds(quote,1,stock?.settings,items);
 const pending=reserved(stock?.orders,excludeOrderId);
 const errors=[],low=[];
 let maxUnits=Infinity;
 const test=(id,perUnit,records,reserves,measure,type)=>{
  if(perUnit<=0)return;
  const record=records.find(i=>i.id===id);
  const inventory=Math.max(0,n(record?.stock));
  const held=Math.max(0,n(reserves.get(id)));
  const available=Math.max(0,inventory-held);
  const capacity=Math.floor((available+1e-7)/perUnit);
  maxUnits=Math.min(maxUnits,capacity);
  const name=record?.name||"Insumo excluído ("+id+")";
  if(!record||available+1e-7<perUnit*requested){
   const shortage=Math.max(0,perUnit*requested-available);
   errors.push({id,kind:type,name,available,needed:perUnit*requested,missing:shortage,
    reserved:held,unit:measure,kind:type});
  }
  if(capacity-requested<5){
   low.push({id,kind:type,name,available,unit:measure,capacity,
    after:Math.max(0,capacity-requested),reserved:held,kind:type});
  }
 };
 for(const [id,qtyPerUnit] of needs.ingredients)test(id,qtyPerUnit,items,pending.ingredients,
  items.find(i=>i.id===id)?.measureUnit||"g","ingredient");
 for(const [id,qtyPerUnit] of needs.beverages)test(id,qtyPerUnit,beverages,pending.beverages,"un","beverage");
 if(maxUnits===Infinity)maxUnits=0;
 return {ok:errors.length===0,maxUnits,errors,low,requested,pending};
}
function calc(quote,qty,{excludeOrderId=null}={}){
 return checkOrder({ingredients:state.data.ingredients,beverages:state.data.beverages,
  orders:state.data.orders,settings:state.data.settings},quote,qty,{excludeOrderId});
}
function currentQuote(){
 const v=$("orderItem")?.value||"",channel=$("orderChannel")?.value||"direto";
 const quote=typeof optionQuote==="function"?optionQuote(v,channel,
  $("orderExtraBev")?.value||"",$("orderExtraAddon")?.value||""):null;
 return window.POTE_ORDER_CUSTOM?.adjustQuote?.(quote)||quote;
}
function reportText(report){
 return report.errors.slice(0,6).map(x=>{
  if(!x.unit)return x.name;
  const amount=Math.max(0,x.missing);
  const unit=x.unit==="un"?"un":"gml".includes(x.unit)?x.unit:x.unit;
  return x.name+" — faltam "+fmtQty(amount)+" "+unit+
   (x.reserved>0?" (há quantidade reservada para pedidos pendentes)":"");
 }).join("; ");
}
let lastStockReport=null;
let savedOrderDraft=null;
const DRAFT_IDS=["orderItem","orderChannel","orderQty","orderPrice","orderClient",
 "orderAddress","orderNote","orderWeight","orderPayment","orderCashReceived",
 "orderHasDelivery","orderDelivery","orderExtraBev","orderExtraAddon",
 "orderComboRecipe","orderComboBeverage"];
function captureOrderDraft(){
 if(state?.tab!=="orders"||!$("orderItem"))return;
 const values={};
 for(const id of DRAFT_IDS)if($(id))values[id]=$(id).value;
 savedOrderDraft={values,uid:String(window.POTE_AUTH?.uid||"")};
}
function restoreDraft(){
 if(state?.tab!=="orders"||!savedOrderDraft||savedOrderDraft.uid!==String(window.POTE_AUTH?.uid||""))return false;
 const values=savedOrderDraft.values;
 for(const id of ["orderItem","orderChannel"]){if($(id)&&values[id]!=null)$(id).value=values[id]}
 window.POTE_DRINKS?.mount?.();
 for(const [id,v] of Object.entries(values))if($(id))$(id).value=v;
 savedOrderDraft=null;
 window.POTE_PAYMENT?.sync?.();
 window.POTE_ORDER_CUSTOM?.mount?.();
 return true;
}
function toRestockItems(report){
 const errors=(report?.errors||[]).filter(x=>x.id);
 const low=(report?.low||[]).filter(x=>x.id&&!errors.some(z=>z.id===x.id));
 return [...errors.map(x=>({...x,level:"missing"})),
  ...low.map(x=>({...x,level:"low"}))];
}
function restockItem(id,kind){
 const items=toRestockItems(lastStockReport);
 if(!items.length){go("ingredients");return}
 captureOrderDraft();
 window.POTE_RESTOCK_CONTEXT={items,from:state?.tab||"orders",
  startedAt:new Date().toISOString()};
 const modal=$("poteOrderAlerts");if(modal)modal.hidden=true;
 go("ingredients");
 const selected=items.find(i=>i.id===id&&i.kind===kind)||items[0];
 if(selected.kind==="beverage")window.POTE_STOCK_EXT?.selectBeverage?.(selected.id);
 else window.POTE_STOCK_UI?.openPurchase?.(selected.id);
}
function restock(){
 const items=toRestockItems(lastStockReport);
 if(!items.length){go("ingredients");return}
 restockItem(items[0].id,items[0].kind);
}
window.addEventListener?.("pote:user-logout",()=>{
 savedOrderDraft=null;lastStockReport=null;window.POTE_RESTOCK_CONTEXT=null;
});
function ensureModal(){
 let modal=$("poteOrderAlerts");if(modal)return modal;
 modal=document.createElement("div");modal.id="poteOrderAlerts";modal.hidden=true;
 modal.innerHTML='<section class="pote-order-dialog" role="alertdialog" aria-modal="true" aria-labelledby="poteOrderAlertTitle">'+
 '<small>CONTROLE DE ESTOQUE</small><h2 id="poteOrderAlertTitle">Aviso</h2>'+
 '<p id="poteOrderAlertDescription"></p><div id="poteOrderAlertItems" class="pote-order-alert-items"></div>'+
 '<div class="pote-order-alert-actions"><button type="button" class="btn line" id="poteOrderAlertClose">Entendi</button>'+
 '<button type="button" class="btn" id="poteOrderAlertStock">Ver estoque</button>'+
 '<button type="button" class="btn" id="poteOrderAlertRestock">Repor estoque faltante</button></div></section>';
 document.body.appendChild(modal);
 $("poteOrderAlertClose").addEventListener("click",()=>{modal.hidden=true});
 $("poteOrderAlertStock").addEventListener("click",()=>{captureOrderDraft();modal.hidden=true;go("ingredients")});
 $("poteOrderAlertRestock").addEventListener("click",restock);
 return modal;
}
function showAlert(title,description,report=null){
 const modal=ensureModal();
 $("poteOrderAlertTitle").textContent=title;
 $("poteOrderAlertDescription").textContent=description;
 lastStockReport=report;
 const items=toRestockItems(report);
 const list=$("poteOrderAlertItems");
 if(list)list.innerHTML=items.map(x=>'<div class="pote-order-alert-item '+(x.level==="missing"?"missing":"low")+'">'+
  '<button type="button" class="pote-order-missing-open" data-need-id="'+esc(x.id)+'" data-need-kind="'+esc(x.kind)+'" onclick="POTE_ORDER.restockItem(this.dataset.needId,this.dataset.needKind)">'+(x.level==="missing"?"FALTANTE: ":"ESTOQUE BAIXO: ")+esc(x.name)+' · toque para repor</button>'+
  '<small>'+(x.level==="missing"?
   'Repor '+fmtQty(x.missing)+' '+esc(x.unit||"un")+'. Disponível após reservas: '+fmtQty(x.available)+' '+esc(x.unit||"un"):
   'Restam insumos para '+fmtQty(x.after)+' unidade(s) após este pedido.')+'</small></div>').join("");
 const restockButton=$("poteOrderAlertRestock");
 if(restockButton){restockButton.disabled=!items.length;restockButton.hidden=!items.length}
 modal.hidden=false;
 $("poteOrderAlertClose").focus?.();
}
function refresh(){
 if(typeof state==="undefined"||state.tab!=="orders")return;
 const status=$("poteOrderAvailability"),button=$("poteOrderRegister");
 if(!status||!button)return;
 const quote=currentQuote(),qty=Number($("orderQty")?.value||1);
 const check=calc(quote,qty);
 status.className="pote-order-availability "+(check.ok?(check.low.length?"low":"ok"):"blocked");
 if(!check.ok){
  status.innerHTML='<strong>Pedido bloqueado: estoque insuficiente.</strong><span>'+
   esc(reportText(check))+'</span><small>Capacidade disponível: '+fmtQty(check.maxUnits)+
   ' unidade(s), já descontados os pedidos aguardando produção.</small>';
  button.disabled=true;
  button.title="Reponha o estoque antes de registrar este pedido.";
 }else{
  if(check.low.length){
   status.innerHTML='<strong>Estoque baixo: restam menos de 5 unidades deste produto.</strong>'+
    '<span>Após este pedido: '+fmtQty(Math.max(0,check.maxUnits-check.requested))+
    ' unidade(s) possíveis. Verifique: '+esc(check.low.slice(0,4).map(x=>x.name).join(", "))+'</span>';
  }else{
   status.innerHTML='<strong>Estoque suficiente para registrar.</strong><span>'+
    'Capacidade restante após registrar: '+fmtQty(check.maxUnits-check.requested)+
    ' unidade(s), considerando os pedidos já recebidos.</span>';
  }
  button.disabled=false;button.title="";
 }
 return check;
}
function checkCart(items,{requireMain=false}={}){
 const cartItems=Array.isArray(items)?items:[];
 const main=cartItems.filter(m=>m.kind==="recipe"||m.kind==="combo");
 if(requireMain&&!main.length)return {ok:false,errors:[{name:"Inclua ao menos uma receita ou combo para finalizar a sacola.",missing:1}],low:[]};
 const needs=new Map(),drinks=new Map(),issues=[];
 const add=(map,k,v)=>{if(!k||!Number.isFinite(v)||v<=0)return;map.set(k,(map.get(k)||0)+v)};
 for(const m of main){
  const qty=Number(m.qty);
  if(!Number.isInteger(qty)||qty<1||qty>1000){
   issues.push({name:"Quantidade inválida em "+(m.name||"produto"),missing:1});continue;
  }
  const quote=window.POTE_DRINKS?.quoteForCart?.(m,"direto")||
    (typeof optionQuote==="function"?optionQuote(m.kind+":"+m.id,"direto"):null);
  if(!quote?.recipe||quote.recipe.unavailable||!Array.isArray(quote.recipe.items)||!quote.recipe.items.length){
   issues.push({name:"Produto indisponível ou sem ficha: "+(m.name||"produto"),missing:1});continue;
  }
  if(typeof canSell==="function"&&!canSell(quote.recipe)){
   issues.push({name:"Produto não autorizado: "+quote.recipe.name,missing:1});continue;
  }
  if(!positive(m.price)){
   issues.push({name:"Produto sem preço configurado: "+quote.recipe.name,missing:1});continue;
  }
  const req=joinNeeds(quote,qty,state.data.settings,state.data.ingredients);
  for(const [id,v] of req.ingredients)add(needs,id,v);
  for(const [id,v] of req.beverages)add(drinks,id,v);
 }
 for(const m of cartItems.filter(i=>i.kind==="addon")){
  const item=state.data.addons.find(a=>a.id===m.id);
  const ing=state.data.ingredients.find(i=>i.id===item?.ingredientId);
  if(!item||!ing||!positive(item.quantity)){
   issues.push({name:"Adicional indisponível: "+(m.name||m.id),missing:1});continue;
  }
  add(needs,ing.id,n(item.quantity)*n(m.qty)/Math.max(.01,n(ing.yield||100)/100));
 }
 for(const m of cartItems.filter(i=>i.kind==="bev")){
  const item=state.data.beverages.find(b=>b.id===m.id);
  if(!item){issues.push({name:"Bebida indisponível: "+(m.name||m.id),missing:1});continue}
  add(drinks,item.id,n(m.qty));
 }
 const held=reserved(state.data.orders);
 for(const [id,needed] of needs){
  const item=state.data.ingredients.find(i=>i.id===id);
  const available=Math.max(0,n(item?.stock)-n(held.ingredients.get(id)));
  if(!item||available+1e-7<needed){
   issues.push({id,kind:"ingredient",name:item?.name||"Insumo excluído ("+id+")",
    missing:Math.max(0,needed-available),available,needed,
    reserved:n(held.ingredients.get(id)),unit:item?.measureUnit||"g"});
  }
 }
 for(const [id,needed] of drinks){
  const item=state.data.beverages.find(i=>i.id===id);
  const available=Math.max(0,n(item?.stock)-n(held.beverages.get(id)));
  if(!item||available+1e-7<needed){
   issues.push({id,kind:"beverage",name:item?.name||"Bebida excluída ("+id+")",
    missing:Math.max(0,needed-available),available,needed,
    reserved:n(held.beverages.get(id)),unit:"un"});
  }
 }
 return {ok:issues.length===0,errors:issues,low:[],mainCount:main.length};
}
function acceptCart(items,{requireMain=false}={}){
 const result=checkCart(items,{requireMain});
 if(result.ok)return true;
 showAlert("Sacola bloqueada — estoque ou cadastro insuficiente",
  reportText(result)+". Corrija antes de registrar ou enviar este pedido.",result);
 return false;
}
function checkBeforeRegister(){
 const q=currentQuote(),qty=$("orderQty")?.value;
 const result=calc(q,qty);
 if(!result.ok){
  showAlert("Pedido não registrado — estoque insuficiente",
   reportText(result)+". Reponha ou ajuste o estoque antes de aceitar o pedido.",result);
  refresh();return false;
 }
 return true;
}
function checkBeforeProduce(order){
 if(!order)return false;
 const held=reserved(state.data.orders,order.id),qty=Math.max(0,n(order.qty)),errors=[];
 const needs=new Map(),drinks=new Map();
 for(const row of order.items||[]){
  const ratio=Math.max(.01,n(row.yieldPct||100)/100);
  needs.set(row.id,(needs.get(row.id)||0)+n(row.g)*qty/ratio);
 }
 for(const row of order.beverageItems||[]){
  drinks.set(row.id,(drinks.get(row.id)||0)+n(row.qty)*qty);
 }
 for(const [id,needed] of needs){
  const item=state.data.ingredients.find(i=>i.id===id);
  const available=Math.max(0,n(item?.stock)-n(held.ingredients.get(id)));
  if(!item||available+1e-7<needed)
   errors.push({id,kind:"ingredient",name:item?.name||id,missing:Math.max(0,needed-available),
    available,needed,reserved:n(held.ingredients.get(id)),
    unit:item?.measureUnit||"g"});
 }
 for(const [id,needed] of drinks){
  const item=state.data.beverages.find(b=>b.id===id);
  const available=Math.max(0,n(item?.stock)-n(held.beverages.get(id)));
  if(!item||available+1e-7<needed)
   errors.push({id,kind:"beverage",name:item?.name||id,missing:Math.max(0,needed-available),
    available,needed,reserved:n(held.beverages.get(id)),unit:"un"});
 }
 if(errors.length){
  showAlert("Produção bloqueada — estoque comprometido",
   reportText({errors})+". Confira as reservas e reponha o estoque antes de produzir.",{errors});
  return false;
 }
 return true;
}
function lowAfterOrder(order){
 if(!order)return;
 const quote={recipe:state.data.recipes.find(r=>r.id===order.recipeId)};
 if(!quote.recipe)return;
 const result=calc(quote,1);
 if(!result.low.length)return;
 const qty=Math.max(0,result.maxUnits);
 const names=result.low.slice(0,4).map(x=>x.name).join(", ");
 showAlert("Alerta: estoque para menos de 5 unidades",
  qty===0?"Não é possível produzir mais uma unidade de "+order.name+
   ". Reponha "+names+".":"Restam ingredientes para aproximadamente "+qty+
   " unidade(s) de "+order.name+". Confira "+names+" e prepare a reposição.",result);
}
function scrollToOrders(id){
 if(typeof state==="undefined")return;
 state.tab="orders";
 const section=$("ordersHistoryTitle");
 if(section)requestAnimationFrame(()=>section.scrollIntoView({behavior:"smooth",block:"start"}));
 if(id){
  const el=[...document.querySelectorAll("[data-order-id]")].find(x=>x.dataset.orderId===id);
  if(el){el.classList.add("pote-order-focus");setTimeout(()=>el.classList.remove("pote-order-focus"),2200)}
 }
}
function scanLowRecipes(limit=8){
 if(typeof state==="undefined")return [];
 const result=[];
 const candidates=(state.data.recipes||[]).filter(r=>typeof canSell==="function"?canSell(r):!r.unavailable);
 for(const recipe of candidates){
  if(!Array.isArray(recipe.items)||!recipe.items.length)continue;
  const check=calc({recipe},1);
  if(check.maxUnits<5)result.push({id:recipe.id,name:recipe.name,maxUnits:check.maxUnits,
   missing:check.errors.length>0,ingredients:check.low.slice(0,3).map(i=>i.name)});
 }
 result.sort((a,b)=>a.maxUnits-b.maxUnits||a.name.localeCompare(b.name,"pt-BR"));
 return result.slice(0,Math.max(1,limit));
}
function alertOnEnter(){
 const quote=currentQuote();
 if(!quote)return;
 const check=calc(quote,1);
 if(check.maxUnits>=5)return;
 const names=check.low.slice(0,4).map(x=>x.name).join(", ");
 const key=String(state.data.businessType||"")+":"+
   String(quote.recipe?.id)+":"+String(check.maxUnits)+":"+names;
 if(window.POTE_ORDER_LAST_LOW===key)return;
 window.POTE_ORDER_LAST_LOW=key;
 showAlert(check.maxUnits===0?"Atenção: produto sem estoque":"Aviso de reposição",
  check.maxUnits===0?"Não há saldo disponível para produzir "+quote.recipe.name+". "+names:
  "Restam ingredientes para "+check.maxUnits+" unidade(s) de "+quote.recipe.name+
  ". Considere comprar os seguintes itens: "+names,check);
}
window.POTE_ORDER={joinNeeds,reserved,checkOrder,checkCart,acceptCart,calc,currentQuote,refresh,checkBeforeRegister,
 checkBeforeProduce,showAlert,restock,restockItem,toRestockItems,restoreDraft,scrollToOrders,lowAfterOrder,alertOnEnter,scanLowRecipes,ensureModal};
})();
