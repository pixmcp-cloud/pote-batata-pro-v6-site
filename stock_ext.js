/* Estoque de bebidas e embalagens em blocos próprios; compras registradas com custo real. */
(function(){
"use strict";
if(window.POTE_STOCK_EXT)return;
const $=id=>document.getElementById(id);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function beverageMargin(b){
 const paid=Number(b.purchasePrice),qty=Number(b.purchaseQuantity),price=Number(b.sellPrice);
 if(!Number.isFinite(paid)||paid<=0||!Number.isFinite(qty)||qty<=0)return {level:"unknown",gross:null,unitCost:null,label:"CUSTO NÃO INFORMADO — confira a margem"};
 const unitCost=paid/qty,gross=price-unitCost;
 const level=gross < -0.000001?"loss":gross<=0.000001?"zero":"profit";
 const label=level==="loss"?"PREJUÍZO BRUTO POR UNIDADE":level==="zero"?"MARGEM BRUTA ZERO — ATENÇÃO":"GANHO BRUTO POR UNIDADE";
 return {level,gross,unitCost,label};
}
const sorted=()=>[...(state.data.beverages||[])].sort((a,b)=>{
 const rank={missing:0,low:1,good:2};
 const wa=rank[beverageHealth(a).level]??3,wb=rank[beverageHealth(b).level]??3;
 return wa-wb||String(a.name+" "+a.size).localeCompare(String(b.name+" "+b.size),
  "pt-BR",{sensitivity:"base"});
});
function duplicatePanel(){
 const groups=window.POTE_INVENTORY?.duplicates?.(state.data.ingredients)||[];
 if(!groups.length)return "";
 return '<section class="stock-duplicate-warning" role="status">'+
  '<strong>Cadastros duplicados encontrados: '+groups.length+' grupo(s)</strong>'+
  '<p>Não cadastre o mesmo pote ou ingrediente novamente. A mesclagem soma os saldos e atualiza as fichas ligadas, mantendo o histórico de movimentações. Confira cada grupo antes de confirmar.</p>'+
  groups.map(group=>'<div><span>'+esc(group[0].name)+' · '+group.length+
   ' cadastros · '+group.map(i=>Number(i.stock||0)).reduce((a,b)=>a+b,0)+
   ' '+esc(group[0].measureUnit||"g")+' no total</span>'+
   '<button class="btn mini line" type="button" data-duplicate-id="'+esc(group[0].id)+
    '" onclick="POTE_STOCK_DELETE.open(this.dataset.duplicateId)">Conferir duplicados</button></div>').join("")+
  '</section>';
}
function beverageHealth(b){
 const held=window.POTE_STOCK_STATUS?.reserved?.(state.data)?.beverages?.get(b.id)||0;
 const context=window.POTE_STOCK_STATUS?.requested?.(b.id,"beverage");
 return window.POTE_STOCK_STATUS?.classify?.(b,held,{shortage:context?.level==="missing"})||
  {level:Number(b.stock)<=0?"missing":"good",label:Number(b.stock)<=0?"FALTANTE":"ESTOQUE BOM",
   available:Number(b.stock)||0,reservation:0};
}
function renderBeverages(){
 const drinks=sorted(),history=(state.data.purchases||[])
  .filter(p=>p.itemKind==="beverage").slice(0,9);
 return '<section class="stock-box stock-beverage-section" id="stockBeverages">'+
  '<div class="stock-section-head"><div><small>UNIDADES FÍSICAS</small><h2>Águas e refrigerantes</h2></div><span>Separados dos ingredientes e descartáveis</span></div>'+
  '<p>O preço exibido é o de venda. O custo de compra começa zerado até registrar a mercadoria realmente recebida. Latas, garrafas e sabores têm saldos independentes.</p>'+
  (drinks.length?'<div class="stock-beverage-grid">'+drinks.map(b=>
   '<article class="stock-beverage-card stock-status-'+beverageHealth(b).level+' stock-margin-'+beverageMargin(b).level+'" data-stock-name="'+esc([b.name,b.size,b.id].join(" ").toLowerCase())+'">'+
   '<div><button type="button" class="stock-item-open" data-bev-id="'+esc(b.id)+'" onclick="POTE_STOCK_EXT.selectBeverage(this.dataset.bevId)">'+esc(b.name)+'</button><small>'+esc(b.size||"Sem volume")+'</small></div>'+
   '<div><small>Estoque físico</small><b class="stock-balance-'+beverageHealth(b).level+'">'+
    Number(b.stock||0).toLocaleString("pt-BR")+" un</b><small>Disponível após reservas: "+beverageHealth(b).available+" un</small></div>"+
   '<div><small>Venda</small><strong>'+esc(money(b.sellPrice))+'</strong></div>'+
   '<div><small>Última compra</small><strong>'+esc(Number(b.purchasePrice)>0?money(b.purchasePrice)+" / "+(b.purchaseQuantity||1)+" un":"Sem custo informado")+'</strong></div>'+
   '<div class="stock-margin-note '+beverageMargin(b).level+'" role="status"><strong>'+esc(beverageMargin(b).label)+'</strong><small>'+
    (beverageMargin(b).gross===null?'Cadastre o valor da compra para verificar a rentabilidade.':
     'Compra por unidade: '+money(beverageMargin(b).unitCost)+' · '+(beverageMargin(b).gross>=0?'+':'−')+money(Math.abs(beverageMargin(b).gross))+' por venda, antes de taxas e despesas.')+
    '</small></div>'+
   '<span class="stock-health-badge '+beverageHealth(b).level+'">'+beverageHealth(b).label+'</span><button class="btn mini" type="button" data-bev-id="'+esc(b.id)+'" onclick="POTE_STOCK_EXT.selectBeverage(this.dataset.bevId)">+ Comprar</button>'+
   '<button class="btn mini line" type="button" data-bev-id="'+esc(b.id)+'" onclick="POTE_STOCK_EXT.adjustBeverage(this.dataset.bevId)">Ajustar saldo</button>'+
   '<details class="stock-beverage-edit"><summary>Editar compra, venda e unidades</summary><div class="stock-beverage-edit-fields">'+
    '<label>Valor total da última compra (R$)<input type="text" inputmode="decimal" id="bevEditPaid-'+esc(b.id)+'" value="'+esc(b.purchasePrice??0)+'"></label>'+
    '<label>Unidades da última compra<input type="number" min="1" step="1" id="bevEditQty-'+esc(b.id)+'" value="'+esc(b.purchaseQuantity??1)+'"></label>'+
    '<label>Preço de venda por unidade (R$)<input type="text" inputmode="decimal" id="bevEditSale-'+esc(b.id)+'" value="'+esc(b.sellPrice??0)+'"></label>'+
    '<label>Estoque físico atual (un)<input type="number" min="0" step="1" id="bevEditStock-'+esc(b.id)+'" value="'+esc(b.stock??0)+'"></label>'+
    '</div><p class="stock-beverage-edit-help">Editar custo corrige o valor de referência, sem registrar compra nova. Alterar estoque gera movimentação auditável.</p>'+
    '<button type="button" class="btn mini" data-bev-id="'+esc(b.id)+'" onclick="POTE_STOCK_EXT.saveBeverageEdit(this.dataset.bevId)">Salvar alterações</button></details>'+
   '</article>').join("")+'</div>':'<p>Nenhuma bebida cadastrada. Você pode cadastrá-las em Combos e Bebidas.</p>')+
  (drinks.length?'<div class="stock-beverage-purchase">'+
   '<h3>Registrar compra de bebida</h3><div class="stock-purchase-fields">'+
    '<label>Produto<select id="stockBeverageId" onchange="POTE_STOCK_EXT.preview()">'+
      drinks.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name+" · "+b.size)+'</option>').join("")+'</select></label>'+
    '<label>Unidades recebidas<input id="stockBeverageQty" type="text" inputmode="numeric" placeholder="Ex.: 12" oninput="POTE_STOCK_EXT.preview()"></label>'+
    '<label>Total pago (R$)<input id="stockBeveragePaid" type="text" inputmode="decimal" placeholder="Ex.: 42,00" oninput="POTE_STOCK_EXT.preview()"></label>'+
    '<label>Fornecedor (opcional)<input id="stockBeverageSupplier" type="text" maxlength="130" placeholder="Nome do fornecedor"></label>'+
   '</div><div id="stockBeveragePreview" class="stock-purchase-preview">Informe a quantidade e o valor total pago.</div>'+
   '<button class="btn" type="button" onclick="POTE_STOCK_EXT.saveBeveragePurchase()">Confirmar compra de bebida</button></div>':"")+
  '<div class="stock-beverage-history"><h3>Últimas entradas de bebidas</h3>'+
   (history.length?history.map(p=>'<div><strong>'+esc(p.name)+'</strong><span>+'+
     Number(p.added||0)+' un · '+money(p.totalPaid)+' · '+esc(p.at?.slice(0,10)||"")+'</span></div>').join(""):
    '<small>Ainda não há compras de bebidas registradas.</small>')+'</div>'+
 '</section>';
}
function selectBeverage(id){
 const field=$("stockBeverageId");
 if(field){field.value=id;preview()}
 window.POTE_STOCK_UPDATE?.pulse?.("beverage",id);
 window.POTE_STOCK_UPDATE?.open?.("beverage",id,"purchase");
}
function preview(){
 const b=state.data.beverages.find(x=>x.id===$("stockBeverageId")?.value);
 const target=$("stockBeveragePreview");if(!b||!target)return;
 const physical=window.POTE_STOCK.physicalStock(b);
 if(!Number.isFinite(physical)){target.textContent="Saldo físico inválido. Faça uma conferência antes da compra.";return}
 const qty=window.POTE_STOCK?.number?.($("stockBeverageQty")?.value);
 const paid=window.POTE_STOCK?.number?.($("stockBeveragePaid")?.value);
 if(!Number.isInteger(qty)||qty<=0){target.textContent="Estoque atual: "+physical+" un. Informe quantas unidades comprou.";return}
 target.textContent=physical+" un + "+qty+" un = "+(physical+qty)+
  " un. Total pago: "+(Number.isFinite(paid)&&paid>0?money(paid):"informe o valor da compra")+
  ". A compra será registrada e somada ao saldo.";
}
function saveBeveragePurchase(){
 const b=state.data.beverages.find(x=>x.id===$("stockBeverageId")?.value);
 if(!b){alert("Selecione uma bebida");return}
 const qty=window.POTE_STOCK.number($("stockBeverageQty")?.value);
 if(!Number.isInteger(qty)||qty<1){alert("Informe a quantidade em unidades inteiras.");return}
 state.data.purchases??=[];state.data.stockMovements??=[];
 try{
  const result=window.POTE_STOCK.purchase({
   ingredient:{...b,measureUnit:"un"},quantity:qty,unit:"un",
   paidTotal:$("stockBeveragePaid")?.value,supplier:$("stockBeverageSupplier")?.value,
   purchases:state.data.purchases,movements:state.data.stockMovements,
   makeId:()=>uid()
  });
  // A compra é validada antes de alterar o objeto real: os dados devem ser aplicados juntos.
  b.stock=result.next;b.purchasePrice=result.totalPaid;b.purchaseQuantity=qty;
  b.costSource="real-purchase";
  b.purchaseUnit="un";b.catalogPurchaseAt=result.receipt.at;
  result.receipt.itemKind="beverage";
  state.data.stockMovements[0].itemKind="beverage";
  persist();render();toast(b.name+": compra de "+qty+" un registrada. Estoque: "+b.stock+" un.");
 }catch(e){alert(e.message)}
}
function adjustBeverage(id){
 const b=state.data.beverages.find(x=>x.id===id);if(!b)return;
 window.POTE_STOCK_UPDATE?.pulse?.("beverage",id);
 return window.POTE_STOCK_UPDATE?.open?.("beverage",id,"adjust");
}
function saveBeverageEdit(id){
 const b=state.data.beverages.find(x=>String(x.id)===String(id));
 if(!b)return false;
 const parse=v=>window.POTE_STOCK?.number?.(v)??Number(v);
 const paid=parse($("bevEditPaid-"+id)?.value),qty=parse($("bevEditQty-"+id)?.value),
  sale=parse($("bevEditSale-"+id)?.value),stock=parse($("bevEditStock-"+id)?.value);
 if(!Number.isFinite(paid)||paid<0||!Number.isSafeInteger(qty)||qty<1||
  !Number.isFinite(sale)||sale<=0||!Number.isSafeInteger(stock)||stock<0||stock>1000000000){
  toast("Valores inválidos. Compra não negativa, quantidades inteiras e venda maior que zero.");
  return false;
 }
 const oldStock=Number(b.stock)||0,oldSale=Number(b.sellPrice)||0,oldPaid=Number(b.purchasePrice)||0,
  oldQty=Number(b.purchaseQuantity)||1;
 const reserved=Number(window.POTE_STOCK_STATUS?.reserved?.(state.data)?.beverages?.get(b.id)||0);
 if(stock<reserved&&!window.confirm("Há "+reserved+" unidade(s) reservada(s), mas o saldo informado é "+stock+". Confirmar a divergência?"))return false;
 if(Math.abs(sale-oldSale)<0.000001&&Math.abs(paid-oldPaid)<0.000001&&qty===oldQty&&stock===oldStock){
  toast("Não há alterações a salvar.");return true;
 }
 const at=new Date().toISOString();
 if(stock!==oldStock){
  state.data.stockMovements??=[];
  state.data.stockMovements.unshift({id:uid(),at,ingredientId:"bev:"+id,ingredientName:b.name,
   itemKind:"beverage",quantity:stock-oldStock,reason:"Conferência manual no card de bebida",
   previousStock:oldStock,afterStock:stock,referenceId:"beverage-edit:"+id});
 }
 if(sale!==oldSale||paid!==oldPaid||qty!==oldQty){
  b.priceAudit??=[];
  b.priceAudit.unshift({at,previousSellPrice:oldSale,previousPurchasePrice:oldPaid,previousPurchaseQuantity:oldQty,
   newSellPrice:sale,newPurchasePrice:paid,newPurchaseQuantity:qty,reason:"Edição manual de valores de referência"});
  b.priceAudit=b.priceAudit.slice(0,30);
 }
 b.sellPrice=sale;b.purchasePrice=paid;b.purchaseQuantity=qty;b.purchaseUnit="un";b.stock=stock;
 if(paid!==oldPaid||qty!==oldQty)b.costSource="manual-price";
 b.referencePriceEditedAt=at;
 persist();render();toast("Bebida atualizada: compra, venda e saldo conferidos.");return true;
}
window.POTE_STOCK_EXT={renderBeverages,duplicatePanel,selectBeverage,preview,beverageMargin,saveBeverageEdit,
 saveBeveragePurchase,adjustBeverage};
})();
