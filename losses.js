/* Perdas reais: descarte de estoque, cancelamento pós-produção e inadimplência.
   Custo perdido e receita não recebida são métricas distintas.
   Não altera estoque novamente quando o pedido já foi produzido. */
(function(){
"use strict";
if(window.POTE_LOSSES)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=v=>window.POTE_STOCK?.number?.(v)??Number(v);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmt=v=>Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
const date=v=>{const d=new Date(v);return Number.isFinite(d.valueOf())?
 d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):String(v||"");};
const newId=()=>typeof uid==="function"?uid():"loss-"+Date.now()+"-"+Math.floor(Math.random()*1000000);
const data=()=>state.data;
const storage=()=>data().losses??(data().losses=[]);
const reasons=[
 ["vencimento","Vencimento ou apodrecimento"],
 ["queda","Queda no chão"],
 ["higiene","Descarte por higiene"],
 ["preparo","Erro de preparo"],
 ["deterioracao","Deterioração / refrigeração"],
 ["avaria","Avaria / embalagem danificada"],
 ["outro","Outros motivos"]
];
function itemKind(kind){return kind==="beverage"?"beverage":"ingredient"}
function item(kind,id){return ((kind==="beverage"?data().beverages:data().ingredients)||[]).find(i=>i.id===id&&!i.archived)}
function baseUnit(ingredient,kind){
 // Bebidas do catálogo são estocadas por lata/garrafa, normalmente sem measureUnit.
 // Nunca presumir gramas para esses itens.
 if(kind==="beverage"||(data().beverages||[]).some(b=>b===ingredient||b.id===ingredient?.id))return "un";
 return ingredient?.measureUnit==="ml"?"ml":
  ingredient?.measureUnit==="un"?"un":"g";
}
function costUnit(ingredient){
 if(!ingredient)return {cost:0,known:false};
 if(data().settings?.costBasis==="average"&&ingredient.averageCostKnown===true&&Number(ingredient.averageUnitCost)>0)
  return {cost:Number(ingredient.averageUnitCost),known:true};
 const price=n(ingredient.purchasePrice??ingredient.price);
 const quantity=n(ingredient.purchaseQuantity),unit=ingredient.purchaseUnit;
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(quantity)||quantity<=0)
  return {cost:0,known:false};
 const factor=(unit==="kg"||unit==="L")?1000:1;
 const base=baseUnit(ingredient);
 if((base==="g"&&unit!=="kg"&&unit!=="g")||
    (base==="ml"&&unit!=="L"&&unit!=="ml")||
    (base==="un"&&unit!=="un"))return {cost:0,known:false};
 return {cost:price/(quantity*factor),known:true};
}
function orderCost(order){
 if(order?.costSnapshot?.version===1){
  const snap=order.costSnapshot;
  const qty=Math.max(1,Number(order.qty)||1);
  return {cost:Number(snap.totalMaterialCost)||0,known:snap.costKnown===true,
   estimated:snap.estimated===true,unknown:Array.isArray(snap.missingCosts)?snap.missingCosts:[],
   uncollectedSale:Number(((Number(order.price)||0)*qty+(Number(order.deliveryFee)||0)).toFixed(2))};
 }
 let cost=0,unknown=[];
 const quantity=Math.max(1,Number(order?.qty)||1);
 for(const row of order.items||[]){
  const ingredient=item("ingredient",row.id)||
    (data().ingredients||[]).find(i=>i.id===row.id);
  const per=costUnit(ingredient);
  if(!per.known){unknown.push(ingredient?.name||row.ingredientName||row.id);continue}
  const yieldPct=Math.max(.01,(Number(row.yieldPct)||100)/100);
  cost+=per.cost*(Number(row.g)||0)*quantity/yieldPct;
 }
 for(const b of order.beverageItems||[]){
  const beverage=item("beverage",b.id);
  const per=costUnit(beverage);
  if(!per.known){unknown.push(beverage?.name||b.name||b.id);continue}
  cost+=per.cost*(Number(b.qty)||0)*quantity;
 }
 return {cost:Number(cost.toFixed(2)),known:!unknown.length,unknown,
  uncollectedSale:Number(((Number(order.price)||0)*quantity+(Number(order.deliveryFee)||0)).toFixed(2))};
}
function activeLosses(){
 return storage().filter(l=>!l.voidedAt);
}
function totals(){
 const list=activeLosses();
 return {count:list.length,
  cost:Number(list.reduce((a,l)=>a+(Number(l.costLost)||0),0).toFixed(2)),
  uncollected:Number(list.reduce((a,l)=>a+(Number(l.uncollectedSale)||0),0).toFixed(2)),
  missingCostCount:list.filter(l=>!l.costKnown).length,
  stockLosses:list.filter(l=>l.type==="stock").length,
  orderLosses:list.filter(l=>l.type==="order").length};
}
function stockLoss({kind="ingredient",id,quantity,unit,reason="outro",note=""}){
 const type=itemKind(kind),ing=item(type,id);
 if(!ing)return {ok:false,error:"Escolha um item que esteja cadastrado e ativo."};
 if(!reasons.some(r=>r[0]===reason))return {ok:false,error:"Motivo da perda inválido."};
 if(!String(note||"").trim()&&reason==="outro")
  return {ok:false,error:"Descreva o motivo quando selecionar Outros."};
 if(baseUnit(ing,type)==="un"&&(!Number.isInteger(n(quantity))||n(quantity)<1))
  return {ok:false,error:"Informe um número inteiro de unidades (garrafas, latas, potes etc.)."};
 let base;
 try{base=window.POTE_STOCK.toBase(type==="beverage"?{...ing,measureUnit:"un"}:ing,quantity,unit)}
 catch(e){return {ok:false,error:e.message}}
 const current=n(ing.stock);
 if(!Number.isFinite(current)||current<0)return {ok:false,error:"Saldo físico inválido. Faça uma conferência."};
 if(base>current+1e-7)return {ok:false,error:"Quantidade perdida maior que o estoque físico ("+
  window.POTE_STOCK.formatStock(type==="beverage"?{...ing,measureUnit:"un"}:ing)+")."};
 const held=window.POTE_STOCK_STATUS?.reserved?.(data());
 const heldQty=Number((type==="beverage"?held?.beverages:held?.ingredients)?.get(id)||0);
 const remaining=current-base;
 const costBasis=costUnit(ing),event={
  id:newId(),at:new Date().toISOString(),type:"stock",
  reason,description:String(note||"").slice(0,350),
  itemId:id,itemName:ing.name,
  itemKind:type==="ingredient"&&ing.category==="Embalagem"?"packaging":type,
  measureUnit:baseUnit(ing,type),
  quantityBase:base,enteredQuantity:n(quantity),enteredUnit:unit,
  costLost:costBasis.known?Number((base*costBasis.cost).toFixed(2)):0,
  costKnown:costBasis.known,
  uncollectedSale:0,previousStock:current,afterStock:Number(remaining.toFixed(5))
 };
 // Inventory is changed only once and event is journaled in the same in-memory state mutation.
 ing.stock=event.afterStock;
 storage().unshift(event);
 (data().stockMovements??=[]).unshift({
  id:newId(),at:event.at,ingredientId:type==="beverage"?"bev:"+id:id,
  ingredientName:ing.name,quantity:-base,
  reason:"Perda: "+(reasons.find(r=>r[0]===reason)?.[1]||reason),
  referenceId:event.id,previousStock:current,afterStock:event.afterStock,
  itemKind:type
 });
 if(typeof persist==="function")persist();
 if(typeof render==="function")render();
 if(heldQty>event.afterStock&&typeof toast==="function")
  toast("Perda registrada. Atenção: pedidos reservados excedem o estoque restante.");
 else if(typeof toast==="function")
  toast("Perda registrada: "+ing.name+" · "+money(event.costLost)+" de custo.");
 return {ok:true,event,reservationShortage:Math.max(0,heldQty-event.afterStock)};
}
function existingOrderLoss(orderId){
 return storage().find(l=>l.type==="order"&&l.orderId===orderId&&!l.voidedAt);
}
function orderLoss({order,reason="cancelamento",note="",fromCancel=false}){
 if(!order||!data().orders.some(o=>o.id===order.id))
  return {ok:false,error:"Pedido não encontrado."};
 if(existingOrderLoss(order.id))return {ok:false,error:"Já existe uma perda registrada para esse pedido."};
 const deducted=window.POTE_CANCEL?.wasDeducted?.(order)||
   order.stockDeducted===true||order.status==="em_producao"||order.status==="entregue";
 if(!deducted)return {ok:false,error:"Pedido sem baixa de estoque. Cancele normalmente para liberar a reserva, sem registrar perda material."};
 if(order.stockRestored)return {ok:false,error:"O estoque desse pedido já foi devolvido. Não é perda de material."};
 if(reason==="nao_pagamento"&&(order.status==="cancelado"||order.stockReturnDeclined))
  return {ok:false,error:"Pedido cancelado já tem o fluxo de perda. Evite dupla contabilização."};
 if(reason==="cancelamento"&&(!fromCancel&&order.status!=="cancelado"))
  return {ok:false,error:"Use Cancelar pedido → Cancelar sem devolver (perda) para registrar uma perda de produção."};
 const direct=orderCost(order),record={
  id:newId(),at:new Date().toISOString(),type:"order",reason,
  description:String(note||"").slice(0,350),
  orderId:order.id,orderName:order.name,quantity:Math.max(1,Number(order.qty)||1),
  costLost:direct.cost,costKnown:direct.known,costEstimated:direct.estimated===true,missingCosts:direct.unknown,
  uncollectedSale:direct.uncollectedSale,
  stockAlreadyDeducted:true,stockMovement:false
 };
 storage().unshift(record);
 order.lossEventId=record.id;
 if(reason==="cancelamento")order.stockReturnDeclined=true;
 if(reason==="nao_pagamento"){
  order.paymentStatus="nao_pago";
  order.unpaidAt=record.at;
 }
 if(typeof persist==="function")persist();
 if(typeof render==="function")render();
 return {ok:true,event:record};
}
function recordCancelled(order){
 if(!order||order.stockRestored||!order.stockReturnDeclined)return {ok:false,error:"Pedido não classificado como perda."};
 const result=orderLoss({order,reason:"cancelamento",note:"Produzido e descartado após cancelamento",fromCancel:true});
 if(result.ok&&typeof toast==="function")toast("Prejuízo do pedido registrado. Nenhuma segunda baixa de estoque.");
 return result;
}
function markNonPayment(orderId,note=""){
 const order=data().orders.find(o=>o.id===orderId);
 if(!order)return {ok:false,error:"Pedido não encontrado."};
 const result=orderLoss({order,reason:"nao_pagamento",note});
 if(result.ok&&typeof toast==="function")
  toast("Não pagamento registrado. Receita não será contada como recebida; o estoque não sofre nova baixa.");
 return result;
}
function recoverPayment(orderId){
 const order=data().orders.find(o=>o.id===orderId);
 const loss=order&&storage().find(l=>l.id===order.lossEventId&&l.reason==="nao_pagamento");
 if(!loss||loss.voidedAt)return {ok:false,error:"Não há inadimplência ativa neste pedido."};
 loss.voidedAt=new Date().toISOString();
 loss.voidReason="Pagamento recebido posteriormente";
 order.paymentStatus="pago";
 order.paidAt=loss.voidedAt;
 if(typeof persist==="function")persist();
 if(typeof render==="function")render();
 return {ok:true,loss};
}
function warn(str){const box=$("poteLossFormError");if(box){box.hidden=false;box.textContent=str}else if(typeof alert==="function")alert(str)}
function selectOptions(arr,getId,label){
 return arr.map(x=>'<option value="'+esc(getId(x))+'">'+esc(label(x))+'</option>').join("");
}
function page(){
 const loss=totals(),ingredients=(data().ingredients||[]).filter(i=>!i.archived)
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR")),
  drinks=(data().beverages||[]).sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
 const orders=(data().orders||[]).filter(o=>o.status!=="cancelado"&&
  (o.stockDeducted||o.status==="em_producao"||o.status==="entregue")&&
  !existingOrderLoss(o.id));
 const review=storage().slice(0,80);
 const unclassified=(data().orders||[]).filter(o=>o.status==="cancelado"&&
   (window.POTE_CANCEL?.wasDeducted?.(o)||o.stockDeducted===true)&&
   !o.stockRestored&&!existingOrderLoss(o.id));
 return '<section class="pote-losses">'+
 '<header class="pote-loss-header"><span>CONTROLE DE DESPERDÍCIO</span><h2>Perdas e prejuízos</h2>'+
 '<p>Registre tudo o que foi descartado, estragou, caiu no chão ou deixou de ser pago. O custo da perda reduz o resultado estimado; a receita não recebida é exibida separadamente. O custo de materiais é estimado pelo preço de compra cadastrado.</p></header>'+
 '<div class="pote-loss-metrics">'+
  '<div><small>Prejuízo direto registrado</small><strong>'+money(loss.cost)+'</strong></div>'+
  '<div><small>Vendas que não entraram</small><strong>'+money(loss.uncollected)+'</strong></div>'+
  '<div><small>Ocorrências</small><strong>'+loss.count+'</strong></div>'+
  '<div><small>Sem custo conhecido</small><strong>'+loss.missingCostCount+'</strong></div>'+
 '</div>'+
 '<div class="pote-loss-panel">'+
  '<h3><span>1</span> Ingrediente, embalagem ou bebida descartada</h3>'+
  '<p>Ex.: batata apodrecida, bacon no chão, bebida avariada ou pote quebrado. A unidade muda conforme o produto: <b>água e refrigerante em garrafas ou latas são lançados em unidades</b>; líquidos a granel usam L/ml. O estoque é descontado uma única vez.</p>'+
  '<div class="pote-loss-form">'+
   '<label>Tipo de item<select id="lossStockKind" onchange="POTE_LOSSES.updateStockForm(\'kind\')">'+
   '<option value="ingredient">Alimento / ingrediente</option>'+
   '<option value="packaging">Embalagem / descartável</option>'+
   '<option value="beverage">Bebida · lata, garrafa ou água</option></select></label>'+
   '<label>Qual produto?<select id="lossStockId" onchange="POTE_LOSSES.updateStockForm(\'item\')">'+
   selectOptions(ingredients,x=>x.id,x=>x.name+" · "+window.POTE_STOCK.formatStock(x))+
   '</select></label>'+
   '<label>Quantidade perdida<input id="lossStockQty" inputmode="decimal" placeholder="Selecione o tipo e o item" oninput="POTE_LOSSES.preview()"></label>'+
   '<label>Unidade de medida<select id="lossStockUnit" onchange="POTE_LOSSES.preview()"></select></label>'+
   '<label>Motivo<select id="lossStockReason">'+
    selectOptions(reasons,x=>x[0],x=>x[1])+'</select></label>'+
   '<label class="loss-wide">Observações<input id="lossStockNote" maxlength="350" placeholder="Detalhe o descarte (opcional)"></label>'+
  '</div><div id="lossStockPreview" class="pote-loss-preview"></div>'+
  '<button class="btn" type="button" onclick="POTE_LOSSES.submitStock()">Registrar perda e baixar estoque</button>'+
 '</div>'+
 '<div class="pote-loss-panel">'+
  '<h3><span>2</span> Pedido produzido, mas não pago</h3>'+
  '<p>Não desconte batata, bacon, embalagem nem bebidas novamente. O pedido fica marcado como não recebido, com o custo dos produtos separado do valor de venda perdido.</p>'+
  '<div class="pote-loss-form"><label class="loss-wide">Pedido entregue / já produzido'+
   '<select id="lossOrderId">'+
   (orders.length?selectOptions(orders,x=>x.id,x=>((typeof window==='object'&&window.POTE_ORDER_PUBLIC_CODE?.(x))||('#'+x.id.slice(-8)))+" · "+x.name+" · "+money((Number(x.price)||0)*(Number(x.qty)||1))):
     '<option value="">Sem pedidos elegíveis para inadimplência</option>')+
   '</select></label>'+
   '<label class="loss-wide">Motivo / tentativa de cobrança<input id="lossOrderNote" maxlength="350" placeholder="Ex.: cliente não pagou"></label></div>'+
  '<button type="button" class="btn" '+(!orders.length?"disabled":"")+
    ' onclick="POTE_LOSSES.submitUnpaid()">Registrar não pagamento</button>'+
  '<p class="pote-loss-tip">Cancelamento de pedido já produzido: na área Pedidos, escolha <b>Cancelar sem devolver · perda</b>. O prejuízo será registrado automaticamente.</p>'+
 '</div>'+
 (unclassified.length?'<section class="pote-loss-panel"><h3>Pedidos cancelados anteriormente</h3>'+
  '<p>Pedidos já produzidos e cancelados sem lançamento de perda. Registre o custo somente se os produtos foram realmente perdidos e não devolvidos ao estoque.</p>'+
  unclassified.map(o=>'<div class="pote-loss-legacy"><span>#'+esc((typeof window==='object'&&window.POTE_ORDER_PUBLIC_CODE?.(o))||('#'+o.id.slice(-8)))+' · '+esc(o.name)+'</span>'+
  '<button type="button" class="btn mini" data-loss-order="'+esc(o.id)+'" onclick="POTE_LOSSES.submitLegacyLoss(this.dataset.lossOrder)">Registrar prejuízo sem nova baixa</button></div>').join("")+
  '</section>':"")+
 '<div id="poteLossFormError" class="pote-loss-error" role="alert" hidden></div>'+
 '<section class="pote-loss-history"><h3>Histórico de perdas</h3>'+
 (review.length?'<div class="pote-loss-table">'+review.map(l=>
   '<article class="'+(l.voidedAt?'loss-voided':'')+'"><div><strong>'+esc(l.type==="stock"?l.itemName:l.orderName)+
   '</strong><small>'+esc(l.reason==="nao_pagamento"?"Não pagamento":
   l.reason==="cancelamento"?"Pedido cancelado após produção":
   reasons.find(x=>x[0]===l.reason)?.[1]||l.reason)+
   ' · '+esc(date(l.at))+
   (l.quantityBase!=null?' · '+fmt(l.quantityBase)+' '+esc(l.measureUnit):"")+
   '</small></div><div><b>'+money(l.costLost)+'</b>'+
   (l.uncollectedSale?'<small>Venda não recebida: '+money(l.uncollectedSale)+'</small>':"")+
   (l.voidedAt?'<small>Regularizada em '+esc(date(l.voidedAt))+'</small>':"")+
   (!l.costKnown?'<small>Custo incompleto: confira compras cadastradas</small>':"")+
   '</div>'+
   (!l.voidedAt&&l.reason==="nao_pagamento"?'<button type="button" class="btn mini line" data-loss-order="'+esc(l.orderId)+
    '" onclick="POTE_LOSSES.submitRecovery(this.dataset.lossOrder)">Recebi depois</button>':"")+
   '</article>').join("")+'</div>':
   '<p>Sem perdas registradas nesta conta.</p>')+
 '</section></section>';
}
function lossOptions(kind){
 const source=kind==="beverage"?data().beverages:data().ingredients;
 return (source||[]).filter(i=>!i.archived&&
  (kind==="beverage"||(kind==="packaging"?
   i.category==="Embalagem":i.category!=="Embalagem")))
  .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-BR"));
}
function updateStockForm(source="kind"){
 const kind=$("lossStockKind")?.value||"ingredient";
 const selector=$("lossStockId"),unit=$("lossStockUnit"),quantity=$("lossStockQty");
 if(!selector||!unit)return;
 const list=lossOptions(kind);
 const previous=selector.value;
 if(source!=="item"){
  selector.innerHTML=selectOptions(list,x=>x.id,x=>x.name+
   (x.size?" · "+x.size:"")+" · "+
   window.POTE_STOCK.formatStock(kind==="beverage"?{...x,measureUnit:"un"}:x));
  selector.value=list.some(i=>i.id===previous)?previous:list[0]?.id||"";
 }
 const selected=item(kind,selector.value);
 if(!selected){
  unit.innerHTML='<option value="">Nenhum produto nesta categoria</option>';
  unit.value="";
  if(quantity){quantity.value="";quantity.disabled=true;quantity.placeholder="Cadastre o produto no estoque primeiro";}
  preview();
  return;
 }
 if(quantity)quantity.disabled=false;
 const base=baseUnit(selected,kind);
 const names=base==="g"?[["kg","Quilograma (kg)"],["g","Grama (g)"]]:
  base==="ml"?[["L","Litro (L)"],["ml","Mililitro (ml)"]]:
  [["un","Unidade (garrafa, lata, pote etc.)"]];
 unit.innerHTML=names.map(([v,label])=>'<option value="'+esc(v)+'">'+esc(label)+'</option>').join("");
 unit.value=base==="g"?"kg":base==="ml"?"L":"un";
 if(quantity){
  quantity.value="";
  quantity.placeholder=base==="g"?"Ex.: 0,5 kg":base==="ml"?"Ex.: 250 ml":"Ex.: 1 unidade";
  quantity.inputMode=base==="un"?"numeric":"decimal";
 }
 preview();
}
function preview(){
 const kind=$("lossStockKind")?.value||"ingredient";
 const selected=item(kind,$("lossStockId")?.value);
 const output=$("lossStockPreview"),unit=$("lossStockUnit")?.value;
 if(!output)return;
 if(!selected||!unit){
  output.textContent="Selecione um produto cadastrado no estoque para registrar a perda.";
  return;
 }
 const display=kind==="beverage"?{...selected,measureUnit:"un"}:selected;
 const quantityText=String($("lossStockQty")?.value||"").trim();
 const entered=n(quantityText),factor=unit==="kg"||unit==="L"?1000:1;
 const amount=quantityText&&Number.isFinite(entered)&&entered>0?entered*factor:NaN;
 const rate=costUnit(selected);
 const bottle=kind==="beverage"?(selected.size||"garrafa/lata"):"";
 output.textContent="Estoque físico atual: "+window.POTE_STOCK.formatStock(display)+
  (bottle?" · Produto: "+bottle+" · Baixa por garrafas ou latas inteiras.":"")+
  (Number.isFinite(amount)?
   " · Quantidade a retirar: "+window.POTE_STOCK.formatStock(display,amount)+
   (rate.known?" · Prejuízo estimado: "+money(amount*rate.cost):
     " · Custo ainda não cadastrado"):
   " · Informe a quantidade perdida.");
}
function submitStock(){
 const result=stockLoss({kind:$("lossStockKind")?.value,
  id:$("lossStockId")?.value,quantity:$("lossStockQty")?.value,
  unit:$("lossStockUnit")?.value,reason:$("lossStockReason")?.value,
  note:$("lossStockNote")?.value});
 if(!result.ok)warn(result.error);
 return result;
}
function submitUnpaid(){
 const orderId=$("lossOrderId")?.value;
 if(!orderId)return warn("Selecione um pedido produzido.");
 const order=data().orders.find(o=>o.id===orderId);
 const gross=(Number(order.price)||0)*(Number(order.qty)||1)+(Number(order.deliveryFee)||0);
 const ok=window.confirm("Registrar que "+order.name+" não foi pago? Valor não recebido: "+money(gross)+
  ". O estoque já consumido NÃO será descontado novamente. Você pode reverter caso receba depois.");
 if(!ok)return false;
 const result=markNonPayment(orderId,$("lossOrderNote")?.value);
 if(!result.ok)warn(result.error);
 return result;
}
function submitLegacyLoss(orderId){
 const order=data().orders.find(o=>o.id===orderId);
 if(!order)return false;
 if(!window.confirm("Este pedido foi realmente produzido e perdido, sem devolução de materiais? Registrar apenas o custo do prejuízo, SEM baixar o estoque novamente?"))return false;
 const result=orderLoss({order,reason:"cancelamento",note:"Cancelamento anterior com perda de produção"});
 if(!result.ok)warn(result.error);
 return result;
}
function submitRecovery(orderId){
 const order=data().orders.find(o=>o.id===orderId);
 if(!order||!window.confirm("Confirmar que o pagamento do pedido "+order.name+" foi recebido?"))return false;
 const result=recoverPayment(orderId);
 if(!result.ok)warn(result.error);
 return result;
}
function mount(){
 if(state.tab==="losses")updateStockForm();
}
window.POTE_LOSSES={reasons,page,mount,stockLoss,orderLoss,recordCancelled,
 markNonPayment,recoverPayment,activeLosses,totals,costUnit,orderCost,
 submitStock,updateStockForm,preview,submitUnpaid,submitLegacyLoss,submitRecovery,existingOrderLoss};
})();
