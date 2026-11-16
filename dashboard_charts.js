/* Potê Batata Pro: gráficos operacionais reais. Sobra != lucro, não somar as duas métricas. */
(function(){
"use strict";
const fmt=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const days=()=>Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i-6);return dateKey(d)});
function lineChart(values,dates){
 const max=Math.max(1,...values);
 const x=i=>40+i*93;
 const y=v=>158-(Math.max(0,v)/max)*121;
 const points=values.map((v,i)=>x(i)+","+y(v).toFixed(1)).join(" ");
 const area=points+" "+x(6)+",158 40,158";
 return '<svg class="ops-chart-line" viewBox="0 0 640 204" role="img" aria-label="Faturamento diário dos últimos sete dias">'
 +'<defs><linearGradient id="opsAreaFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5c77c" stop-opacity=".34"/><stop offset="1" stop-color="#f5c77c" stop-opacity="0"/></linearGradient></defs>'
 +[37,98,158].map(y0=>'<line x1="40" y1="'+y0+'" x2="598" y2="'+y0+'" stroke="#91a5b7" stroke-opacity=".2" stroke-dasharray="4 6"/>').join("")
 +'<polygon points="'+area+'" fill="url(#opsAreaFill)"/><polyline points="'+points+'" fill="none" stroke="#efc478" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>'
 +values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v).toFixed(1)+'" r="4" fill="#ffdb9d" stroke="#29394e" stroke-width="2"><title>'+esc(dates[i])+': '+esc(fmt(v))+'</title></circle>').join("")
 +dates.map((day,i)=>'<text x="'+x(i)+'" y="189" text-anchor="middle" fill="#b8c7d9" font-size="12">'+day.slice(8)+'</text>').join("")
 +'</svg>';
}
function compareBars(profit,surplus){
 const largest=Math.max(1,Math.abs(profit),Math.abs(surplus));
 const bars=[
  {label:"Lucro",value:profit,desc:"Após rateio dos custos fixos e perdas",tone:profit<0?"loss":"profit"},
  {label:"Sobras",value:surplus,desc:"Disponível antes dos custos fixos e perdas",tone:surplus<0?"loss":"surplus"}
 ];
 return '<div class="ops-profit-compare" aria-label="Comparação independente entre lucro e sobras">'+
 bars.map(b=>'<div class="ops-profit-row '+b.tone+'"><div class="ops-profit-row-top"><span><i aria-hidden="true"></i><b>'+b.label+
  '</b></span><strong>'+fmt(b.value)+'</strong></div>'+
  '<div class="ops-profit-track" role="img" aria-label="'+esc(b.label)+': '+esc(fmt(b.value))+'"><span style="width:'+
  (Math.abs(b.value)/largest*100).toFixed(2)+'%"></span></div><small>'+b.desc+'</small></div>').join("")+'</div>';
}
function render(data){
 const orders=Array.isArray(data?.orders)?data.orders.filter(o=>o&&o.status!=="cancelado"&&o.paymentStatus!=="nao_pago"):[];
 const lastDays=days(),salesByDay=Object.fromEntries(lastDays.map(d=>[d,0]));
 const flavors=new Map();
 let totalSales=0,totalContribution=0,totalProfit=0,units=0;
 const lossCost=(data?.losses||[]).filter(l=>!l.voidedAt).reduce((sum,l)=>sum+n(l.costLost),0);
 let missingContribution=0;
 for(const o of orders){
  const qty=Math.max(0,n(o.qty));
  const rev=n(o.price)*qty+n(o.deliveryFee);
  const delivResult=n(o.deliveryFee)-n(o.deliveryCost);
  if(!Number.isFinite(Number(o.unitContribution)))missingContribution++;
  const contribution=n(o.unitContribution??o.profit)*qty+delivResult;
  const profit=n(o.profit)*qty+delivResult;
  totalSales+=rev;totalContribution+=contribution;totalProfit+=profit;units+=qty;
  const d=String(o.date||o.createdAt||"").slice(0,10);
  if(Object.prototype.hasOwnProperty.call(salesByDay,d))salesByDay[d]+=rev;
  const name=String(o.name||"Produto sem nome").trim()||"Produto sem nome";
  flavors.set(name,(flavors.get(name)||0)+qty);
 }
 totalProfit-=lossCost;
 const vals=lastDays.map(k=>salesByDay[k]);
 const ranked=[...flavors.entries()].filter(([_,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const maxFlavor=Math.max(1,...ranked.map(x=>x[1]));
 const resultColor=totalContribution<0?" ops-negative":"";
 const covered=totalContribution-totalProfit;
 return '<section class="ops-analytics" aria-label="Gráficos financeiros de pedidos reais">'
 +'<div class="ops-analytics-heading"><div><small>INTELIGÊNCIA DA OPERAÇÃO</small><h2>Seus números, com clareza</h2><p>Dados exclusivos desta conta. Pedidos cancelados não entram nos gráficos.</p></div><span class="ops-real-badge">● DADOS REAIS</span></div>'
 +'<div class="ops-stats ops-stats-losses"><div><small>Faturamento registrado</small><strong>'+fmt(totalSales)+'</strong></div><div><small>Sobras antes dos custos fixos</small><strong class="'+resultColor+'">'+fmt(totalContribution)+'</strong></div><div><small>Lucro estimado após perdas</small><strong class="'+(totalProfit<0?"ops-negative":"")+'">'+fmt(totalProfit)+'</strong></div><div><small>Potes registrados</small><strong>'+units.toLocaleString("pt-BR")+'</strong></div></div>'
 +'<div class="ops-analytics-grid"><article class="ops-chart-card ops-chart-wide"><div class="ops-chart-title"><h3>Faturamento diário</h3><span>Últimos 7 dias</span></div>'
 +lineChart(vals,lastDays)
 +(vals.every(v=>v===0)?'<p class="ops-chart-empty">Ainda sem vendas neste período. A curva começa a crescer com os primeiros pedidos.</p>':'')
 +'</article>'
 +'<article class="ops-chart-card"><div class="ops-chart-title"><h3>Sabores mais vendidos</h3><span>Por unidades</span></div>'
 +(ranked.length?ranked.map(([name,qty])=>'<div class="ops-flavor-row"><div class="ops-flavor-name" title="'+esc(name)+'">'+esc(name)+'</div><div class="ops-flavor-track"><i style="width:'+(qty/maxFlavor*100).toFixed(1)+'%"></i></div><strong>'+qty+'</strong></div>').join(""):'<div class="ops-chart-placeholder"><span>◌</span><p>Sem sabores vendidos ainda.</p><small>Seus campeões aparecerão aqui.</small></div>')
 +'</article>'
 +'<article class="ops-chart-card ops-profit-card"><div class="ops-chart-title"><h3>Lucro × Sobras</h3><span>Acumulado das vendas</span></div>'
 +compareBars(totalProfit,totalContribution)
 +'<div class="ops-profit-summary">'+
 (covered>=0?'<span>Despesas rateadas e perdas descontadas do lucro</span><strong>'+fmt(covered)+'</strong>':
 '<span>⚠ Revisar custos: lucro calculado acima das sobras</span><strong>'+fmt(Math.abs(covered))+'</strong>')+'</div>'
 +(missingContribution?'<p class="ops-chart-note">Atenção: '+missingContribution+' pedido(s) antigos sem separação da sobra. Confira a ficha de custos para comparação mais precisa.</p>':'')
 +(totalSales===0?'<p class="ops-chart-empty">Sem vendas registradas. Valores zerados, sem dados fictícios.</p>':'')
 +'<p class="ops-chart-note">Lucro e sobras são duas leituras das mesmas vendas: não devem ser somados.</p></article></div>'
 +'<p class="ops-chart-disclaimer">Resultados estimados a partir dos pedidos; não substituem o fluxo de caixa, a conferência de pagamentos nem a apuração fiscal. Use o Painel de Simulação para visualizar exemplos fictícios separadamente.</p>'
 +'</section>';
}
window.POTE_CHARTS={render,compareBars};
})();