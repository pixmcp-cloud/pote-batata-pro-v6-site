import {getApp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth,getIdTokenResult} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,doc,getDocs,getDoc,writeBatch,serverTimestamp,Timestamp,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {LICENSE_TERMS,resolveLicense,expiryForTerm,dateBR,epochMillis} from "./license_terms.mjs?v=plans-20261115";

const auth=getAuth(getApp()),db=getFirestore(getApp());
const btn=document.getElementById("poteAdminOpen");
if(!btn)throw Error("Botão administrativo não encontrado no cabeçalho");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
const markup=`<div id="poteAdmOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="poteAdmTitle">
  <section class="pote-adm-shell">
   <header class="pote-adm-head"><div><small>CONTROLE EXCLUSIVO • CONTA MESTRE</small><h2 id="poteAdmTitle">Central Administrativa</h2><p>Cadastros Google, licenças, prazos e histórico de concessões.</p></div><button id="poteAdmClose" aria-label="Fechar administração" type="button">✕</button></header>
   <div class="pote-adm-scroll">
    <div class="pote-adm-stats" id="poteAdmStats" aria-live="polite"></div>
    <div class="pote-adm-toolbar"><input id="poteAdmSearch" type="search" placeholder="Buscar por e-mail, nome ou UID..." aria-label="Buscar usuários"><select id="poteAdmFilter" aria-label="Filtrar por plano"><option value="all">Todos os cadastros</option><option value="free">Somente FREE</option><option value="trial">Testes ativos</option><option value="pro">PRO ativos</option><option value="lifetime">Vitalícios</option><option value="expired">Vencidos</option></select><button id="poteAdmReload" type="button">Atualizar lista</button></div>
    <div class="pote-adm-columns">
     <section class="pote-adm-list"><div class="pote-adm-section-head"><h3>Contas cadastradas</h3><span id="poteAdmFound"></span></div><div id="poteAdmUsers" class="pote-adm-users" role="listbox" aria-label="Selecione uma conta"></div></section>
     <section class="pote-adm-editor"><h3>Promover ou renovar</h3><div id="poteAdmSelected" class="pote-adm-selected">Selecione uma conta na lista.</div>
      <label class="pote-adm-label">Licença e duração<select id="poteAdmTerm" aria-label="Modalidade da licença">${LICENSE_TERMS.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join("")}</select></label>
      <p id="poteAdmPreview" class="pote-adm-preview"></p>
      <div class="pote-adm-controls"><button id="poteAdmGrant" type="button" disabled>Promover / renovar</button><button id="poteAdmRevoke" type="button" disabled>Revogar → FREE</button></div>
      <p class="pote-adm-footnote">FREE não vence. O teste de 24 horas começa na concessão; o PRO tem opções de 1, 6 ou 12 meses; a vitalícia não vence. Licenças vencidas retornam a FREE na verificação de acesso.</p>
      <div id="poteAdmFeedback" role="status" aria-live="polite"></div>
     </section>
    </div>
    <section class="pote-adm-audit"><div class="pote-adm-section-head"><h3>Histórico de alterações</h3><button id="poteAdmAuditReload" type="button">Recarregar</button></div><div id="poteAdmAudit"></div></section>
   </div>
  </section>
 </div>`;
document.body.insertAdjacentHTML("beforeend",markup);
const overlay=$("poteAdmOverlay");
const today=()=>Date.now();
let entries=[],selection=null,busy=false,loading=false;
const current=()=>entries.find(x=>x.uid===selection);
const expires=v=>{if(!v)return "Sem vencimento";return dateBR(v)};
function selectionReady(){
 const user=current(),allowed=!!user&&user.uid!==auth.currentUser?.uid;
 $("poteAdmGrant").disabled=!allowed||busy;
 $("poteAdmRevoke").disabled=!allowed||busy;
 $("poteAdmSelected").innerHTML=user?
  `<strong>${esc(user.displayName||user.email||"Sem nome")}</strong><small>${esc(user.email||user.uid)}</small><span>${esc(resolveLicense(user.license,today()).label)} · ${esc(user.license?.term||"free")}</span>`:
  "Selecione uma conta na lista.";
 preview();
}
function preview(){
 const term=$("poteAdmTerm").value,u=current(),now=new Date();
 const start=u?.license?.status==="active"&&resolveLicense(u.license,now.getTime()).active?epochMillis(u.license.expiresAt):null;
 const anchor=term==="lifetime"?now:new Date(Math.max(now.getTime(),start||0));
 const end=expiryForTerm(term,anchor);
 $("poteAdmPreview").textContent=end?"Previsão de término: "+expires(end)+(start&&start>now.getTime()?" (renovação somada ao prazo atual)":""):"Sem vencimento: acesso vitalício";
}
function fmtDate(input){return input?dateBR(input):"—"}
function render(){
 const now=today();
 const stats={total:entries.length,free:0,trial:0,pro:0,lifetime:0,expired:0};
 for(const u of entries){
  if(String(u.email||"").toLowerCase()==="pixmcp@gmail.com")continue;
  const l=resolveLicense(u.license,now);
  if(l.reason==="expired")stats.expired++;
  if(l.active)stats[l.kind]++;else stats.free++;
 }
 $("poteAdmStats").innerHTML=[
  ["Cadastros",stats.total],["FREE",stats.free],["Teste ativo",stats.trial],["PRO ativo",stats.pro],["Vitalício",stats.lifetime],["Vencidos",stats.expired]
 ].map(([label,n])=>`<div><small>${label}</small><strong>${n}</strong></div>`).join("");
 const filter=$("poteAdmFilter").value,q=$("poteAdmSearch").value.trim().toLowerCase();
 const matched=entries.filter(u=>{
  const plan=resolveLicense(u.license,now);
  const ok=filter==="all"||(filter==="expired"?plan.reason==="expired":filter==="free"?plan.kind==="free":plan.kind===filter);
  return ok&&[u.email,u.displayName,u.uid].some(v=>String(v||"").toLowerCase().includes(q));
 });
 $("poteAdmFound").textContent=matched.length+" exibido(s)";
 $("poteAdmUsers").innerHTML=matched.length?matched.map(u=>{
  const l=resolveLicense(u.license,now),selected=u.uid===selection;
  const isSelf=u.uid===auth.currentUser?.uid;
  const name=u.displayName||u.email||"Usuário Google",meta=isSelf?"Administrador mestre":l.expiresAt?"Vence em "+expires(l.expiresAt):"Sem vencimento";
  return `<button type="button" data-uid="${esc(u.uid)}" class="pote-adm-user${selected?" selected":""}" role="option" aria-selected="${selected}" ${isSelf?'title="Conta administradora — somente consulta"':''}>
   <span class="pote-adm-user-identity"><strong>${esc(name)}</strong><small>${esc(u.email||u.uid)}</small><small>${esc(fmtDate(u.createdAt))} · ${esc(meta)}</small></span>
   <span class="pote-adm-user-plan" data-plan="${esc(l.kind)}">${isSelf?"ADM MESTRE":esc(l.label)}</span></button>`;
 }).join(""):'<p class="pote-adm-empty">Nenhuma conta encontrada para este filtro.</p>';
 selectionReady();
}
function status(msg,isError=false){
 $("poteAdmFeedback").textContent=msg;
 $("poteAdmFeedback").classList.toggle("error",isError);
}
async function assertAdmin(){
 const user=auth.currentUser;
 if(!user||user.email?.trim().toLowerCase()!=="pixmcp@gmail.com")throw Error("Acesso restrito à conta mestre");
 const token=await getIdTokenResult(user,true);
 if(token.claims.email_verified!==true||token.signInProvider!=="google.com")throw Error("Conta Google não verificada");
 return user;
}
function setBusy(v){busy=v;selectionReady();$("poteAdmReload").disabled=v;$("poteAdmAuditReload").disabled=v;}
async function loadUsers(){
 if(loading)return;loading=true;status("Consultando cadastros...");$("poteAdmUsers").innerHTML='<p class="pote-adm-empty">Carregando contas do Firestore...</p>';
 try{
  await assertAdmin();
  const records=await getDocs(collection(db,"users"));
  entries=records.docs.map(d=>({uid:d.id,...d.data()})).sort((a,b)=>(epochMillis(b.createdAt)||0)-(epochMillis(a.createdAt)||0));
  if(selection&&!entries.some(x=>x.uid===selection))selection=null;
  render();status("Lista atualizada. Exibindo cadastros que já acessaram o Firebase.");
 }catch(e){entries=[];selection=null;render();status("Falha ao consultar usuários: "+(e.code||e.message),true)}
 finally{loading=false}
}
async function loadAudit(){
 $("poteAdmAudit").textContent="Carregando histórico...";
 try{
  await assertAdmin();
  const records=await getDocs(query(collection(db,"licenseAudit"),orderBy("at","desc"),limit(30)));
  $("poteAdmAudit").innerHTML=records.empty?'<p class="pote-adm-empty">Nenhuma licença concedida nesta central.</p>':
   records.docs.map(d=>{const a=d.data();return `<div class="pote-adm-event"><span>${esc(fmtDate(a.at))}</span><strong>${esc(a.targetEmail||a.targetUid)}</strong><span>${esc(a.fromTerm||"free")} → ${esc(a.toTerm||"free")}</span><small>${esc(a.action||"alteração")}</small></div>`}).join("");
 }catch(e){$("poteAdmAudit").textContent="Histórico indisponível: "+(e.code||e.message)}
}
async function changeLicense(revoke=false){
 const u=current();if(!u||u.uid===auth.currentUser?.uid)return;
 if(busy)return;
 const term=revoke?"free":$("poteAdmTerm").value;
 const option=LICENSE_TERMS.find(x=>x.id===term);
 if(!revoke&&!option){status("Escolha um prazo válido.",true);return}
 const previous=resolveLicense(u.license,today());
 const now=new Date();
 const start=previous.active?Math.max(now.getTime(),epochMillis(u.license?.expiresAt)||0):now.getTime();
 const end=revoke||term==="lifetime"?null:expiryForTerm(term,new Date(start));
 const title=revoke?"REVOGAR o acesso PRO":"CONCEDER / RENOVAR "+option.label;
 const expiryText=end?" até "+expires(end):" sem vencimento";
 if(!confirm(title+" para "+(u.email||u.uid)+"?"+(revoke?" A conta continuará FREE.":expiryText)))return;
 setBusy(true);status("Gravando alteração com autenticação administrativa...");
 try{
  const actor=await assertAdmin();
  const latest=await getDoc(doc(db,"users",u.uid));
  if(!latest.exists())throw Error("O cadastro não existe mais no banco");
  const realPrevious=resolveLicense(latest.data()?.license,today());
  const anchor=realPrevious.active?Math.max(Date.now(),epochMillis(latest.data().license?.expiresAt)||0):Date.now();
  const finalEnd=revoke||term==="lifetime"?null:expiryForTerm(term,new Date(anchor));
  const license={kind:revoke?"free":option.kind,term,status:revoke?"revoked":"active",startsAt:serverTimestamp(),
    expiresAt:finalEnd?Timestamp.fromDate(finalEnd):null,grantedByUid:actor.uid,grantedByEmail:actor.email,
    changedAt:serverTimestamp()};
  const batch=writeBatch(db);
  batch.update(doc(db,"users",u.uid),{license,updatedAt:serverTimestamp()});
  const event=doc(collection(db,"licenseAudit"));
  batch.set(event,{action:revoke?"revogar":realPrevious.active?"renovar":"promover",at:serverTimestamp(),
    actorUid:actor.uid,actorEmail:actor.email,targetUid:u.uid,targetEmail:u.email||"",
    fromTerm:latest.data().license?.term||"free",toTerm:term,expiresAt:finalEnd?Timestamp.fromDate(finalEnd):null});
  await batch.commit();
  status("Licença atualizada e registrada no histórico.");
  await Promise.all([loadUsers(),loadAudit()]);
 }catch(e){status("Alteração não foi concluída: "+(e.code||e.message),true)}
 finally{setBusy(false)}
}
async function open(){
 try{await assertAdmin()}catch(e){alert(e.message);return}
 overlay.hidden=false;
 document.documentElement.classList.add("pote-admin-open");
 $("poteAdmSearch").value="";
 $("poteAdmFilter").value="all";
 await Promise.all([loadUsers(),loadAudit()]);
}
function close(){overlay.hidden=true;document.documentElement.classList.remove("pote-admin-open")}
btn.addEventListener("click",open);
$("poteAdmClose").addEventListener("click",close);
overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close()});
$("poteAdmReload").addEventListener("click",loadUsers);
$("poteAdmAuditReload").addEventListener("click",loadAudit);
$("poteAdmUsers").addEventListener("click",e=>{
 const target=e.target.closest("[data-uid]");if(!target)return;selection=target.dataset.uid;render();
});
$("poteAdmSearch").addEventListener("input",render);
$("poteAdmFilter").addEventListener("change",render);
$("poteAdmTerm").addEventListener("change",preview);
$("poteAdmGrant").addEventListener("click",()=>changeLicense(false));
$("poteAdmRevoke").addEventListener("click",()=>changeLicense(true));
window.POTE_ADMIN={open};
