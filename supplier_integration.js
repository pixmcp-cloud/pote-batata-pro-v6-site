/* Potê Batata Pro — busca piloto de fornecedores, sem chave/API paga.
 * Consulta deliberada pelo usuário aos dados públicos do OpenStreetMap via Photon.
 * O servidor público pode limitar chamadas e não garante cobertura/atualização.
 */
(function () {
  "use strict";
  const REQUEST_INTERVAL_MS = 1100;
  const REQUEST_TIMEOUT_MS = 6000;
  const REQUEST_LIMIT_PER_MINUTE = 16;
  const CACHE_MS = 12 * 60 * 1000;
  const CACHE_ENTRIES = 64;
  const responseCache = new Map();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let queue = Promise.resolve();
  let nextRequestAt = 0;
  let recentRequests = [];
  let pausedUntil = 0;
  let accountEpoch = 0;
  let activeRequest;

  function coordinates(lon, lat) {
    return Number.isFinite(lon) && Math.abs(lon) <= 180 &&
      Number.isFinite(lat) && Math.abs(lat) <= 90 ? {lat,lon} : null;
  }

  const clean = (value, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";
  function readFeature(feature) {
    const point = feature?.geometry?.coordinates;
    const props = feature?.properties;
    if (!props || !Array.isArray(point) || !coordinates(point[0],point[1])) return null;
    const fields = ["name","city","district","state","street","housenumber","countrycode","type","osm_key","osm_value"];
    const result = Object.fromEntries(fields.map(key => [key,clean(props[key])]));
    result.countrycode = result.countrycode.toUpperCase();
    const osmType = clean(props.osm_type).toUpperCase();
    const osmId = Number.isSafeInteger(props.osm_id) ? String(props.osm_id) : clean(props.osm_id);
    result.osm_type = /^[NWR]$/.test(osmType) ? osmType : "";
    result.osm_id = /^[1-9]\d{0,19}$/.test(osmId) ? osmId : "";
    result.phone = clean(props.extra?.phone || props.extra?.["contact:phone"] || props.phone, 40);
    result.website = clean(props.extra?.website || props.extra?.["contact:website"], 360);
    return {properties:result, geometry:{coordinates:point.slice(0,2)}};
  }

  function requestPhoton(path, params, coords) {
    const url = new URL("https://photon.komoot.io/" + path + "/");
    for (const [key,value] of Object.entries(params)) url.searchParams.set(key,String(value));
    if (coords) {
      // Photon receives an approximate center. Keep the exact GPS position in memory for radius checks.
      url.searchParams.set("lat",coords.lat.toFixed(2));
      url.searchParams.set("lon",coords.lon.toFixed(2));
    }
    const key = url.href;
    const epoch = accountEpoch;
    const pending = queue.then(async () => {
      if (epoch !== accountEpoch) throw new Error("Conta alterada.");
      const cached = responseCache.get(key);
      if (cached && Date.now() - cached.at < CACHE_MS) return cached.features;
      if (Date.now() < pausedUntil) throw new Error("A pesquisa externa está temporariamente indisponível.");
      const delay = nextRequestAt - Date.now();
      if (delay > 0) await wait(delay);
      if (epoch !== accountEpoch) throw new Error("Conta alterada.");

      const now = Date.now();
      recentRequests = recentRequests.filter(at => now-at < 60_000);
      if (recentRequests.length >= REQUEST_LIMIT_PER_MINUTE) throw new Error("Limite de consultas atingido. Aguarde um minuto.");
      recentRequests.push(now);
      const control = new AbortController();
      activeRequest = control;
      nextRequestAt = now + REQUEST_INTERVAL_MS;
      const timeout = setTimeout(() => control.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(key, {
          signal:control.signal, mode:"cors", credentials:"omit", cache:"no-store", referrerPolicy:"no-referrer"
        });
        if (!response.ok) throw new Error("A pesquisa externa está temporariamente indisponível.");
        const data = await response.json();
        if (!Array.isArray(data?.features)) throw new Error("Resposta inválida do serviço de pesquisa.");
        if (epoch !== accountEpoch) throw new Error("Conta alterada.");
        const features = data.features.slice(0,40).map(readFeature).filter(Boolean);
        responseCache.delete(key);
        if (responseCache.size >= CACHE_ENTRIES) responseCache.delete(responseCache.keys().next().value);
        responseCache.set(key,{at:Date.now(),features});
        return features;
      } catch (error) {
        if (epoch === accountEpoch) pausedUntil = Date.now() + 30_000;
        if (error.name === "AbortError") throw new Error("A pesquisa externa excedeu o tempo disponível.");
        throw error;
      } finally {
        clearTimeout(timeout);
        activeRequest = null;
      }
    });
    queue = pending.catch(() => {});
    return pending;
  }

  function clearProviderSession() {
    accountEpoch++;
    activeRequest?.abort();
    responseCache.clear();
  }
  for (const event of ["pote:user-logout","pote:user-ready"]) window.addEventListener?.(event,clearProviderSession);
  window.POTE_SUPPLIER_SEARCH = {request:requestPhoton,coordinates};

  if (typeof pageSuppliers !== "function" || typeof escapeHtml !== "function") return;
  const originalPage = pageSuppliers;
  const SEARCH_TERMS = ["supermercado", "atacado", "açougue", "hortifruti"];
  const GPS_MAX_AGE_MS = 2 * 60 * 1000;
  let userCoords = null;
  let locationLabel = "";
  let resultItems = [];
  let fallbackCity = null;
  let currentStatus = "";
  let searchToken = null;
  let gpsRequest = null;
  const esc = value => escapeHtml(String(value ?? ""));

  function status(text) {
    currentStatus = text;
    const el = document.getElementById("supplierLookupStatus");
    if (el) el.textContent = text;
  }
  const cityValue = () => (document.getElementById("supplierCity")?.value || "").trim().slice(0,100);
  function km(a,b,c,d) {
    const R=6371, rad=Math.PI/180;
    const dl=(c-a)*rad, dn=(d-b)*rad;
    const h=Math.sin(dl/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dn/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function matchesVendor(feature) {
    const p=feature?.properties || {};
    const cat=String(p.osm_value || "");
    const kind=String(p.osm_key || "");
    return !!(p.name && p.osm_type && p.osm_id) && (kind==="shop" && /^(supermarket|wholesale|butcher|bakery|greengrocer|deli|convenience|grocery|general|department_store|farm|beverages)$/i.test(cat)
      || kind==="craft" && cat==="bakery"
      || /supermercado|mercado|atacado|açougue|acougue|hortifruti|distribuidor|mercearia/i.test(String(p.name)));
  }
  function drawResults() {
    const el=document.getElementById("supplierSearchResults");
    if (!el) return;
    if (!resultItems.length) {
      el.innerHTML=fallbackCity===null?"":'<a class="btn line mini" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query='
        +encodeURIComponent(("fornecedores de alimentos "+fallbackCity).trim())+'">Pesquisar no Google Maps</a>';
      return;
    }
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
        +esc(currentStatus || "Pesquise por cidade ou use GPS. Ao pesquisar com GPS, sua localização aproximada é enviada ao Photon.")
        +'</div><div id="supplierSearchResults"></div>'
        +'<small>Fonte: <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">© colaboradores do OpenStreetMap</a> (Photon). Não confirma preço, telefone ou estoque. Serviço público sujeito a limites.</small></section>'
        +'<h3>Adicionar manualmente</h3>');
    setTimeout(drawResults,0);
    return html;
  };

  supplierGps = function () {
    if (!pro()) {toast("Pesquisa por GPS disponível conforme seu plano e a integração do serviço.");return;}
    if (!window.isSecureContext || !navigator.geolocation) {
      status("GPS indisponível neste navegador. Você pode pesquisar por cidade e UF.");
      return;
    }
    userCoords=null;
    const token={city:cityValue()};
    gpsRequest=token;
    status("Solicitando permissão para sua localização...");
    navigator.geolocation.getCurrentPosition(function(pos){
      if(gpsRequest!==token)return;
      gpsRequest=null;
      const point=coordinates(pos.coords.longitude,pos.coords.latitude);
      if(!point) {status("GPS indisponível. Você pode pesquisar por cidade e UF.");return;}
      userCoords={...point,at:Date.now(),city:token.city};
      status("GPS autorizado. Ao tocar em Pesquisar fornecedores, sua localização aproximada será enviada ao Photon.");
    },function(err){
      if(gpsRequest!==token)return;
      gpsRequest=null;
      const reasons={1:"Permissão de GPS negada.",2:"O aparelho não conseguiu determinar a posição.",3:"Tempo de GPS esgotado."};
      status((reasons[err.code] || "Não foi possível acessar o GPS.")+" Você pode pesquisar por cidade e UF.");
    },{enableHighAccuracy:false,maximumAge:120000,timeout:12000});
  };

  searchSupplier = async function () {
    if (!pro()) {toast("A pesquisa externa está em teste no painel ADM.");return;}
    if (searchToken) {status("Pesquisa já em andamento...");return;}
    if (gpsRequest) {status("Aguarde a autorização do GPS para pesquisar.");return;}
    const city=cityValue();
    const useGps=userCoords?.city===city && Date.now()-userCoords.at<GPS_MAX_AGE_MS;
    if(!useGps && city.length<3) {status("Digite a cidade e o estado antes de pesquisar.");return;}
    const token={};
    searchToken=token;
    const selectedRadius=Number(document.getElementById("supplierRadius")?.value||10);
    const radius=Number.isFinite(selectedRadius)?Math.min(50,Math.max(2,selectedRadius)):10;
    resultItems=[];
    fallbackCity=null;
    drawResults();
    try {
      let center=useGps?userCoords:null;
      const label=useGps?"sua localização":city;
      if (!center) {
        status("Localizando "+city+"...");
        const geo=await requestPhoton("api",{q:city+", Brasil",countrycode:"BR",limit:8});
        if(searchToken!==token)return;
        const match=geo.find(f=>f.properties.countrycode==="BR" &&
           (f?.properties?.osm_value==="municipality" || f?.properties?.osm_value==="city"
             || f?.properties?.osm_value==="town" || f?.properties?.type==="city"))
           || geo.find(f=>f.properties.countrycode==="BR");
        if (!match) throw new Error("Cidade não encontrada. Informe cidade e UF ou use GPS.");
        center=coordinates(...match.geometry.coordinates);
      }
      const found=new Map();
      let incomplete=false;
      for (const term of SEARCH_TERMS) {
        status("Consultando "+term+" perto de "+label+"...");
        try {
          const features=await requestPhoton("api",{q:useGps?term:term+" "+city,countrycode:"BR",limit:30},center);
          if(searchToken!==token)return;
          for (const f of features) {
            if (!matchesVendor(f)) continue;
            const [lon,lat]=f.geometry.coordinates;
            const distance=km(center.lat,center.lon,lat,lon);
            if (distance>radius) continue;
            const id=f.properties.osm_type+":"+f.properties.osm_id;
            if (!found.has(id)) found.set(id,{...f,distance,osmId:id});
          }
        } catch (_) {incomplete=true;break;}
      }
      if(searchToken!==token)return;
      locationLabel=useGps?"":city;
      resultItems=Array.from(found.values()).sort((a,b)=>a.distance-b.distance).slice(0,40);
      if (resultItems.length) status("Encontrados "+resultItems.length+" estabelecimentos do OpenStreetMap em até "+radius+" km. "+
        (incomplete?"Busca parcial por indisponibilidade do serviço. ":"")+"Confira os dados antes de comprar.");
      else status(incomplete
        ?"Serviço externo indisponível no momento. Pesquise pelo Google Maps ou cadastre manualmente."
        :"Nenhum fornecedor identificado nessa distância. Tente outro raio ou cadastre manualmente.");
      if(!resultItems.length)fallbackCity=useGps?"":city;
      drawResults();
    } catch (e) {
      if(searchToken!==token)return;
      status(e.message||"Falha na pesquisa. Você pode cadastrar o fornecedor manualmente.");
      fallbackCity=useGps?"":city;
      drawResults();
    } finally {if(searchToken===token)searchToken=null;}
  };

  function clearSupplierSearch() {
    searchToken=null;
    gpsRequest=null;
    userCoords=null;
    resultItems=[];
    locationLabel="";
    fallbackCity=null;
    status("");
    drawResults();
  }
  for (const event of ["pote:user-logout","pote:user-ready"]) window.addEventListener?.(event,clearSupplierSearch);

  window.poteSaveSupplierFromMap = function(index) {
    const f=resultItems[index];
    if (!f) return;
    if (!pro() && state.data.suppliers.length >= 1){toast("FREE: máximo de 1 fornecedor cadastrado.");return;}
    if (state.data.suppliers.some(x=>x.osmId===f.osmId)){toast("Fornecedor já cadastrado.");return;}
    const p=f.properties;
    const address=[p.street,p.housenumber,p.city,p.state].filter(Boolean).join(", ");
    state.data.suppliers.push({
      id:uid(), name:p.name, phone:p.phone,
      address, city:String(p.city||locationLabel||""), category:String(p.osm_value||"OpenStreetMap"),
      osmId:f.osmId
    });
    persist();
    render();
    toast("Fornecedor cadastrado. Confirme o endereço e o telefone antes de comprar.");
  };
})();
