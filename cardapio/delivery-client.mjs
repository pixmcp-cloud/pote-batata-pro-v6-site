import {GEO_ENDPOINT} from "./geo-config.mjs";
import {money} from "./cardapio-core.mjs";
const msg={authentication_required:"Entre com Google para consultar o frete.",canary_required:"Recurso reservado às contas de homologação.",delivery_disabled:"A loja ainda não configurou a entrega automática.",outside_delivery_area:"Este endereço está fora da área de entrega.",daily_quota_exhausted:"Limite diário de consultas atingido. Consulte a loja.",geo_provider_quota:"Consultas temporariamente indisponíveis. Consulte a loja.",address_not_confirmed:"Não foi possível confirmar esse endereço. Revise rua e número.",owner_required:"Somente o proprietário pode configurar o frete.",geo_disabled:"Integração em homologação, ainda desativada.",geo_unavailable:"Não foi possível consultar o frete. Tente novamente.",invalid_store_location:"Localização da loja não confirmada. Revise o endereço."};
export const geoMessage=e=>msg[e?.code]||"Não foi possível concluir a consulta. Nenhum frete foi confirmado.";
export function createDeliveryClient({endpoint=GEO_ENDPOINT,token,requestFetch=fetch}={}){
 let base;
 try{const u=new URL(endpoint);if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash)throw Error();base=u.origin}catch{}
 return {enabled:!!base,async request(path,data,{signal}={}){
  if(!base)throw Object.assign(Error("not configured"),{code:"geo_disabled"});
  if(!["config/get","config/set","geocode","autocomplete","reverse","quote"].includes(path))throw Error("invalid operation");
  const idToken=await token();if(!idToken)throw Object.assign(Error("authentication required"),{code:"authentication_required"});
  const r=await requestFetch(base+"/v1/geo/"+path,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+idToken},body:JSON.stringify(data),signal:signal||AbortSignal.timeout(18000),credentials:"omit",redirect:"error",cache:"no-store"});
  const b=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error("geo request failed"),{code:b.error,status:r.status});
  return b;
 }};
}
async function customerAuth(){
 const [{app},sdk]=await Promise.all([import("../firebase_app.mjs"),import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js")]);
 const auth=sdk.getAuth(app);await auth.authStateReady();
 return {auth,sdk};
}
const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n};
const button=txt=>{const b=el("button",txt);b.type="button";b.className="button button-quiet";return b};
const field=(label,type="text",value="")=>{const wrap=el("label",label),input=el("input");input.type=type;input.value=value;wrap.append(input);return {wrap,input}};
const point=p=>({lat:p.lat,lon:p.lon});
const gps=()=>new Promise((resolve,reject)=>{
 if(!navigator.geolocation)return reject(Error("GPS unavailable"));
 navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),reject,{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
});
export function quoteCurrent(q,{now=Date.now(),identity,slug,address}={}){
 return Boolean(q&&q.expiresAt>now&&q.identity===identity&&q.slug===slug&&q.addressInput===address&&
 Number.isSafeInteger(q.feeCents)&&q.feeCents>=0);
}
// Only mounted on an explicitly published store after configured staging endpoint.
export function mountDeliveryCheckout({slug,host,addressInput,feeNode,totalNode,totalLabel,subtotal,hasCart,onMode}){
 if(!GEO_ENDPOINT||!host||host.dataset.geoMounted)return null;
 host.dataset.geoMounted="true";
 let auth=null,client=null,uid=null,selected=null,quote=null,epoch=0,busy=false,timer=null,abort=null,setupPromise=null;
 const panel=el("section");panel.className="geo-delivery-panel";
 panel.append(el("strong","Entrega inteligente • homologação"));
 const signin=button("Entrar com Google para calcular");
 const search=button("Buscar endereço"),locate=button("Usar minha localização"),calculate=button("Calcular frete");
 const results=el("div"),status=el("p");status.setAttribute("role","status");results.className="geo-suggestions";
 panel.append(signin,search,locate,results,calculate,status);host.after(panel);
 const tell=t=>{status.textContent=t};
 function clearQuote(){quote=null;feeNode.textContent="A calcular";totalNode.textContent=money(subtotal());}
 function invalidate(){epoch++;selected=null;abort?.abort();clearTimeout(timer);results.replaceChildren();clearQuote();}
 function sync(){
  const delivery=onMode()==="entrega";panel.hidden=!delivery;
  const current=delivery&&hasCart()&&quoteCurrent(quote,{identity:uid,slug,address:addressInput.value});
  if(!current){quote=null;feeNode.textContent=delivery?"A calcular":"Não se aplica";totalNode.textContent=money(subtotal());}
  else{feeNode.textContent=money(quote.feeCents)+" (cotação)";totalNode.textContent=money(subtotal()+quote.feeCents);}
  if(totalLabel)totalLabel.textContent=current?"Total estimado (cotação)":"Total dos produtos";
  signin.hidden=!!uid;signin.disabled=!hasCart();search.disabled=locate.disabled=busy||!uid||!hasCart();calculate.disabled=busy||!selected||!uid||!hasCart();
 }
 function showResults(items){
  results.replaceChildren();
  for(const p of items||[]){
   const b=button(p.address);b.addEventListener("click",()=>{
    invalidate();selected=point(p);addressInput.value=p.address;results.replaceChildren();
    tell("Endereço selecionado. Confirme rua, número e complemento antes da compra.");sync();
   });results.append(b);
  }
  if(!items?.length)tell("Nenhum endereço localizado na área de atendimento. Revise rua, número e cidade.");
 }
 async function setup(){
  if(auth)return;
  if(!setupPromise)setupPromise=(async()=>{const a=await customerAuth();auth=a.auth;
   client=createDeliveryClient({token:()=>auth.currentUser?.getIdToken()});
   uid=auth.currentUser?.uid||null;sync();
   a.sdk.onAuthStateChanged(auth,user=>{if((user?.uid||null)!==uid){uid=user?.uid||null;invalidate();sync();}});
  })().finally(()=>{setupPromise=null});
  await setupPromise;
 }
 signin.addEventListener("click",async()=>{
  if(!hasCart()){tell("Adicione um produto primeiro.");return;}
  try{await setup();if(!auth.currentUser){const {sdk}=await customerAuth();await sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());}uid=auth.currentUser?.uid||null;sync();tell("Agora escolha o endereço da entrega.");}
  catch(e){tell(geoMessage(e));}
 });
 async function lookup(){
  if(!uid||!hasCart()||addressInput.value.trim().length<4)return;
  const stamp=++epoch;abort?.abort();abort=new AbortController();const typed=addressInput.value;
  try{const data=await client.request("autocomplete",{slug,text:typed},{signal:abort.signal});
   if(stamp===epoch&&addressInput.value===typed&&onMode()==="entrega")showResults(data.results);}
  catch(e){if(stamp===epoch&&e.name!=="AbortError")tell(geoMessage(e));}
 }
 addressInput.addEventListener("input",()=>{invalidate();sync();if(uid&&hasCart()&&addressInput.value.trim().length>=4)timer=setTimeout(lookup,850);});
 search.addEventListener("click",()=>{clearTimeout(timer);void lookup()});
 locate.addEventListener("click",async()=>{
  invalidate();const stamp=epoch;busy=true;sync();
  try{const p=await gps();if(stamp!==epoch)return;const data=await client.request("reverse",{slug,point:p});
   if(stamp===epoch)showResults(data.results);}
  catch(e){if(stamp===epoch)tell(e.code?geoMessage(e):"GPS indisponível ou não autorizado. Digite seu endereço.");}
  finally{busy=false;sync();}
 });
 calculate.addEventListener("click",async()=>{
  if(!selected||!uid||!hasCart())return;const stamp=++epoch,identity=uid,typed=addressInput.value;busy=true;clearQuote();sync();
  try{const q=await client.request("quote",{slug,point:selected});
   if(stamp!==epoch||uid!==identity||addressInput.value!==typed||onMode()!=="entrega")return;
   if(!q.quoteId||!Number.isSafeInteger(q.feeCents)||q.feeCents<0||q.expiresAt<=Date.now()||q.checkoutEnabled!==false)throw Error("invalid quote");
   quote={...q,identity,slug,addressInput:typed};
   tell("Frete "+money(q.feeCents)+" • "+(q.meters/1000).toLocaleString("pt-BR",{maximumFractionDigits:2})+" km • trajeto estimado "+Math.ceil(q.seconds/60)+" min. Endereço conferido: "+q.address+". Cotação de homologação; nenhum pedido será enviado.");
   clearTimeout(timer);timer=setTimeout(()=>{sync();tell("Cotação expirada. Calcule novamente.");},Math.max(0,q.expiresAt-Date.now()));
  }catch(e){if(stamp===epoch)tell(geoMessage(e));}
  finally{busy=false;sync();}
 });
 // Reading the menu never launches OAuth. Existing session is read only upon checkout entry.
 const controller={sync,getQuote(){return quoteCurrent(quote,{identity:uid,slug,address:addressInput.value})?{...quote}:null},reset(){invalidate();sync()},activate(){if(hasCart()&&onMode()==="entrega")void setup().catch(()=>tell("Entre com Google para calcular."));sync();}};
 sync();return controller;
}
export function mountMerchantDelivery({host,slugFor,ownerFor,token}){
 if(!GEO_ENDPOINT)return;
 const client=createDeliveryClient({token});
 const details=el("details"),summary=el("summary","Configurar entrega inteligente (homologação)");
 details.className="geo-delivery-panel";details.append(summary);
 const address=field("Endereço da loja (rua, número e cidade)"),locate=button("Localizar endereço"),gpsBtn=button("Usar GPS da loja"),results=el("div"),location=el("p","Localização não definida");
 const base=field("Taxa inicial (R$)","number"),km=field("Por km (R$)","number"),min=field("Taxa mínima (R$)","number"),radius=field("Distância máxima pelas ruas (km)","number");
 for(const f of [base,km,min,radius]){f.input.min="0";f.input.step=".01";}
 const enabled=field("Ativar cotação na homologação","checkbox"),mode=el("select");
 for(const [value,label] of [["motorcycle","Moto"],["drive","Carro"],["bicycle","Bicicleta"]]){const o=el("option",label);o.value=value;mode.append(o);}
 const modeLabel=el("label","Veículo");modeLabel.append(mode);
 const load=button("Carregar configuração"),save=button("Salvar configuração"),status=el("p");status.setAttribute("role","status");
 details.append(address.wrap,locate,gpsBtn,results,location,base.wrap,km.wrap,min.wrap,radius.wrap,modeLabel,enabled.wrap,load,save,status);host.append(details);
 let selected=null,scopeKey="",epoch=0,busy=false;
 const scope=()=>({slug:slugFor(),uid:ownerFor()});
 function check(){const s=scope();if(!s.uid||!s.slug)throw Error("store not ready");return s}
 function same(s,stamp){const now=scope();return details.isConnected&&stamp===epoch&&s.slug===now.slug&&s.uid===now.uid}
 function tell(t){status.textContent=t}
 function choose(p){selected=point(p);location.textContent=p.address||("GPS: "+p.lat.toFixed(5)+", "+p.lon.toFixed(5));}
 function setBusy(v){busy=v;for(const b of [load,save,locate,gpsBtn])b.disabled=v;}
 function clear(){selected=null;location.textContent="Localização não definida";results.replaceChildren();for(const f of [address,base,km,min,radius])f.input.value="";enabled.input.checked=false;mode.value="motorcycle";}
 async function run(action){
  if(busy)return;let s;try{s=check()}catch{tell("Publique a loja primeiro.");return}
  const stamp=++epoch,key=s.uid+":"+s.slug;
  if(scopeKey!==key){clear();scopeKey=key;if(action!=="load"){tell("Carregue a configuração desta loja antes de editar.");return}}
  setBusy(true);
  try{
   if(action==="load"){clear();const r=await client.request("config/get",{slug:s.slug});if(!same(s,stamp))return;
    if(r.config){const c=r.config;choose(c.origin);base.input.value=(c.baseCents/100).toFixed(2);km.input.value=(c.perKmCents/100).toFixed(2);min.input.value=(c.minCents/100).toFixed(2);radius.input.value=(c.maxMeters/1000).toFixed(2);enabled.input.checked=c.enabled;mode.value=c.mode;}
    tell(r.config?"Configuração carregada.":"Nenhuma tarifa cadastrada. Defina a origem e os valores.");return;}
   if(action==="locate"){const r=await client.request("geocode",{slug:s.slug,text:address.input.value});if(!same(s,stamp))return;results.replaceChildren();for(const p of r.results||[]){const b=button(p.address);b.addEventListener("click",()=>{if(same(s,stamp))choose(p)});results.append(b);}tell("Selecione o endereço correto.");return;}
   if(action==="gps"){const p=await gps();if(same(s,stamp)){choose(p);tell("GPS selecionado; será validado pelo servidor ao salvar.");}return;}
   if(action==="save"){
    if(!selected||[base,km,min,radius].some(f=>f.input.value.trim()===""||!Number.isFinite(Number(f.input.value)))){tell("Preencha origem, tarifas e distância máxima.");return;}
    const config={origin:selected,enabled:enabled.input.checked,baseCents:Math.round(Number(base.input.value)*100),perKmCents:Math.round(Number(km.input.value)*100),minCents:Math.round(Number(min.input.value)*100),maxMeters:Math.round(Number(radius.input.value)*1000),mode:mode.value};
    await client.request("config/set",{slug:s.slug,config});if(same(s,stamp))tell("Configuração confirmada pelo servidor. Pedidos reais continuam desativados.");
   }
  }catch(e){if(same(s,stamp))tell(geoMessage(e));}
  finally{setBusy(false);}
 }
 address.input.addEventListener("input",()=>{epoch++;selected=null;location.textContent="Selecione novamente a localização.";results.replaceChildren();});
 for(const [b,a] of [[load,"load"],[locate,"locate"],[gpsBtn,"gps"],[save,"save"]])b.addEventListener("click",()=>void run(a));
 details.addEventListener("toggle",()=>{if(details.open)void run("load")});
}
