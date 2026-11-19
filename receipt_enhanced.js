/* Recibo detalhado e comanda no próprio fluxo de pedidos, impressão térmica 58/80mm. */
(function(){
"use strict";
if(window.POTE_RECEIPTS)return;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const qty=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:2});
const status={recebido:"Recebido",em_producao:"Em produção",entregue:"Concluído / entregue",cancelado:"Cancelado"};
function recipeOf(order,data){return data?.recipes?.find(x=>x.id===order.recipeId)||null}
function weight(order,data){
 const explicit=Number(order.approxWeightG||0);
 if(explicit>0&&explicit<100000)return {g:explicit,source:"informado no pedido"};
 const r=recipeOf(order,data);
 const recipeGrams=Number(r?.portionWeightG||r?.weightG||0);
 if(recipeGrams>0&&recipeGrams<100000)return {g:recipeGrams,source:"informado na receita"};
 const batataria=order.businessType==="batataria"||
   (data?.businessType==="batataria"&&(!r||!r.businessUniverse||r.businessUniverse==="batataria"))||
   r?.templateOrigin==="batataria"||r?.templateOrigin==="franchise";
 if(batataria){
  const category=String(order.recipeCategory||r?.category||"").toLowerCase();
  if(category.includes("doce")||category.includes("sobremesa"))return {g:250,source:"padrão aproximado para doce"};
  return {g:500,source:"padrão aproximado para salgado"};
 }
 return {g:null,source:"não informado"};
}
function grams(n){
 if(!Number.isFinite(n)||n<=0)return "não informado";
 return n>=1000?(n/1000).toLocaleString("pt-BR",{maximumFractionDigits:2})+" kg":qty(n)+" g";
}
function formatDate(order){
 const value=order.createdAt||order.date;
 if(!value)return "Não informada";
 const date=new Date(value);
 return Number.isNaN(date.valueOf())?String(value):date.toLocaleString("pt-BR",
  {dateStyle:"short",timeStyle:order.createdAt?"short":undefined});
}
function line(name,value,cls=""){
 return '<div class="pote-receipt-line '+cls+'"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong></div>'
}
function render(order,type,data){
 if(!order)return '<div class="receipt">Pedido não encontrado.</div>';
 const kitchen=type==="kitchen",brand=data?.brand||{},w=weight(order,data),
  count=Math.max(1,Number(order.qty)||1);
 const client=String(order.clientName||"Balcão / não informado");
 const payment=String(order.paymentMethod||order.note?.match(/Pgto:\s*([^•|\n]+)/)?.[1]||"Não informado").trim();
 const sub=Number(order.price||0)*count,delivery=Number(order.deliveryFee||0);
 const total=sub+delivery,removed=(order.removedIngredients||[]),
  extras=(order.customAddons||[]),beverages=(order.beverageItems||[]),
  code=String((typeof window==='object'&&window.POTE_ORDER_PUBLIC_CODE?.(order))||('#'+String(order.id||'').slice(-8).toUpperCase())).replace(/^#/,'');
 const grouped=new Map();
 for(const item of order.items||[]){
  const key=item.id+":"+(item.addonName||"");
  const previous=grouped.get(key);
  if(previous)previous.amount+=Number(item.g||0)*count;
  else grouped.set(key,{name:item.ingredientName||item.id,unit:item.measureUnit||"g",
   amount:Number(item.g||0)*count,isPkg:!!item.isPkg,isExtra:!!item.addonName});
 }
 return '<article class="receipt pote-complete-receipt">'+
  '<header class="pote-receipt-header">'+
  '<h2>'+esc(brand.name||"Meu Negócio")+'</h2>'+
  (brand.phone?'<small>Contato: '+esc(brand.phone)+'</small>':'')+
  (brand.cnpj?'<small>CNPJ: '+esc(brand.cnpj)+'</small>':'')+
  (brand.instagram?'<small>Instagram: '+esc(brand.instagram)+'</small>':'')+
  '<strong>'+ (kitchen?"COMANDA DE PREPARO":"COMPROVANTE DO PEDIDO")+'</strong>'+
  '<small>Documento não fiscal · identificação interna</small></header>'+
  '<div class="pote-receipt-block">'+line("Pedido","№ "+(code||"—"))+
   line("Data e hora",formatDate(order))+line("Situação",status[order.status]||order.status||"Não informada")+
   line("Canal",order.channel==="marketplace"?"Marketplace":"Venda direta / balcão")+'</div>'+
  '<div class="pote-receipt-block"><h3>Cliente e entrega</h3>'+
   line("Cliente",client)+(order.clientPhone?line("WhatsApp",order.clientPhone):"")+
   line("Modalidade",order.deliveryType||((Number(order.deliveryFee)||0)>0?"Tele-entrega":"Retirada"))+
   line("Endereço / referência",order.clientAddress||"Retirada no balcão")+
   (kitchen?line("Taxa de tele-entrega",money(delivery)):"")+
   (!kitchen?line("Pagamento",payment)+
   line("Situação financeira",order.paymentStatus==="nao_pago"?"NÃO PAGO · cobrança pendente":
    order.paymentStatus||"Não confirmada")+
   (order.paymentStatus!=="nao_pago"&&order.paidAmount!=null?line("Valor recebido",money(order.paidAmount)):"")+
   (order.paymentStatus!=="nao_pago"&&order.changeGiven!=null?line("Troco devolvido",money(order.changeGiven)):""):"")+'</div>'+
  '<div class="pote-receipt-block"><h3>Produto</h3>'+
   '<div class="pote-receipt-product"><strong>'+esc(order.name||"Produto")+'</strong>'+
    '<span>'+qty(count)+' unidade(s) × '+money(order.price)+' (incl. adicionais)</span></div>'+
   (w.g?line("Peso aproximado por unidade","aprox. "+grams(w.g),"weight")+
     line("Peso total aproximado","aprox. "+grams(w.g*count),"weight"):
     line("Peso aproximado","Não informado para este produto","weight"))+
   '<small class="pote-receipt-note">Peso estimado do produto, sem bebidas nem embalagem. Pode variar conforme preparo e extras. Não substitui pesagem.</small>'+
   (removed.length?'<div class="pote-receipt-removed"><strong>RETIRAR / NÃO COLOCAR</strong>'+
     '<div>'+removed.map(x=>'SEM '+esc(typeof x==="string"?x:x.name||"ingrediente")).join(" · ")+'</div></div>':'')+
   (extras.length?'<div class="pote-receipt-extras"><strong>ADICIONAIS EXTRAS</strong>'+
     '<div>'+extras.map(x=>esc((x.name||"Adicional")+" ×"+(x.count||1))+
     " por unidade"+(Number(x.unitPrice)>0?" · +"+money(x.unitPrice*Number(x.count||1))+" já incluídos no preço":"")).join(" · ")+'</div></div>':'')+
   ((order.addons||[]).length&&!extras.length?'<p>Adicionais: '+
     esc(order.addons.map(x=>x.name||"Adicional").join(", "))+'</p>':'')+
   (beverages.length?'<div class="pote-receipt-drinks"><strong>Bebidas</strong>'+
    beverages.map(x=>line(x.name,qty(Number(x.qty||0)*count)+" un")).join("")+'</div>':"")+
   '</div>'+
  (kitchen?'<div class="pote-receipt-block"><h3>Separação de ingredientes</h3>'+
   '<table><thead><tr><th>Insumo</th><th>Quantidade total</th></tr></thead><tbody>'+
   [...grouped.values()].filter(x=>x.amount>0).map(x=>'<tr><td>'+
   (x.isExtra?"+ ":x.isPkg?"Embalagem · ":"")+esc(x.name)+'</td><td>'+
   qty(x.amount)+" "+esc(x.unit)+'</td></tr>').join("")+'</tbody></table>'+
   '<small class="pote-receipt-note">Quantidades para o pedido completo. Conferir ingredientes retirados antes de montar.</small></div>':
   '<div class="pote-receipt-block"><h3>Valores</h3>'+
    line("Produtos",money(sub))+
    (Number(order.discountApplied||0)>0?line("Desconto do combo",money(Number(order.discountApplied)*count)+" já incluído no preço"):"")+
    line("Taxa de tele-entrega",delivery>0?money(delivery):"Sem cobrança")+
    line("TOTAL",money(total),"total")+'</div>')+
  '<div class="pote-receipt-block"><h3>Observações '+(kitchen?"para a cozinha":"do pedido")+'</h3>'+
   '<p>'+esc(order.note||"Nenhuma observação registrada")+'</p></div>'+
  '<footer class="pote-receipt-footer">'+
   '<small>'+ (kitchen?"Uso interno · verificar adicionais, retiradas e identificação antes da entrega.":
   "Obrigado pela preferência. Confira os itens ao receber. Documento não fiscal.")+'</small>'+
  '</footer></article>';
}
function open(id,type){
 if(typeof state==="undefined")return;
 const order=state.data.orders.find(x=>x.id===id);
 if(!order)return;
 const old=document.getElementById("poteReceiptModal");
 old?.remove?.();
 const modal=document.createElement("div");modal.id="poteReceiptModal";
 modal.innerHTML='<div class="pote-receipt-sheet">'+
  '<div class="pote-receipt-toolbar">'+
  '<button class="btn line" type="button" id="poteReceiptClose">Fechar · voltar aos pedidos</button>'+
  '<button class="btn" type="button" id="poteReceiptPrint">Imprimir / salvar PDF</button></div>'+
  render(order,type,state.data)+'</div>';
 document.body.appendChild(modal);
 document.getElementById("poteReceiptClose")?.addEventListener("click",()=>modal.remove());
 document.getElementById("poteReceiptPrint")?.addEventListener("click",()=>window.print?.());
}
window.POTE_RECEIPTS={render,open,weight,grams};
})();
