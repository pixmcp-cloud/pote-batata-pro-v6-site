/* Auditoria automática do inventário: detecta referências, saldos, duplicidade e reservas. */
(function(){
"use strict";
if(window.POTE_APP_AUDIT)return;
const getNum=x=>typeof x==="number"?x:window.POTE_STOCK?.stockNumber?.(x);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>Number(x||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
function scan(data){
 if(!data)return {issues:[],errors:0,warnings:0};
 const issues=[],existing=new Map(),active=new Set(),used=new Set();
 const add=(level,code,name,detail,id,kind="ingredient",recipeId)=>issues.push({
  level,code,name,detail,id,kind,recipeId});
 for(const item of data.ingredients||[]){
  if(item.archived)continue;
  existing.set(item.id,item);
  const stock=getNum(item.stock);
  if(!Number.isFinite(stock)||stock<0)
   add("error","invalid-stock",item.name||item.id,
    "O estoque está armazenado em formato inválido: "+String(item.stock)+". Faça conferência física.",item.id);
  if(!item.id||!item.name||!item.measureUnit)
   add("error","incomplete-item",item.name||item.id||"Sem identificação",
    "Cadastro incompleto: nome, ID e unidade são obrigatórios.",item.id);
 }
 const saleable=(data.recipes||[]).filter(r=>!r.unavailable&&
  (typeof canSell!=="function"||canSell(r)));
 for(const r of saleable){
  if(!r.items?.length){
   add("error","no-recipe",r.name,"Receita sem ingredientes. Abra a receita para completar a ficha.",r.id,"recipe",r.id);
   continue;
  }
  for(const row of r.items){
   used.add(row.id);
   const item=existing.get(row.id);
   if(!item)add("error","missing-ingredient",r.name,
    "A receita pede um ingrediente que não está cadastrado/está excluído: ID "+row.id+
    ". Abra o estoque para recuperar o cadastro ou corrigir a ficha.",row.id,"ingredient",r.id);
   else if(!Number.isFinite(Number(row.g))||Number(row.g)<=0)
    add("error","invalid-quantity",r.name,"Quantidade inválida de "+item.name+
     " na ficha: "+String(row.g),r.id,"recipe",r.id);
  }
  if(data.settings?.usePackagingStock){
   if(!Array.isArray(r.packagingIngredientIds))
    add("warning","unlinked-package",r.name,
     "Nenhuma embalagem foi escolhida nesta receita. Se usa pote, garfo, sacola ou caixa, marque as embalagens corretas em Precificação.",r.id,"recipe",r.id);
   else for(const id of r.packagingIngredientIds){
    used.add(id);
    const item=existing.get(id);
    if(!item)
     add("error","missing-package",r.name,
       "A embalagem vinculada não existe no estoque ativo: ID "+id+".",id,"ingredient",r.id);
   }
  }
 }
 for(const a of data.addons||[]){
  if(a.ingredientId&&!existing.has(a.ingredientId))
   add("error","missing-addon",a.name||a.id,"Adicional vinculado a ingrediente inexistente: "+
    a.ingredientId,a.ingredientId);
 }
 const seen=new Map();
 for(const item of data.ingredients||[]){
  if(item.archived)continue;
  const norm=window.POTE_INVENTORY?.key?.(item)||
   String(item.name+"|"+item.measureUnit+"|"+item.category).toLowerCase();
  const prev=seen.get(norm);
  if(prev)add("warning","duplicate",item.name,
   "Possível duplicidade: cadastros "+prev.id+" e "+item.id+
   ". Use a lixeira para transferir o saldo e arquivar o registro repetido.",item.id);
  else seen.set(norm,item);
 }
 const held=window.POTE_STOCK_STATUS?.reserved?.(data);
 for(const order of data.orders||[]){
  if(order.status!=="recebido"||order.stockDeducted===true)continue;
  for(const item of order.items||[]){
   if(item.id&&!existing.has(item.id))
    add("error","missing-reserved",order.name||order.id,
     "Pedido aguardando produção referencia ingrediente/embalagem invisível: "+item.id+
      ". Recupere ou ajuste o cadastro sem gerar estoque fictício.",item.id);
  }
 }
 if(held)for(const item of data.ingredients||[]){
  if(item.archived)continue;
  const reserved=Number(held.ingredients.get(item.id))||0;
  const stock=getNum(item.stock);
  if(reserved>0&&Number.isFinite(stock)&&reserved>stock+1e-7)
   add("error","over-reserved",item.name||item.id,
    "Reservado: "+fmt(reserved)+" "+(item.measureUnit||"g")+
    "; físico: "+fmt(stock)+" "+(item.measureUnit||"g")+
    ". Há mais pedidos reservados do que saldo disponível. Não confunda reserva com compra.",item.id);
 }
 const order={error:0,warning:1};
 issues.sort((a,b)=>(order[a.level]??9)-(order[b.level]??9)||
  a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
 return {issues,errors:issues.filter(i=>i.level==="error").length,
  warnings:issues.filter(i=>i.level==="warning").length};
}
function jump(kind,id,recipeId){
 if(kind==="recipe"){
  if(typeof go==="function")go("pricing");
  const field=document.getElementById("priceRecipe");
  if(field&&recipeId){field.value=recipeId;window.POTE_PRICING?.mount?.()}
 }else if(kind==="beverage")window.POTE_STOCK_EXT?.selectBeverage?.(id);
 else window.POTE_STOCK_UI?.openPurchase?.(id);
}
function panel(data){
 const result=scan(data);
 if(!result.issues.length)return '<section class="stock-audit-summary good" role="status">'+
  '<strong>Auditoria automática: sem inconsistências identificadas.</strong>'+
  '<span>Receitas, vínculos e reservas conferidos no estado atual.</span></section>';
 return '<section class="stock-audit-summary '+(result.errors?"error":"warning")+'" role="status">'+
  '<div><strong>Auditoria automática: '+result.errors+' problema(s) e '+
   result.warnings+' aviso(s)</strong><small>Verificação ao abrir e atualizar o estoque</small></div>'+
  '<details '+(result.errors?"open":"")+'><summary>Ver diagnósticos e abrir correções</summary>'+
  result.issues.slice(0,18).map(i=>
   '<div class="stock-audit-issue '+esc(i.level)+'"><div><strong>'+esc(i.name)+'</strong>'+
   '<p>'+esc(i.detail)+'</p></div>'+
   '<button class="btn mini" type="button" data-audit-id="'+esc(i.id)+'" data-audit-kind="'+esc(i.kind)+
   '" data-audit-recipe="'+esc(i.recipeId||"")+
   '" onclick="POTE_APP_AUDIT.jump(this.dataset.auditKind,this.dataset.auditId,this.dataset.auditRecipe)">'+
   (i.kind==="recipe"?"Rever ficha":"Ir para item")+'</button></div>').join("")+
  (result.issues.length>18?'<small>Exibindo as 18 primeiras inconsistências. Resolva e atualize a tela para continuar.</small>':"")+
  '</details></section>';
}
window.POTE_APP_AUDIT={scan,panel,jump};
})();
