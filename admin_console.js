import {getApp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth,getIdTokenResult} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,doc,getDocs,getDoc,writeBatch,serverTimestamp,Timestamp,query,orderBy,limit,where,startAfter} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {LICENSE_TERMS,resolveLicense,expiryForTerm,dateBR,epochMillis,licenseCountdown} from "./license_terms.mjs?v=plans-20261115-years";
import {computeFranchiseFinances} from "./franchise_financial_report.mjs?v=finance-brazil-20261118";
import {manualLicensePayment} from "./manual_receipt.mjs?v=pilot-10-20261118";

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
    <div class="pote-adm-toolbar"><input id="poteAdmSearch" type="search" placeholder="Buscar por e-mail, nome ou UID..." aria-label="Buscar usuários"><select id="poteAdmFilter" aria-label="Filtrar por plano"><option value="all">Todos os cadastros</option><option value="free">Somente FREE</option><option value="trial">Testes ativos</option><option value="pro">PRO ativos</option><option value="lifetime">Vitalícios</option><option value="franchise">Franquias</option><option value="expired">Vencidos</option></select><button id="poteAdmReload" type="button">Atualizar lista</button></div>
    <div class="pote-adm-columns">
     <section class="pote-adm-list"><div class="pote-adm-section-head"><h3>Contas cadastradas</h3><span id="poteAdmFound"></span></div><div id="poteAdmUsers" class="pote-adm-users" role="listbox" aria-label="Selecione uma conta"></div></section>
     <section class="pote-adm-editor"><h3>Promover ou renovar</h3><div id="poteAdmSelected" class="pote-adm-selected">Selecione uma conta na lista.</div><div id="poteAdmCountdown" class="pote-adm-countdown" data-state="free"><small id="poteAdmCountdownLabel">TEMPO PARA VOLTAR AO FREE</small><strong id="poteAdmCountdownTime" role="timer">--a --d --h --m --s</strong><span id="poteAdmCountdownHint">Selecione uma conta com licença ativa.</span></div>
      <label class="pote-adm-label">Licença e duração<select id="poteAdmTerm" aria-label="Modalidade da licença">${LICENSE_TERMS.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join("")}</select></label>
      <p id="poteAdmPreview" class="pote-adm-preview"></p>
      <section id="poteAdmPaymentPanel" class="pote-adm-payment" hidden>
       <strong>Recebimento da assinatura</strong>
       <p>Confira o Pix no banco. A plataforma não consulta o extrato automaticamente.</p>
       <label class="pote-adm-label">Modalidade<select id="poteAdmPaymentMode">
        <option value="pix_manual">Pix conferido no extrato</option>
        <option value="courtesy">Cortesia sem receita</option>
       </select></label>
       <label class="pote-adm-label">Valor recebido em R$ (somente Pix)
        <input id="poteAdmPaymentAmount" type="text" inputmode="decimal" maxlength="12" placeholder="Ex.: 39,90">
       </label>
       <label class="pote-adm-label">Referência Pix ou motivo da cortesia
        <input id="poteAdmPaymentRef" type="text" maxlength="120" placeholder="Código Pix ou justificativa">
       </label>
       <label class="pote-adm-payment-confirm"><input type="checkbox" id="poteAdmPaymentVerified"> Conferi o Pix no banco ou autorizei esta cortesia.</label>
      </section>
      <div class="pote-adm-controls"><button id="poteAdmGrant" type="button" disabled>Promover / renovar</button><button id="poteAdmRevoke" type="button" disabled>Revogar → FREE</button></div>
      <section class="pote-adm-franchise">
        <div class="pote-adm-franchise-head"><strong>Franquia Potê Batata</strong><span id="poteAdmFranchiseStatus">Selecione uma conta</span></div>
        <p>Ative para liberar a marca original, as fotos oficiais e a atualização automática dos sabores cadastrados pela matriz. Cada unidade mantém seus próprios clientes, estoque, vendas e custos.</p>
        <div class="pote-adm-controls">
          <button type="button" id="poteAdmFranchiseActivate" disabled>Transformar em franquia</button>
          <button type="button" id="poteAdmFranchiseRevoke" disabled>Revogar franquia</button>
          <button type="button" id="poteAdmFranchiseReport" disabled>Relatório</button>
        </div>
      </section>
      <section id="poteAdmFinancialPanel" class="pote-adm-financial-panel" hidden aria-live="polite">
        <div class="pote-adm-financial-header"><h3>Desempenho da franquia</h3>
        <button type="button" id="poteAdmFinancialClose">Fechar</button></div>
        <p id="poteAdmFinancialName" class="pote-adm-financial-muted"></p>
        <div class="pote-adm-financial-tabs"><button type="button" data-financial-days="7" aria-pressed="true">Semanal</button><button type="button" data-financial-days="30" aria-pressed="false">Mensal</button></div>
        <p id="poteAdmFinancialStatus" role="status">Selecione uma franquia.</p>
        <div id="poteAdmFinancialMetrics"></div>
        <div id="poteAdmFinancialChart"></div>
        <div id="poteAdmFinancialTender"></div>
        <p class="pote-adm-financial-muted">Resultados estimados, não representam conciliação bancária. Custos simulados não são despesas reais. Confira recebimentos e comprovantes.</p>
      </section>
      <p class="pote-adm-footnote">FREE não vence. O teste de 24 horas começa na concessão; o PRO tem opções de 1, 6 ou 12 meses; a vitalícia não vence. Licenças vencidas retornam a FREE na verificação de acesso.</p>
      <div id="poteAdmFeedback" role="status" aria-live="polite"></div>
     </section>
    </div>
    <section class="pote-adm-audit"><div class="pote-adm-section-head"><h3>Histórico de franquias</h3><button id="poteAdmFranchiseAuditReload" type="button">Recarregar</button></div><div id="poteAdmFranchiseAudit"></div></section>
    <section class="pote-adm-audit"><div class="pote-adm-section-head"><h3>Histórico de alterações</h3><button id="poteAdmAuditReload" type="button">Recarregar</button></div><div id="poteAdmAudit"></div></section>
   </div>
  </section>
 </div>`;
document.body.insertAdjacentHTML("beforeend",markup);
const overlay=$("poteAdmOverlay");
const today=()=>Date.now();
let entries=[],selection=null,busy=false,loading=false,clockTimer=null,previousClockState=null;
let financialDays=7,financialUid=null,financialVersion=0,financialRecords=null;
const current=()=>entries.find(x=>x.uid===selection);
const expires=v=>{if(!v)return "Sem vencimento";return dateBR(v)};
function selectionReady(){
 const user=current(),allowed=!!user&&user.uid!==auth.currentUser?.uid;
 $("poteAdmGrant").disabled=!allowed||busy;
 $("poteAdmRevoke").disabled=!allowed||busy;
 const isFranchise=user?.franchise?.status==="active"&&user.franchise.brandId==="potebatata";
 $("poteAdmFranchiseActivate").disabled=!allowed||busy||isFranchise;
 $("poteAdmFranchiseRevoke").disabled=!allowed||busy||!isFranchise;
 $("poteAdmFranchiseReport").disabled=!allowed||busy||!isFranchise;
 $("poteAdmFranchiseStatus").textContent=isFranchise?"Franquia ativa":"Não é franquia";
 $("poteAdmSelected").innerHTML=user?
  `<strong>${esc(user.displayName||user.email||"Sem nome")}</strong><small>${esc(user.email||user.uid)}</small><span>${esc(isFranchise?"FRANQUIA POTÊ BATATA":resolveLicense(user.license,today()).label)} · ${esc(user.license?.term||"free")}</span>`:
  "Selecione uma conta na lista.";
 preview();
 refreshCountdown();
 window.POTE_ADMIN_PERMISSIONS?.renderAccount?.(user);
}
function resetPaymentForm(){
 $("poteAdmPaymentAmount").value="";$("poteAdmPaymentRef").value="";
 $("poteAdmPaymentVerified").checked=false;
}
function preview(){
 const selectedTerm=LICENSE_TERMS.find(x=>x.id===$("poteAdmTerm").value);
 $("poteAdmPaymentPanel").hidden=!current()||!["pro","lifetime"].includes(selectedTerm?.kind);
 const term=$("poteAdmTerm").value,u=current(),now=new Date();
 const start=u?.license?.status==="active"&&resolveLicense(u.license,now.getTime()).active?epochMillis(u.license.expiresAt):null;
 const anchor=term==="lifetime"?now:new Date(Math.max(now.getTime(),start||0));
 const end=expiryForTerm(term,anchor);
 $("poteAdmPreview").textContent=end?"Previsão de término: "+expires(end)+(start&&start>now.getTime()?" (renovação somada ao prazo atual)":""):"Sem vencimento: acesso vitalício";
}
function refreshCountdown(){
 const widget=$("poteAdmCountdown"),user=current();
 const remaining=licenseCountdown(user?.license,Date.now());
 widget.dataset.state=remaining.state;
 $("poteAdmCountdownLabel").textContent=remaining.state==="active"?"TEMPO RESTANTE PARA VOLTAR AO FREE":"STATUS DA LICENÇA";
 $("poteAdmCountdownTime").textContent=user?remaining.formatted:"--a --d --h --m --s";
 $("poteAdmCountdownHint").textContent=user?remaining.description:"Selecione uma conta cadastrada.";
 document.querySelectorAll("[data-remaining-uid]").forEach(el=>{
  const account=entries.find(x=>x.uid===el.getAttribute("data-remaining-uid"));
  if(!account)return;
  const clock=licenseCountdown(account.license,Date.now());
  el.textContent=clock.state==="active"?"Volta ao FREE em "+clock.formatted:
    clock.state==="expired"?"Prazo vencido · FREE":
    clock.state==="lifetime"?"Vitalícia · sem vencimento":"FREE · sem vencimento";
 });
 // Quando um plano vence, os filtros e indicadores também precisam mudar.
 const selectedState=user?remaining.state:"none";
 if(previousClockState!==null && selectedState!==previousClockState && !overlay.hidden){
   previousClockState=selectedState;
   render();
   return;
 }
 previousClockState=selectedState;
}
function fmtDate(input){return input?dateBR(input):"—"}
function render(){
 const now=today();
 const stats={total:entries.length,businesses:0,free:0,trial:0,pro:0,lifetime:0,expired:0,franchise:0};
 for(const u of entries){
  if(String(u.email||"").toLowerCase()==="pixmcp@gmail.com")continue;
  stats.businesses++;
  const l=resolveLicense(u.license,now);
  if(u.franchise?.status==="active"&&u.franchise.brandId==="potebatata")stats.franchise++;
  if(l.reason==="expired")stats.expired++;
  if(u.franchise?.status==="active"&&u.franchise.brandId==="potebatata")continue;
  if(l.active)stats[l.kind]++;else stats.free++;
 }
 $("poteAdmStats").innerHTML=[
  ["Negócios no piloto",stats.businesses+"/10"],["Cadastros",stats.total],["FREE",stats.free],["Teste ativo",stats.trial],["PRO ativo",stats.pro],["Vitalício",stats.lifetime],["Franquias",stats.franchise],["Vencidos",stats.expired]
 ].map(([label,n])=>`<div><small>${label}</small><strong>${n}</strong></div>`).join("");
 const filter=$("poteAdmFilter").value,q=$("poteAdmSearch").value.trim().toLowerCase();
 const matched=entries.filter(u=>{
  const plan=resolveLicense(u.license,now);
  const ok=filter==="all"||(filter==="franchise"?u.franchise?.status==="active"&&u.franchise.brandId==="potebatata":filter==="expired"?plan.reason==="expired":filter==="free"?plan.kind==="free"&&u.franchise?.status!=="active":plan.kind===filter);
  return ok&&[u.email,u.displayName,u.uid].some(v=>String(v||"").toLowerCase().includes(q));
 });
 $("poteAdmFound").textContent=matched.length+" exibido(s)";
 $("poteAdmUsers").innerHTML=matched.length?matched.map(u=>{
  const l=resolveLicense(u.license,now),selected=u.uid===selection;
  const isSelf=u.uid===auth.currentUser?.uid;
  const name=u.displayName||u.email||"Usuário Google",meta=isSelf?"Administrador mestre":u.franchise?.status==="active"?"Franquia Potê Batata · acesso oficial":l.expiresAt?"Vence em "+expires(l.expiresAt):"Sem vencimento";
  return `<button type="button" data-uid="${esc(u.uid)}" class="pote-adm-user${selected?" selected":""}" role="option" aria-selected="${selected}" ${isSelf?'title="Conta administradora — somente consulta"':''}>
   <span class="pote-adm-user-identity"><strong>${esc(name)}</strong><small>${esc(u.email||u.uid)}</small><small>${esc(fmtDate(u.createdAt))} · ${esc(meta)}</small><small class="pote-adm-timer-row" data-remaining-uid="${esc(u.uid)}"></small></span>
   <span class="pote-adm-user-plan" data-plan="${esc(u.franchise?.status==="active"?"franchise":l.kind)}">${isSelf?"ADM MESTRE":u.franchise?.status==="active"?"FRANQUIA":esc(l.label)}</span></button>`;
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
 if(token.claims.email_verified!==true||token.signInProvider!=="google.com"||token.claims.potebatataAdmin!==true)throw Error("Conta Google ou autorização administrativa não verificada");
 return user;
}
function setBusy(v){busy=v;selectionReady();$("poteAdmReload").disabled=v;$("poteAdmAuditReload").disabled=v;$("poteAdmFranchiseAuditReload").disabled=v;}
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
   records.docs.map(d=>{const a=d.data();const receipt=a.paymentMethod==="pix_manual"?
   " · Pix recebido R$ "+(Number(a.paymentAmountCents)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+
   " · Ref.: "+String(a.paymentReference||""):
   a.paymentMethod==="courtesy"?" · Cortesia (R$ 0,00) · "+String(a.paymentReference||""):
   " · Pagamento não informado no histórico anterior";return `<div class="pote-adm-event"><span>${esc(fmtDate(a.at))}</span><strong>${esc(a.targetEmail||a.targetUid)}</strong><span>${esc(a.fromTerm||"free")} → ${esc(a.toTerm||"free")}</span><small>${esc(a.action||"alteração")}${esc(receipt)}</small></div>`}).join("");
 }catch(e){$("poteAdmAudit").textContent="Histórico indisponível: "+(e.code||e.message)}
}
async function changeLicense(revoke=false){
 const u=current();if(!u||u.uid===auth.currentUser?.uid)return;
 if(busy)return;
 const term=revoke?"free":$("poteAdmTerm").value;
 const option=LICENSE_TERMS.find(x=>x.id===term);
 if(!revoke&&!option){status("Escolha um prazo válido.",true);return}
 let payment=null;
 if(!revoke&&["pro","lifetime"].includes(option?.kind)){
  try{payment=manualLicensePayment({mode:$("poteAdmPaymentMode").value,
   amount:$("poteAdmPaymentAmount").value,
   reference:$("poteAdmPaymentRef").value,
   confirmed:$("poteAdmPaymentVerified").checked});}
  catch(e){status(String(e.message||e),true);return}
 }
 const previous=resolveLicense(u.license,today());
 const now=new Date();
 const start=previous.active?Math.max(now.getTime(),epochMillis(u.license?.expiresAt)||0):now.getTime();
 const end=revoke||term==="lifetime"?null:expiryForTerm(term,new Date(start));
 const title=revoke?"REVOGAR o acesso PRO":"CONCEDER / RENOVAR "+option.label;
 const expiryText=end?" até "+expires(end):" sem vencimento";
 if(!confirm((!revoke&&option.kind==="pro"?"ATENÇÃO: confira o pagamento no banco antes de liberar PRO. O aplicativo não confirma Pix.\n":"")+title+" para "+(u.email||u.uid)+"?"+(revoke?" A conta continuará FREE.":expiryText)))return;
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
    fromTerm:latest.data().license?.term||"free",toTerm:term,expiresAt:finalEnd?Timestamp.fromDate(finalEnd):null,
    ...(payment?{...payment,paymentConfirmedAt:serverTimestamp()}: {})});
  await batch.commit();
  resetPaymentForm();
  status("Licença atualizada e registrada no histórico.");
  await Promise.all([loadUsers(),loadAudit()]);
 }catch(e){status("Alteração não foi concluída: "+(e.code||e.message),true)}
 finally{setBusy(false)}
}
async function loadFranchiseAudit(){
 $("poteAdmFranchiseAudit").textContent="Carregando histórico de franquias...";
 try{
  await assertAdmin();
  const records=await getDocs(query(collection(db,"franchiseAudit"),orderBy("at","desc"),limit(30)));
  $("poteAdmFranchiseAudit").innerHTML=records.empty?
   '<p class="pote-adm-empty">Nenhuma franquia concedida nesta central.</p>':
   records.docs.map(d=>{
    const a=d.data();
    return '<div class="pote-adm-event"><span>'+esc(fmtDate(a.at))+'</span><strong>'+
     esc(a.targetEmail||a.targetUid)+'</strong><span>'+esc(a.brandId||"potebatata")+
     '</span><small>'+esc(a.action||"alteração")+'</small></div>'
   }).join("");
 }catch(e){$("poteAdmFranchiseAudit").textContent="Histórico indisponível: "+(e.code||e.message)}
}
async function changeFranchise(enable){
 const selected=current(),actorId=auth.currentUser?.uid;
 if(!selected||!actorId||selected.uid===actorId||busy)return;
 const active=selected.franchise?.status==="active"&&selected.franchise?.brandId==="potebatata";
 if(enable===active){status(enable?"Esta conta já é franquia.":"Esta conta não tem franquia ativa.",true);return}
 const name=selected.email||selected.uid;
 const prompt=enable?
  "Transformar "+name+" em FRANQUIA OFICIAL POTÊ BATATA? Isso libera logo, fotos oficiais, PRO e os novos sabores automáticos. Vendas, estoque e custos permanecem separados.":
  "REVOGAR a franquia de "+name+"? A conta perde o uso da identidade e dos sabores oficiais sincronizados. As vendas e os registros históricos próprios serão preservados.";
 if(!confirm(prompt))return;
 setBusy(true);status(enable?"Ativando franquia com acesso oficial...":"Revogando acesso à franquia...");
 try{
  const actor=await assertAdmin();
  const ref=doc(db,"users",selected.uid),latest=await getDoc(ref);
  if(!latest.exists())throw Error("Usuário não existe mais");
  if(latest.data().email?.trim().toLowerCase()==="pixmcp@gmail.com")throw Error("A conta mestre não pode ser convertida em franquia");
  const now=serverTimestamp();
  const franchise={
   brandId:"potebatata",status:enable?"active":"revoked",
   grantedByUid:actor.uid,grantedByEmail:actor.email,
   grantedAt:enable?now:(latest.data().franchise?.grantedAt||now),
   changedAt:now
  };
  const batch=writeBatch(db);
  batch.update(ref,{franchise,updatedAt:now});
  batch.set(doc(collection(db,"franchiseAudit")),{
   action:enable?"ativar":"revogar",status:franchise.status,brandId:"potebatata",
   at:now,actorUid:actor.uid,actorEmail:actor.email,
   targetUid:selected.uid,targetEmail:latest.data().email||selected.email||""
  });
  await batch.commit();
  status(enable?"Franquia ativada. A conta receberá automaticamente a marca e o catálogo ao sincronizar.":
    "Franquia revogada. Os registros comerciais próprios foram preservados.");
  closeFranchiseFinance();
  window.POTE_FRANCHISE?.refresh?.();
  await Promise.all([loadUsers(),loadFranchiseAudit()]);
 }catch(e){status("Não foi possível alterar a franquia: "+(e.code||e.message),true)}
 finally{setBusy(false)}
}

const financeBRL=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
async function readFranchiseGroup(uid,group){
 const rows=[],collectionRef=collection(db,"users",uid,"records");
 let cursor=null,hasMore=false;
 for(let page=0;page<8;page++){
  const conditions=[where("record.group","==",group),limit(250)];
  if(cursor)conditions.push(startAfter(cursor));
  const snap=await getDocs(query(collectionRef,...conditions));
  for(const item of snap.docs){
   const entry=item.data()?.record;
   if(entry?.group===group&&entry?.universe==="batataria"&&entry.item)
    rows.push(entry.item);
  }
  if(snap.docs.length<250){hasMore=false;break}
  hasMore=true;cursor=snap.docs.at(-1);
 }
 return {rows,more:hasMore};
}
function renderFranchiseFinance(){
 if(!financialRecords||$("poteAdmFinancialPanel").hidden)return;
 const result=computeFranchiseFinances(financialRecords,financialDays);
 const t=result.totals;
 const box=(label,value)=>'<div><small>'+esc(label)+'</small><strong>'+esc(financeBRL(value))+'</strong></div>';
 $("poteAdmFinancialMetrics").innerHTML='<div class="pote-adm-financial-metrics">'+
  box("Vendas não canceladas",t.sales)+box("Recebimentos registrados",t.received)+
  box("Reembolsos",t.refunds)+box("Recebido líquido registrado",t.netReceived)+
  box("Custos variáveis calculados",t.variableCost)+box("Despesas registradas",t.expenses)+
  box("Resultado estimado",t.estimatedResult)+box("Vendas pendentes",t.pending)+'</div>'+
  '<small>'+t.ordersCount+' pedidos no período · '+t.canceledCount+' cancelados · '+t.expenseCount+' despesas identificadas'+
   (t.estimatedCount?' · '+t.estimatedCount+' com custo simulado':'')+'</small>';
 const maximum=Math.max(1,...result.series.flatMap(x=>[x.sales,x.received,x.expenses]));
 $("poteAdmFinancialChart").innerHTML='<h4>Vendas, recebimentos e despesas por dia</h4>'+
  '<div class="pote-adm-financial-bars">'+result.series.map(x=>
  '<div class="pote-adm-financial-bar" title="'+esc(x.day+' • vendas '+financeBRL(x.sales)+' • recebidos '+financeBRL(x.received)+' • despesas '+financeBRL(x.expenses))+'">'+
   '<div class="pote-adm-financial-columns">'+
    '<span class="sales" style="height:'+Math.round(100*x.sales/maximum)+'%"></span>'+
    '<span class="received" style="height:'+Math.round(100*x.received/maximum)+'%"></span>'+
    '<span class="expenses" style="height:'+Math.round(100*x.expenses/maximum)+'%"></span>'+
   '</div><small>'+esc(x.day.slice(8))+'</small></div>').join("")+'</div>'+
  '<p class="pote-adm-financial-legend">■ Vendas &nbsp; ■ Recebimentos &nbsp; ■ Despesas</p>';
 $("poteAdmFinancialTender").innerHTML='<h4>Recebimentos por meio de pagamento</h4>'+
  '<div class="pote-adm-financial-metrics">'+box("Dinheiro",t.payments.cash)+
   box("Pix",t.payments.pix)+box("Cartão",t.payments.card)+box("Outros",t.payments.other)+'</div>';
 document.querySelectorAll("[data-financial-days]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.financialDays)===financialDays)));
}
async function openFranchiseFinance(){
 const selected=current();
 if(!selected||selected.uid===auth.currentUser?.uid||
   selected.franchise?.status!=="active"||selected.franchise?.brandId!=="potebatata")return;
 const version=++financialVersion;
 const uid=selected.uid;
 financialUid=uid;financialRecords=null;financialDays=7;
 const pane=$("poteAdmFinancialPanel");pane.hidden=false;
 $("poteAdmFinancialName").textContent=selected.displayName||selected.email||"Franquia";
 $("poteAdmFinancialStatus").textContent="Consultando vendas, despesas e recebimentos da unidade...";
 $("poteAdmFinancialMetrics").replaceChildren();$("poteAdmFinancialChart").replaceChildren();
 $("poteAdmFinancialTender").replaceChildren();
 try{
  await assertAdmin();
  const profile=await getDoc(doc(db,"users",uid));
  if(!profile.exists()||profile.data()?.franchise?.status!=="active"||
     profile.data()?.franchise?.brandId!=="potebatata")
   throw Error("Esta unidade não possui franquia Potê Batata ativa");
  const [orders,expenses,cashMovements]=await Promise.all([
   readFranchiseGroup(uid,"orders"),readFranchiseGroup(uid,"expenses"),readFranchiseGroup(uid,"cashMovements")
  ]);
  if(version!==financialVersion||$("poteAdmFinancialPanel").hidden||financialUid!==uid)return;
  financialRecords={orders:orders.rows,expenses:expenses.rows,cashMovements:cashMovements.rows};
  const capped=[orders,expenses,cashMovements].some(x=>x.more);
  $("poteAdmFinancialStatus").textContent=capped?
   "Dados parciais: limite de consulta atingido. Exporte o histórico da unidade para conciliação completa.":
   "Leitura concluída. Consultados apenas os registros desta franquia.";
  renderFranchiseFinance();
 }catch(e){
  if(version===financialVersion)$("poteAdmFinancialStatus").textContent="Relatório indisponível: "+(e.code||e.message);
 }
}
function closeFranchiseFinance(){
 ++financialVersion;financialUid=null;financialRecords=null;
 $("poteAdmFinancialPanel").hidden=true;
}

async function open(){
 closeFranchiseFinance();
 try{await assertAdmin()}catch(e){alert(e.message);return}
 overlay.hidden=false;
 document.documentElement.classList.add("pote-admin-open");
 $("poteAdmSearch").value="";
 $("poteAdmFilter").value="all";
 await Promise.all([loadUsers(),loadAudit(),loadFranchiseAudit()]);
 if(clockTimer!==null)clearInterval(clockTimer);
 clockTimer=setInterval(()=>{if(!overlay.hidden)refreshCountdown()},1000);
 refreshCountdown();
}
function close(){
 closeFranchiseFinance();
 overlay.hidden=true;
 document.documentElement.classList.remove("pote-admin-open");
 if(clockTimer!==null){clearInterval(clockTimer);clockTimer=null;}
 previousClockState=null;
}
btn.addEventListener("click",open);
$("poteAdmClose").addEventListener("click",close);
overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close()});
$("poteAdmReload").addEventListener("click",loadUsers);
$("poteAdmAuditReload").addEventListener("click",loadAudit);
 $("poteAdmFranchiseAuditReload").addEventListener("click",loadFranchiseAudit);
 $("poteAdmFranchiseReport").addEventListener("click",openFranchiseFinance);
 $("poteAdmFinancialClose").addEventListener("click",closeFranchiseFinance);
 document.querySelectorAll("[data-financial-days]").forEach(button=>button.addEventListener("click",()=>{
  financialDays=Number(button.dataset.financialDays);renderFranchiseFinance();
 }));
$("poteAdmFranchiseActivate").addEventListener("click",()=>changeFranchise(true));
$("poteAdmFranchiseRevoke").addEventListener("click",()=>changeFranchise(false));
$("poteAdmUsers").addEventListener("click",e=>{
 const target=e.target.closest("[data-uid]");if(!target)return;selection=target.dataset.uid;resetPaymentForm();closeFranchiseFinance();render();
});
$("poteAdmSearch").addEventListener("input",render);
$("poteAdmFilter").addEventListener("change",render);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!overlay.hidden)refreshCountdown()});
$("poteAdmTerm").addEventListener("change",()=>{resetPaymentForm();preview()});
$("poteAdmPaymentMode").addEventListener("change",()=>{
 $("poteAdmPaymentVerified").checked=false;
 $("poteAdmPaymentAmount").disabled=$("poteAdmPaymentMode").value==="courtesy";
});
$("poteAdmGrant").addEventListener("click",()=>changeLicense(false));
$("poteAdmRevoke").addEventListener("click",()=>changeLicense(true));
window.POTE_ADMIN={open};
