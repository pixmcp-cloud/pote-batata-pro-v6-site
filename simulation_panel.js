/* Painel de simulação, somente leitura — nunca modifica as vendas, o estoque ou o Firestore. */
(function(){
  "use strict";
  if (typeof pageHome !== "function") return;
  const savedHome = pageHome;
  pageHome=function(...args){
    const html=savedHome(...args);
    return html.replace("</section>", "</section>" + '<section class="pote-sim-invite" aria-label="Dados demonstrativos">'
      +'<div class="pote-sim-invite-copy"><div class="pote-sim-eyebrow">VISUALIZAÇÃO SEM RISCO</div>'
      +'<h2>Como seus gráficos podem ficar?</h2>'
      +'<p>Veja um painel com números fictícios, sem gerar vendas, alterar estoque ou afetar seu lucro real.</p></div>'
      +'<button type="button" class="pote-sim-open" onclick="window.POTE_SIM.open()">'
      +' <span>▥</span> Painel de simulação</button></section>');
  };
  const mock={
    revenue:2846.90,
    profit:1079.40,
    orders:89,
    days:[152,186,161,207,250,210,271],
    flavors:[["Carne com cheddar",26],["Estrogonofe de frango",21],["Cachorro-quente",18],["Pizza",13]]
  };
  let overlay=null,previousOverflow="";
  function amount(v){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function chartLine(values){
    const scale=(v)=>108-(v-130)/160*83;
    const points=values.map((v,i)=>(20+i*47).toFixed(0)+","+scale(v).toFixed(1));
    return '<svg class="pote-sim-line" viewBox="0 0 340 140" role="img" aria-label="Gráfico ilustrativo de faturamento durante sete dias">'
      +'<defs><linearGradient id="simLineFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edb352" stop-opacity=".32"/><stop offset="1" stop-color="#edb352" stop-opacity="0"/></linearGradient></defs>'
      +'<path d="M20 108 H320 M20 70 H320 M20 32 H320" fill="none" stroke="#674c31" stroke-width=".8" opacity=".5"/>'
      +'<polygon points="20,118 '+points.join(" ")+' 302,118" fill="url(#simLineFill)"/>'
      +'<polyline points="'+points.join(" ")+'" fill="none" stroke="#eec477" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
      +values.map((v,i)=>'<circle cx="'+(20+i*47)+'" cy="'+scale(v).toFixed(1)+'" r="3.5" fill="#ffdf96"/>').join("")
      +'<text x="20" y="136">SEG</text><text x="114" y="136">QUA</text><text x="208" y="136">SEX</text><text x="302" y="136">DOM</text></svg>';
  }
  function build(){
    const costs=mock.revenue-mock.profit;
    const pct=Math.round(mock.profit/mock.revenue*100);
    return '<div class="pote-sim-overlay" role="dialog" aria-modal="true" aria-labelledby="poteSimTitle">'
      +'<div class="pote-sim-window"><div class="pote-sim-head">'
      +'<div><div class="pote-sim-eyebrow">DADOS FICTÍCIOS • NÃO SALVOS</div><h2 id="poteSimTitle">Painel de simulação</h2><p>Exemplo visual. Seus números reais permanecem intactos.</p></div>'
      +'<button class="pote-sim-close" type="button" aria-label="Fechar simulação" onclick="window.POTE_SIM.close()">✕</button></div>'
      +'<div class="pote-sim-kpis">'
      +'<div><small>Faturamento ilustrativo</small><strong>'+amount(mock.revenue)+'</strong><em>Exemplo</em></div>'
      +'<div><small>Pedidos ilustrativos</small><strong>'+mock.orders+'</strong><em>Exemplo</em></div>'
      +'<div><small>Lucro ilustrativo</small><strong>'+amount(mock.profit)+'</strong><em>Exemplo</em></div></div>'
      +'<div class="pote-sim-charts">'
      +'<article class="pote-sim-chart"><h3>Faturamento <span>7 dias ilustrativos</span></h3>'+chartLine(mock.days)+'</article>'
      +'<article class="pote-sim-chart"><h3>Mais vendidos <span>Ranking fictício</span></h3>'
      +mock.flavors.map(([name,v])=>'<div class="pote-sim-bar"><span>'+escapeHtml(name)+'</span><div><i style="width:'+(v/26*100)+'%"></i></div><b>'+v+'</b></div>').join('')
      +'</article>'
      +'<article class="pote-sim-chart"><h3>Custos x lucro <span>Valores fictícios</span></h3>'
      +'<div class="pote-sim-donut-row"><div class="pote-sim-donut" style="--percent:'+pct+'"><strong>'+pct+'%</strong><small>Lucro</small></div>'
      +'<div><div><span class="pote-sim-dot gold"></span>Lucro: <b>'+amount(mock.profit)+'</b></div>'
      +'<div><span class="pote-sim-dot brown"></span>Custos: <b>'+amount(costs)+'</b></div></div></div></article></div>'
      +'<div class="pote-sim-foot"><span>🔒 Nenhum pedido, estoque, faturamento ou custo real foi alterado.</span>'
      +'<button type="button" onclick="window.POTE_SIM.close()">Voltar aos meus dados</button></div>'
      +'</div></div>';
  }
  function close(){
    if(!overlay)return;
    overlay.remove();overlay=null;document.body.style.overflow=previousOverflow;
  }
  function open(){
    if(overlay)return;
    previousOverflow=document.body.style.overflow;
    overlay=document.createElement("div");
    overlay.innerHTML=build();
    overlay=overlay.firstElementChild;
    overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
    document.body.appendChild(overlay);
    document.body.style.overflow="hidden";
    overlay.querySelector(".pote-sim-close")?.focus();
  }
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  window.POTE_SIM={open,close};
})();
