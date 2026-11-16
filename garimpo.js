/* Garimpo: pesquisa regional por GPS, ofertas documentadas, histórico e CSV.
   Não representa resultados de buscas externas como preços confirmados. */
(function(){
"use strict";
if(window.POTE_GARIMPO)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=v=>{let s=String(v??"").trim().replace(/^R\$\s*/,"").replace(/\s/g,"");return Number(s.includes(",")?s.replace(/\./g,"").replace(",","."):s)};
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
const money=v=>Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateBR=v=>v?String(v).slice(0,10).split("-").reverse().join("/"):"—";
const units={g:["kg",.001],kg:["kg",1],ml:["L",.001],L:["L",1],un:["un",1],caixa:["caixa",1],fardo:["fardo",1],pacote:["pacote",1]};
const canonical=(qty,unit)=>{const u=units[unit];return u&&Number(qty)>0?{unit:u[0],quantity:Number(qty)*u[1]}:null};
const today=()=>new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
const stocks=()=>[...(state.data.ingredients||[]).map(i=>({id:"ing:"+i.id,name:i.name,brand:i.brand||"",kind:"ingredient",unit:i.measureUnit==="ml"?"L":i.measureUnit==="un"?"un":"kg"})),
 ...(state.data.beverages||[]).map(b=>({id:"bev:"+b.id,name:b.name,brand:b.brand||"",kind:"beverage",unit:"un",size:b.size||""}))];
const offers=()=>{state.data.garimpoOffers??=[];return state.data.garimpoOffers};
const recent=()=>offers().slice().sort((a,b)=>String(b.checkedAt).localeCompare(String(a.checkedAt)));
const dist=(a,b,c,d)=>{let rad=Math.PI/180,dl=(c-a)*rad,dn=(d-b)*rad;
 let h=Math.sin(dl/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dn/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))};
const REGIONAL=()=> (state.data.suppliers||[]).filter(s=>s.osmId||s.externalId||s.supplierType==="regional"||s.type==="Local");
let center=null,marketSearch=[],searchMessage="",busy=false;
function markets(){const map=new Map();for(const s of [...REGIONAL(),...marketSearch]){
 const key=norm(s.name)+"|"+norm(s.city||"");if(!map.has(key))map.set(key,s);
 }return [...map.values()].filter(s=>{
 if(!center||!Number.isFinite(Number(s.lat))||!Number.isFinite(Number(s.lon)))return false;
 return dist(center.lat,center.lon,Number(s.lat),Number(s.lon))<=30;
 }).map(s=>({...s,distanceKm:dist(center.lat,center.lon,Number(s.lat),Number(s.lon))})).sort((a,b)=>a.distanceKm-b.distanceKm);
}
function status(o,at=today()){
 if(o.recordType==="receipt")return "histórico NFC-e (não é oferta atual)";
 if(o.priceCondition==="clube")return "preço de clube — exige adesão";
 if(o.validUntil&&o.validUntil<at)return "vencida";
 if(o.validFrom&&o.validFrom>at)return "futura";
 if(!o.validUntil||!o.sourceUrl||!/^https?:\/\//i.test(o.sourceUrl))return "sem validade/fonte";
 if(o.recordType!=="official"&&o.recordType!=="manual")return "sem confirmação";
 // Conferência de usuário é tratada separadamente de verificação automática.
 if(o.recordType==="manual")return "conferida manualmente";
 if(!o.snapshotCurrent||o.freshness!=="CURRENT")return "fonte desatualizada";
 return "vigente na fonte";
}
const active=(o,at=today())=>["conferida manualmente","vigente na fonte"].includes(status(o,at));
function unitPrice(o){const p=number(o.price),q=canonical(o.packageQty,o.packageUnit);
 return Number.isFinite(p)&&p>0&&q?{price:p/q.quantity,unit:q.unit}:null;
}
function matcher(o,item){const unit=unitPrice(o);
 if(o.itemId!==item.id||!unit||unit.unit!==item.unit)return false;
 if(item.brand&&norm(o.brand)!==norm(item.brand))return false;
 // Bebidas com tamanhos distintos não podem ser comparadas como equivalentes.
 if(item.kind==="beverage"&&item.size&&norm(item.size)!==norm(o.size))return false;
 return true;
}
function validOffers(item){return recent().filter(o=>active(o)&&matcher(o,item)&&o.regionVerified===true);}
function best(item){return validOffers(item).sort((a,b)=>unitPrice(a).price-unitPrice(b).price)[0]||null;}
function save(){if(typeof persist==="function")persist();if(typeof window.render==="function")window.render();}
function addOffer(){
 const id=$("garimpoItem")?.value,item=stocks().find(i=>i.id===id);
 const market=String($("garimpoMarket")?.value||"").trim(),brand=String($("garimpoBrand")?.value||"").trim();
 const size=String($("garimpoSize")?.value||"").trim(),price=number($("garimpoPrice")?.value);
 const packageQty=number($("garimpoQty")?.value),packageUnit=String($("garimpoUnit")?.value||"");
 const validFrom=String($("garimpoFrom")?.value||"")||today(),validUntil=String($("garimpoUntil")?.value||"");
 const sourceUrl=String($("garimpoSource")?.value||"").trim(),recordType=$("garimpoReceipt")?.checked?"receipt":"manual";
 const ref=markets().find(x=>norm(x.name)===norm(market));
 const urlOk=/^https:\/\/[^ ]+$/i.test(sourceUrl);
 if(!item||!market||!Number.isFinite(price)||price<=0||!canonical(packageQty,packageUnit)){
  alert("Informe item, mercado, quantidade, unidade e preço positivo.");return false;
 }
 if(recordType==="manual"&&(!urlOk||!validUntil||validUntil<validFrom)){
  alert("Para comparar como oferta atual, informe o link HTTPS do encarte e a validade. Para notas fiscais, selecione preço histórico.");return false;
 }
 if(sourceUrl&&!urlOk){alert("Link de comprovação inválido: use endereço HTTPS.");return false;}
 const o={id:uid(),itemId:id,itemName:item.name,brand,size,market,price,packageQty,packageUnit,
  validFrom,validUntil,sourceUrl,checkedAt:new Date().toISOString(),recordType,
  priceCondition:String($("garimpoCondition")?.value||"normal"),
  regionVerified:!!ref,marketLat:ref?.lat??null,marketLon:ref?.lon??null,distanceKm:ref?.distanceKm??null};
 // Se a localização não foi comprovada, registra o histórico mas não aprova a comparação de 30 km.
 offers().unshift(o);save();toast(o.regionVerified?"Preço e validade registrados.":"Registro salvo, mas estabelecimento ainda sem confirmação dentro de 30 km.");return true;
}
function removeOffer(id){if(!window.confirm("Excluir este registro de preço?"))return false;
 state.data.garimpoOffers=offers().filter(x=>x.id!==id);save();return true;}
function exportCSV(){
 const rows=[["Produto","Marca","Volume","Mercado","Distancia_km","Embalagem","Quantidade","Preco_R$","Preco_Por_Unidade","Unidade_Comparacao","Tipo_Preco","Consultado","Inicio","Fim","Status","Fonte"]];
 for(const o of recent()){const u=unitPrice(o);rows.push([o.itemName,o.brand,o.size,o.market,o.distanceKm??"",o.packageUnit,o.packageQty,o.price,u?.price??"",u?.unit??"",o.priceCondition||"normal",o.checkedAt,o.validFrom,o.validUntil,status(o),o.sourceUrl]);}
 const csv="\ufeff"+rows.map(a=>a.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="garimpo_preco_historico.csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function searchUrl(item,market){
 const query=[item.name,item.size,item.brand,market.name,market.city||"SC","preço encarte"].filter(Boolean).join(" ");
 return "https://www.google.com/search?q="+encodeURIComponent(query);
}
let onlineCatalog=null,onlineInfo="Catálogo online ainda não consultado.";
const officialCatalogs=[
 {test:/giassi/i,name:"Giassi Supermercados",url:"https://www.giassi.com.br/"},
 {test:/combo/i,name:"Combo Atacadista",url:"https://www.comboatacadista.com.br/ofertas"},
 {test:/\bfort\b/i,name:"Fort Atacadista",url:"https://www.fortatacadista.com.br/encartes"},
 {test:/\bl[ií]der\b/i,name:"Supermercado Líder",url:"https://www.supermercadolider.com.br/produtos.php"}
];
function storeOfficial(m){return officialCatalogs.find(x=>x.test.test(m.name))||null}
function marketDetails(index){
 const m=markets()[Number(index)],host=$("garimpoMarketDetails");
 if(!m||!host)return false;
 const geo=Number(m.lat)+","+Number(m.lon),route="https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(geo);
 const map="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(m.name+" "+(m.address||m.city||""));
 const official=storeOfficial(m),web=m.website&&/^https?:\/\//i.test(m.website)?m.website:official?.url;
 const phone=String(m.phone||"").replace(/[^\d+]/g,"");
 const msg=encodeURIComponent("Olá! Qual o preço e disponibilidade de produtos para meu negócio?");
 const waDigits=phone.replace(/\D/g,"");
 const wa=/^55\d{10,11}$/.test(waDigits)?waDigits: /^\d{10,11}$/.test(waDigits)?"55"+waDigits:"";
 const buttons=[
  '<a class="btn mini" target="_blank" rel="noopener noreferrer" href="'+esc(route)+'">Traçar rota</a>',
  '<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc(map)+'">Ver no mapa</a>',
  phone?'<a class="btn mini line" href="tel:'+esc(phone)+'">Ligar</a>':'',
  wa?'<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+msg+'">WhatsApp</a>':'',
  web?'<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc(web)+'">Site / encarte oficial</a>':'',
  '<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc("https://www.google.com/search?q="+encodeURIComponent(m.name+" "+m.city+" ofertas encarte"))+'">Pesquisar ofertas</a>'
 ];
 host.innerHTML='<section class="garimpo-market-details"><h4>'+esc(m.name)+'</h4>'+
  '<p>'+esc(m.address||m.city||"Endereço não informado")+' · '+m.distanceKm.toFixed(1)+' km do GPS</p>'+
  '<p>Contato: '+esc(phone||"não cadastrado no mapa")+'. '+(official?'Rede identificada: '+esc(official.name)+'.':'Dados provenientes do mapa; conferir o estabelecimento.')+'</p>'+
  '<div class="actions">'+buttons.filter(Boolean).join("")+'</div>'+
  '<div id="garimpoMarketProducts"><p>Pesquisando preços cadastrados e referências online disponíveis...</p></div></section>';
 const products=offers().filter(o=>norm(o.market)===norm(m.name));
 const target=$("garimpoMarketProducts");
 if(target)target.innerHTML='<h4>Portfólio e preços conhecidos</h4>'+
  (products.length?products.map(o=>'<div class="garimpo-online-row"><span><strong>'+esc(o.itemName)+' · '+esc(o.brand||"")+
   '</strong><small>'+esc(status(o))+' · validade '+esc(dateBR(o.validUntil))+'</small></span><span class="garimpo-online-price">'+money(o.price)+'</span></div>').join(""):
   '<p>Nenhum preço confirmado desta loja foi cadastrado.</p>')+
  (official?.name==="Giassi Supermercados"?'<p>Preços de e-commerce podem ser diferentes dos da loja física. Veja as referências online abaixo.</p>'+
   '<div id="garimpoSelectedOnline"></div>':'<p>Para conferir preços deste estabelecimento, consulte o encarte ou site oficial. Os resultados não são simulados.</p>');
 if(official?.name==="Giassi Supermercados")void loadPublicPrices(true);
 host.scrollIntoView?.({behavior:"smooth",block:"start"});
 return true;
}
function normTokens(v){return norm(v).split(/[^a-z0-9]+/).filter(x=>x.length>2&&!["com","sem","para","de","tipo","produto","fatiado","cozido","em","pacote"].includes(x));}
function onlineMatches(item){
 if(!onlineCatalog?.products?.length||!item)return [];
 const terms=normTokens(item.name),brand=norm(item.brand);
 return onlineCatalog.products.filter(p=>{
  if(brand&&!norm(p.brand).includes(brand))return false;
  const hay=norm(p.name);
  let hits=terms.filter(t=>hay.includes(t)).length;
  if(!hits||hits<Math.max(1,Math.ceil(terms.length*0.6)))return false;
  if(item.kind==="beverage"&&item.size){
   const amount=/(\d+(?:[.,]\d+)?)\s*(ml|l)\b/i.exec(item.size);
   if(amount&&!hay.includes(norm(amount[1]+amount[2]))&&!new RegExp("\\b"+amount[1]+"\\s*"+amount[2]+"\\b","i").test(hay))return false;
  }
  return p.price>0&&(!p.validUntil||p.validUntil>=today());
 }).sort((a,b)=>a.price-b.price).slice(0,35);
}
function onlineRows(item){
 const rows=onlineMatches(item),t=onlineCatalog?.collectedAt||"",hostName=item?.name||"";
 return rows.length?'<p class="garimpo-offsite-warning">Giassi ONLINE • consultado '+esc(t.slice(0,16).replace("T"," "))+
  ' UTC. Para preço local, entre no site, faça login e escolha a loja. A consulta automática não confirma estoque ou preço na loja física.</p>'+
  rows.slice(0,20).map(p=>'<div class="garimpo-online-row"><div><strong>'+esc(p.name)+'</strong><small>'+
   esc(p.brand||"Sem marca")+' · preço online, não da loja física'+
   (p.validUntil?' · referência técnica até '+esc(dateBR(p.validUntil)):"")+'</small>'+
   '<a target="_blank" rel="noopener noreferrer" href="'+esc(p.url)+'">Ver preço no Giassi</a></div>'+
   '<span class="garimpo-online-price">'+money(p.price)+'</span></div>').join(""):
  '<p class="muted">Nenhum preço online compatível com '+esc(hostName)+' disponível no catálogo capturado. Confira a busca oficial.</p>'+
  '<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc("https://www.giassi.com.br/"+encodeURIComponent(hostName)+"?map=ft")+'">Pesquisar no Giassi</a>';
}
async function loadPublicPrices(silent=false){
 const info=$("garimpoOnlineStatus");
 if(info&&!silent)info.textContent="Consultando catálogo público...";
 try{
  const res=await fetch("./garimpo_catalog.json?v="+encodeURIComponent(today()),{cache:"no-store"});
  if(!res.ok)throw Error("catálogo ainda não disponível");
  const json=await res.json();
  const ts=Date.parse(json.collectedAt||"");
  const ageH=(Date.now()-ts)/3600000;
  if(json.source!=="giassi.com.br"||!Array.isArray(json.products)||!(ageH>=0&&ageH<=24)){
   throw Error("catálogo ausente ou com mais de 24 horas");
  }
  onlineCatalog=json;onlineInfo=json.products.length+" preços online identificados e datados (sem confirmação na loja física).";
 }catch(e){onlineCatalog=null;onlineInfo="Sem preços online recentes: "+(e.message||"indisponível");}
 if(info)info.textContent=onlineInfo;
 const item=stocks().find(x=>x.id===($("garimpoOnlineItem")?.value||$("garimpoItem")?.value))||stocks()[0];
 const online=$("garimpoOnlineResults");if(online)online.innerHTML=onlineRows(item);
 const selected=$("garimpoSelectedOnline");if(selected)selected.innerHTML=onlineRows(item);
 return !!onlineCatalog?.products?.length;
}
function selectOnlineItem(){const item=stocks().find(x=>x.id===$("garimpoOnlineItem")?.value);const online=$("garimpoOnlineResults");
 if(online)online.innerHTML=onlineRows(item);
}

function showMarkets(){
 const host=$("garimpoMarkets");if(!host)return;
 const all=markets();
 host.innerHTML=all.length?all.map((m,i)=>'<div class="garimpo-market"><button type="button" class="garimpo-market-click" onclick="POTE_GARIMPO.marketDetails('+i+')"><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.city||"SC")+' · '+m.distanceKm.toFixed(1)+' km · '+esc(m.address||"")+'</small></span><span class="garimpo-chevron">›</span></button></div>').join(""):
 '<p class="muted">Nenhum estabelecimento com coordenadas confirmado até 30 km. Ative o GPS e faça uma busca.</p>';
 const sel=$("garimpoMarketList");if(sel)sel.innerHTML=all.map(m=>'<option value="'+esc(m.name)+'">'+esc(m.name)+'</option>').join("");
}
function showComparison(){
 const host=$("garimpoComparison");if(!host)return;
 const items=stocks(),all=markets();
 host.innerHTML='<div class="garimpo-scroll"><table><thead><tr><th>Item cadastrado</th><th>Menor preço válido</th><th>Mercado</th><th>Demais fontes</th></tr></thead><tbody>'+
 items.map(item=>{const b=best(item),u=b&&unitPrice(b),others=validOffers(item).length;
  const searches=all.slice(0,6).map(m=>'<a href="'+esc(searchUrl(item,m))+'" rel="noopener noreferrer" target="_blank">'+esc(m.name)+'</a>').join(" · ");
  return '<tr><td><strong>'+esc(item.name)+'</strong><small>'+esc(item.size||item.brand||item.unit)+'</small></td>'+
   '<td>'+(b?money(u.price)+'/'+esc(u.unit):'<span class="garimpo-pending">Sem oferta válida confirmada</span>')+'</td>'+
   '<td>'+esc(b?.market||"—")+'</td><td>'+(others?others+' oferta(s)':'')+
   '<small>'+ (searches||'Localize mercados com GPS para pesquisar')+'</small></td></tr>';
 }).join("")+'</tbody></table></div>';
 const data=recent(),history=$("garimpoHistory");if(history)history.innerHTML=data.length?
 '<div class="garimpo-scroll"><table><thead><tr><th>Mercado / item</th><th>Preço</th><th>Unidade</th><th>Validade</th><th>Classificação</th><th>Fonte</th></tr></thead><tbody>'+
 data.map(o=>{const v=unitPrice(o),st=status(o);
 return '<tr><td>'+esc(o.market)+'<small>'+esc(o.itemName)+' · '+esc(o.brand)+'</small></td>'+
 '<td>'+money(o.price)+'</td><td>'+esc(v?money(v.price)+'/'+v.unit:'Inválida')+'</td><td>'+esc(dateBR(o.validUntil))+'</td>'+
 '<td class="garimpo-status">'+esc(st)+(o.regionVerified?' · até 30 km':' · local não confirmado')+'</td>'+
 '<td>'+(o.sourceUrl?'<a target="_blank" rel="noopener noreferrer" href="'+esc(o.sourceUrl)+'">Conferir</a>':'—')+
 ' <button type="button" data-id="'+esc(o.id)+'" onclick="POTE_GARIMPO.removeOffer(this.dataset.id)">Excluir</button></td></tr>'}).join("")+'</tbody></table></div>':
 '<p class="muted">Nenhum preço registrado. O Garimpo não cria preços fictícios.</p>';
}
async function discover(){
 if(busy)return;busy=true;
 const note=$("garimpoSearchStatus");const progress=s=>{searchMessage=s;if(note)note.textContent=s};
 let coords=center;
 try{
  if(!coords){
   if(!navigator.geolocation)throw Error("GPS indisponível neste navegador.");
   progress("Solicitando acesso ao GPS...");
   const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:13000,maximumAge:120000}));
   coords={lat:p.coords.latitude,lon:p.coords.longitude};center=coords;
  }
  const terms=["supermercado","atacado","Giassi","Combo","Líder","Forte","Salvetti"];
  const found=new Map();
  for(const term of terms){
   progress("Pesquisando "+term+" no raio de 30 km...");
   const url=new URL("https://photon.komoot.io/api/");
   url.searchParams.set("q",term);url.searchParams.set("lat",coords.lat);url.searchParams.set("lon",coords.lon);url.searchParams.set("limit","40");
   let response;
   try{response=await fetch(url.href,{mode:"cors"});if(!response.ok)continue;}catch(e){continue}
   const json=await response.json();
   for(const f of json.features||[]){
    const p=f.properties||{},c=f.geometry?.coordinates;
    if(!p.name||!Array.isArray(c)||dist(coords.lat,coords.lon,c[1],c[0])>30)continue;
    const isStore=/^(supermarket|wholesale|convenience|grocery|greengrocer|beverages|department_store)$/i.test(p.osm_value||"")||
     /supermercado|mercado|atacado|giassi|combo|líder|lider|forte|salvetti/i.test(p.name);
    if(!isStore)continue;
    const m={id:"osm:"+p.osm_type+":"+p.osm_id,name:p.name,city:p.city||p.district||"",
     phone:String(p.extra?.phone||p.extra?.['contact:phone']||p.phone||""),website:String(p.extra?.website||p.extra?.['contact:website']||""),
     address:[p.street,p.housenumber,p.city,p.state].filter(Boolean).join(", "),lat:c[1],lon:c[0],
     osmId:String(p.osm_type)+":"+String(p.osm_id),supplierType:"regional"};
    found.set(m.osmId,m);
   }
  }
  marketSearch=[...found.values()];progress(marketSearch.length+" mercados encontrados no raio de 30 km. Preços dependem de fontes verificáveis.");
  showMarkets();showComparison();
 }catch(e){progress("Não foi possível pesquisar: "+(e.message||"permita o GPS e tente novamente"))}finally{busy=false}
}
let mphRows=[];
async function lookupMPH(){
 // MPH tem dados declarados para Lages: não usar as ofertas em outras regiões.
 const host=$("garimpoMPHResults");
 // Consulta de Lages é independente do GPS e nunca entra no ranking dos mercados próximos.
 const item=stocks().find(x=>x.id===$("garimpoItem")?.value);
 if(!item){alert("Escolha um produto para consultar.");return false;}
 const url="https://www.menorprecohoje.com.br/agent/v1/search?product="+encodeURIComponent(item.name);
 if(host)host.textContent="Consultando API oficial MPH para "+item.name+"...";
 try{
  const response=await fetch(url,{mode:"cors"});
  const payload=await response.json();
  const fresh=response.ok&&payload?.ok===true&&norm(payload?.meta?.city)==="lages"&&
   payload.meta?.snapshot_current===true&&payload.edge?.freshness==="CURRENT"&&
   payload.temporal_scope==="PRESENTE";
  if(!response.ok||payload?.ok!==true||norm(payload?.meta?.city)!=="lages"){
   if(host)host.textContent=payload?.error==="STALE_SNAPSHOT"?
    "AVISO — A API MPH informou que a edição "+dateBR(payload.snapshot_reference_date)+" está desatualizada para a data atual. A fonte bloqueou preços vigentes; não exibimos valores antigos como se fossem ofertas de hoje.":
    "AVISO — API MPH indisponível para consulta de Lages. "+String(payload?.message||"Nenhum preço atualizado retornado.").slice(0,190);
   return false;
  }
  const updated=String(payload.meta?.reference_date||payload?.snapshot_reference_date||"").slice(0,10);
  const baseFresh=fresh&&updated===today();
  mphRows=(Array.isArray(payload.offers)?payload.offers:[]).filter(o=>
   o.temporal_status==="VIGENTE"&&o.data_fim>=today()&&o.data_inicio<=today()&&
   Number.isFinite(Number(o.preco_final))&&Number(o.preco_final)>0).map(o=>({...o,itemId:item.id,sourceUrl:url}));
  if(host)host.innerHTML=mphRows.length?'<p class="garimpo-offsite-warning"><strong>'+mphRows.length+' preço(s) de Lages/SC obtidos na API MPH.</strong> Base de '+esc(dateBR(updated))+'. '+(baseFresh?'Atualizada hoje.':'Não atualizada hoje: conferir validade antes de comprar.')+' Estes preços NÃO pertencem aos mercados no raio de 30 km do seu GPS.</p>'+
   mphRows.slice(0,30).map((o,index)=>{
    const normPrice=o.comparacao?.preco_normalizado,baseUnit=o.comparacao?.base,normalized=Number(normPrice)>0?money(normPrice)+"/"+esc(baseUnit||"un"):"";
    return '<div class="garimpo-market"><strong>'+esc(o.descricao)+'</strong><small>'+esc(o.mercado)+' · '+money(o.preco_final)+
     ' · '+esc(o.marca||"Marca não indicada")+' · '+esc(o.unidade||"")+
     ' · válido até '+esc(dateBR(o.data_fim))+
     ' · Lages/SC (fora da pesquisa local) '+(normalized?' · '+normalized:'')+
     '</small><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Ver resposta MPH</a> '+
     '<button class="btn mini line" onclick="POTE_GARIMPO.fillFromMPH('+index+')">Conferir e registrar referência de Lages</button></div>';
   }).join(""):'<p class="muted">Nenhuma oferta vigente encontrada no MPH para este item.</p>';
  return true;
 }catch(err){
  if(host)host.textContent="Não foi possível consultar a API MPH neste dispositivo: "+(err?.message||"erro de rede");
  return false;
 }
}
function fillFromMPH(index){
 const o=mphRows[index];if(!o)return false;
 // Lages: preço registrado separadamente, sem autenticar como preço de loja local.
 const current=stocks().find(i=>i.id===o.itemId);
 if(!current){alert("Produto do estoque não encontrado.");return false;}
 if($("garimpoItem"))$("garimpoItem").value=current.id;
 if($("garimpoMarket"))$("garimpoMarket").value=o.mercado+" — Lages/SC";
 if($("garimpoBrand"))$("garimpoBrand").value=o.marca||"";
 if($("garimpoSize"))$("garimpoSize").value=o.unidade||"";
 if($("garimpoPrice"))$("garimpoPrice").value=String(o.preco_final);
 if($("garimpoUnit"))$("garimpoUnit").value=current.unit;
 if($("garimpoCondition"))$("garimpoCondition").value=o.tipo_preco==="CLUBE"?"clube":o.tipo_preco==="PROMOCIONAL"?"promocional":"normal";
 if($("garimpoFrom"))$("garimpoFrom").value=o.data_inicio||today();
 if($("garimpoUntil"))$("garimpoUntil").value=o.data_fim||"";
 if($("garimpoSource"))$("garimpoSource").value=o.sourceUrl;
 // A apresentação da embalagem varia na API; usuário confirma quantidade e unidade.
 if($("garimpoQty"))$("garimpoQty").value="";
 if($("garimpoReceipt"))$("garimpoReceipt").checked=false;
 window.POTE_NOTICE?.show?.("Preço de Lages preenchido. Verifique produto, marca, embalagem e quantidade. Esta referência não será classificada como oferta local.");
 $("garimpoQty")?.focus?.();
 return true;
}
function selectItem(){const item=stocks().find(i=>i.id===$("garimpoItem")?.value);if(item&&$("garimpoUnit"))$("garimpoUnit").value=item.unit;}
function render(){
 const items=stocks(),known=markets();
 return '<section class="box garimpo" id="poteGarimpoPanel"><small>INTELIGÊNCIA DE COMPRAS</small><h2>Garimpo · preços e validade</h2>'+
 '<p>Pesquisa de estabelecimentos até <strong>30 km</strong> do GPS. Cruza seus insumos e bebidas com preços comprovados; não inventa promoções nem mistura peso, embalagem ou marca.</p>'+
 '<div class="actions"><button class="btn" onclick="POTE_GARIMPO.discover()">Garimpar mercados em 30 km</button>'+
 '<button class="btn line" onclick="POTE_GARIMPO.exportCSV()">Exportar planilha CSV</button>'+
 '<button class="btn line" onclick="POTE_GARIMPO.lookupMPH()">Consultar API MPH (Lages)</button></div><div id="garimpoMPHResults" aria-live="polite"></div>'+
 '<div role="status" id="garimpoSearchStatus">'+esc(searchMessage||"Autorize o GPS para conferir a distância real. A busca não garante que cada loja publique seus preços.")+'</div>'+
 '<h3>Mercados próximos</h3><p class="muted">Toque em qualquer mercado para ver ficha, rota, telefone, site e referências de preços.</p><div id="garimpoMarkets">'+(known.length?known.map(m=>'<div class="garimpo-market">'+esc(m.name)+'</div>').join(""):'Ative a pesquisa para ver mercados.')+'</div><div id="garimpoMarketDetails"></div>'+
 '<h3>Planilha comparativa por insumo</h3><div id="garimpoComparison"></div>'+
 '<h3>Preços online disponíveis — Giassi</h3><p class="muted">Referências verificáveis de e-commerce. Os valores não são declarados como preços das lojas físicas.</p><div class="garimpo-form"><label>Item para consultar<select id="garimpoOnlineItem" onchange="POTE_GARIMPO.selectOnlineItem()">'+items.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+'</option>').join("")+'</select></label><button type="button" class="btn line" onclick="POTE_GARIMPO.loadPublicPrices()">Carregar preços online</button></div><div role="status" id="garimpoOnlineStatus">'+esc(onlineInfo)+'</div><div id="garimpoOnlineResults"></div>'+
 '<h3>Registrar oferta ou preço de nota fiscal</h3><p class="muted">Para considerar uma oferta válida, registre fonte HTTPS e data final do encarte. Nota fiscal representa somente preço histórico, nunca promoção atual.</p>'+
 '<div class="garimpo-form"><label>Item do seu estoque<select id="garimpoItem" onchange="POTE_GARIMPO.selectItem()">'+items.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name+(i.size?' · '+i.size:''))+'</option>').join("")+'</select></label>'+
 '<label>Mercado com GPS confirmado<input id="garimpoMarket" list="garimpoMarketList" placeholder="Giassi, Combo, Líder..."><datalist id="garimpoMarketList"></datalist></label>'+
 '<label>Marca<input id="garimpoBrand" placeholder="Marca da embalagem"></label><label>Volume / peso descritivo<input id="garimpoSize" placeholder="Ex.: lata 350 ml"></label>'+
 '<label>Quantidade na embalagem<input id="garimpoQty" inputmode="decimal" value="1"></label>'+
 '<label>Unidade<select id="garimpoUnit">'+Object.keys(units).map(x=>'<option>'+x+'</option>').join("")+'</select></label>'+
 '<label>Preço do pacote R$<input id="garimpoPrice" inputmode="decimal" placeholder="0,00"></label>'+
 '<label>Tipo de preço<select id="garimpoCondition"><option value="normal">Normal</option><option value="promocional">Promocional</option><option value="clube">Clube / fidelidade</option></select></label>'+
 '<label>Início da oferta<input id="garimpoFrom" type="date" value="'+today()+'"></label>'+
 '<label>Último dia válido<input id="garimpoUntil" type="date"></label>'+
 '<label>Link do encarte / fonte HTTPS<input id="garimpoSource" type="url" placeholder="https://..."></label>'+
 '<label class="garimpo-checkbox"><input id="garimpoReceipt" type="checkbox"> Preço histórico de NFC-e (não é oferta atual)</label>'+
 '<button class="btn" onclick="POTE_GARIMPO.addOffer()">Registrar com data e fonte</button></div>'+
 '<h3>Histórico de preços e validade</h3><div id="garimpoHistory"></div>'+
 '<p class="muted">Oferta conferida manualmente não é verificação automática do site; consulte sempre a fonte antes de sair para comprar. Valores de clube dependem de adesão e não são comparáveis a preço aberto sem ressalva.</p></section>';
}
function mount(){selectItem();showMarkets();showComparison();void loadPublicPrices(true)}
window.POTE_GARIMPO={render,mount,discover,addOffer,removeOffer,exportCSV,lookupMPH,fillFromMPH,selectItem,stocks,offers,markets,marketDetails,loadPublicPrices,selectOnlineItem,onlineMatches,status,active,unitPrice,matcher,best,dist,searchUrl,setCenter:c=>{center=c},setMarketSearch:v=>{marketSearch=v}};
})();