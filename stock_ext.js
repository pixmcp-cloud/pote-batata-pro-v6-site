/* Estoque de bebidas e embalagens em blocos próprios; compras registradas com custo real. */
(function(){
"use strict";
if(window.POTE_STOCK_EXT)return;
const $=id=>document.getElementById(id);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sorted=()=>[...(state.data.beverages||[])].sort((a,b)=>
 String(a.name+" "+a.size).localeCompare(String(b.name+" "+b.size),"pt-BR",{sensitivity:"base"}));
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
    '" onclick="POTE_INVENTORY.merge(this.dataset.duplicateId)">Conferir e mesclar</button></div>').join("")+
  '</section>';
}
function renderBeverages(){
 const drinks=sorted(),history=(state.data.purchases||[])
  .filter(p=>p.itemKind==="beverage").slice(0,9);
 return '<section class="stock-box stock-beverage-section" id="stockBeverages">'+
  '<div class="stock-section-head"><div><small>UNIDADES FÍSICAS</small><h2>Águas e refrigerantes</h2></div><span>Separados dos ingredientes e descartáveis</span></div>'+
  '<p>O preço exibido é o de venda. O custo de compra começa zerado até registrar a mercadoria realmente recebida. Latas, garrafas e sabores têm saldos independentes.</p>'+
  (drinks.length?'<div class="stock-beverage-grid">'+drinks.map(b=>
   '<article class="stock-beverage-card" data-stock-name="'+esc([b.name,b.size,b.id].join(" ").toLowerCase())+'">'+
   '<div><strong>'+esc(b.name)+'</strong><small>'+esc(b.size||"Sem volume")+'</small></div>'+
   '<div><small>Estoque</small><b class="'+(Number(b.stock)<=Number(b.minimum||0)?"stock-critical":"")+'">'+
    Number(b.stock||0).toLocaleString("pt-BR")+" un</b></div>"+
   '<div><small>Venda</small><strong>'+esc(money(b.sellPrice))+'</strong></div>'+
   '<div><small>Última compra</small><strong>'+esc(Number(b.purchasePrice)>0?money(b.purchasePrice)+" / "+(b.purchaseQuantity||1)+" un":"Sem custo informado")+'</strong></div>'+
   '<button class="btn mini" type="button" data-bev-id="'+esc(b.id)+'" onclick="POTE_STOCK_EXT.selectBeverage(this.dataset.bevId)">+ Comprar</button>'+
   '<button class="btn mini line" type="button" data-bev-id="'+esc(b.id)+'" onclick="POTE_STOCK_EXT.adjustBeverage(this.dataset.bevId)">Ajustar saldo</button>'+
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
 const field=$("stockBeverageId");if(!field)return;
 field.value=id;preview();$("stockBeverages")?.scrollIntoView?.({block:"center",behavior:"smooth"});
 $("stockBeverageQty")?.focus?.();
}
function preview(){
 const b=state.data.beverages.find(x=>x.id===$("stockBeverageId")?.value);
 const target=$("stockBeveragePreview");if(!b||!target)return;
 const qty=window.POTE_STOCK?.number?.($("stockBeverageQty")?.value);
 const paid=window.POTE_STOCK?.number?.($("stockBeveragePaid")?.value);
 if(!Number.isInteger(qty)||qty<=0){target.textContent="Estoque atual: "+(b.stock||0)+" un. Informe quantas unidades comprou.";return}
 target.textContent=(b.stock||0)+" un + "+qty+" un = "+(Number(b.stock||0)+qty)+
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
  b.purchaseUnit="un";b.catalogPurchaseAt=result.receipt.at;
  result.receipt.itemKind="beverage";
  state.data.stockMovements[0].itemKind="beverage";
  persist();render();toast(b.name+": compra de "+qty+" un registrada. Estoque: "+b.stock+" un.");
 }catch(e){alert(e.message)}
}
function adjustBeverage(id){
 const b=state.data.beverages.find(x=>x.id===id);if(!b)return;
 const raw=prompt("Saldo TOTAL contado de "+b.name+" ("+b.size+") em unidades:",String(b.stock||0));
 if(raw===null)return;
 const units=window.POTE_STOCK.number(raw);
 if(!Number.isInteger(units)||units<0){alert("O estoque precisa ser um número inteiro maior ou igual a zero.");return}
 const reason=prompt("Motivo do ajuste (contagem, perdas, correção):","Conferência física");
 if(reason===null)return;
 state.data.stockMovements??=[];
 const result=window.POTE_STOCK.adjust({
  ingredient:{...b,stock:b.stock,measureUnit:"un"},
  quantity:units,unit:"un",reason,movements:state.data.stockMovements,
  makeId:()=>uid()
 });
 b.stock=result.next;
 state.data.stockMovements[0].itemKind="beverage";
 persist();render();toast("Estoque atualizado: "+b.name+" · "+b.stock+" un.");
}
window.POTE_STOCK_EXT={renderBeverages,duplicatePanel,selectBeverage,preview,
 saveBeveragePurchase,adjustBeverage};
})();
