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
const today=()=>{
 const zone=state?.data?.settings?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||"America/Sao_Paulo";
 try{
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
 }catch(e){return new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})}
};
const stocks=()=>[...(state.data.ingredients||[]).map(i=>({id:"ing:"+i.id,name:i.name,brand:i.brand||"",kind:"ingredient",unit:i.measureUnit==="ml"?"L":i.measureUnit==="un"?"un":"kg"})),
 ...(state.data.beverages||[]).map(b=>({id:"bev:"+b.id,name:b.name,brand:b.brand||"",kind:"beverage",unit:"un",size:b.size||""}))];
const offers=()=>{state.data.garimpoOffers??=[];return state.data.garimpoOffers};
const recent=()=>offers().slice().sort((a,b)=>String(b.checkedAt).localeCompare(String(a.checkedAt)));
const dist=(a,b,c,d)=>{let rad=Math.PI/180,dl=(c-a)*rad,dn=(d-b)*rad;
 let h=Math.sin(dl/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dn/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))};
const REGIONAL=()=> (state.data.suppliers||[]).filter(s=>s.osmId||s.externalId||s.supplierType==="regional"||s.type==="Local");
let center=null,marketSearch=[],searchMessage="",busy=false,searchRegion="gps",regionInfo=null;
const geoDist=(a,b)=>center?dist(center.lat,center.lon,a,b):Infinity;
const geoNearby=(lat,lon,km)=>geoDist(lat,lon)<=km;
function regionalLinks(){
 const state=regionInfo?.state||"";
 const links=[];
 if(state==="SC")links.push({url:"https://www.sef.sc.gov.br/servicos/instalar-o-aplicativo-menor-preco-brasil",label:"Menor Preço Brasil · Santa Catarina",desc:"Consultar preços de notas fiscais da sua região no serviço oficial; exige acesso Gov.br"});
 if(state==="RS")links.push({url:"https://nfg.sefaz.rs.gov.br/site/MenorPreco.aspx",label:"Menor Preço Nota Gaúcha · Rio Grande do Sul",desc:"Preços praticados por estabelecimentos gaúchos; escolha sua localização no aplicativo oficial"});
 if(geoNearby(-29.3389427,-49.7271564,70)){
  links.push({url:"https://stokonline.com.br/",label:"Stok Center / Stok Online",desc:"Referência regional; lojas físicas e online podem praticar preços diferentes. Confira a unidade"});
  links.push({url:"https://portal.qrofertas.com/torres-rs",label:"Encartes de mercados próximos",desc:"Consultar encartes, validade e condições de clube ou CNPJ"});
  links.push({url:"https://www.precomelhor.com.br/s/11159-asun-supermercados-torres",label:"Preços publicados por mercado",desc:"Conferir preço, data e disponibilidade antes de comprar"});
 }
 return links;
}
function regionFromAddress(address){
 const code=String(address?.state_code||address?.["ISO3166-2-lvl4"]||"").toUpperCase();
 if(code.endsWith("-SC")||code==="SC")return "SC";
 if(code.endsWith("-RS")||code==="RS")return "RS";
 const name=norm(address?.state||"");
 if(name==="santa catarina")return "SC";
 if(name==="rio grande do sul")return "RS";
 return code.match(/-([A-Z]{2})$/)?.[1]||"";
}
function renderRegional(){
 const links=regionalLinks();
 const action=$("garimpoRegionalActions");
 if(action)action.innerHTML=geoNearby(-29.3389427,-49.7271564,70)?
  '<button type="button" class="btn line" onclick="POTE_GARIMPO.discover(\'torres\')">Pesquisar mercados da região vizinha</button>':"";
 const source=$("garimpoRegionalSources");
 if(source)source.innerHTML=links.length?
  '<section class="garimpo-sources"><h3>Fontes e encartes disponíveis na região</h3><p class="muted">Acesso externo aos serviços. Estes links não confirmam automaticamente preços da loja física.</p><div class="garimpo-source-grid">'+
  links.map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer"><strong>'+esc(x.label)+'</strong><small>'+esc(x.desc)+'</small></a>').join("")+'</div></section>':
  '<p class="muted">Ative a pesquisa por localização para identificar fontes disponíveis na sua região. Os resultados nunca serão preenchidos com preços de outra cidade.</p>';
 const mph=$("garimpoMPHAction");
 if(mph)mph.innerHTML=geoNearby(-27.816,-50.327,40)?
  '<button class="btn line" onclick="POTE_GARIMPO.lookupMPH()">Consultar preços MPH desta região</button>':"";
 const giassi=$("garimpoGiassiOnline");
 if(giassi)giassi.hidden=!["SC","RS"].includes(regionInfo?.state||"");
}
async function identifyRegion(coords){
 // A localização e o estado não ficam salvos no servidor. Falha de geocodificação não atribui SC ou RS por suposição.
 try{
  const u="https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=8&addressdetails=1&lat="+encodeURIComponent(coords.lat)+"&lon="+encodeURIComponent(coords.lon);
  const response=await fetch(u,{mode:"cors"});
  if(!response.ok)throw Error("Estado indisponível");
  const payload=await response.json();
  regionInfo={state:regionFromAddress(payload.address),city:String(payload.address?.city||payload.address?.town||payload.address?.municipality||"")};
 }catch(e){regionInfo={state:"",city:""};}
 renderRegional();
 return regionInfo;
}
const TORRES_CENTER={lat:-29.3389427,lon:-49.7271564}; // Centro urbano de Torres/RS (Praca Quinze de Novembro)
function markets(){const map=new Map();for(const s of [...REGIONAL(),...marketSearch]){
 const key=norm(s.name)+"|"+norm(s.city||"");if(!map.has(key))map.set(key,s);
 }return [...map.values()].filter(s=>{
 if(!center||!Number.isFinite(Number(s.lat))||!Number.isFinite(Number(s.lon)))return false;
 return dist(center.lat,center.lon,Number(s.lat),Number(s.lon))<=30;
 }).map(s=>({...s,distanceKm:dist(center.lat,center.lon,Number(s.lat),Number(s.lon))})).sort((a,b)=>a.distanceKm-b.distanceKm);
}
function status(o,at=today()){
 if(o.recordType==="receipt")return "histórico NFC-e (não é oferta atual)";
 if(o.validUntil&&o.validUntil<at)return "vencida";
 if(o.validFrom&&o.validFrom>at)return "futura";
 if(!o.validUntil||!o.sourceUrl||!/^https?:\/\//i.test(o.sourceUrl))return "sem validade/fonte";
 if(o.recordType!=="official"&&o.recordType!=="manual")return "sem confirmação";
 // Condição comercial é independente da validade e da verificação da fonte.
 if(o.recordType==="official"&&(!o.snapshotCurrent||o.freshness!=="CURRENT"))return "fonte desatualizada";
 if(o.priceCondition==="clube")return o.recordType==="manual"?
  "clube vigente — conferida manualmente; exige adesão":"clube vigente na fonte — exige adesão";
 return o.recordType==="manual"?"conferida manualmente":"vigente na fonte";
}
const active=(o,at=today())=>[
 "conferida manualmente","vigente na fonte",
 "clube vigente — conferida manualmente; exige adesão",
 "clube vigente na fonte — exige adesão"
].includes(status(o,at));
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
function validOffers(item){return recent().filter(o=>active(o)&&matcher(o,item)&&o.regionVerified===true&&center&&Number.isFinite(Number(o.marketLat))&&Number.isFinite(Number(o.marketLon))&&dist(center.lat,center.lon,Number(o.marketLat),Number(o.marketLon))<=30);}
function best(item){return validOffers(item).filter(o=>o.priceCondition!=="clube").sort((a,b)=>unitPrice(a).price-unitPrice(b).price)[0]||null;}
function bestClub(item){return validOffers(item).filter(o=>o.priceCondition==="clube").sort((a,b)=>unitPrice(a).price-unitPrice(b).price)[0]||null;}
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
 const a=document.createElement("a");a.href=url;a.download="radar_de_preco_historico.csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function searchUrl(item,market){
 const query=[item.name,item.size,item.brand,market.name,market.city||"Brasil","preço encarte"].filter(Boolean).join(" ");
 return "https://www.google.com/search?q="+encodeURIComponent(query);
}
let onlineCatalog=null,onlineInfo="Catálogo online ainda não consultado.";
const officialCatalogs=[
 {test:/stok\s*(?:center|atacadista)/i,name:"Stok Center",url:"https://stokonline.com.br/"},
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
 const products=offers().filter(o=>norm(o.market)===norm(m.name)&&o.marketLat!=null&&o.marketLon!=null&&
  dist(Number(o.marketLat),Number(o.marketLon),Number(m.lat),Number(m.lon))<1);
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
 host.innerHTML=all.length?all.map((m,i)=>'<div class="garimpo-market"><button type="button" class="garimpo-market-click" onclick="POTE_GARIMPO.marketDetails('+i+')"><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.city||"Brasil")+' · '+m.distanceKm.toFixed(1)+' km · '+esc(m.address||"")+'</small></span><span class="garimpo-chevron">›</span></button></div>').join(""):
 '<p class="muted">Nenhum estabelecimento com coordenadas confirmado até 30 km. Ative o GPS e faça uma busca.</p>';
 const sel=$("garimpoMarketList");if(sel)sel.innerHTML=all.map(m=>'<option value="'+esc(m.name)+'">'+esc(m.name)+'</option>').join("");
}
function showComparison(){
 const host=$("garimpoComparison");if(!host)return;
 const items=stocks(),all=markets();
 host.innerHTML='<div class="garimpo-scroll"><table><thead><tr><th>Item cadastrado</th><th>Menor preço aberto</th><th>Preço de clube</th><th>Mercado</th><th>Demais fontes</th></tr></thead><tbody>'+
 items.map(item=>{const b=best(item),u=b&&unitPrice(b),club=bestClub(item),clubUnit=club&&unitPrice(club),others=validOffers(item).length;
  const searches=all.slice(0,6).map(m=>'<a href="'+esc(searchUrl(item,m))+'" rel="noopener noreferrer" target="_blank">'+esc(m.name)+'</a>').join(" · ");
  return '<tr><td><strong>'+esc(item.name)+'</strong><small>'+esc(item.size||item.brand||item.unit)+'</small></td>'+
   '<td>'+(b?money(u.price)+'/'+esc(u.unit):'<span class="garimpo-pending">Sem oferta aberta confirmada</span>')+'</td>'+
   '<td>'+(club?money(clubUnit.price)+'/'+esc(clubUnit.unit)+'<small>Exige clube/fidelidade · '+esc(club.market)+'</small>':'—')+'</td>'+
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
 '<p class="muted">Nenhum preço registrado. O Radar de Preço não cria preços fictícios.</p>';
}
async function discover(region="gps"){
 if(busy)return;busy=true;
 searchRegion=region==="torres"?"torres":"gps";
 if(searchRegion==="torres"&&!geoNearby(TORRES_CENTER.lat,TORRES_CENTER.lon,70)){busy=false;return false;}
 if(searchRegion==="torres")center={...TORRES_CENTER};
 else center=null;
 regionInfo=null;
 const note=$("garimpoSearchStatus");const progress=s=>{searchMessage=s;if(note)note.textContent=s};
 let coords=center;
 try{
  if(!coords){
   if(!navigator.geolocation)throw Error("GPS indisponível neste navegador.");
   progress("Solicitando acesso ao GPS...");
   const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:13000,maximumAge:120000}));
   coords={lat:p.coords.latitude,lon:p.coords.longitude};center=coords;
  }
  await identifyRegion(coords);
  const terms=["supermercado","atacado","mercado","atacadista","hipermercado",...(["SC","RS"].includes(regionInfo?.state||"")?["Stok Center","Giassi","Combo","Bistek","Asun"]:[])];
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
     /supermercado|mercado|atacado|atacadista|hipermercado|stok center|giassi|combo|lider|bistek|asun/i.test(p.name);
    if(!isStore)continue;
    const m={id:"osm:"+p.osm_type+":"+p.osm_id,name:p.name,city:p.city||p.district||"",
     phone:String(p.extra?.phone||p.extra?.['contact:phone']||p.phone||""),website:String(p.extra?.website||p.extra?.['contact:website']||""),
     address:[p.street,p.housenumber,p.city,p.state].filter(Boolean).join(", "),lat:c[1],lon:c[0],
     osmId:String(p.osm_type)+":"+String(p.osm_id),supplierType:"regional"};
    found.set(m.osmId,m);
   }
  }
  marketSearch=[...found.values()];progress(marketSearch.length+" mercados encontrados dentro de 30 km da localização selecionada. Preços dependem de fontes verificáveis.");
  showMarkets();showComparison();renderRegional();
 }catch(e){progress("Não foi possível pesquisar: "+(e.message||"permita o GPS e tente novamente"))}finally{busy=false}
}
let mphRows=[];
let mphHistoryContext=null;
const mphHistoryUrl=item=>"https://www.menorprecohoje.com.br/agent/v1/history?product="+encodeURIComponent(item.name);
function mphHistoryList(payload){
 // A rota historica nao publica um esquema de itens no OpenAPI: aceitar somente entradas reais com descricao e preco.
 const roots=[
  payload?.offers,payload?.history,payload?.historico,payload?.items,payload?.results,payload?.records,
  payload?.data?.offers,payload?.data?.history,payload?.data?.items,payload?.data?.results,
  payload?.data?.records,payload?.data,
  payload?.snapshot?.offers,payload?.snapshot?.items,payload?.snapshot?.records,
  payload?.editions,payload?.snapshots,payload?.data?.editions,payload?.data?.snapshots
 ];
 const rows=[];
 for(const list of roots){
  if(!Array.isArray(list))continue;
  for(const record of list){
   if(!record||typeof record!=="object")continue;
   const nested=[record.offers,record.items,record.records,record.products].find(Array.isArray);
   const subrows=nested||[record];
   for(const row of subrows){
   if(!row||typeof row!=="object")continue;
   const o=row.offer&&typeof row.offer==="object"?row.offer:row;
   const name=String(o.descricao||o.produto||o.product_name||o.nome||o.name||"").trim();
   const seller=String(o.mercado||o.estabelecimento||o.store||o.market||"").trim();
   const raw=o.preco_final??o.preco_promocional??o.preco_normal??o.preco??o.price;
   const price=typeof raw==="number"?raw:number(raw);
   if(!name||!seller||!Number.isFinite(price)||price<=0)continue;
   rows.push({
    descricao:name,mercado:seller,preco_final:price,marca:String(o.marca||o.brand||""),
    unidade:String(o.unidade||o.measure||""),data_inicio:String(o.data_inicio||o.validFrom||""),
    data_fim:String(o.data_fim||o.validUntil||""),
    tipo_preco:String(o.tipo_preco||o.price_type||"").toUpperCase(),
    reference_date:String(o.reference_date||o.data_referencia||o.date||record.reference_date||record.data_referencia||""),
    fonte:String(o.fonte||o.source||"")
   });
   }
  }
 }
 const unique=new Map();
 for(const o of rows){
  const id=[o.descricao,o.mercado,o.preco_final,o.data_fim].join("|");
  if(!unique.has(id))unique.set(id,o);
 }
 return [...unique.values()];
}
function mphHistoryMatches(item,rows){
 const words=normTokens(item.name);
 return rows.filter(row=>{
  const title=norm(row.descricao);
  return words.length?words.some(w=>title.includes(w)):true;
 });
}
async function showMPHHistory(){
 const context=mphHistoryContext,host=$("garimpoMPHResults");
 if(!context||!host)return false;
 const {item,referenceDate}=context;
 host.innerHTML='<p class="garimpo-offsite-warning">Consultando histórico do MPH para '+esc(item.name)+' (edição '+esc(dateBR(referenceDate))+')...</p>';
 const url=mphHistoryUrl(item);
 try{
  const response=await fetch(url,{mode:"cors",cache:"no-store"});
  const payload=await response.json();
  if(!response.ok||payload?.ok===false){
   host.innerHTML='<p class="garimpo-offsite-warning">A consulta histórica do MPH não retornou dados acessíveis agora ('+esc(payload?.message||payload?.error||String(response.status))+'). Não é possível exibir preços sem registros fornecidos pela fonte.</p>'+
    '<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Abrir histórico na fonte</a>';
   return false;
  }
  const rows=mphHistoryMatches(item,mphHistoryList(payload)).slice(0,60);
  if(!rows.length){
   host.innerHTML='<p class="garimpo-offsite-warning">A edição de '+esc(dateBR(referenceDate))+' está desatualizada. A rota histórica do MPH não devolveu ofertas com nome de produto, mercado e preço para '+esc(item.name)+'. Não serão exibidos valores presumidos.</p>'+
    '<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Consultar histórico na fonte</a>';
   return false;
  }
  // Não cadastrar estes valores como oferta vigente ou ranking local.
  host.innerHTML='<div class="garimpo-history-warning" role="status"><strong>HISTÓRICO • NÃO É PREÇO ATUAL</strong><span>Referência MPH: '+esc(dateBR(referenceDate))+'. Lages/SC, fora do raio de 30 km. Confirme preços e validade com o estabelecimento.</span></div>'+
   '<div class="garimpo-scroll"><table><thead><tr><th>Produto / marca</th><th>Mercado</th><th>Preço histórico</th><th>Última validade</th><th>Condição</th></tr></thead><tbody>'+
   rows.map(o=>'<tr><td><strong>'+esc(o.descricao)+'</strong><small>'+esc(o.marca||"Sem marca informada")+' · '+esc(o.unidade)+'</small></td>'+
   '<td>'+esc(o.mercado)+'</td><td><strong>'+money(o.preco_final)+'</strong></td>'+
   '<td>'+esc(dateBR(o.data_fim||referenceDate))+'</td>'+
   '<td>'+esc(o.tipo_preco||"Não informada")+'</td></tr>').join("")+'</tbody></table></div>'+
   '<p class="muted">Fonte: <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">MPH / histórico de Lages</a>. Histórico não incluído no cálculo do menor preço vigente.</p>';
  return true;
 }catch(error){
  host.innerHTML='<p class="garimpo-offsite-warning">Não foi possível recuperar o histórico do MPH: '+esc(error?.message||"erro de conexão")+'. Nenhum preço foi inventado.</p>'+
   '<a class="btn mini line" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Abrir histórico no MPH</a>';
  return false;
 }
}
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
  if(payload?.error==="STALE_SNAPSHOT"){
   const referenceDate=String(payload.snapshot_reference_date||payload.meta?.reference_date||"").slice(0,10);
   mphHistoryContext={item,referenceDate};
   if(host)host.innerHTML='<div class="garimpo-history-warning" role="status"><strong>AVISO — BASE DESATUALIZADA</strong><span>A edição MPH de '+esc(dateBR(referenceDate))+' não permite consultar ofertas vigentes. Você pode visualizar os registros históricos, sem considerá-los preços atuais.</span></div>'+
    '<button type="button" class="btn line garimpo-history-trigger" onclick="POTE_GARIMPO.showMPHHistory()">Conferir ofertas desatualizadas?</button>';
   return false;
  }
  mphHistoryContext=null;
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
 return '<section class="box garimpo" id="poteGarimpoPanel"><small>INTELIGÊNCIA DE COMPRAS</small><h2>Radar de Preço</h2>'+
 '<p>Busca mercados próximos à localização autorizada em todo o Brasil, num raio de <strong>30 km</strong>. Fontes e ofertas são selecionadas por região; preços históricos não são exibidos como vigentes.</p>'+
 '<div class="actions"><button class="btn" onclick="POTE_GARIMPO.discover()">Pesquisar preços em até 30 km</button>'+
 '<button class="btn line" onclick="POTE_GARIMPO.exportCSV()">Exportar planilha CSV</button>'+
 '</div><div id="garimpoRegionalActions" class="actions"></div><div id="garimpoMPHAction"></div><div id="garimpoMPHResults" aria-live="polite"></div>'+
 '<div id="garimpoRegionalSources"></div>'+
 '<div role="status" id="garimpoSearchStatus">'+esc(searchMessage||"Autorize o GPS para conferir a distância real. A busca não garante que cada loja publique seus preços.")+'</div>'+
 '<h3>Mercados próximos</h3><p class="muted">Toque em qualquer mercado para ver ficha, rota, telefone, site e referências de preços.</p><div id="garimpoMarkets">'+(known.length?known.map(m=>'<div class="garimpo-market">'+esc(m.name)+'</div>').join(""):'Ative a pesquisa para ver mercados.')+'</div><div id="garimpoMarketDetails"></div>'+
 '<h3>Planilha comparativa por insumo</h3><div id="garimpoComparison"></div>'+
 '<div id="garimpoGiassiOnline" hidden><h3>Preços online disponíveis — Giassi</h3><p class="muted">Referências verificáveis de e-commerce. Os valores não são declarados como preços das lojas físicas.</p><div class="garimpo-form"><label>Item para consultar<select id="garimpoOnlineItem" onchange="POTE_GARIMPO.selectOnlineItem()">'+items.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+'</option>').join("")+'</select></label><button type="button" class="btn line" onclick="POTE_GARIMPO.loadPublicPrices()">Carregar preços online</button></div><div role="status" id="garimpoOnlineStatus">'+esc(onlineInfo)+'</div><div id="garimpoOnlineResults"></div></div>'+
 '<h3>Registrar oferta ou preço de nota fiscal</h3><p class="muted">Para considerar uma oferta válida, registre fonte HTTPS e data final do encarte. Nota fiscal representa somente preço histórico, nunca promoção atual.</p>'+
 '<div class="garimpo-form"><label>Item do seu estoque<select id="garimpoItem" onchange="POTE_GARIMPO.selectItem()">'+items.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name+(i.size?' · '+i.size:''))+'</option>').join("")+'</select></label>'+
 '<label>Mercado com localização confirmada<input id="garimpoMarket" list="garimpoMarketList" placeholder="Nome do estabelecimento"><datalist id="garimpoMarketList"></datalist></label>'+
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
function mount(){
 selectItem();showMarkets();showComparison();renderRegional();
 // Nunca fazer consulta online regional automaticamente para uma região desconhecida.
 if(navigator.permissions?.query&&navigator.geolocation){
  navigator.permissions.query({name:"geolocation"}).then(p=>{
   if(p.state==="granted"&&navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
     center={lat:pos.coords.latitude,lon:pos.coords.longitude};
     identifyRegion(center).then(()=>{showMarkets();showComparison();});
    },()=>{}, {enableHighAccuracy:false,timeout:7000,maximumAge:120000});
   }
  }).catch(()=>{});
 }
}
window.POTE_GARIMPO={render,mount,discover,addOffer,removeOffer,exportCSV,lookupMPH,showMPHHistory,mphHistoryList,fillFromMPH,selectItem,stocks,offers,markets,marketDetails,loadPublicPrices,selectOnlineItem,onlineMatches,status,active,unitPrice,matcher,best,bestClub,dist,searchUrl,regionalLinks,regionFromAddress,renderRegional,identifyRegion,
 setCenter:c=>{center=c},setRegionInfo:v=>{regionInfo=v;renderRegional()},
 setMarketSearch:v=>{marketSearch=v}};
})();
