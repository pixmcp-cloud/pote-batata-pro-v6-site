/* Potê Batata Pro — busca piloto de fornecedores, sem chave/API paga.
 * Consulta deliberada pelo usuário aos dados públicos do OpenStreetMap via Photon.
 * O servidor público pode limitar chamadas e não garante cobertura/atualização.
 */
(function () {
  "use strict";
  if (typeof pageSuppliers !== "function" || typeof escapeHtml !== "function") return;
  const originalPage = pageSuppliers;
  const SEARCH_TERMS = ["supermercado", "atacado", "açougue", "hortifruti"];
  const CACHE_PREFIX = "pote-suppliers-photon-v1:";
  const CACHE_MS = 24 * 60 * 60 * 1000;
  let userCoords = null;
  let locationLabel = "";
  let resultItems = [];
  let currentStatus = "";
  let searching = false;
  const esc = value => escapeHtml(String(value ?? ""));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function status(text) {
    currentStatus = text;
    const el = document.getElementById("supplierLookupStatus");
    if (el) el.textContent = text;
  }
  function cacheGet(key) {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || "null");
      if (v && Date.now() - v.saved < CACHE_MS) return v.value;
    } catch (_) {}
    return null;
  }
  function cachePut(key, value) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({saved:Date.now(), value})); } catch (_) {}
  }
  function km(a,b,c,d) {
    const R=6371, rad=Math.PI/180;
    const dl=(c-a)*rad, dn=(d-b)*rad;
    const h=Math.sin(dl/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dn/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  async function request(query, coords, limit) {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit || 20));
    if (coords) {
      url.searchParams.set("lat", String(coords.lat));
      url.searchParams.set("lon", String(coords.lon));
    }
    const key=url.searchParams.toString();
    const cached=cacheGet(key);
    if (cached) return cached;
    const control=new AbortController();
    const timeout=setTimeout(()=>control.abort(),16000);
    try {
      const resp=await fetch(url.href, {signal:control.signal,mode:"cors"});
      if (!resp.ok) throw new Error("Serviço de busca temporariamente indisponível (HTTP "+resp.status+").");
      const data=await resp.json();
      if (!Array.isArray(data.features)) throw new Error("Formato inesperado da pesquisa externa.");
      cachePut(key,data);
      return data;
    } finally {clearTimeout(timeout);}
  }
  function matchesVendor(feature) {
    const p=feature?.properties || {};
    const cat=String(p.osm_value || "");
    const kind=String(p.osm_key || "");
    return !!p.name && (kind==="shop" && /^(supermarket|wholesale|butcher|bakery|greengrocer|deli|convenience|grocery|general|department_store|farm|beverages)$/i.test(cat)
      || kind==="craft" && cat==="bakery"
      || /supermercado|mercado|atacado|açougue|acougue|hortifruti|distribuidor|mercearia/i.test(String(p.name)));
  }
  function drawResults() {
    const el=document.getElementById("supplierSearchResults");
    if (!el) return;
    if (!resultItems.length) {el.innerHTML="";return;}
    el.innerHTML = resultItems.map((x,i) => {
      const p=x.properties, coords=x.geometry.coordinates;
      const address=[p.street,p.housenumber,p.city||p.district,p.state].filter(Boolean).join(", ");
      const link="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(x.geometry.coordinates[1]+","+coords[0]);
      return '<div class="pote-supplier-result">'
       +'<div><strong>'+esc(p.name)+'</strong><div class="muted">'
       +esc(x.distance.toFixed(1))+' km · '+esc(p.osm_value||"Estabelecimento")+'</div>'
       +(address?'<div class="muted">'+esc(address)+'</div>':"")+'</div>'
       +'<div class="pote-supplier-result-actions"><a class="btn line mini" target="_blank" rel="noopener" href="'+link+'">Ver no mapa</a>'
       +'<button type="button" class="btn mini" onclick="poteSaveSupplierFromMap('+i+')">Cadastrar</button></div>'
       +'</div>';
    }).join("");
  }
  pageSuppliers = function () {
    let html=originalPage();
    html=html.replace("Pesquisa habilitada nesta simulação. Nenhuma chamada externa será enviada.",
      "Busca piloto de estabelecimentos reais no OpenStreetMap. Os registros podem estar incompletos.");
    html=html.replace(/Pesquisa por GPS, cidade e raio bloqueada no Free para proteger seus créditos externos\./,
      "FREE permite 1 fornecedor manual. Pesquisa externa disponível apenas para o administrador neste teste.");
    html=html.replace("<h3>Adicionar manualmente</h3>",
      '<section class="pote-supplier-lookup"><div id="supplierLookupStatus" aria-live="polite">'
        +esc(currentStatus || "Pesquise por cidade ou use GPS. Só será feita consulta externa após tocar em Pesquisar.")
        +'</div><div id="supplierSearchResults"></div>'
        +'<small>Fonte: <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">© colaboradores do OpenStreetMap</a> (Photon). Não confirma preço, telefone ou estoque. Serviço público sujeito a limites.</small></section>'
        +'<h3>Adicionar manualmente</h3>');
    setTimeout(drawResults,0);
    return html;
  };

  supplierGps = function () {
    if (!pro()) {toast("Pesquisa por GPS disponível conforme seu plano e a integração do serviço.");return;}
    if (!window.isSecureContext || !navigator.geolocation) {
      status("GPS indisponível neste navegador. Abra o site no Chrome ou Edge, com HTTPS.");
      return;
    }
    status("Solicitando permissão para sua localização...");
    navigator.geolocation.getCurrentPosition(function(pos){
      userCoords={lat:pos.coords.latitude,lon:pos.coords.longitude};
      locationLabel="localização atual (GPS)";
      status("GPS autorizado. Precisão aproximada: "+Math.round(pos.coords.accuracy)+" m. Toque em Pesquisar fornecedores.");
    },function(err){
      const reasons={1:"Permissão de GPS negada. Autorize a localização no navegador.",2:"O aparelho não conseguiu determinar a posição.",3:"Tempo de GPS esgotado."};
      status(reasons[err.code] || "Não foi possível acessar o GPS. Tente no Chrome.");
    },{enableHighAccuracy:false,maximumAge:120000,timeout:12000});
  };

  searchSupplier = async function () {
    if (!pro()) {toast("A pesquisa externa está em teste no painel ADM.");return;}
    if (searching) {status("Pesquisa já em andamento...");return;}
    const city=(document.getElementById("supplierCity")?.value||"").trim();
    const radius=Math.min(50,Math.max(2,Number(document.getElementById("supplierRadius")?.value||10)));
    searching=true;
    resultItems=[];
    drawResults();
    try {
      let center=userCoords;
      if (!center) {
        if (!city || city.length<3) throw new Error("Digite a cidade e o estado antes de pesquisar.");
        status("Localizando "+city+"...");
        const geo=await request(city+", Brasil",null,8);
        const match=geo.features.find(f=>f?.properties?.countrycode==="BR" &&
           (f?.properties?.osm_value==="municipality" || f?.properties?.osm_value==="city"
             || f?.properties?.osm_value==="town" || f?.properties?.type==="city"))
           || geo.features.find(f=>f?.properties?.countrycode==="BR");
        if (!match || !Array.isArray(match.geometry?.coordinates)) throw new Error("Cidade não encontrada. Informe cidade e UF ou use GPS.");
        center={lat:Number(match.geometry.coordinates[1]),lon:Number(match.geometry.coordinates[0])};
        locationLabel=city;
      }
      if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) throw new Error("Coordenadas inválidas. Tente localizar novamente.");
      const found=new Map();
      let errors=0;
      for (const term of SEARCH_TERMS) {
        status("Consultando "+term+" perto de "+(locationLabel || city)+"...");
        const query=term+" "+(userCoords?"":city);
        try {
          const data=await request(query.trim(),center,30);
          for (const f of data.features) {
            if (!matchesVendor(f) || !Array.isArray(f.geometry?.coordinates)) continue;
            const [lon,lat]=f.geometry.coordinates;
            const distance=km(center.lat,center.lon,Number(lat),Number(lon));
            if (!Number.isFinite(distance) || distance>radius) continue;
            const id=String(f.properties.osm_type)+":"+String(f.properties.osm_id);
            if (!found.has(id)) found.set(id,{...f,distance,osmId:id});
          }
        } catch (e) {errors++; console.warn("Busca OpenStreetMap:", e.message);}
        await wait(1100);
      }
      resultItems=Array.from(found.values()).sort((a,b)=>a.distance-b.distance).slice(0,40);
      drawResults();
      if (resultItems.length) status("Encontrados "+resultItems.length+" estabelecimentos cadastrados no OpenStreetMap em até "+radius+" km. Confira os dados antes de comprar.");
      else status(errors===SEARCH_TERMS.length
        ?"Serviço externo indisponível no momento. Pesquise pelo Google Maps ou cadastre manualmente."
        :"Nenhum fornecedor identificado nessa distância. Tente outro raio ou cadastre manualmente.");
      if (!resultItems.length) {
        const box=document.getElementById("supplierSearchResults");
        if (box) box.innerHTML='<a class="btn line mini" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='
          +encodeURIComponent("fornecedores alimentos "+city)+'">Pesquisar no Google Maps</a>';
      }
    } catch (e) {
      status(e.name==="AbortError"?"A busca excedeu o tempo disponível. Tente novamente.":e.message||"Falha na pesquisa.");
    } finally {searching=false;}
  };

  window.poteSaveSupplierFromMap = function(index) {
    const f=resultItems[index];
    if (!f) return;
    if (!pro() && state.data.suppliers.length >= 1){toast("FREE: máximo de 1 fornecedor cadastrado.");return;}
    if (state.data.suppliers.some(x=>x.osmId===f.osmId)){toast("Fornecedor já cadastrado.");return;}
    const p=f.properties;
    const address=[p.street,p.housenumber,p.city,p.state].filter(Boolean).join(", ");
    state.data.suppliers.push({
      id:uid(), name:String(p.name), phone:String(p.extra?.phone||p.extra?.["contact:phone"]||""),
      address, city:String(p.city||locationLabel||""), category:String(p.osm_value||"OpenStreetMap"),
      osmId:f.osmId
    });
    persist();
    render();
    toast("Fornecedor cadastrado. Confirme o endereço e o telefone antes de comprar.");
  };
})();