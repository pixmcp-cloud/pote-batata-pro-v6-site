/* Exclusão reversível de inventário e mesclagem segura sem perder histórico. */
(function(){
"use strict";
if(window.POTE_STOCK_DELETE)return;
const $=id=>document.getElementById(id);
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const unit=x=>x?.measureUnit||"g";
const sameUnit=(a,b)=>unit(a)===unit(b);
const sameKind=(a,b)=>String(a.category||"")===String(b.category||"");
const fmt=(i,qty)=>window.POTE_STOCK?.formatStock?.(i,qty)||String(qty||0)+" "+unit(i);
function item(id){return (state.data.ingredients||[]).find(i=>i.id===id)}
function dependencies(id){
 const recipes=(state.data.recipes||[]).filter(r=>(r.items||[]).some(x=>x.id===id)||
   (r.packagingIngredientIds||[]).includes(id));
 const addons=(state.data.addons||[]).filter(a=>a.ingredientId===id);
 const orders=(state.data.orders||[]).filter(o=>(o.items||[]).some(x=>x.id===id));
 const pending=orders.filter(o=>o.status==="recebido"||o.status==="em_producao");
 return {recipes,addons,orders,pending,activeCount:recipes.length+addons.length+pending.length};
}
function alternatives(i){
 if(!i)return [];
 return (state.data.ingredients||[]).filter(other=>!other.archived&&other.id!==i.id&&
   sameUnit(i,other)&&sameKind(i,other))
   .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-BR"));
}
function archived(){return (state.data.ingredients||[]).filter(i=>i.archived)}
function record(type,src,target,quantity){
 (state.data.stockMovements??=[]).unshift({
  id:"stock-trash-"+Date.now()+"-"+Math.floor(Math.random()*999999),
  at:new Date().toISOString(),
  ingredientId:src.id,ingredientName:src.name,
  quantity,reason:type,referenceId:target?.id||src.id,
  oldIngredientId:src.id,newIngredientId:target?.id||null,
  afterStock:src.stock||0
 });
}
function dialog(){
 let modal=$("poteDeleteStockModal");if(modal)return modal;
 modal=document.createElement("div");modal.id="poteDeleteStockModal";modal.hidden=true;
 modal.innerHTML='<section class="stock-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="stockDeleteTitle">'+
 '<h2 id="stockDeleteTitle">Lixeira do estoque</h2>'+
 '<div id="stockDeleteContent"></div>'+
 '<div class="stock-delete-actions"><button type="button" class="btn line" id="stockDeleteCancel">Cancelar</button>'+
 '<button type="button" class="btn danger" id="stockDeleteArchive">Excluir da lista</button>'+
 '<button type="button" class="btn" id="stockDeleteMerge">Substituir e excluir duplicado</button></div>'+
 '</section>';
 document.body.appendChild(modal);
 $("stockDeleteCancel").addEventListener("click",close);
 $("stockDeleteArchive").addEventListener("click",()=>archiveSelected());
 $("stockDeleteMerge").addEventListener("click",()=>mergeSelected());
 return modal;
}
let selectedId=null;
function open(id){
 const ing=item(id);if(!ing)return;
 const modal=dialog(),usage=dependencies(id),targets=alternatives(ing);
 selectedId=id;
 const busy=usage.pending.length>0,referenced=usage.recipes.length>0||usage.addons.length>0;
 const selectable=targets.length>0&&!busy;
 $("stockDeleteTitle").textContent="Excluir "+ing.name+"?";
 $("stockDeleteContent").innerHTML=
  '<p><b>Saldo físico:</b> '+html(fmt(ing,n(ing.stock)))+
  '. <b>Categoria:</b> '+html(ing.category||"Insumo")+'.</p>'+
  '<div class="stock-delete-usage">'+
  '<p>Vínculos: '+usage.recipes.length+' receita(s), '+usage.addons.length+
  ' adicional(is), '+usage.pending.length+' pedido(s) abertos e '+usage.orders.length+
  ' pedido(s) no histórico.</p>'+
  (busy?'<p class="stock-delete-stop">Existem pedidos abertos usando este item. Finalize ou cancele esses pedidos antes de excluir ou substituir o cadastro.</p>':'')+
  (referenced?'<p>Este item participa de receitas ou adicionais. Não pode simplesmente desaparecer: escolha um produto equivalente abaixo para substituir seus vínculos e transferir o saldo.</p>':'')+
  '<p>A lixeira preserva compras, movimentações e registros anteriores. Excluir da lista é reversível.</p>'+
  '</div>'+
  (selectable?'<label>Manter este cadastro no lugar do excluído'+
   '<select id="stockDeleteReplacement">'+targets.map(x=>
   '<option value="'+html(x.id)+'">'+html(x.name)+' — '+html(fmt(x,n(x.stock)))+'</option>').join("")+
   '</select></label><small>Confirme que os produtos são realmente equivalentes: pote 250 g não é pote 500 g. Saldos serão somados apenas se você escolher substituir.</small>':'')+
  '<p id="stockDeleteWarning" class="stock-delete-warning" role="status"></p>';
 $("stockDeleteArchive").hidden=busy||referenced;
 $("stockDeleteMerge").hidden=!selectable;
 modal.hidden=false;
 $("stockDeleteCancel")?.focus?.();
}
function close(){
 const modal=$("poteDeleteStockModal");if(modal)modal.hidden=true;
 selectedId=null;
}
function archiveSelected(){
 const i=item(selectedId);if(!i)return;
 const usage=dependencies(i.id);
 if(usage.activeCount){
  const note=$("stockDeleteWarning");
  if(note)note.textContent="Item em uso. Finalize os pedidos e substitua o ingrediente nas receitas antes de excluir.";
  return false;
 }
 if(!window.confirm("Enviar \""+i.name+"\" para a lixeira?\nSaldo físico: "+
   fmt(i,n(i.stock))+"\n\nO cadastro sairá da lista ativa, mas poderá ser restaurado; o histórico será mantido."))return false;
 i.archived=true;i.archivedAt=new Date().toISOString();
 record("Item arquivado pelo usuário",i,null,0);
 persist();close();render();toast("Item enviado à lixeira: "+i.name);
 return true;
}
function mergeTo(sourceId,targetId){
 const source=item(sourceId),target=item(targetId);
 if(!source||!target||source.archived||target.archived||source.id===target.id)return {ok:false,reason:"Selecione dois itens ativos diferentes."};
 if(!sameUnit(source,target)||!sameKind(source,target))return {ok:false,reason:"A categoria e a unidade dos dois itens precisam ser iguais."};
 const usage=dependencies(sourceId);
 if(usage.pending.length)return {ok:false,reason:"Finalize ou cancele os pedidos em aberto antes de substituir o item."};
 // Histórico de compras e pedidos antigos permanece imutável.
 for(const r of state.data.recipes||[]){
  for(const row of r.items||[])if(row.id===sourceId)row.id=targetId;
  if(Array.isArray(r.packagingIngredientIds))
   r.packagingIngredientIds=[...new Set(r.packagingIngredientIds.map(x=>x===sourceId?targetId:x))];
  // Quando duas referências de embalagem equivalentes coexistiam na ficha,
  // a substituição representa UMA embalagem, não duas por produto.
  if(Array.isArray(r.items)){
   const seen=new Map();
   for(const row of r.items){
    const old=seen.get(row.id);
    if(!old){seen.set(row.id,row);continue}
    if(target.category==="Embalagem")old.g=Math.max(n(old.g),n(row.g));
    else old.g=n(old.g)+n(row.g);
   }
   r.items=[...seen.values()];
  }
 }
 for(const a of state.data.addons||[])if(a.ingredientId===sourceId)a.ingredientId=targetId;
 const moved=Math.max(0,n(source.stock));
 target.stock=Math.round((n(target.stock)+moved)*100000)/100000;
 target.minimum=Math.max(n(target.minimum),n(source.minimum));
 if(n(target.purchasePrice)<=0&&n(source.purchasePrice)>0){
  target.purchasePrice=source.purchasePrice;
  target.purchaseQuantity=source.purchaseQuantity;
  target.purchaseUnit=source.purchaseUnit;
 }
 if(Array.isArray(window.POTE_RESTOCK_CONTEXT?.items)){
  window.POTE_RESTOCK_CONTEXT.items=window.POTE_RESTOCK_CONTEXT.items.map(x=>
    x.id===sourceId&&x.kind==="ingredient"?{...x,id:targetId,name:target.name}:x);
 }
 source.stock=0;source.archived=true;source.archivedAt=new Date().toISOString();
 source.mergedInto=target.id;
 record("Transferência de saldo e exclusão de duplicado",source,target,moved);
 return {ok:true,targetId,transferred:moved,stock:target.stock};
}
function mergeSelected(){
 const targetId=$("stockDeleteReplacement")?.value;
 const source=item(selectedId),target=item(targetId);
 if(!source||!target)return false;
 if(!window.confirm("SUBSTITUIR E EXCLUIR?\n\nDe: "+source.name+" ("+fmt(source,n(source.stock))+")"+
  "\nPara: "+target.name+" ("+fmt(target,n(target.stock))+")"+
  "\n\nConfirme que são embalagens/insumos equivalentes. As compras e pedidos antigos permanecerão registrados. O saldo será transferido e as receitas serão atualizadas."))return false;
 const result=mergeTo(source.id,target.id);
 if(!result.ok){
  const warning=$("stockDeleteWarning");if(warning)warning.textContent=result.reason;
  return false;
 }
 persist();close();render();
 toast("Cadastro duplicado retirado. "+target.name+" agora tem "+fmt(target,result.stock)+".");
 return true;
}
function restore(id){
 const ing=item(id);if(!ing||!ing.archived)return false;
 if(ing.mergedInto){
  alert("Este cadastro já teve o saldo transferido para outro item. Para evitar duplicar mercadorias, crie um cadastro novo apenas após conferência física.");
  return false;
 }
 ing.archived=false;delete ing.archivedAt;
 record("Item restaurado da lixeira",ing,null,0);
 persist();render();toast("Item restaurado: "+ing.name);
 return true;
}
function trashHtml(){
 const list=archived();
 if(!list.length)return "";
 return '<details class="stock-trash-section"><summary>Lixeira · '+list.length+' item(ns) excluído(s)</summary>'+
  '<p>Itens retirados da lista ativa, preservados para auditoria e eventual restauração.</p>'+
  list.map(i=>'<div><strong>'+html(i.name)+'</strong><span>'+
   html(i.mergedInto?"Saldo transferido para outro cadastro":"Saldo guardado: "+fmt(i,n(i.stock)))+'</span>'+
   (i.mergedInto?"":'<button type="button" class="btn mini line" data-restore-id="'+html(i.id)+
    '" onclick="POTE_STOCK_DELETE.restore(this.dataset.restoreId)">Restaurar</button>')+'</div>').join("")+
  '</details>';
}
window.POTE_STOCK_DELETE={open,close,archiveSelected,mergeSelected,mergeTo,restore,trashHtml,dependencies,alternatives,archived};
})();
