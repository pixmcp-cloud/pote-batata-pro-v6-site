/* Global notification bell: verified ADM announcements (Firestore realtime)
   and manual delivery imports already saved in the logged-in account. */
import {getApp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,onSnapshot,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {notificationState,mergeNotifications,unreadCount,markRead} from "./notification_core.mjs?v=notices-20261116";
const auth=getAuth(getApp()),db=getFirestore(getApp());
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const root=document.createElement("div");root.id="poteNotifications";root.hidden=true;
root.innerHTML='<button type="button" id="poteBell" aria-label="Abrir notificações" aria-expanded="false" aria-controls="poteNoticeDrawer">'+
 '<span aria-hidden="true" class="pote-bell-icon">🔔</span><span id="poteNoticeCount" class="pote-bell-count" hidden>0</span></button>'+
 '<section id="poteNoticeDrawer" class="pote-notice-drawer" role="dialog" aria-label="Central de notificações" hidden>'+
 '<header><div><small>ALERTAS DA SUA CONTA</small><h2>Notificações</h2></div><button type="button" id="poteNoticeClose" aria-label="Fechar notificações">✕</button></header>'+
 '<div class="pote-notice-tools"><button type="button" id="poteNoticeReadAll">Marcar todas como lidas</button><span id="poteNoticeStatus"></span></div>'+
 '<div id="poteNoticeList" class="pote-notice-list"></div></section>';
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
let messages=[],items=[],connectedUid=null,unsub=null,listenerError="";
function logged(){return !!window.POTE_AUTH?.uid&&auth.currentUser?.uid===window.POTE_AUTH.uid}
function safeData(){return typeof state!=="undefined"&&state?.data?state.data:null}
function readStore(){return safeData()?notificationState(state.data).read:{}}
function currentNotifications(){
 if(!logged()||!safeData())return [];
 return mergeNotifications(messages,state.data.deliveryHub?.orders||[],readStore());
}
function fmt(value){
 return value?new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
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
 $("poteNoticeStatus").textContent=listenerError?"Comunicados indisponíveis: "+listenerError:
 count?count+" não lida(s)":"Tudo lido";
 $("poteNoticeList").innerHTML=items.length?items.map(x=>
  '<article class="pote-notice-item '+(x.unread?"unread ":"")+'priority-'+esc(x.priority)+'" data-notice-id="'+esc(x.id)+'">'+
  '<div class="pote-notice-head"><strong>'+esc(x.title)+'</strong><small>'+esc(fmt(x.at))+'</small></div>'+
  '<p>'+esc(x.body)+'</p><div class="pote-notice-actions"><span>'+esc(x.source)+'</span>'+
  (x.unread?'<button type="button" data-notice-read="'+esc(x.id)+'">Marcar como lida</button>':'<span class="read-tag">✓ Lida</span>')+
  (x.kind==="order"?'<button type="button" data-notice-open="'+esc(x.id)+'">Abrir Hub</button>':
   x.href?'<a target="_blank" rel="noopener noreferrer" href="'+esc(x.href)+'">Ver mensagem</a>':"")+
  '</div></article>').join(""):
  '<p class="pote-notice-empty">Nenhuma notificação. Pedidos importados e comunicados aparecerão aqui.</p>';
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
 if(!logged())return;
 const show=typeof force==="boolean"?force:drawer.hidden;
 drawer.hidden=!show;
 bell.setAttribute("aria-expanded",String(show));
 paint();
}
function disconnect(){
 if(unsub){unsub();unsub=null}
 connectedUid=null;messages=[];items=[];listenerError="";toggle(false);
 root.hidden=true;
 bell.classList.remove("has-unread");
 $("poteNoticeCount").hidden=true;
}
function connect(){
 if(!logged()||!safeData()){disconnect();return}
 const uid=window.POTE_AUTH.uid;
 if(connectedUid===uid){paint();return}
 if(unsub){unsub();unsub=null}
 connectedUid=uid;messages=[];listenerError="";root.hidden=false;paint();
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
 const open=event.target.closest("[data-notice-open]");
 if(open){mark(open.dataset.noticeOpen);toggle(false);if(typeof go==="function")go("deliveryhub");}
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!drawer.hidden)toggle(false)});
window.addEventListener("pote:user-ready",connect);
window.addEventListener("pote:user-logout",disconnect);
window.addEventListener("pote:changed",paint);
window.addEventListener("pote:notice-update",paint);
window.POTE_NOTIFY={refresh:paint,open:()=>toggle(true),close:()=>toggle(false),
 mark,markAll,get unread(){return unreadCount(currentNotifications())},
 get count(){return currentNotifications().length}};
if(logged())connect();
