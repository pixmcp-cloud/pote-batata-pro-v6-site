/* Gestão clara de estoque — saldo físico, compras reais, preço de referência e rendimento em áreas distintas. */
(function(){
"use strict";
if(window.POTE_STOCK_UI)return;
const S=window.POTE_STOCK;
const $=id=>document.getElementById(id);
const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const idFor=x=>String(x?.id??"");
const neededByPending=()=>{
 const ids=new Set();
 for(const order of state.data.orders||[]){
  if(order.status!=="recebido"&&order.status!=="em_producao")continue;
  for(const x of order.items||[])if(x.id)ids.add(x.id);
 }
 // A franquia deve enxergar os insumos de TODAS as fichas de preparo liberadas,
 // não apenas os materiais de pedidos que já foram feitos.
 for(const r of state.data.recipes||[]){
  if(r.unavailable||typeof canSell==="function"&&!canSell(r))continue;
  for(const x of r.items||[])if(x.id)ids.add(x.id);
  for(const id of r.packagingIngredientIds||[])ids.add(id);
 }
 for(const a of state.data.addons||[])if(a.ingredientId)ids.add(a.ingredientId);
 return ids;
};
const available=()=>{
 const required=neededByPending();
 return state.data.ingredients.filter(i=>!i.archived&&(
  !window.POTE_AUTH?.franchiseActive||
  i.templateOrigin!=="batataria"||
  i.category==="Embalagem"||
  required.has(i.id)
 )).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-BR",
 {sensitivity:"base",numeric:true}));
};
const integerFmt=(v,d=2)=>Number(v??0).toLocaleString("pt-BR",{maximumFractionDigits:d});
const sourceLabel=item=>{
 const src=String(item.source||"").toLowerCase();
 if(item.modelRecipe||item.templateOrigin||src.includes("referência")||src.includes("simula")||src.includes("atualize"))
   if(!src.startsWith("compra real")&&!src.startsWith("preço informado"))return "REFERÊNCIA DO MODELO · CONFIRA ANTES DE USAR";
 return "VALOR INFORMADO · ÚLTIMA COMPRA/EDIÇÃO";
};
function costUnit(item){
 const paid=S.number(item.purchasePrice??item.price);
 const q=S.number(item.purchaseQuantity??1);
 const u=item.purchaseUnit||"kg";
 if(!Number.isFinite(paid)||!Number.isFinite(q)||q<=0)return "Custo não informado";
 return S.money(paid)+" / "+integerFmt(q,3)+" "+u+" (embalagem, não estoque)";
}
function itemHealth(i,held,recipeRisk){
 const current=window.POTE_STOCK_STATUS?.requested?.(i.id,"ingredient");
 return window.POTE_STOCK_STATUS?.classify?.(i,held?.ingredients.get(i.id),{
   risk:recipeRisk.has(i.id),shortage:current?.level==="missing"
 })||{level:Number(i.stock)<=0?"missing":"good",
      label:Number(i.stock)<=0?"FALTANTE":"ESTOQUE BOM",available:Number(i.stock)||0,reservation:0};
}
function priorityPanel(visible,held,recipeRisk){
 const items=visible.map(i=>({i,health:itemHealth(i,held,recipeRisk),kind:"ingredient"}))
   .filter(x=>x.health.level==="missing");
 for(const b of state.data.beverages||[]){
  const h=window.POTE_STOCK_STATUS?.classify?.(b,held?.beverages.get(b.id),{
    shortage:window.POTE_STOCK_STATUS?.requested?.(b.id,"beverage")?.level==="missing"});
  if(h?.level==="missing")items.push({i:b,health:h,kind:"beverage"});
 }
 // Vínculos órfãos são mostrados explicitamente, nunca omitidos nem fabricados.
 const referenced=new Map();
 for(const order of state.data.orders||[]){
  if(order.status!=="recebido"&&!order.status?.startsWith("em_producao"))continue;
  for(const x of order.items||[])if(x.id&&!referenced.has(x.id))
   referenced.set(x.id,x);
 }
 for(const x of window.POTE_RESTOCK_CONTEXT?.items||[]){
  if(x.kind==="ingredient"&&x.id&&!referenced.has(x.id))referenced.set(x.id,x);
 }
 for(const [id,ref] of referenced){
  if(state.data.ingredients.some(i=>i.id===id&&!i.archived))continue;
  if(items.some(i=>i.i.id===id))continue;
  const old=state.data.ingredients.find(i=>i.id===id);
  items.push({i:{id,name:old?.name||ref.name||"Cadastro ausente: "+id,
    stock:0,measureUnit:old?.measureUnit||ref.unit||"un"},
   health:{level:"missing",reservation:0,available:0},kind:"ingredient",orphan:true});
 }
 if(!items.length)return "";
 items.sort((a,b)=>Number(!!b.orphan)-Number(!!a.orphan)||
  String(a.i.name||"").localeCompare(String(b.i.name||""),"pt-BR"));
 return '<section class="stock-urgent-list" role="status">'+
  '<div class="stock-urgent-header"><strong>FALTANTES · REPOR PRIMEIRO</strong>'+
  '<small>'+items.length+' item(ns) sem disponibilidade para novas vendas</small></div>'+
  '<div>'+items.map(({i,health,kind,orphan})=>'<button type="button" class="stock-urgent-link"'+
    ' data-need-id="'+e(i.id)+'" data-need-kind="'+e(kind)+'"'+
    ' onclick="POTE_STOCK_UI.jumpToNeed(this.dataset.needId,this.dataset.needKind)">'+
    '<strong>'+e(i.name)+'</strong><span>Físico: '+e(S.formatStock(kind==="beverage"?{...i,measureUnit:"un"}:i))+
    ' · Reservado: '+e(S.formatStock(kind==="beverage"?{...i,measureUnit:"un"}:i,health.reservation))+
    ' · Disponível: '+e(S.formatStock(kind==="beverage"?{...i,measureUnit:"un"}:i,health.available))+'</span>'+
    '<b>'+(orphan?"+ Recuperar cadastro original":"+ Repor")+'</b></button>').join("")+'</div></section>';
}
function restockPanel(){
 const previous=window.POTE_RESTOCK_CONTEXT?.items;
 if(!Array.isArray(previous)||!previous.length)return "";
 const items=window.POTE_STOCK_STATUS?.currentContext?.()||previous;
 if(!items.length)return '<section class="stock-restock-resolved" role="status">'+
  '<strong>Reposição atendida para este pedido.</strong>'+
  '<p>O saldo atualizado cobre os itens da falta anterior. Volte e confira o pedido novamente.</p>'+
  '<button type="button" class="btn" onclick="POTE_STOCK_UI.returnToOrder()">Voltar ao pedido</button></section>';
 return '<section class="stock-pending-replenish" id="stockRestockFocus" role="status">'+
  '<strong>Reposição necessária para o pedido</strong>'+
  '<p>Estes itens estão faltando ou baixos. Faça a compra ou ajuste a contagem física antes de voltar ao pedido. As reservas de pedidos pendentes já foram consideradas.</p>'+
  '<div>'+items.map(i=>'<article class="stock-pending-item '+(i.level==="missing"?"missing":"low")+'">'+
   '<button type="button" class="stock-pending-open" data-need-id="'+e(i.id)+'" data-need-kind="'+e(i.kind)+'" onclick="POTE_STOCK_UI.jumpToNeed(this.dataset.needId,this.dataset.needKind)">'+(i.level==="missing"?"FALTANTE":"ESTOQUE BAIXO")+': '+e(i.name)+'</button>'+
   '<span>'+(i.level==="missing"?"Faltam "+S.decimal(i.missing||0)+" "+e(i.unit||"un"):
      "Rendimento restante: "+S.decimal(i.capacity||0)+" unidade(s)")+'</span>'+
   '<button class="btn mini" type="button" data-need-id="'+e(i.id)+'" data-need-kind="'+e(i.kind)+
    '" onclick="POTE_STOCK_UI.jumpToNeed(this.dataset.needId,this.dataset.needKind)">Repor este item</button>'+
   '</article>').join("")+'</div>'+
  '<button type="button" class="btn line" onclick="POTE_STOCK_UI.returnToOrder()">Voltar ao pedido</button>'+
 '</section>';
}
function jumpToNeed(id,kind){
 if(kind==="beverage")window.POTE_STOCK_EXT?.selectBeverage?.(id);
 else openPurchase(id);
}
function returnToOrder(){
 window.POTE_RESTOCK_CONTEXT=null;
 if(typeof go==="function")go("orders");
}
function renderPanel(state,data){
 const visible=available();
 const held=window.POTE_STOCK_STATUS?.reserved?.(state.data);
 const recipeRisk=window.POTE_STOCK_STATUS?.recipeLowIds?.(state.data,held)||new Set();
 const ranks={missing:0,low:1,good:2};
 const displayItems=[...visible].sort((a,b)=>
  (ranks[itemHealth(a,held,recipeRisk).level]??3)-(ranks[itemHealth(b,held,recipeRisk).level]??3)||
  String(a.name||"").localeCompare(String(b.name||""),"pt-BR",{sensitivity:"base",numeric:true}));
 const count=visible.length,low=visible.filter(i=>S.number(i.minimum)>0&&
   S.number(i.stock)<=S.number(i.minimum)).length;
 const localStockCount=visible.filter(i=>S.number(i.stock)>0).length;
 const last=(state.data.purchases||[]).filter(p=>visible.some(i=>i.id===p.ingredientId))
  .slice(0,12);
 const shortages=window.POTE_ORDER?.scanLowRecipes?.(7)||[];
 return `<div class="stock-head">
  <div class="stock-kicker">INVENTÁRIO ATUAL · VALORES REAIS DA SUA CONTA</div>
  <h2>Estoque e compras</h2>
  <p><strong>Estoque</strong> é o saldo que existe fisicamente. <strong>Compra</strong> soma uma entrada ao saldo. <strong>Preço da embalagem</strong> e <strong>rendimento (%)</strong> servem só para calcular custos — não indicam quantidade disponível.</p>
  <div class="stock-summary">
   <div><small>Insumos cadastrados</small><strong>${count}</strong></div>
   <div><small>Com saldo positivo</small><strong>${localStockCount}</strong></div>
   <div><small>Abaixo do mínimo</small><strong>${low}</strong></div>
  </div>
 </div>
 ${criticalStockPermitted()?'<section class="notice" id="poteStockCriticalTest" style="border-color:#bc9655;background:#231d14"><strong>SIMULAÇÃO CONTROLADA — ESTOQUE A 10%</strong><p>Coloca os insumos, embalagens e bebidas deste negócio em 10% do estoque mínimo configurado. Sem mínimo, usa a necessidade de uma receita ou o saldo atual. Preserva os saldos anteriores para restaurar.</p><div class="actions"><button type="button" class="btn" onclick="POTE_STOCK_UI.criticalStock10Apply()">Aplicar estoque 10% (teste)</button><button type="button" class="btn line" onclick="POTE_STOCK_UI.criticalStock10Restore()">Restaurar estoque anterior</button></div><small>Disponível somente à conta administradora. Bloqueado enquanto houver conflito de sincronização.</small></section>':''}
 ${window.POTE_KITCHEN?.renderPanel?.(state.data)||""}
 ${window.POTE_APP_AUDIT?.panel?.(state.data)||""}
 ${priorityPanel(visible,held,recipeRisk)}
 ${shortages.length?`<section class="stock-shortage-alert" role="status">
 <strong>⚠ Estoque crítico para produção</strong>
 <p>Estas receitas têm insumos disponíveis para menos de cinco unidades. O sistema bloqueia pedidos sem saldo e considera quantidades reservadas para pedidos pendentes.</p>
 <div>${shortages.map(r=>`<span>${e(r.name)}: ${r.maxUnits} un · ${e(r.ingredients.join(", "))}</span>`).join("")}</div>
 </section>`:""}
 ${restockPanel()}
 ${window.POTE_STOCK_EXT?.duplicatePanel?.()||""}
 ${window.POTE_STOCK_EXT?.renderBeverages?.()||""}
 <section class="stock-box" id="stockPurchaseBox">
  <div class="stock-section-head"><div><small>ENTRADA DE MERCADORIAS</small><h2>+ Registrar nova compra</h2></div><span>Adiciona ao estoque, não substitui</span></div>
  ${visible.length?`<div class="stock-purchase-fields">
   <label>Ingrediente comprado<select id="stockPurchaseIngredient" onchange="POTE_STOCK_UI.selectIngredient()">
   ${visible.map(i=>`<option value="${e(i.id)}">${e(i.name)}</option>`).join("")}</select></label>
   <label>Quantidade recebida<input id="stockPurchaseQty" type="text" inputmode="decimal" placeholder="Ex.: 20" oninput="POTE_STOCK_UI.preview()"></label>
   <label>Unidade<select id="stockPurchaseUnit" onchange="POTE_STOCK_UI.preview()">
   <option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="un">un</option></select></label>
   <label>Valor TOTAL pago (R$)<input id="stockPurchasePaid" type="text" inputmode="decimal" placeholder="Ex.: 185,90" oninput="POTE_STOCK_UI.preview()"></label>
   <label class="stock-purchase-supplier">Fornecedor (opcional)<input id="stockPurchaseSupplier" type="text" maxlength="130" placeholder="Nome do fornecedor"></label>
  </div>
  <div id="stockPurchasePreview" class="stock-purchase-preview">Selecione o item e informe a quantidade e o total pago. O saldo novo será calculado aqui.</div>
  <div class="stock-purchase-actions"><button class="btn" type="button" onclick="POTE_STOCK_UI.savePurchase()">Confirmar compra e somar ao estoque</button><small>Exemplo: 3 kg no estoque + 20 kg comprados = 23 kg. Os valores reais são registrados no histórico.</small></div>`:
  '<p>Nenhum ingrediente cadastrado. Adicione o primeiro item na seção Cadastro de ingrediente, abaixo.</p>'}
 </section>
 <section class="stock-box">
  <div class="stock-section-head"><div><small>CONTAGEM FÍSICA</small><h2>Estoque existente</h2></div><span>Separado do preço da embalagem</span></div>
  <div class="stock-search-area">
   <label class="stock-search" for="stockSearch"><span>Pesquisar itens no estoque</span>
    <span class="stock-search-control"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
     <input id="stockSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Lupa: nome, categoria ou código..." oninput="POTE_STOCK_UI.filter(this.value)">
    </span></label>
   <button type="button" class="btn line mini stock-search-clear" onclick="POTE_STOCK_UI.clearSearch()">Limpar busca</button>
   <small id="stockSearchCount" aria-live="polite">${visible.length+(state.data.beverages||[]).length} itens encontrados</small>
  </div>
  <p id="stockSearchEmpty" class="stock-search-empty" hidden>Nenhum item encontrado. Experimente outra palavra.</p>
  <div class="stock-card-list">${displayItems.map((i,idx)=>{
   const health=itemHealth(i,held,recipeRisk);
   const previous=idx>0?itemHealth(displayItems[idx-1],held,recipeRisk).level:null;
   const titles={missing:"Faltantes · repor primeiro",low:"Estoque baixo · atenção",good:"Estoque bom · disponível"};
   return `${health.level!==previous?'<div class="stock-priority-title '+health.level+'"><strong>'+titles[health.level]+'</strong><small>Ordenado por prioridade</small></div>':""}
    <article class="stock-card stock-status-${health.level} ${i.category==="Embalagem"?"stock-packaging-card":""}" data-stock-status="${health.level}" data-stock-name="${e([i.name,i.category||'',i.id].join(' ').toLocaleLowerCase('pt-BR'))}">
    <div class="stock-card-primary">
     <div class="stock-card-name"><button type="button" class="stock-item-open" data-stock-id="${e(i.id)}" onclick="POTE_STOCK_UI.openPurchase(this.dataset.stockId)" title="Repor este item">${e(i.name)}</button><small>${e(i.category||"Insumo")}</small><span class="stock-health-badge ${health.level}">${e(health.label)}</span></div>
     <div class="stock-card-balance"><small>ESTOQUE ATUAL · FÍSICO</small><strong class="stock-balance-${health.level}">${e(S.formatStock(i))}</strong><small>Disponível após reservas: ${e(S.formatStock(i,health.available))}</small></div>
    </div>
    <div class="stock-card-details">
     <span><small>Preço / embalagem de referência</small><strong>${e(costUnit(i))}</strong></span>
     <span><small>Rendimento aproveitável</small><strong>${integerFmt(i.yield||100)}%</strong></span>
     <span><small>Estoque mínimo</small><strong>${e(S.formatStock(i,i.minimum||0))}</strong></span>
    </div>
    <div class="stock-reference-note">${e(sourceLabel(i))}</div>
    <div class="stock-card-actions">
     <button class="btn mini" type="button" data-stock-id="${e(i.id)}" onclick="POTE_STOCK_UI.openPurchase(this.dataset.stockId)">+ Nova compra</button>
     <button class="btn mini line" type="button" data-stock-id="${e(i.id)}" onclick="POTE_STOCK_UI.adjustStock(this.dataset.stockId)">Conferir / ajustar saldo</button>
     <button type="button" class="btn mini danger stock-delete-button" aria-label="Excluir ${e(i.name)}" data-stock-id="${e(i.id)}" onclick="POTE_STOCK_DELETE.open(this.dataset.stockId)">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m5 6 1 14h12l1-14"/><path d="M10 10v7M14 10v7"/></svg> Excluir
     </button>
    </div>
    <details class="stock-ref-edit">
     <summary>Editar preço da embalagem e rendimento</summary>
     <div class="stock-ref-fields">
      <label>Preço da embalagem (R$)<input data-ref="price" inputmode="decimal" value="${e(i.purchasePrice??i.price??0)}"></label>
      <label>Quantidade na embalagem<input data-ref="quantity" inputmode="decimal" value="${e(i.purchaseQuantity??1)}"></label>
      <label>Unidade da embalagem<select data-ref="unit">${["kg","g","L","ml","un"].map(u=>`<option value="${u}" ${(i.purchaseUnit||"kg")===u?"selected":""}>${u}</option>`).join("")}</select></label>
      <label>Rendimento (%)<input data-ref="yield" inputmode="decimal" value="${e(i.yield??100)}"></label>
     </div>
     <p class="stock-note">Estes campos alteram o custo calculado da receita, <b>não aumentam nem diminuem o saldo</b>. Exemplo: R$ 90 / 25 kg e 90% de rendimento são dados de custo, não indicam 25 kg no depósito.</p>
     <button type="button" class="btn mini line" data-stock-id="${e(i.id)}" onclick="POTE_STOCK_UI.saveReference(this)">Salvar parâmetros de custo</button>
    </details>
   </article>`}).join("")||'<p class="muted">Estoque vazio para este universo.</p>'}</div>
 </section>
 <section class="stock-box">
  <div class="stock-section-head"><div><small>REGISTRO DAS ENTRADAS</small><h2>Últimas compras</h2></div><span>Valores efetivamente pagos</span></div>
  <div class="stock-history">${last.map(p=>{
   const item=state.data.ingredients.find(x=>x.id===p.ingredientId)||{measureUnit:"g",stock:0};
   const added=Number(p.added)||0;
   const date=p.at?new Date(p.at).toLocaleString("pt-BR"):"Data não informada";
   return `<div class="stock-history-item"><div><strong>${e(p.name||item.name||"Insumo")}</strong><small>${e(date)}${p.supplier?" · "+e(p.supplier):""}</small></div>
    <div><strong>+${e(S.formatStock(item,added))}</strong><small>Total pago: ${e(S.money(p.totalPaid??p.pricePaid??0))}</small></div></div>`;
  }).join("")||'<p class="muted">Nenhuma compra real registrada neste universo.</p>'}</div>
 </section>
 <section class="stock-box">
  <div class="stock-section-head"><div><small>CADASTRO DE INSUMOS</small><h2>Adicionar ingrediente ou embalagem</h2></div><span>Começa com estoque zero</span></div>
  <p>O preço inicial é apenas uma referência de custo. Depois, use <b>Nova compra</b> para registrar quanto recebeu e pagou.</p>
  <div class="fields">
   ${field("Nome do ingrediente","newIngName","")}
   ${select("Categoria","newIngCat",[["Proteína","Proteína"],["Laticínio","Laticínio"],["Base","Base"],["Molho e vegetal","Molho e vegetal"],["Finalização","Finalização"],["Embalagem","Embalagem"],["Doce","Doce"]],"Base")}
   ${field("Preço da embalagem de referência (R$)","newIngPrice","","text",'inputmode="decimal"')}
   ${field("Quantidade da embalagem (NÃO é estoque)","newIngQuantity","","text",'inputmode="decimal" placeholder="Ex.: 1"')}
   ${select("Unidade da embalagem","newIngUnit",[["kg","kg"],["g","g"],["L","L"],["ml","ml"],["un","un"]],"kg")}
   ${field("Rendimento (%)","newIngYield","100","text",'inputmode="decimal"')}
  </div>
  <button class="btn" onclick="addIngredient()">Cadastrar ingrediente (saldo inicial 0)</button>
 </section>
 ${window.POTE_STOCK_DELETE?.trashHtml?.()||""}`;
}
function selectIngredient(){
 const item=state.data.ingredients.find(i=>i.id===$("stockPurchaseIngredient")?.value);
 const menu=$("stockPurchaseUnit");
 if(!item||!menu)return;
 const base=S.measureUnit(item);
 menu.querySelectorAll("option").forEach(o=>{o.hidden=!S.validUnit(item,o.value);o.disabled=!S.validUnit(item,o.value)});
 menu.value=S.defaultUnit(item);
 preview();
}
function preview(){
 const item=state.data.ingredients.find(i=>i.id===$("stockPurchaseIngredient")?.value);
 const target=$("stockPurchasePreview");if(!target||!item)return;
 const qty=$("stockPurchaseQty")?.value,unit=$("stockPurchaseUnit")?.value,paid=$("stockPurchasePaid")?.value;
 if(!qty){target.textContent="Saldo atual: "+S.formatStock(item)+". Informe uma quantidade para calcular o saldo após a compra.";return}
 try{
  const plus=S.toBase(item,qty,unit),total=S.number(paid);
  const physical=S.physicalStock(item);
  if(!Number.isFinite(physical))throw Error("Saldo físico inválido. Faça uma conferência antes da compra.");
  target.innerHTML="<b>Saldo antes:</b> "+e(S.formatStock(item))+
   " <b>+ Entrada:</b> "+e(S.formatStock(item,plus))+
   " <b>= Saldo depois:</b> "+e(S.formatStock(item,physical+plus))+
   "<span>"+(Number.isFinite(total)&&total>0?"Valor total pago: "+e(S.money(total)):"Informe também o valor total pago.")+"</span>";
 }catch(err){target.textContent=err.message}
}
function openPurchase(id){
 const menu=$("stockPurchaseIngredient");
 const item=state.data.ingredients.find(i=>i.id===id);
 if(!item||!menu){
  window.POTE_STOCK_UPDATE?.open?.("ingredient",id,"purchase");
  return;
 }
 menu.value=id;selectIngredient();
 window.POTE_STOCK_UPDATE?.pulse?.("ingredient",id);
 window.POTE_STOCK_UPDATE?.open?.("ingredient",id,"purchase");
}
function savePurchase(){
 const id=$("stockPurchaseIngredient")?.value,item=state.data.ingredients.find(i=>i.id===id);
 if(!item){toast("Selecione um ingrediente.");return}
 try{
  const qty=$("stockPurchaseQty")?.value,paid=$("stockPurchasePaid")?.value;
  const data=state.data;
  data.purchases??=[];data.stockMovements??=[];
  const result=S.purchase({ingredient:item,quantity:qty,unit:$("stockPurchaseUnit").value,
   paidTotal:paid,supplier:$("stockPurchaseSupplier")?.value,
   purchases:data.purchases,movements:data.stockMovements,makeId:()=>uid()});
  persist();render();
  if(state.tab==="ingredients")window.POTE_STOCK_UPDATE?.pulse?.("ingredient",item.id);
  toast(item.name+": "+S.formatStock(item,result.previous)+" + "+S.formatStock(item,result.added)+
   " = "+S.formatStock(item,result.next)+". Compra de "+S.money(result.totalPaid)+" registrada.");
 }catch(err){alert(err.message)}
}
function adjustStock(id){
 const item=state.data.ingredients.find(i=>i.id===id&&!i.archived);
 if(!item)return;
 window.POTE_STOCK_UPDATE?.pulse?.("ingredient",id);
 return window.POTE_STOCK_UPDATE?.open?.("ingredient",id,"adjust");
}
function saveReference(button){
 const item=state.data.ingredients.find(i=>i.id===button.dataset.stockId);
 if(!item)return;
 const article=button.closest(".stock-card");
 const get=name=>article.querySelector('[data-ref="'+name+'"]')?.value;
 const price=S.number(get("price")),quantity=S.number(get("quantity")),
  yld=S.number(get("yield")),unit=get("unit");
 if(!Number.isFinite(price)||price<0||!Number.isFinite(quantity)||quantity<=0||
    !Number.isFinite(yld)||yld<=0||yld>100||!S.validUnit(item,unit)){
  alert("Confira preço, quantidade, unidade e rendimento. Nenhum dado foi alterado.");return;
 }
 item.purchasePrice=price;item.price=price;item.purchaseQuantity=quantity;
 item.purchaseUnit=unit;item.yield=yld;item.source="Preço informado manualmente";
 item.costSource="manual-price";
 persist();render();toast("Custo de referência atualizado. Saldo de estoque preservado.");
}
function normalized(text){
 return String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
}
function filter(q){
 const term=normalized(q),cards=[...document.querySelectorAll(".stock-card,.stock-beverage-card")];
 let found=0;
 for(const el of cards){
  const match=!term||normalized(el.dataset.stockName).includes(term);
  el.hidden=!match;if(match)found++;
 }
 const total=document.getElementById("stockSearchCount");
 if(total)total.textContent=found+" de "+cards.length+" itens encontrados";
 const empty=document.getElementById("stockSearchEmpty");
 if(empty)empty.hidden=found>0;
 return found;
}
function clearSearch(){
 const field=document.getElementById("stockSearch");
 if(field){field.value="";field.focus?.()}
 filter("");
}

const criticalStockBackupKey=()=> "pote-stock-critical10-v1:"+String(window.POTE_AUTH?.uid||"")+
 ":"+String(state?.data?.businessType||"batataria");
function criticalStockPermitted(){
 const auth=window.POTE_AUTH;
 return !!auth?.uid&&auth.role==="admin"&&
  String(auth.email||"").toLowerCase()==="pixmcp@gmail.com"&&
  (state.data.businessType||"batataria")==="batataria";
}
function criticalStockTarget(item,recipeNeed=0,integer=false){
 const min=Number(item?.minimum),physical=Number(item?.stock);
 const needed=Number.isFinite(min)&&min>0?min:
  Number.isFinite(recipeNeed)&&recipeNeed>0?recipeNeed:
  Number.isFinite(physical)&&physical>0?physical:0;
 const raw=Math.max(0,needed*0.1);
 return integer||String(item?.measureUnit||"").toLowerCase()==="un"?
  Math.floor(raw):Math.round(raw*1000)/1000;
}
function criticalRecipeNeeds(){
 const needs=new Map();
 const addRecipe=items=>{
  const counts=new Map();
  for(const row of items||[]){
   if(typeof row?.id!=="string")continue;
   const n=Number(row.g);
   if(Number.isFinite(n)&&n>0)counts.set(row.id,(counts.get(row.id)||0)+n);
  }
  for(const [id,qty] of counts)
   needs.set(id,Math.max(needs.get(id)||0,qty));
 };
 for(const r of state.data.recipes||[]){
  if(r?.archived||r?.unavailable)continue;
  addRecipe(r.items);
  for(const id of r.packagingIngredientIds||[])
   needs.set(id,Math.max(needs.get(id)||0,1));
 }
 for(const a of state.data.addons||[]){
  const id=a?.ingredientId,n=Number(a?.quantity);
  if(id&&Number.isFinite(n)&&n>0)needs.set(id,Math.max(needs.get(id)||0,n));
 }
 return needs;
}
function criticalStockReady(){
 if(!criticalStockPermitted())throw Error("Recurso exclusivo da conta administradora do Potê Batata.");
 if(window.POTE_APP_READY!==true)throw Error("Aguarde carregar os dados da sua conta.");
 if(window.POTE_SYNC_GUARD?.blocked||window.POTE_SYNC_GUARD?.hasPending?.()){
  window.POTE_SYNC_GUARD?.showRecovery?.();
  throw Error("Há conflito/backup pendente. Resolva antes de alterar o estoque.");
 }
 if(navigator.onLine===false)throw Error("Sem conexão. Estoque não alterado.");
}
function criticalStock10Apply(){
 try{
  criticalStockReady();
  const key=criticalStockBackupKey();
  if(localStorage.getItem(key))throw Error("Já existe backup dos saldos anteriores. Restaure antes de aplicar novamente.");
  const rows=[
   ...(state.data.ingredients||[]).filter(i=>i&&!i.archived)
    .map(item=>({item,kind:"ingredient"})),
   ...(state.data.beverages||[]).filter(i=>i&&!i.archived)
    .map(item=>({item,kind:"beverage"}))
  ];
  if(!rows.length)throw Error("Nenhum item ativo encontrado para simulação.");
  const needs=criticalRecipeNeeds();
  const data=rows.map(({item,kind})=>{
   const before=Number(item.stock);
   if(!Number.isFinite(before)||before<0||typeof item.id!=="string"||!item.id)
    throw Error("Saldo ou identificador inválido: "+String(item.name||item.id));
   const after=criticalStockTarget(item,needs.get(item.id)||0,kind==="beverage");
   return {id:item.id,kind,before,after,name:String(item.name||item.id)};
  });
  const affected=data.filter(x=>x.after!==x.before);
  if(!affected.length){toast("Os itens já estão nos saldos-alvo de 10%.");return false;}
  if(!confirm("SIMULAÇÃO CONTROLADA: ajustar "+affected.length+
   " item(ns) para 10% do estoque mínimo (ou necessidade da receita quando não houver mínimo). "+
   "Esse ajuste é somente para seus dados de teste; NÃO registra compra ou perda. "+
   "Os saldos originais serão guardados para restauração. Confirmar?"))return false;
  // Backup export runs while the original state is still intact.
  window.POTE_SYNC_GUARD?.downloadPending?.();
  localStorage.setItem(key,JSON.stringify({version:1,uid:window.POTE_AUTH.uid,
   universe:state.data.businessType||"batataria",createdAt:new Date().toISOString(),
   items:data}));
  const byKey=new Map(data.map(x=>[x.kind+":"+x.id,x]));
  const now=new Date().toISOString();
  state.data.stockMovements??=[];
  for(const {item,kind} of rows){
   const v=byKey.get(kind+":"+item.id);
   if(!v||v.before===v.after)continue;
   item.stock=v.after;
   state.data.stockMovements.unshift({
    id:"stock10-"+Date.now()+"-"+uid(),at:now,
    ingredientId:kind==="ingredient"?item.id:null,
    beverageId:kind==="beverage"?item.id:null,
    ingredientName:item.name,kind:"simulacao-estoque10",
    quantity:v.after-v.before,previousStock:v.before,afterStock:v.after,
    reason:"TESTE: estoque 10% do mínimo. Não é perda nem compra.",
    referenceId:"stock10:"+window.POTE_AUTH.uid
   });
  }
  persist();render();
  window.dispatchEvent(new Event("pote:changed"));
  toast("Estoque de teste ajustado para 10% em "+affected.length+
   " itens. Saldos originais preservados para restauração.");
  return true;
 }catch(error){alert(String(error?.message||error));return false}
}
function criticalStock10Restore(){
 try{
  criticalStockReady();
  const key=criticalStockBackupKey(),raw=localStorage.getItem(key);
  if(!raw)throw Error("Nenhuma simulação anterior disponível neste aparelho.");
  const backup=JSON.parse(raw);
  if(backup.version!==1||backup.uid!==window.POTE_AUTH.uid||
   backup.universe!==(state.data.businessType||"batataria")||
   !Array.isArray(backup.items))throw Error("Backup de estoque incompatível com esta conta.");
  const groups={ingredient:state.data.ingredients||[],beverage:state.data.beverages||[]};
  for(const record of backup.items){
   const item=groups[record.kind]?.find(x=>x.id===record.id);
   if(!item||Number(item.stock)!==record.after)
    throw Error("O saldo de "+record.name+" mudou desde o teste. "+
     "A restauração automática foi bloqueada para preservar alterações posteriores.");
  }
  if(!confirm("Restaurar todos os saldos originais da simulação de 10%? "+
   "As movimentações históricas serão preservadas."))return false;
  const now=new Date().toISOString();
  state.data.stockMovements??=[];
  for(const record of backup.items){
   const item=groups[record.kind].find(x=>x.id===record.id);
   if(record.before===record.after)continue;
   item.stock=record.before;
   state.data.stockMovements.unshift({
    id:"stock10-restore-"+Date.now()+"-"+uid(),at:now,
    ingredientId:record.kind==="ingredient"?item.id:null,
    beverageId:record.kind==="beverage"?item.id:null,
    ingredientName:item.name,kind:"restauracao-simulacao10",
    quantity:record.before-record.after,previousStock:record.after,
    afterStock:record.before,reason:"TESTE: restaurar saldos anteriores ao estoque 10%.",
    referenceId:"stock10-restore:"+window.POTE_AUTH.uid
   });
  }
  localStorage.removeItem(key);
  persist();render();window.dispatchEvent(new Event("pote:changed"));
  toast("Saldos originais restaurados, sem apagar os registros de ajuste.");
  return true;
 }catch(error){alert(String(error?.message||error));return false}
}

window.POTE_STOCK_UI={renderPanel,selectIngredient,preview,openPurchase,savePurchase,
 adjustStock,saveReference,filter,clearSearch,normalized,costUnit,restockPanel,jumpToNeed,returnToOrder,
 criticalStockTarget,criticalStock10Apply,criticalStock10Restore,criticalStockPermitted};
window.stockSelectIngredient=selectIngredient;
window.stockConfirmPurchase=savePurchase;
window.stockOpenPurchase=openPurchase;
})();
