/* Global notification bell: verified ADM announcements (Firestore realtime)
   and manual delivery imports already saved in the logged-in account. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {createCheckoutApi} from "./cardapio/checkout-api.mjs";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,onSnapshot,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {notificationState,mergeNotifications,unreadCount,markRead} from "./notification_core.mjs?v=notices-20261116";
const auth=getAuth(app),db=getFirestore(app);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const root=document.getElementById("poteNotifications")||document.createElement("div");root.id="poteNotifications";root.hidden=false;
root.innerHTML='<button type="button" id="poteBell" aria-label="Abrir notificações" aria-expanded="false" aria-controls="poteNoticeDrawer">'+
 '<span aria-hidden="true" class="pote-bell-icon">🔔</span><span id="poteNoticeCount" class="pote-bell-count" hidden>0</span></button>'+
 '<section id="poteNoticeDrawer" class="pote-notice-drawer" role="dialog" aria-label="Central de notificações" hidden>'+
 '<header><div><small>ALERTAS DA SUA CONTA</small><h2>Notificações</h2></div><button type="button" id="poteNoticeClose" aria-label="Fechar notificações">✕</button></header>'+
 '<div class="pote-notice-tools" id="poteNoticeTools"><button type="button" id="poteNoticeReadAll">Marcar todas como lidas</button><span id="poteNoticeStatus"></span></div>'+
 '<div id="poteNoticeList" class="pote-notice-list"></div><section id="poteNoticeDetail" class="pote-notice-detail" aria-label="Mensagem completa" hidden></section></section>';
document.body.appendChild(root);
// Mount alongside the actual hamburger in the sticky toolbar, not using screen offsets.
function mountBell(){
 const bar=document.getElementById('poteTopActions');
 const menu=document.getElementById('poteFloatToggle');
 if(!bar||!menu||menu.parentElement!==bar)return false;
 if(root.parentElement!==bar||root.nextElementSibling!==menu)bar.insertBefore(root,menu);
 return true;
}
if(!mountBell()){
 document.addEventListener('DOMContentLoaded',mountBell,{once:true});
 window.addEventListener('pote:changed',mountBell);
}

const $=id=>document.getElementById(id),bell=$("poteBell"),drawer=$("poteNoticeDrawer");
let messages=[],safetyAlerts=[],safetyUnsub=null,safetyPopup=null,safetySeen=new Set(),items=[],connectedUid=null,unsub=null,listenerError="",selectedId=null;
function logged(){return !!window.POTE_AUTH?.uid&&auth.currentUser?.uid===window.POTE_AUTH.uid}
function safeData(){return typeof state!=="undefined"&&state?.data?state.data:null}
function readStore(){return safeData()?notificationState(state.data).read:{}}
function currentNotifications(){
 if(!logged()||!safeData())return [];
 return mergeNotifications(messages,state.data.deliveryHub?.orders||[],readStore(),Date.now(),safetyAlerts);
}
function fmt(value){
 return value?new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
}
async function showSafetyLocation(item,host){
 if(!logged()||!item?.safetyRef)return;
 const identity=auth.currentUser.uid,button=document.createElement("button");button.type="button";button.textContent="Ver localização da ocorrência";
 button.onclick=async()=>{button.disabled=true;try{
  const api=createCheckoutApi({token:()=>auth.currentUser?.getIdToken()});
  const result=await api.request("orders/safety-location",item.safetyRef),p=result.point;
  if(auth.currentUser?.uid!==identity||!host.isConnected)return;
  if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||!Number.isFinite(p.accuracy))throw Error();
  const info=document.createElement("p");info.textContent="Última posição no alerta: "+p.lat.toFixed(6)+", "+p.lon.toFixed(6)+" • precisão aproximada "+Math.round(p.accuracy)+" m • "+fmt(p.at);
  const map=document.createElement("a");map.textContent="Abrir no mapa";map.target="_blank";map.rel="noopener noreferrer";map.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.lat+","+p.lon);host.append(info,map);button.remove();
 }catch{if(host.isConnected){button.textContent="Localização indisponível — tentar novamente";button.disabled=false;}}};
 host.append(button);
}
function paint(){
 const visible=logged()&&!!safeData();
 root.hidden=!visible;
 if(!visible){bell.classList.remove("has-unread");$("poteNoticeCount").hidden=true;return}
 items=currentNotifications();
 const count=unreadCount(items);
 bell.classList.toggle("has-unread",count>0);
 bell.setAttribute("aria-label",count?count+" notificações não lidas. Abrir.":"Abrir notificações");
 $("poteNoticeCount").hidden=count===0;
 $("poteNoticeCount").textContent=count>99?"99+":String(count);
 if(drawer.hidden)return;
 const selected=selectedId?items.find(x=>x.id===selectedId):null;
 if(selectedId&&!selected)selectedId=null;
 const detail=$("poteNoticeDetail");
 const showDetail=!!selected;
 $("poteNoticeTools").hidden=showDetail;
 $("poteNoticeList").hidden=showDetail;
 detail.hidden=!showDetail;
 if(showDetail){
  const href=/^https:\/\/[^\s]+$/i.test(selected.href||"")?selected.href:"";
  detail.innerHTML='<div class="pote-notice-detail-top">'+
   '<button type="button" id="poteNoticeBack" data-notice-back>← Voltar às notificações</button>'+
   '<span>'+esc(selected.source)+'</span></div>'+
   '<span class="pote-notice-detail-date">'+esc(fmt(selected.at))+'</span>'+
   '<h3>'+esc(selected.title)+'</h3>'+
   '<div class="pote-notice-detail-body">'+esc(selected.body)+'</div>'+
   (href?'<div class="pote-notice-detail-link"><p>Esta mensagem contém um link adicional. A leitura da mensagem já está completa acima.</p>'+
     '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">'+
     'Abrir link externo (nova aba)</a></div>':'')+
   '<button type="button" class="pote-notice-detail-finish" data-notice-back>Voltar à lista</button>';
  if(selected.kind==="safety")void showSafetyLocation(selected,detail);
  return;
 }
 $("poteNoticeStatus").textContent=listenerError?"Comunicados indisponíveis: "+listenerError:
 count?count+" não lida(s)":"Tudo lido";
 $("poteNoticeList").innerHTML=items.length?items.map(x=>
  '<article class="pote-notice-item '+(x.unread?"unread ":"")+'priority-'+esc(x.priority)+'" data-notice-id="'+esc(x.id)+'">'+
  '<div class="pote-notice-head"><strong>'+esc(x.title)+'</strong><small>'+esc(fmt(x.at))+'</small></div>'+
  '<p>'+esc(x.body)+'</p><div class="pote-notice-actions"><span>'+esc(x.source)+'</span>'+
  (x.unread?'<button type="button" data-notice-read="'+esc(x.id)+'">Marcar como lida</button>':'<span class="read-tag">✓ Lida</span>')+
  (x.kind==="order"?'<button type="button" data-notice-open="'+esc(x.id)+'">Abrir Hub</button>':
   (x.kind==="broadcast"||x.kind==="safety")?'<button type="button" data-notice-detail="'+esc(x.id)+'">Ver mensagem</button>':"")+
  '</div></article>').join(""):
  '<p class="pote-notice-empty">Nenhuma notificação. Pedidos importados e comunicados aparecerão aqui.</p>';
}
function viewMessage(id){
 if(!logged()||!safeData())return false;
 const selected=currentNotifications().find(x=>x.id===id&&(x.kind==="broadcast"||x.kind==="safety"));
 if(!selected)return false;
 selectedId=id;
 mark(id);
 paint();
 $("poteNoticeBack")?.focus?.();
 return true;
}
function backToList(){
 if(!selectedId)return;
 const previous=selectedId;
 selectedId=null;
 paint();
 const button=[...$("poteNoticeList").querySelectorAll("[data-notice-detail]")].find(x=>x.dataset.noticeDetail===previous);
 button?.focus?.();
}
function mark(id){if(!logged())return;
 if(markRead(readStore(),id)){if(typeof persist==="function")persist();paint()}
}
function markAll(){if(!logged())return;
 let changed=false;for(const x of currentNotifications())if(markRead(readStore(),x.id))changed=true;
 if(changed&&typeof persist==="function")persist();
 paint();
}
function toggle(force){
 if(!logged()){
  drawer.hidden=false;
  bell.setAttribute("aria-expanded","true");
  $("poteNoticeStatus").textContent="Entre na sua conta para ver os avisos.";
  $("poteNoticeList").innerHTML='<p class="pote-notice-empty">Notificações protegidas: entre na sua conta.</p>';
  return;
 }
 const show=typeof force==="boolean"?force:drawer.hidden;
 if(!show)selectedId=null;
 drawer.hidden=!show;
 bell.setAttribute("aria-expanded",String(show));
 paint();
}
function disconnect(){
 if(safetyUnsub){safetyUnsub();safetyUnsub=null} safetyAlerts=[];safetySeen.clear();safetyPopup?.remove();safetyPopup=null;
 if(unsub){unsub();unsub=null}
 connectedUid=null;messages=[];items=[];listenerError="";selectedId=null;drawer.hidden=true;bell.setAttribute("aria-expanded","false");
 root.hidden=true;
 bell.classList.remove("has-unread");
 $("poteNoticeCount").hidden=true;
}
function connect(){
 if(!logged()||!safeData()){disconnect();return}
 const uid=window.POTE_AUTH.uid;
 if(connectedUid===uid){paint();return}
 if(unsub){unsub();unsub=null}
 if(safetyUnsub){safetyUnsub();safetyUnsub=null} safetyAlerts=[];safetySeen.clear();safetyPopup?.remove();safetyPopup=null;
 connectedUid=uid;messages=[];listenerError="";root.hidden=false;paint();
 const safetyQuery=query(collection(db,"users",uid,"deliverySafetyAlertsV6"),orderBy("atMs","desc"),limit(30));
 safetyUnsub=onSnapshot(safetyQuery,snapshot=>{
  if(!logged()||window.POTE_AUTH?.uid!==uid)return;
  safetyAlerts=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));paint();
  if(snapshot.metadata.fromCache)return;
  const latest=currentNotifications().find(x=>x.kind==="safety"&&x.unread&&!safetySeen.has(x.id)&&Date.now()-x.at<86400000);
  if(!latest||safetyPopup)return;safetySeen.add(latest.id);
  const box=document.createElement("aside");box.setAttribute("role","alert");Object.assign(box.style,{position:"fixed",top:"16px",left:"12px",right:"12px",maxWidth:"480px",margin:"auto",zIndex:"2147483000",background:"#441414",color:"#fff",padding:"18px",border:"2px solid #f59e0b",borderRadius:"12px"});
  const title=document.createElement("strong");title.textContent=latest.title;const msg=document.createElement("p");msg.textContent=latest.body;const b=document.createElement("button");b.type="button";b.textContent="Ciente — verificar entregador";b.onclick=()=>{mark(latest.id);box.remove();safetyPopup=null;};box.append(title,msg);void showSafetyLocation(latest,box);box.append(b);document.body.append(box);safetyPopup=box;
 },()=>{});
 const q=query(collection(db,"announcements"),orderBy("createdAt","desc"),limit(60));
 unsub=onSnapshot(q,snapshot=>{
  if(window.POTE_AUTH?.uid!==uid)return;
  messages=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  listenerError="";paint();
 },err=>{
  if(window.POTE_AUTH?.uid!==uid)return;
  listenerError=err.code||"conexão indisponível";paint();
 });
}
bell.addEventListener("click",()=>toggle());
$("poteNoticeClose").addEventListener("click",()=>toggle(false));
$("poteNoticeReadAll").addEventListener("click",markAll);
$("poteNoticeList").addEventListener("click",event=>{
 const read=event.target.closest("[data-notice-read]");
 if(read){mark(read.dataset.noticeRead);return}
 const detailButton=event.target.closest("[data-notice-detail]");
 if(detailButton){viewMessage(detailButton.dataset.noticeDetail);return;}
 const open=event.target.closest("[data-notice-open]");
 if(open){mark(open.dataset.noticeOpen);toggle(false);if(typeof go==="function")go("deliveryhub");}
});
$("poteNoticeDetail").addEventListener("click",event=>{
 if(event.target.closest("[data-notice-back]"))backToList();
});
document.addEventListener("keydown",event=>{
 if(event.key!=="Escape"||drawer.hidden)return;
 if(selectedId)backToList();else toggle(false);
});
window.addEventListener("pote:user-ready",connect);
window.addEventListener("pote:user-logout",disconnect);
window.addEventListener("pote:changed",paint);
window.addEventListener("pote:notice-update",paint);
window.POTE_NOTIFY={refresh:paint,open:()=>toggle(true),close:()=>toggle(false),
 viewMessage,backToList,mark,markAll,get unread(){return unreadCount(currentNotifications())},
 get count(){return currentNotifications().length}};
if(logged())connect();
