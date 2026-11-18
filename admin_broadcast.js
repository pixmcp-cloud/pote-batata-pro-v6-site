/* ADM broadcast console: Google-verified account; Firestore rules enforce admin-only writes. */
import {getApp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth,getIdTokenResult} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,doc,getDocs,setDoc,updateDoc,query,orderBy,limit,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {validateBroadcast} from "./notification_core.mjs?v=notices-20261116";
const auth=getAuth(getApp()),db=getFirestore(getApp());
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const overlay=document.getElementById("poteAdmOverlay");
if(!overlay)throw Error("Painel ADM indisponível para comunicados.");
const host=overlay.querySelector(".pote-adm-scroll");
if(!host)throw Error("Painel ADM sem área de rolagem.");
const panel=document.createElement("section");panel.id="poteAdmBroadcast";panel.className="pote-adm-broadcast";
panel.innerHTML='<header><div><small>CANAL DIRETO COM CLIENTES</small><h3>📢 Central de Comunicados</h3>'+
 '<p>Envie avisos, novidades e promoções para todas as contas Google. A mensagem aparece no sininho do aplicativo.</p></div></header>'+
 '<div class="pote-broadcast-form"><label>Título<input id="poteBroadcastTitle" placeholder="Ex.: Semana especial PRO" maxlength="110" autocomplete="off"></label>'+
 '<label>Tipo<select id="poteBroadcastType"><option value="info">Informação</option><option value="promo">Promoção</option><option value="urgent">Aviso importante</option></select></label>'+
 '<label class="wide">Mensagem<textarea id="poteBroadcastBody" rows="4" maxlength="700" placeholder="Escreva o comunicado. Informe as condições e prazo de eventuais descontos."></textarea></label>'+
 '<label>Link opcional (HTTPS)<input id="poteBroadcastUrl" type="url" maxlength="350" placeholder="https://..."></label>'+
 '<label>Validade (opcional)<input id="poteBroadcastExpiry" type="date"></label></div>'+
 '<div class="pote-broadcast-actions"><button type="button" id="poteBroadcastSend">Publicar para todas as contas</button>'+
 '<button type="button" id="poteBroadcastReload">Atualizar comunicados</button></div>'+
 '<p id="poteBroadcastStatus" role="status" aria-live="polite">Somente o ADM autenticado pode enviar mensagens.</p>'+
 '<h4>Comunicados recentes</h4><div id="poteBroadcastHistory"></div>';
host.appendChild(panel);
const $=id=>document.getElementById(id);
let busy=false;
const status=(msg,bad=false)=>{const el=$("poteBroadcastStatus");el.textContent=msg;el.classList.toggle("error",bad)};
const fmt=x=>x?.toDate?.()?.toLocaleString("pt-BR")||"";
async function verify(){
 const me=auth.currentUser;
 if(!me||me.uid!==window.POTE_AUTH?.uid||me.email?.toLowerCase()!=="pixmcp@gmail.com"||window.POTE_AUTH.role!=="admin")
  throw Error("Acesso exclusivo da conta ADM.");
 const token=await getIdTokenResult(me,true);
 if(token.claims.email_verified!==true||token.claims.firebase?.sign_in_provider!=="google.com"||token.claims.potebatataAdmin!==true)
  throw Error("Login Google não verificado.");
 return me;
}
async function history(){
 if(overlay.hidden)return;
 const box=$("poteBroadcastHistory");box.textContent="Consultando comunicados...";
 try{
  await verify();
  const docs=await getDocs(query(collection(db,"announcements"),orderBy("createdAt","desc"),limit(12)));
  box.innerHTML=docs.empty?'<p>Nenhum comunicado publicado.</p>':docs.docs.map(d=>{
   const m=d.data(),active=m.active!==false,expired=m.expiresAt?.toDate?.()&&m.expiresAt.toDate().getTime()<Date.now();
   return '<article class="pote-broadcast-entry"><div><strong>'+esc(m.title)+'</strong><small>'+
    esc(fmt(m.createdAt))+' · '+esc(active?(expired?"Expirado":"Publicado"):"Desativado")+'</small></div>'+
    '<p>'+esc(m.body)+'</p>'+
    (active?'<button type="button" data-broadcast-revoke="'+esc(d.id)+'">Desativar comunicado</button>':"")+'</article>';
  }).join("");
 }catch(e){box.textContent="Histórico indisponível: "+(e.code||e.message);status("Verifique o acesso ADM.",true)}
}
async function send(){
 if(busy)return;
 let data;try{data=validateBroadcast({title:$("poteBroadcastTitle").value,body:$("poteBroadcastBody").value,
  type:$("poteBroadcastType").value,url:$("poteBroadcastUrl").value,expiry:$("poteBroadcastExpiry").value})}
 catch(e){status(e.message,true);return}
 if(!confirm("Publicar o comunicado '"+data.title+"' para TODAS as contas do Potê Batata Pro?"))return;
 busy=true;$("poteBroadcastSend").disabled=true;status("Publicando comunicado...");
 try{
  const me=await verify();
  const ref=doc(collection(db,"announcements"));
  await setDoc(ref,{...data,expiresAt:data.expiresAt?Timestamp.fromDate(data.expiresAt):null,
   active:true,createdAt:serverTimestamp(),actorUid:me.uid,actorEmail:me.email});
  $("poteBroadcastTitle").value="";$("poteBroadcastBody").value="";
  $("poteBroadcastUrl").value="";$("poteBroadcastExpiry").value="";
  status("Publicado! Todas as contas autenticadas com o app aberto receberão o comunicado em tempo real.");
  await history();
 }catch(e){status("Não foi possível publicar: "+(e.code||e.message),true)}
 finally{busy=false;$("poteBroadcastSend").disabled=false}
}
async function deactivate(id){
 if(busy||!/^[\w-]{8,200}$/.test(id))return;
 if(!confirm("Desativar este comunicado para todos os clientes?"))return;
 busy=true;status("Desativando...");
 try{await verify();await updateDoc(doc(db,"announcements",id),{active:false,updatedAt:serverTimestamp()});
 status("Comunicado desativado para todos.");await history();
 }catch(e){status("Não foi possível desativar: "+(e.code||e.message),true)}
 finally{busy=false}
}
$("poteBroadcastSend").addEventListener("click",()=>void send());
$("poteBroadcastReload").addEventListener("click",()=>void history());
$("poteBroadcastHistory").addEventListener("click",event=>{
 const button=event.target.closest("[data-broadcast-revoke]");
 if(button)void deactivate(button.dataset.broadcastRevoke);
});
document.getElementById("poteAdminOpen")?.addEventListener("click",()=>void history());
window.POTE_ADMIN_BROADCAST={send,history,deactivate};
