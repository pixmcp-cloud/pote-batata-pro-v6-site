/* Janela própria de compra e conferência: evita o cabeçalho nativo do navegador. */
(function(){
"use strict";
if(window.POTE_STOCK_UPDATE)return;
const $=id=>document.getElementById(id);
const S=()=>window.POTE_STOCK;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>S().money(v);
const num=v=>S().number(v);
const typeOf=item=>item?.measureUnit==="un"?"un":item?.measureUnit==="ml"?"ml":"g";
const choices=item=>typeOf(item)==="un"?["un"]:typeOf(item)==="ml"?["L","ml"]:["kg","g"];
const defaultUnit=item=>S().defaultUnit(item);
let current=null;
function get(kind,id){
 if(kind==="beverage")return (state.data.beverages||[]).find(i=>i.id===id);
 return (state.data.ingredients||[]).find(i=>i.id===id&&!i.archived);
}
function identifyUnknown(id,kind){
 const archived=(state.data.ingredients||[]).find(x=>x.id===id&&x.archived);
 if(archived)return {candidate:archived,source:"archived"};
 const seed=(typeof SEED!=="undefined"?SEED.ingredients||[]:[]).find(x=>x.id===id);
 if(seed&&kind==="ingredient")return {candidate:seed,source:"seed"};
 return null;
}
function stockInfo(item,kind){
 const held=window.POTE_STOCK_STATUS?.reserved?.(state.data);
 const reserved=kind==="beverage"?held?.beverages?.get(item.id):held?.ingredients?.get(item.id);
 const avail=Math.max(0,S().physicalStock(item)-(Number(reserved)||0));
 const formatting=kind==="beverage"?{...item,measureUnit:"un"}:item;
 return {physical:S().formatStock(formatting),reserved:S().formatStock(formatting,reserved||0),
  available:S().formatStock(formatting,avail)};
}
function packOptions(item,unit){
 if(typeOf(item)==="un")return [
  ["1","Por unidade (1 unidade)"],
  ["12","Dúzia (12 unidades)"],
  ["10","Fardo / pacote de 10 unidades"],
  ["custom","Caixa / atacado: definir quantidade"]
 ];
 return [
  ["1","Quantidade individual (1 "+unit+")"],
  ["5","Pacote de 5 "+unit],
  ["10","Atacado / pacote de 10 "+unit],
  ["custom","Lote personalizado: definir conteúdo"]
 ];
}
function popup(){
 let holder=$("poteStockUpdate");if(holder)return holder;
 holder=document.createElement("div");holder.id="poteStockUpdate";holder.hidden=true;
 holder.innerHTML='<section class="stock-update-dialog" role="dialog" aria-modal="true" aria-labelledby="stockUpdateTitle">'+
  '<small>GESTÃO DE INVENTÁRIO</small><h2 id="stockUpdateTitle">Atualização de estoque</h2>'+
  '<p id="stockUpdateItem"></p><div class="stock-update-snapshot" id="stockUpdateSnapshot"></div>'+
  '<div class="stock-update-grid">'+
   '<label class="stock-update-full">O que deseja fazer?<select id="stockUpdateMode">'+
   '<option value="purchase">Registrar uma compra · somar ao saldo</option>'+
   '<option value="adjust">Conferir contagem física · definir saldo total</option>'+
   '</select></label>'+
   '<label>Número de itens ou pacotes<input id="stockUpdateQty" inputmode="decimal" placeholder="Ex.: 2" autocomplete="off"></label>'+
   '<label>Unidade de peso / medida<select id="stockUpdateUnit"></select></label>'+
   '<label class="stock-update-full">Como comprou ou contou?<select id="stockUpdatePackage"></select></label>'+
   '<label class="stock-update-full" id="stockUpdateCustomWrap" hidden>Unidades por caixa / quantidade por lote'+
    '<input id="stockUpdatePackCustom" inputmode="decimal" placeholder="Ex.: 24"></label>'+
   '<label class="stock-update-purchase stock-update-full">Valor total pago (R$)'+
    '<input id="stockUpdatePaid" inputmode="decimal" placeholder="Ex.: 96,00"></label>'+
   '<label class="stock-update-purchase stock-update-full">Fornecedor (opcional)'+
    '<input id="stockUpdateSupplier" maxlength="130" autocomplete="off"></label>'+
   '<label class="stock-update-adjust stock-update-full" hidden>Motivo da conferência'+
    '<input id="stockUpdateReason" maxlength="100" value="Contagem física"></label>'+
  '</div>'+
  '<div id="stockUpdateResult" class="stock-update-result" aria-live="polite"></div>'+
  '<div id="stockUpdateError" class="stock-update-error" role="alert" hidden></div>'+
  '<div class="stock-update-actions"><button type="button" class="btn line" id="stockUpdateCancel">Cancelar</button>'+
  '<button type="button" class="btn" id="stockUpdateSubmit">Registrar compra</button></div></section>';
 document.body.appendChild(holder);
 for(const id of ["stockUpdateQty","stockUpdateUnit","stockUpdatePackage",
   "stockUpdatePackCustom","stockUpdatePaid","stockUpdateMode"]){
  $(id).addEventListener("input",()=>update());
  $(id).addEventListener("change",()=>update());
 }
 $("stockUpdateCancel").addEventListener("click",close);
 $("stockUpdateSubmit").addEventListener("click",save);
 return holder;
}
function unitChoices(item){
 const select=$("stockUpdateUnit");
 select.innerHTML=choices(item).map(u=>'<option value="'+esc(u)+'">'+esc(u)+'</option>').join("");
 select.value=defaultUnit(item);
}
function refreshPackages(){
 const item=get(current?.kind,current?.id);
 if(!item)return;
 const measured=current.kind==="beverage"?{...item,measureUnit:"un"}:item;
 const box=$("stockUpdatePackage"),old=box.value,options=packOptions(measured,$("stockUpdateUnit").value);
 box.innerHTML=options.map(a=>'<option value="'+a[0]+'">'+esc(a[1])+'</option>').join("");
 box.value=options.some(o=>o[0]===old)?old:"1";
}
function open(kind,id,mode="purchase"){
 const item=get(kind,id);
 const holder=popup();
 current={kind,id};
 if(!item){
  const info=identifyUnknown(id,kind),error=$("stockUpdateError");
  $("stockUpdateTitle").textContent="Atualização · cadastro não encontrado";
  $("stockUpdateItem").textContent="ID exigido no pedido: "+id;
  $("stockUpdateSnapshot").textContent="O produto não está no estoque atual. Não será criado saldo fictício.";
  holder.querySelector(".stock-update-grid").hidden=true;
  $("stockUpdateSubmit").hidden=true;
  $("stockUpdateResult").textContent=info?
   "Há um cadastro original associado a este ID. Confirme a recuperação para deixá-lo visível com o saldo existente (ou zero, se estiver ausente).":
   "É necessário corrigir a referência deste item na receita ou no pedido. Nenhum item será inventado.";
  error.hidden=false;
  error.innerHTML=info?
   '<button class="btn" type="button" data-recover-id="'+esc(id)+'" onclick="POTE_STOCK_UPDATE.recover(this.dataset.recoverId)">Restaurar cadastro original</button>':
   "Cadastro indisponível: ID "+esc(id);
  holder.hidden=false;return;
 }
 holder.querySelector(".stock-update-grid").hidden=false;
 $("stockUpdateSubmit").hidden=false;
 $("stockUpdateError").hidden=true;
 const info=stockInfo(item,kind);
 $("stockUpdateTitle").textContent="Atualização de estoque";
 $("stockUpdateItem").textContent=item.name+(item.size?" · "+item.size:"");
 $("stockUpdateSnapshot").innerHTML=
  '<span><small>Estoque físico</small><strong>'+esc(info.physical)+'</strong></span>'+
  '<span><small>Reservado</small><strong>'+esc(info.reserved)+'</strong></span>'+
  '<span><small>Disponível</small><strong>'+esc(info.available)+'</strong></span>';
 $("stockUpdateMode").value=mode==="adjust"?"adjust":"purchase";
 const unit=defaultUnit(kind==="beverage"?{...item,measureUnit:"un"}:item);
 const physical=S().physicalStock(item);
 $("stockUpdateQty").value=mode==="adjust"&&Number.isFinite(physical)?
   S().decimal(physical/(unit==="kg"||unit==="L"?1000:1),8):"";
 $("stockUpdatePaid").value="";
 $("stockUpdatePackCustom").value="";
 $("stockUpdateSupplier").value="";
 unitChoices(kind==="beverage"?{...item,measureUnit:"un"}:item);
 $("stockUpdatePackage").value="1";
 $("stockUpdatePackage").dataset.prevUnit="";
 $("stockUpdateResult").textContent="";
 holder.hidden=false;
 update();
 $("stockUpdateQty")?.focus?.();
}
function recover(id){
 const info=identifyUnknown(id,current?.kind);
 if(!info)return false;
 if(info.source==="archived"){
  if(info.candidate.mergedInto){
   const target=get(current.kind,info.candidate.mergedInto);
   if(target){close();open(current.kind,target.id,"purchase");return true}
   alert("O saldo deste cadastro foi transferido, mas o cadastro de destino não está disponível. Confira a lixeira antes de continuar.");
   return false;
  }
  if(!window.confirm("Restaurar o cadastro "+info.candidate.name+" ao estoque ativo?"))return false;
  info.candidate.archived=false;delete info.candidate.archivedAt;
 }else{
  if((state.data.ingredients||[]).some(x=>x.id===id))return false;
  if(!window.confirm("Repor o cadastro original "+info.candidate.name+
   " com saldo inicial ZERO para poder registrar a compra? Nenhum estoque será inventado."))return false;
  state.data.ingredients.push({...info.candidate,stock:0,minimum:0,
   source:"Cadastro original restaurado para entrada real"});
 }
 persist();render();open(current.kind,id,"purchase");
 return true;
}
function calc(){
 const item=get(current?.kind,current?.id);
 if(!item)return {valid:false,reason:"Item indisponível"};
 const mode=$("stockUpdateMode")?.value;
 const count=num($("stockUpdateQty")?.value),unit=$("stockUpdateUnit")?.value,
 pack=$("stockUpdatePackage")?.value,multiplier=pack==="custom"?num($("stockUpdatePackCustom")?.value):Number(pack);
 if(!Number.isFinite(count)||count<0||count>10000000||(mode==="purchase"&&count===0))return {valid:false,reason:mode==="adjust"?"Informe a quantidade total contada (zero é permitido).":"Informe quantos itens, caixas ou pacotes comprou."};
 if(!Number.isFinite(multiplier)||multiplier<=0||multiplier>10000000)return {valid:false,reason:"Informe a quantidade contida em cada pacote."};
 if((current.kind==="beverage"||typeOf(item)==="un")&&(!Number.isInteger(count)||!Number.isInteger(multiplier)))
  return {valid:false,reason:"Para itens em unidades, informe números inteiros."};
 const quantity=Math.round(count*multiplier*100000)/100000;
 let added;
 try{added=mode==="adjust"&&quantity===0?0:S().toBase(current.kind==="beverage"?{...item,measureUnit:"un"}:item,quantity,unit)}
 catch(e){return {valid:false,reason:e.message}}
 const physical=S().physicalStock(item);
 if(mode==="purchase"&&!Number.isFinite(physical))
  return {valid:false,reason:"Saldo físico inválido. Faça uma conferência antes da compra."};
 const next=mode==="adjust"?added:physical+added;
 const paid=num($("stockUpdatePaid")?.value);
 if(mode==="purchase"&&(!Number.isFinite(paid)||paid<=0))
  return {valid:false,reason:"Informe o valor total pago na compra para calcular o custo corretamente."};
 return {valid:true,mode,item,count,multiplier,unit,quantity,baseAmount:added,
  before:physical,after:next,paid};
}
function update(){
 const item=get(current?.kind,current?.id);if(!item)return;
 const unit=$("stockUpdateUnit")?.value;
 if($("stockUpdatePackage")?.dataset?.prevUnit!==unit){
  refreshPackages();
  $("stockUpdatePackage").dataset.prevUnit=unit;
 }
 const custom=$("stockUpdatePackage").value==="custom";
 $("stockUpdateCustomWrap").hidden=!custom;
 const mode=$("stockUpdateMode")?.value;
 document.querySelectorAll(".stock-update-purchase").forEach(x=>x.hidden=mode!=="purchase");
 document.querySelectorAll(".stock-update-adjust").forEach(x=>x.hidden=mode!=="adjust");
 $("stockUpdateSubmit").textContent=mode==="purchase"?"Registrar compra e somar":"Salvar contagem física";
 const parsed=calc(),result=$("stockUpdateResult");
 if(!parsed.valid){result.textContent=parsed.reason;return}
 const formatted=current.kind==="beverage"?{...item,measureUnit:"un"}:item;
 const x=parsed;
 const start=S().formatStock(formatted,x.before),end=S().formatStock(formatted,x.after);
 const delta=S().formatStock(formatted,x.baseAmount);
 result.innerHTML='<b>'+(mode==="purchase"?"Compra":"Conferência")+'</b>: '+esc(x.count)+
  ' pacote(s)/item(ns) × '+esc(x.multiplier)+' '+esc(x.unit)+' = '+esc(delta)+
  '<p><strong>'+esc(start)+'</strong> '+(mode==="purchase"?"+ "+esc(delta):"→ saldo contado")+
  ' = <strong>'+esc(end)+'</strong></p>'+
  (mode==="purchase"?'<p>Total pago: <strong>'+money(x.paid)+'</strong> · Custo efetivo: '+
    money(x.paid/x.quantity)+' por '+esc(x.unit)+'</p>':'<p>Conferência física não registra nova compra nem preço fictício.</p>');
}
function save(){
 const x=calc();
 if(!x.valid){$("stockUpdateError").textContent=x.reason;$("stockUpdateError").hidden=false;return false}
 const {item,mode}=x;
 // No canário, nenhuma compra/contagem pode gravar saldos diretamente.
 // A compra entra no Worker com UUID idempotente e reconsulta a V5.
 if(window.POTE_AUTH?.accessPolicy?.workerAuthoritative===true){
  const errorField=$("stockUpdateError");
  if(mode!=="purchase"){
   errorField.textContent="Contagem protegida ainda indisponível no Worker; estoque inalterado.";
   errorField.hidden=false;return false;
  }
  if(window.POTE_WORKER?.inventoryEnabled!==true){
   errorField.textContent="Compras protegidas aguardam autorização do Worker; estoque inalterado.";
   errorField.hidden=false;return false;
  }
  const kind=current.kind,id=current.id,label=item.name;
  return window.POTE_WORKER.purchaseStock({
   universe:state.data.businessType||"batataria",
   group:kind==="beverage"?"beverages":"ingredients",itemId:id,
   delta:x.baseAmount,paidTotal:x.paid,enteredQuantity:x.quantity,
   enteredUnit:x.unit,supplier:String($("stockUpdateSupplier")?.value||"").trim()
  }).then(result=>{
   close();render();
   toast(label+": compra confirmada no servidor. Saldo: "+result.afterStock+".");
   if(typeof setTimeout==="function")setTimeout(()=>window.POTE_STOCK_UPDATE?.pulse?.(kind,id),0);
   return true;
  }).catch(error=>{
   errorField.textContent=error.message||"Compra não confirmada";
   errorField.hidden=false;return false;
  });
 }
 state.data.purchases??=[];state.data.stockMovements??=[];
 try{
  if(mode==="purchase"){
   const input=current.kind==="beverage"?{...item,measureUnit:"un"}:item;
   const result=S().purchase({ingredient:input,quantity:x.quantity,unit:x.unit,
    paidTotal:x.paid,supplier:$("stockUpdateSupplier")?.value||"",
    purchases:state.data.purchases,movements:state.data.stockMovements,
    makeId:()=>uid()});
   if(current.kind==="beverage"){
    item.stock=result.next;
    item.purchasePrice=result.totalPaid;item.purchaseQuantity=x.quantity;
    item.purchaseUnit=x.unit;item.catalogPurchaseAt=result.receipt.at;
    result.receipt.itemKind="beverage";state.data.stockMovements[0].itemKind="beverage";
   }
   result.receipt.packagesPurchased=x.count;
   result.receipt.packageContent=x.multiplier;
   result.receipt.packageUnit=x.unit;
   result.receipt.costPerBaseUnit=x.paid/x.baseAmount;
  }else{
   const input=current.kind==="beverage"?{...item,measureUnit:"un"}:item;
   const result=S().adjust({ingredient:input,quantity:x.quantity,unit:x.unit,
    reason:$("stockUpdateReason")?.value||"Contagem física",
    movements:state.data.stockMovements,makeId:()=>uid()});
   if(current.kind==="beverage"){item.stock=result.next;state.data.stockMovements[0].itemKind="beverage"}
  }
  const {kind,id}=current;
  persist();close();render();
  const label=kind==="beverage"?item.name+" · "+(item.size||""):item.name;
  toast(label+": saldo atualizado para "+S().formatStock(kind==="beverage"?{...item,measureUnit:"un"}:item)+".");
  if(typeof setTimeout==="function")setTimeout(()=>window.POTE_STOCK_UPDATE?.pulse?.(kind,id),0);
  return true;
 }catch(e){
  $("stockUpdateError").textContent=e.message;
  $("stockUpdateError").hidden=false;return false;
 }
}
function pulse(kind,id){
 let selector;
 try{selector=kind==="beverage"?'.stock-beverage-card [data-bev-id="'+CSS.escape(id)+'"]':
  '.stock-card [data-stock-id="'+CSS.escape(id)+'"]'}catch(_){return}
 const element=document.querySelector(selector)?.closest?.(kind==="beverage"?".stock-beverage-card":".stock-card");
 if(element){element.classList.remove("stock-highlight");void element.offsetWidth;element.classList.add("stock-highlight");
  element.scrollIntoView?.({behavior:"smooth",block:"center"})}
}
function close(){const holder=$("poteStockUpdate");if(holder)holder.hidden=true;current=null}
window.POTE_STOCK_UPDATE={open,save,close,calc,update,pulse,recover,stockInfo,identifyUnknown};
})();
