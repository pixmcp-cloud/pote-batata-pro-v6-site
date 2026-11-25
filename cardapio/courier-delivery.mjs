import {CHECKOUT_ENDPOINT} from "./checkout-config.mjs";
import {createCheckoutApi,signInForOrder} from "./checkout-api.mjs";
import {observeStop,distanceMeters} from "./courier-stop.mjs";
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get("pedido"),say=t=>{$("courierStatus").textContent=t};
let api,identity,auth,watch=null,lastSent=0,lastPoint=null,requesting=false,epoch=0,view=null,stopState=null,stopTimer=null,lastFixAt=0,fixPending=false;
let stopNotice=null;
function dismissStopNotice(){if(stopNotice){stopNotice.remove();stopNotice=null;}}
function showStopNotice(){
 if(stopNotice||document.hidden||!active())return;
 const box=document.createElement("aside");box.setAttribute("role","status");box.setAttribute("aria-live","polite");
 Object.assign(box.style,{position:"fixed",top:"max(12px, env(safe-area-inset-top))",left:"12px",right:"12px",maxWidth:"440px",margin:"auto",zIndex:"9999",background:"#17210f",color:"#e2fbb9",border:"1px solid #84cc16",borderRadius:"12px",padding:"16px",boxShadow:"0 4px 20px #0008"});
 const title=document.createElement("strong");title.textContent="Você está parado há 3 minutos";
 const msg=document.createElement("p");msg.textContent="Tudo certo com a entrega? O GPS continua ativo. Quando for seguro, prossiga ou confirme a entrega.";
 const close=document.createElement("button");close.type="button";close.textContent="Entendi";close.onclick=dismissStopNotice;
 box.append(title,msg,close);document.body.append(box);stopNotice=box;
}
function clearStopDetection(){stopState=null;lastFixAt=0;dismissStopNotice();if(stopTimer!==null)clearInterval(stopTimer);stopTimer=null;}
const active=()=>view?.role==="courier"&&view.status==="saiu_entrega"&&auth?.currentUser?.uid===identity;
function controls(){
 $("courierDispatch").hidden=view?.role!=="courier"||view.status!=="finalizado";
 $("courierConsent").hidden=!active();$("courierStart").hidden=!active()||watch!==null;
 $("courierStop").hidden=watch===null;$("courierDone").hidden=!active();
 $("courierAddress").hidden=!active()||!view?.address;$("courierAddress").textContent=active()?view.address||"":"";
 const map=$("courierMap");map.hidden=!active()||!view?.destination;
 if(!map.hidden)map.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(view.destination.lat+","+view.destination.lon);else map.removeAttribute("href");
}
async function stop({clear=true}={}){
 epoch++;if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;lastSent=0;lastPoint=null;clearStopDetection();controls();
 if(clear&&api&&identity===auth?.currentUser?.uid){try{await api.request("tracking/clear",{id})}catch{}}
}
async function refresh(){
 view=await api.request("orders/read",{id});
 if(view.role!=="courier")throw Error("not courier");if(!active())await stop({clear:false});controls();
 say("Pedido "+view.code+" • "+view.status.replaceAll("_"," "));
}
$("courierLogin").onclick=async()=>{
 if(!CHECKOUT_ENDPOINT||!id||!/^[a-f0-9]{64}$/.test(id)){say("Área de entregas ainda em homologação ou link inválido.");return;}
 try{const a=await signInForOrder();auth=a.auth;identity=auth.currentUser?.uid;api=createCheckoutApi({token:()=>auth.currentUser?.getIdToken()});
  a.sdk.onAuthStateChanged(auth,u=>{if(u?.uid!==identity){void stop({clear:false});view=null;controls();say("Sessão encerrada.");}});
  await refresh();
 }catch{say("Entrega indisponível para esta conta.");}
};
$("courierStart").onclick=async()=>{
 if(!active()||!$("courierConsentCheck").checked||!navigator.geolocation){say("Autorize o GPS desta entrega primeiro.");return;}
 const stamp=++epoch;
 try{
  await api.request("tracking/start",{id});if(stamp!==epoch||!active())return;
  const receive=async p=>{
   if(stamp!==epoch||!active()||!$("courierConsentCheck").checked||document.hidden)return;
   const now=Date.now(),point={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
   if(!Number.isFinite(p.timestamp)||now-p.timestamp>30000||p.timestamp>now+5000)return;
   lastFixAt=now;
   const observed=observeStop(stopState,{...point,speed:p.coords.speed},now);stopState=observed.state;
   if(observed.alert)showStopNotice();else if(!observed.stationary)dismissStopNotice();
   if(requesting)return;
   if(!Number.isFinite(point.accuracy)||point.accuracy>100)return;
   const age=now-lastSent;if(age<15000||lastPoint&&age<60000&&distanceMeters(lastPoint,point)<30)return;
   requesting=true;
   try{const r=await api.request("tracking/publish",{id,point,consent:true});if(stamp===epoch&&r.accepted){lastSent=now;lastPoint=point;say("GPS ativo • posição atualizada");}}
   catch(e){if(stamp===epoch){if(e.status===410||e.status===403){await stop({clear:false});say("Rastreamento encerrado pelo servidor.");}else say("GPS temporariamente sem conexão.");}}
   finally{requesting=false;}
  };
  const failure=()=>{if(stamp===epoch){stopState=null;dismissStopNotice();say("GPS indisponível ou não autorizado.");}};
  const options={enableHighAccuracy:true,timeout:15000,maximumAge:10000};
  watch=navigator.geolocation.watchPosition(receive,failure,options);
  // Some devices suppress stationary watch events: obtain a local fresh fix if needed.
  stopTimer=setInterval(()=>{if(stamp!==epoch||!active()||document.hidden||watch===null||fixPending||Date.now()-lastFixAt<45000)return;fixPending=true;
   navigator.geolocation.getCurrentPosition(p=>{fixPending=false;void receive(p)},()=>{fixPending=false;failure()},{...options,maximumAge:0});
  },30000);controls();say("GPS ativo durante esta entrega.");
 }catch{say("Não foi possível iniciar o GPS autorizado.");}
};
$("courierConsentCheck").onchange=()=>{if(!$("courierConsentCheck").checked)void stop()};
$("courierStop").onclick=()=>void stop();
$("courierDispatch").onclick=async()=>{try{await api.request("orders/transition",{id,operationId:crypto.randomUUID(),next:"saiu_entrega"});await refresh()}catch{say("Saída não confirmada.")}};
$("courierDone").onclick=async()=>{if(!active())return;
 const deliveryCode=prompt("Peça ao cliente o código de 4 dígitos após entregar o pedido.");
 if(!/^\d{4}$/.test(deliveryCode||""))return;
 try{await api.request("orders/transition",{id,operationId:crypto.randomUUID(),next:"entregue",deliveryCode});await stop({clear:false});view=null;controls();say("Entrega confirmada. GPS encerrado.");}catch(e){say(({delivery_code_incorrect:"Código incorreto. Confira com o cliente.",delivery_code_locked:"Muitas tentativas. Aguarde 15 minutos.",delivery_code_unavailable:"Código indisponível. Consulte a loja."})[e.code]||"Entrega não confirmada. Consulte o pedido antes de tentar novamente.");}};
document.addEventListener("visibilitychange",()=>{if(document.hidden)void stop({clear:false})});
window.addEventListener("pagehide",()=>{void stop({clear:false})});
if(!CHECKOUT_ENDPOINT){$("courierLogin").disabled=true;say("Área de entrega em homologação. Ainda não aceita entregas reais.");}
