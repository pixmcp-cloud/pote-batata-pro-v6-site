import {CHECKOUT_ENDPOINT} from "./checkout-config.mjs";
import {createCheckoutApi,signInForOrder} from "./checkout-api.mjs";
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get("pedido"),say=t=>{$("courierStatus").textContent=t};
let api,identity,auth,watch=null,lastSent=0,lastPoint=null,requesting=false,epoch=0,view=null;
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
 epoch++;if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;lastSent=0;lastPoint=null;controls();
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
const distance=(a,b)=>{const rad=Math.PI/180,x=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(x)))};
$("courierStart").onclick=async()=>{
 if(!active()||!$("courierConsentCheck").checked||!navigator.geolocation){say("Autorize o GPS desta entrega primeiro.");return;}
 const stamp=++epoch;
 try{
  await api.request("tracking/start",{id});if(stamp!==epoch||!active())return;
  watch=navigator.geolocation.watchPosition(async p=>{
   if(stamp!==epoch||!active()||!$("courierConsentCheck").checked||document.hidden||requesting)return;
   const now=Date.now(),point={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
   if(!Number.isFinite(point.accuracy)||point.accuracy>100)return;
   const age=now-lastSent;if(age<15000||lastPoint&&age<60000&&distance(lastPoint,point)<30)return;
   requesting=true;
   try{const r=await api.request("tracking/publish",{id,point,consent:true});if(stamp===epoch&&r.accepted){lastSent=now;lastPoint=point;say("GPS ativo • posição atualizada");}}
   catch(e){if(stamp===epoch){if(e.status===410||e.status===403){await stop({clear:false});say("Rastreamento encerrado pelo servidor.");}else say("GPS temporariamente sem conexão.");}}
   finally{requesting=false;}
  },()=>say("GPS indisponível ou não autorizado."),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});controls();say("GPS ativo durante esta entrega.");
 }catch{say("Não foi possível iniciar o GPS autorizado.");}
};
$("courierConsentCheck").onchange=()=>{if(!$("courierConsentCheck").checked)void stop()};
$("courierStop").onclick=()=>void stop();
$("courierDispatch").onclick=async()=>{try{await api.request("orders/transition",{id,operationId:crypto.randomUUID(),next:"saiu_entrega"});await refresh()}catch{say("Saída não confirmada.")}};
$("courierDone").onclick=async()=>{if(!active()||!confirm("Confirmar que o pedido foi entregue?"))return;await stop();
 try{await api.request("orders/transition",{id,operationId:crypto.randomUUID(),next:"entregue"});view=null;controls();say("Entrega confirmada. GPS encerrado.");}catch{say("Entrega não confirmada. Consulte o pedido antes de tentar novamente.");}};
document.addEventListener("visibilitychange",()=>{if(document.hidden)void stop()});
window.addEventListener("pagehide",()=>{void stop()});
if(!CHECKOUT_ENDPOINT){$("courierLogin").disabled=true;say("Área de entrega em homologação. Ainda não aceita entregas reais.");}
