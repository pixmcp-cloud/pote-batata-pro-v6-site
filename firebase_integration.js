import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, serverTimestamp, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {createV2Store} from "./v2_storage.mjs?v=f20-late-atomic-20261118";
import {prepareLegacyMigration,inspectLegacyBackup,migrateLegacyV2} from "./legacy_migration_v2.mjs?v=f10-closed-shifts-20261118";
import {stableJson,matchesRemote,nextRevision,jsonBytes,MAX_APPSTATE_BYTES,pendingKey,makePending,validateBackup,pendingMatchesLoadedState,inspectPendingAgainstCloud} from "./sync_guard.mjs?v=sync-navigation-20261119";
import { resolveLicense, dateBR, licenseCountdown } from "./license_terms.mjs?v=plans-20261115-years";
import {createWorkerBridge} from "./worker_bridge.mjs?v=cf-bridge-staging-20261118";

const firebaseConfig = {
  apiKey: "AIzaSyCG8KCd6LKhYOIH3eLxifoT7IC9k3oMYCk",
  authDomain: "potobatata-b71f3.firebaseapp.com",
  projectId: "potobatata-b71f3",
  appId: "1:947524221002:web:ece242260f26bb46418eb3",
  messagingSenderId: "947524221002",
  storageBucket: "potobatata-b71f3.firebasestorage.app"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: "select_account" });

const gate = document.getElementById("poteAuthGate");
const loginBtn = document.getElementById("poteGoogleLogin");
const exitBtn = document.getElementById("poteExit");
const syncEl = document.getElementById("poteSyncStatus");
const message = document.getElementById("poteLoginMessage");
const browserHint = document.getElementById("poteBrowserHint");
const logged = document.getElementById("poteLoggedAs");
const adminOpen = document.getElementById("poteAdminOpen");
const planBadge = document.getElementById("potePlanBadge");
const planCountdown = document.getElementById("potePlanCountdown");

let active = null;
let saving = false;
let queued = false;
let ready = false;
let timer = null;
let lastJson = "";
let epoch = 0;
let loginWatchdog = null;
let unsubscribeRemote = null;
let unsubscribeProfile = null;
let expiryCheckInterval = null;
let rawUserLicense = null;
let rawUserFranchise = null;
let rawUserAccessPolicy = null;
let cloudFingerprint=stableJson(null);
let syncBlocked=false;
let lastSyncCause=null;
let pendingThisSession=false;
let v2Store=null;
// A versão V2 inicia contas de teste limpas em coleções por registro, sem migrar appState/main.
const useV2=window.POTE_USE_V2!==false;
// Staging-only: enabling the Worker also requires Firebase Rules cutover and
// server credentials. Never toggle via localStorage, query strings or devtools.
const CLOUD_WORKER_ACTIVE=false;
window.POTE_WORKER=createWorkerBridge({
 enabled:CLOUD_WORKER_ACTIVE,
 endpoint:"https://pote-batata-guard-staging.pixmcp.workers.dev",
 getSession:()=>({uid:active?.uid,user:auth.currentUser,ready:ready&&useV2,
  proActive:Boolean(window.POTE_AUTH?.proActive),
  syncBlocked:syncBlocked||saving}),
 flush:async()=>!syncBlocked&&!saving&&ready&&useV2&&await syncV2(),
 refresh:async()=>{
  if(!v2Store||!ready||syncBlocked)throw Error("Sincronização indisponível");
  await v2Store.load();
  lastJson=JSON.stringify(safeState());
  setStatus("Operação confirmada no servidor; estoque sincronizado.");
 }
});
window.POTE_APP_READY=false;
const embeddedBrowser = /; wv[);]|FBAN|FBAV|Instagram|ChatGPT|Line|Messenger/i.test(navigator.userAgent || "");
function showBrowserHint() { if (browserHint) browserHint.hidden = false; }
function withDeadline(promise, ms, label) {
  let timerId;
  const deadline = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error("Tempo esgotado na " + label)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timerId));
}
if (embeddedBrowser) showBrowserHint();

function setStatus(v) { if (syncEl) syncEl.textContent = v; if(syncBlocked)refreshSyncExplanation(); }
function syncExplanation(){
 const pending=active?.uid?existingPending(active.uid):null;
 const originalReason=String(lastSyncCause?.detail||pending?.reason||"Nenhum erro detalhado foi registrado anteriormente").slice(0,180);
 const code=String(lastSyncCause?.code||pending?.reason||"pending-local");
 const comparison=pending&&active?.uid?
  inspectPendingAgainstCloud(pending,active.uid,safeState(),{v2:useV2}):null;
 const differences=comparison?.details||[];
 let title="Alteracoes locais anteriores nao confirmadas";
 if(comparison?.kind==="business-different")title="O backup local difere dos dados da nuvem";
 else if(comparison?.kind==="invalid")title="Backup local invalido ou incompleto";
 else if(/sync\/conflict|conflito|concorrente|alterado em outro/i.test(code+" "+originalReason))
  title="Outra aba ou dispositivo alterou os dados";
 else if(/sync\/invalid-state|schema/i.test(code))title="Inconsistencia nos dados enviados";
 else if(/network|unavailable|offline|deadline/i.test(code))title="Conexao temporariamente indisponivel";
 const cause=(comparison?.kind==="business-different"?
  "Diferencas identificadas: "+differences.join("; ")+". ":"")+
  "Motivo registrado: "+originalReason;
 const action=comparison?.kind==="business-different"?
  "Os registros locais nao coincidem com os dados da nuvem. Baixe e confira o backup antes de liberar o salvamento de pedidos.":
  "Feche as outras abas do aplicativo, confira o backup e recupere a sincronizacao com seguranca.";
 return {title,cause,code,action,comparison:comparison?.kind||"none"};
}
function refreshSyncExplanation(){
 const box=document.getElementById("poteOrderSyncWarning");
 if(!box)return;
 box.hidden=!syncBlocked;
 if(!syncBlocked)return;
 const d=syncExplanation();
 const title=box.querySelector("[data-sync-title]")||box.querySelector("strong");
 const cause=box.querySelector("[data-sync-cause]")||box.querySelector("p");
 const action=box.querySelector("[data-sync-action]");
 if(title)title.textContent=d.title;
 if(cause)cause.textContent=d.cause;
 if(action)action.textContent=d.action;
}
function setMessage(v) { message.textContent = v; }
function setGate(show) {
  gate.hidden = !show;
  document.body.classList.toggle("pote-auth-locked", show);
}
function safeState() { return window.POTE_APP.snapshot(); }
function existingPending(uid){
 try{const raw=localStorage.getItem(pendingKey(uid));return raw?JSON.parse(raw):null}
 catch(e){return null}
}
function showBackupButton(){
 let button=document.getElementById("potePendingSyncBackup");
 if(!button && syncEl?.parentElement){
  button=document.createElement("button");
  button.type="button";
  button.id="potePendingSyncBackup";
  button.textContent="Exportar alterações não sincronizadas";
  button.className="btn mini line";
  button.style.marginLeft="8px";
  button.addEventListener("click",downloadPending);
  syncEl.parentElement.appendChild(button);
 }
 if(button)button.hidden=!active||!existingPending(active.uid)&&!syncBlocked;
 let full=document.getElementById("poteFullAccountBackup");
 if(!full&&syncEl?.parentElement){
  full=document.createElement("button");
  full.type="button";
  full.id="poteFullAccountBackup";
  full.textContent="Backup completo";
  full.title="Baixa um JSON com dados comerciais privados. Guarde o arquivo em local seguro.";
  full.className="btn mini line";
  full.style.marginLeft="8px";
  full.addEventListener("click",downloadPending);
  syncEl.parentElement.appendChild(full);
 }
 if(full)full.hidden=!active;
 let recovery=document.getElementById("poteSyncResolve");
 if(!recovery&&syncEl?.parentElement){
  recovery=document.createElement("button");
  recovery.type="button";
  recovery.id="poteSyncResolve";
  recovery.textContent="Resolver conflito";
  recovery.title="Exporta as alterações pendentes e recarrega os dados atuais da nuvem.";
  recovery.className="btn mini line";
  recovery.style.marginLeft="8px";
  recovery.addEventListener("click",resolvePendingConflict);
  syncEl.parentElement.appendChild(recovery);
 }
 if(recovery)recovery.hidden=!active||!syncBlocked;
}
async function resolvePendingConflict(){
 if(!active||!syncBlocked)return false;
 const uid=active.uid;
 const backup=existingPending(uid);
 const expected=backup?.state||safeState();
 // Never discard a pending order on the strength of the download click alone.
 try{downloadPending()}catch(error){
  setStatus("Falha ao exportar backup. Conflito preservado.");return false;
 }
 setStatus("Confirme seu backup: selecione o arquivo JSON que acabou de baixar.");
 const checked=await verifyBackupFile(uid,expected);
 if(!checked?.ok){
  setStatus("Conflito preservado: "+String(checked?.error||"backup não verificado"));
  return false;
 }
 if(active?.uid!==uid||auth.currentUser?.uid!==uid||!syncBlocked||
  stableJson(existingPending(uid)?.state||safeState())!==stableJson(expected)){
  setStatus("A conta ou o backup mudou. Conflito preservado.");
  return false;
 }
 if(!window.confirm("Backup verificado ("+checked.fileName+"). Recarregar os dados da nuvem? As alterações locais pendentes ficarão somente no arquivo JSON. Confirme que encerrou as outras abas do Potê Batata."))return false;
 try{localStorage.removeItem(pendingKey(uid))}catch(error){
  setStatus("Não foi possível liberar o backup pendente.");return false;
 }
 ready=false;
 syncBlocked=false;
 pendingThisSession=false;
 window.location.reload();
 return true;
}
function savePending(serialized,reason){
 if(!active?.uid)return;
 // Não sobrescrever o único backup de uma sessão anterior com o estado atual do servidor.
 if(existingPending(active.uid)&&!pendingThisSession){showBackupButton();return}
 try{
  const value=JSON.parse(serialized);
  localStorage.setItem(pendingKey(active.uid),JSON.stringify(makePending(active.uid,value,reason)));
  pendingThisSession=true;
 }catch(error){
  console.warn("Backup local pendente indisponível:",error.message||error);
  setStatus("Falha de backup local: exporte o JSON da conta antes de sair.");
 }
 showBackupButton();
}
function downloadPending(){
 const pending=active?.uid?existingPending(active.uid):null;
 const value=pending?.state||safeState();
 const blob=new Blob([JSON.stringify({
  backupVersion:1,exportedAt:new Date().toISOString(),
  uid:active?.uid||"",reason:pending?.reason||"manual",state:value
 },null,2)],{type:"application/json"});
 const href=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=href;a.download="pote-backup-pendente-"+new Date().toISOString().slice(0,10)+".json";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(href),10000);
}
function verifyBackupFile(expectedUid,expectedState){
 // Must select the downloaded file from the device: requesting a download alone
 // is not evidence that the browser actually stored a recoverable backup.
 if(!expectedUid||!expectedState||auth.currentUser?.uid!==expectedUid)
  return Promise.resolve({ok:false,error:"Conta mudou durante a verificação."});
 const picker=document.createElement("input");
 picker.type="file";picker.accept=".json,application/json";picker.style.display="none";
 document.body.appendChild(picker);
 return new Promise(resolve=>{
  let settled=false;
  const finish=result=>{
   if(settled)return;
   settled=true;picker.remove();resolve(result);
  };
  picker.addEventListener("change",async()=>{
   const file=picker.files?.[0];
   if(!file)return finish({ok:false,error:"Nenhum arquivo selecionado."});
   if(file.size>30*1024*1024)return finish({ok:false,error:"Arquivo de backup maior que o limite de verificação."});
   try{
    const content=JSON.parse(await file.text());
    if(content.backupVersion!==1||content.uid!==expectedUid)
     throw Error("Arquivo pertence a outra conta ou possui versão inválida.");
    const validity=validateBackup(content.state);
    if(!validity.ok)throw Error(validity.error||"Backup incompleto.");
    if(stableJson(content.state)!==stableJson(expectedState))
     throw Error("Arquivo não corresponde exatamente ao estado atual da conta.");
    if(auth.currentUser?.uid!==expectedUid)
     throw Error("Conta alterada durante a verificação.");
    finish({ok:true,counts:validity.counts,fileName:file.name});
   }catch(error){finish({ok:false,error:String(error.message||error).slice(0,160)})}
  },{once:true});
  picker.addEventListener("cancel",()=>finish({ok:false,error:"Seleção cancelada."}),{once:true});
  try{picker.click()}catch(error){finish({ok:false,error:"Navegador bloqueou a seleção do arquivo."})}
 });
}
function showRecovery(){
 if(!syncBlocked)return;
 showBackupButton();refreshSyncExplanation();
 const orderNotice=document.getElementById("poteOrderSyncWarning");
 if(orderNotice){orderNotice.hidden=false;}
 const target=orderNotice||document.getElementById("poteSyncResolve")||
  document.getElementById("potePendingSyncBackup")||syncEl;
 if(target){target.scrollIntoView?.({behavior:"smooth",block:"center"});target.focus?.({preventScroll:true})}
}
window.POTE_SYNC_GUARD={downloadPending,verifyBackupFile,resolvePendingConflict,showRecovery,diagnosis:syncExplanation,get blocked(){return syncBlocked},hasPending:()=>Boolean(active&&existingPending(active.uid))};
async function offerLegacyMigration(user){
 if(!user?.uid||auth.currentUser?.uid!==user.uid)return;
 let container=document.getElementById("poteLegacyMigration");
 if(!container){
  container=document.createElement("div");container.id="poteLegacyMigration";
  container.style.cssText="margin:14px auto;padding:16px;border:1px solid #e0b97a;border-radius:12px;background:#152d46;color:#f3e6d0;max-width:520px";
  const head=document.createElement("strong");head.textContent="Recuperação segura da conta antiga (V1 → V2)";
  const info=document.createElement("p");info.textContent="O histórico V1 será mantido. Primeiro exporte o backup; depois selecione o arquivo salvo para verificar e migrar. Não feche a página enquanto houver transferência.";
  const exportBtn=document.createElement("button");exportBtn.type="button";exportBtn.textContent="1. Baixar backup V1";
  const importBtn=document.createElement("button");importBtn.type="button";importBtn.textContent="2. Verificar arquivo e migrar";
  exportBtn.style.margin="6px";importBtn.style.margin="6px";
  const state=document.createElement("p");state.setAttribute?.("role","status");
  container.append(head,info,exportBtn,importBtn,state);
  (gate||document.body).appendChild(container);
  const getPlan=async()=>{
   const source=await getDoc(doc(db,"users",auth.currentUser.uid,"appState","main"));
   if(!source.exists()||!source.data()?.state)throw Error("Histórico V1 não encontrado.");
   const planned=await prepareLegacyMigration(source.data().state,{free:false});
   // O histórico V1 deve migrar integralmente, inclusive cadastros anteriores
   // aos limites FREE. A política de edição FREE continua aplicada após a cópia.
   return planned;
  };
  exportBtn.onclick=async()=>{
   try{
    state.textContent="Conferindo a integridade do histórico...";
    const planned=await getPlan();
    const file=new Blob([JSON.stringify({backupVersion:1,uid:auth.currentUser.uid,
     exportedAt:new Date().toISOString(),state:planned.state},null,2)],{type:"application/json"});
    const href=URL.createObjectURL(file),a=document.createElement("a");
    a.href=href;a.download="pote-v1-backup-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),10000);
    state.textContent="Backup solicitado: "+planned.recordCount+" registros. Confira o arquivo antes de migrar.";
   }catch(e){state.textContent="Backup não disponibilizado: "+(e.code||e.message)}
  };
  importBtn.onclick=()=>{
   const picker=document.createElement("input");picker.type="file";picker.accept=".json,application/json";
   picker.hidden=true;document.body.appendChild(picker);
   picker.onchange=async()=>{
    const file=picker.files?.[0];picker.remove();if(!file)return;
    if(!auth.currentUser?.uid||file.size>30*1024*1024){state.textContent="Arquivo inválido ou maior que 30 MB";return}
    importBtn.disabled=true;exportBtn.disabled=true;
    try{
     state.textContent="Validando o backup selecionado...";
     const uid=auth.currentUser.uid,backup=JSON.parse(await file.text()),planned=await getPlan();
     if(!inspectLegacyBackup(backup,uid,planned.state))
      throw Error("Backup diferente do histórico atual, inválido ou de outra conta.");
     if(!window.confirm("Backup conferido ("+planned.recordCount+" registros). Iniciar cópia V1 → V2, preservando o histórico original?"))
      throw Error("Migração cancelada; nenhum dado foi copiado.");
     const outcome=await migrateLegacyV2({uid,db,
      sdk:{doc,getDoc,getDocs,collection,runTransaction,serverTimestamp},planned,
      onProgress:p=>state.textContent="Migrando: "+p.processed+" de "+p.total+" registros verificados..."});
     state.textContent="Migração verificada: "+outcome.records+" registros. Carregando seus dados...";
     window.location.reload();
    }catch(error){
     state.textContent="Migração suspensa, sem apagar V1: "+(error.code||error.message)+
       ". Utilize o mesmo backup para retomar.";
     importBtn.disabled=false;exportBtn.disabled=false;
    }
   };
   picker.click();
  };
 }
 container.hidden=false;
}
window.addEventListener("online",()=>{if(ready&&!syncBlocked)queueSave()});
function refreshEntitlements() {
  if (!window.POTE_AUTH) return;
  const result = resolveLicense(rawUserLicense, Date.now());
  const admin = window.POTE_AUTH.role === "admin";
  const wasPro = Boolean(window.POTE_AUTH.proActive);
  const wasFranchise=Boolean(window.POTE_AUTH.franchiseActive);
  const franchise=!admin&&rawUserFranchise?.status==="active"&&rawUserFranchise.brandId==="potebatata";
  window.POTE_AUTH.franchiseActive=franchise;
  window.POTE_AUTH.proActive = admin || franchise || result.active;
  window.POTE_AUTH.plan = admin ? "admin" : franchise ? "franchise" : result.kind;
  window.POTE_AUTH.expiresAt = result.expiresAt;
  window.POTE_AUTH.accessPolicy = rawUserAccessPolicy || {};
  if (adminOpen) adminOpen.hidden = !admin;
  if (planBadge) {
    planBadge.hidden = admin;
    planBadge.textContent = franchise ? "FRANQUIA POTÊ BATATA" : result.label;
    planBadge.title = result.expiresAt ? "Vencimento: " + dateBR(result.expiresAt) : "Sem vencimento";
  }
  const remaining = licenseCountdown(rawUserLicense, Date.now());
  if (planCountdown) {
    planCountdown.hidden = admin || franchise || remaining.state !== "active";
    planCountdown.textContent = remaining.state === "active" ? "Volta ao FREE em " + remaining.formatted : "";
    planCountdown.title = remaining.expiresAt ? "Vencimento: " + dateBR(remaining.expiresAt) : "";
  }
  window.POTE_LICENSE_STATUS = {...remaining,label:franchise?"FRANQUIA POTÊ BATATA":result.label,
    franchiseActive:franchise,expiresLabel:remaining.expiresAt?dateBR(remaining.expiresAt):null};
  window.dispatchEvent(new CustomEvent("pote:license-updated",{detail:window.POTE_LICENSE_STATUS}));
  if(ready&&wasFranchise!==franchise){
    window.dispatchEvent(new Event("pote:franchise-updated"));
  }
  if (ready && (wasPro !== Boolean(window.POTE_AUTH.proActive)||wasFranchise!==franchise)
      && typeof window.render === "function")window.render();
}
function observeProfile(user, index) {
  if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
  const profileRef = doc(db, "users", user.uid);
  unsubscribeProfile = onSnapshot(profileRef, snapshot => {
    if (index !== epoch || auth.currentUser?.uid !== user.uid) return;
    rawUserLicense = snapshot.data()?.license || null;
    rawUserFranchise = snapshot.data()?.franchise || null;
    const previousPolicy=JSON.stringify(rawUserAccessPolicy||{});
    rawUserAccessPolicy=snapshot.data()?.accessPolicy||{};
    refreshEntitlements();
    if(previousPolicy!==JSON.stringify(rawUserAccessPolicy))
      window.dispatchEvent(new Event("pote:access-updated"));
  }, error => console.warn("Licença: ", error.code || error.message));
  if (expiryCheckInterval) clearInterval(expiryCheckInterval);
  expiryCheckInterval = setInterval(refreshEntitlements, 1000);
}
function refFor(user) { return doc(db, "users", user.uid, "appState", "main"); }

async function syncV2(){
  if(!ready||!active||!v2Store||auth.currentUser?.uid!==active.uid)return false;
  if(saving){queued=true;return false}
  const serialized=JSON.stringify(safeState());
  if(serialized===lastJson)return true;
  if(syncBlocked){savePending(serialized,"conflito V2 não resolvido");return false}
  saving=true;
  const currentEpoch=epoch,currentUid=active.uid;
  setStatus("Sincronizando registros V2...");
  try{
    const result=await v2Store.save();
    if(epoch!==currentEpoch||auth.currentUser?.uid!==currentUid)return false;
    if(!result.ok){
      if(result.code==="sync/conflict"||result.code==="sync/invalid-state"||result.partial)syncBlocked=true;
      lastSyncCause={code:result.code,detail:result.error};
      setStatus(result.partial?"Importação parcialmente salva ("+result.savedChanges+" cadastros). Backup preservado; retome a sincronização.":
       result.code==="sync/conflict"?"CONFLITO DE ESTOQUE/PEDIDOS — exporte backup.":
       "Alterações ainda não sincronizadas: "+String(result.error||"sem conexão").slice(0,90));
      savePending(serialized,result.error||result.code||"erro V2");
      return false;
    }
    lastJson=serialized;
    if(pendingThisSession){
      try{localStorage.removeItem(pendingKey(currentUid))}catch(e){}
      pendingThisSession=false;
    }
    setStatus("Dados V2 salvos com segurança");showBackupButton();
    if(JSON.stringify(safeState())!==serialized)queued=true;
    return true;
  }catch(e){
    if(epoch!==currentEpoch)return false;
    savePending(serialized,e.message||"falha V2");
    setStatus("Erro de sincronização V2: exporte backup");
    return false;
  }finally{
    saving=false;
    if(queued&&!syncBlocked){queued=false;queueSave()}
  }
}
async function sync() {
  if(useV2)return syncV2();
  if(!ready||!active||auth.currentUser?.uid!==active.uid)return false;
  if(saving){queued=true;return false}
  const value=safeState(),serialized=JSON.stringify(value);
  if(serialized===lastJson)return true;
  if(syncBlocked){
    savePending(serialized,"conflito não resolvido");
    setStatus("SINCRONIZAÇÃO BLOQUEADA: exporte o backup pendente.");
    return false;
  }
  // O estado antigo ainda é um único documento. Impedir ultrapassar o limite antes da escrita.
  if(jsonBytes(serialized)>MAX_APPSTATE_BYTES){
    syncBlocked=true;
    savePending(serialized,"documento próximo do limite Firestore");
    setStatus("Limite de armazenamento próximo: exporte backup e contate o suporte.");
    return false;
  }
  const user=active,saveEpoch=epoch,expected=cloudFingerprint;
  saving=true;setStatus("Salvando na nuvem...");
  try{
    // A comparação da versão de TODOS os campos bloqueia gravações antigas ou concorrentes.
    // Não migra, apaga ou duplica os documentos da conta existente.
    await runTransaction(db,async tx=>{
      const reference=refFor(user),document=await tx.get(reference);
      if(!matchesRemote(document.data()?.state??null,expected)){
        const error=new Error("Dados alterados em outro dispositivo");
        error.code="sync/conflict";
        throw error;
      }
      if(saveEpoch!==epoch||auth.currentUser?.uid!==user.uid){
        const error=new Error("Sessão alterada durante a gravação");
        error.code="sync/session-changed";
        throw error;
      }
      tx.set(reference,{
        state:value,updatedAt:serverTimestamp(),
        syncRevision:nextRevision(document.data()?.syncRevision)
      },{merge:true});
    });
    if(saveEpoch!==epoch||auth.currentUser?.uid!==user.uid)return false;
    cloudFingerprint=stableJson(value);
    lastJson=serialized;
    if(pendingThisSession){
      try{localStorage.removeItem(pendingKey(user.uid))}catch(e){}
      pendingThisSession=false;
    }
    setStatus("Dados salvos na nuvem");
    showBackupButton();
    if(JSON.stringify(safeState())!==serialized)queued=true;
    return true;
  }catch(e){
    if(saveEpoch!==epoch||auth.currentUser?.uid!==user.uid)return false;
    if(e.code==="sync/conflict"){
      syncBlocked=true;
      setStatus("CONFLITO: outro dispositivo alterou os dados. Exporte backup local.");
    }else{
      setStatus("Falha na nuvem. Alterações pendentes: exporte o backup.");
    }
    savePending(serialized,e.code||e.message||"falha de sincronização");
    console.warn("Firestore sync:",e.code||e.message);
    return false;
  }finally{
    saving=false;
    if(queued&&!syncBlocked){queued=false;queueSave()}
  }
}
function queueSave(){
  if(!ready||!active)return;
  // Renderização e navegação não precisam gerar gravações se o estado não mudou.
  const serialized=JSON.stringify(safeState());
  if(!syncBlocked&&serialized===lastJson)return;
  if(useV2&&!syncBlocked&&lastJson){
   try{
    const comparison=inspectPendingAgainstCloud({version:1,uid:active.uid,state:safeState()},
     active.uid,JSON.parse(lastJson),{v2:true});
    if(comparison.safeToRelease){lastJson=serialized;return}
   }catch(error){}
  }
  clearTimeout(timer);
  if(syncBlocked){
    // Nunca tentar sobrescrever a nuvem após descobrir conflito.
    if(pendingThisSession)savePending(JSON.stringify(safeState()),"conflito pendente");
    return;
  }
  timer=setTimeout(sync,1300);
}
window.addEventListener("pote:changed",queueSave);
window.addEventListener("beforeunload",event=>{
  if(!ready||!active)return;
  const serialized=JSON.stringify(safeState());
  if(serialized===lastJson&&!syncBlocked)return;
  if(useV2&&!syncBlocked&&lastJson){
   try{
    const comparison=inspectPendingAgainstCloud({version:1,uid:active.uid,state:safeState()},
     active.uid,JSON.parse(lastJson),{v2:true});
    if(comparison.safeToRelease)return;
   }catch(error){}
  }
  savePending(serialized,"navegador fechado com alterações pendentes");
  event.preventDefault();
  event.returnValue="";
});

function observeRemote(user, index) {
  if (unsubscribeRemote) { unsubscribeRemote(); unsubscribeRemote = null; }
  unsubscribeRemote = onSnapshot(refFor(user), snapshot => {
    if (index !== epoch || !ready || auth.currentUser?.uid !== user.uid) return;
    if (snapshot.metadata.hasPendingWrites || saving) return;
    const remote=snapshot.data()?.state;
    if(!remote||!remote.data)return;
    const incoming=JSON.stringify(remote);
    const fingerprint=stableJson(remote);
    if(fingerprint===cloudFingerprint)return;
    if(syncBlocked){showBackupButton();return}
    // Outro dispositivo atualizou a nuvem enquanto existiam mudanças locais ainda pendentes.
    if(JSON.stringify(safeState())!==lastJson){
      syncBlocked=true;
      savePending(JSON.stringify(safeState()),"alteração concorrente detectada");
      setStatus("CONFLITO ENTRE DISPOSITIVOS. Exporte backup local.");
      return;
    }
    window.POTE_APP.applyState(remote,{preserveNavigation:true});
    cloudFingerprint=fingerprint;
    lastJson=JSON.stringify(safeState());
    setStatus("Atualizado entre aplicativos");
  }, error => {
    console.warn("Firestore realtime:", error.code || error.message);
    setStatus("Sincronização em tempo real indisponível. Atualize a página.");
  });
}

async function loadUser(user, index) {
  setGate(true);
  setMessage("Verificando conta e carregando seus dados...");
  ready = false;
  clearTimeout(timer);
  const claims = await withDeadline(getIdTokenResult(user, true), 15000, "verificação do Google");
  const admin = user.email?.toLowerCase() === "pixmcp@gmail.com" &&
    claims.claims.potebatataAdmin === true &&
    claims.claims.email_verified === true &&
    claims.claims.firebase?.sign_in_provider === "google.com";
  window.POTE_AUTH = { uid: user.uid, email: user.email, role: admin ? "admin" : "free", proActive: admin, plan: admin ? "admin" : "free" };
  active = user;
  const profile = doc(db, "users", user.uid);
  const existing = await withDeadline(getDoc(profile), 15000, "consulta do perfil");
  rawUserLicense = existing.exists() ? existing.data().license || null : null;
  rawUserFranchise = existing.exists() ? existing.data().franchise || null : null;
  rawUserAccessPolicy = existing.exists() ? existing.data().accessPolicy || {} : {};
  refreshEntitlements();
  if (!existing.exists()) {
    await withDeadline(setDoc(profile, {
      displayName: user.displayName || "",
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), 15000, "criação do perfil");
  }
  if(useV2){
    v2Store?.dispose();
    v2Store=createV2Store({
      uid:user.uid,db,
      sdk:{doc,collection,getDoc,getDocs,runTransaction,onSnapshot,serverTimestamp},
      fresh:()=>window.POTE_APP.reset(),
      snapshot:safeState,
      apply:next=>window.POTE_APP.applyState(next,{preserveNavigation:true}),
      status:setStatus
    });
    await withDeadline(v2Store.load(),25000,"inicialização do banco V2");
    if(index!==epoch)return;
    lastJson=JSON.stringify(safeState());
  }else{
  const record = await withDeadline(getDoc(refFor(user)), 15000, "carregamento dos seus dados");
  if (index !== epoch) return;
  cloudFingerprint=stableJson(record.data()?.state??null);
  if (record.exists() && record.data().state) {
    const remote = record.data().state;
    // Only reset a FREE account automatically when every field matches
    // the untouched built-in demo. Any user edits must be preserved.
    if (!admin && window.POTE_APP.isPristineDemo(remote)) {
      window.POTE_APP.reset();
      const fresh = safeState();
      await withDeadline(setDoc(refFor(user), {
        state: fresh, demoClearedVersion: 1, updatedAt: serverTimestamp()
      }, {merge: true}), 15000, "remoção de dados demonstrativos da conta FREE");
      lastJson = JSON.stringify(fresh);
      cloudFingerprint=stableJson(fresh);
    } else {
      window.POTE_APP.applyState(remote);
      lastJson = JSON.stringify(safeState());
    }
  } else {
    window.POTE_APP.reset();
    const start = safeState();
    await withDeadline(setDoc(refFor(user), {
      state: start, demoClearedVersion: 1, updatedAt: serverTimestamp()
    }), 15000, "primeira gravação");
    lastJson = JSON.stringify(start);
    cloudFingerprint=stableJson(start);
  }
  }
  if (index !== epoch) return;
  ready = true;
  window.POTE_APP_READY=true;
  logged.textContent = user.email;
  refreshEntitlements();
  loginBtn.disabled = false;
  setMessage("");
  const pendingOnLoad=existingPending(user.uid);
   const backupCheck=pendingOnLoad?
    inspectPendingAgainstCloud(pendingOnLoad,user.uid,safeState(),{v2:useV2}):null;
  if(pendingMatchesLoadedState(pendingOnLoad,user.uid,safeState())||backupCheck?.safeToRelease){
    // A local pending record may survive a successful previous sync.
    // Remove it only if every field matches the now-loaded cloud state.
    try{localStorage.removeItem(pendingKey(user.uid))}catch(error){
      console.warn("Backup local idêntico não pôde ser liberado:",error.message||error);
    }
  }
  if(existingPending(user.uid)){
    syncBlocked=true;
    setStatus("Vendas aguardando sincronizacao: "+syncExplanation().title);
   }else{syncBlocked=false;lastSyncCause=null;setStatus(pendingOnLoad?"Backup local conferido: dados comerciais iguais aos da nuvem. Vendas liberadas.":"Dados salvos na nuvem");}
  setGate(false);
  showBackupButton();
  if(useV2){
    v2Store?.subscribe(result=>{
      if(index!==epoch||auth.currentUser?.uid!==user.uid)return;
      if(result.ok){lastJson=JSON.stringify(safeState());lastSyncCause=null;return}
      if(result.queued)return;
      const code=String(result.code||"sync/error");
      lastSyncCause={code,detail:String(result.error||"")};
      if(["sync/error","unavailable","deadline-exceeded","network-request-failed"].includes(code)){
       setStatus("Falha temporaria de conexao: "+String(result.error||code).slice(0,90)+". Tentando novamente.");
       setTimeout(async()=>{
        if(!ready||syncBlocked||!v2Store||auth.currentUser?.uid!==user.uid)return;
        if(JSON.stringify(safeState())!==lastJson){queueSave();return;}
        const res=await v2Store.refresh();
        if(res.ok){lastJson=JSON.stringify(safeState());lastSyncCause=null;setStatus("Conexao restabelecida.");}
        else if(res.code==="sync/conflict"){syncBlocked=true;lastSyncCause={code:res.code,detail:res.error};savePending(JSON.stringify(safeState()),res.error||res.code);}
       },3500);
       return;
      }
      syncBlocked=true;
      savePending(JSON.stringify(safeState()),result.error||code);
      setStatus("Vendas aguardando sincronizacao: "+syncExplanation().title);
    });
  }else observeRemote(user, index);
  observeProfile(user, index);
  window.POTE_BUSINESS?.refresh?.();
  window.dispatchEvent(new Event("pote:user-ready"));
  if(window.POTE_BRAND_MIGRATED||window.POTE_UNIVERSE_MIGRATED){
    // Gravar apenas migrações cuidadosas, sem apagar pedidos, receitas ou outros universos.
    window.POTE_BRAND_MIGRATED=false;
    window.POTE_UNIVERSE_MIGRATED=false;
    lastJson='';
    queueSave();
  }
}

loginBtn.addEventListener("click", async () => {
  clearTimeout(loginWatchdog);
  loginBtn.disabled = true;
  if (embeddedBrowser) showBrowserHint();
  setMessage("Abrindo login Google...");
  loginWatchdog = setTimeout(() => {
    if (!auth.currentUser) {
      loginBtn.disabled = false;
      showBrowserHint();
      setMessage("O Google não respondeu. Abra este endereço diretamente no Chrome e tente novamente.");
    } else {
      setMessage("Verificando conta e conexão com o banco...");
    }
  }, 18000);
  try {
    await withDeadline(signInWithPopup(auth, google), 35000, "janela de login Google");
  } catch (e) {
    loginBtn.disabled = false;
    showBrowserHint();
    const code = e.code || e.message || "erro de autenticação";
    setMessage("Falha no login Google (" + code + "). Abra no Chrome ou Edge e tente novamente.");
  } finally {
    clearTimeout(loginWatchdog);
  }
});
exitBtn.addEventListener("click", async () => {
  if(!window.POTE_EXIT?.confirmLogout?.())return;
  clearTimeout(timer);
  const synced=await sync();
  if(!synced&&JSON.stringify(safeState())!==lastJson){
    setStatus("Saída suspensa: alterações ainda não foram sincronizadas.");
    showBackupButton();
    return;
  }
  ready = false;
  setGate(true);
  setMessage("Saindo...");
  try {
    await signOut(auth);
  } catch (e) { setMessage("Não foi possível sair. Tente novamente."); }
});
onAuthStateChanged(auth, async user => {
  const myEpoch = ++epoch;
  if(v2Store){v2Store.dispose();v2Store=null}
  if (unsubscribeRemote) { unsubscribeRemote(); unsubscribeRemote = null; }
  if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
  if (expiryCheckInterval) { clearInterval(expiryCheckInterval); expiryCheckInterval = null; }
  rawUserLicense = null;
  rawUserFranchise=null;
  rawUserAccessPolicy=null;
  cloudFingerprint=stableJson(null);
  syncBlocked=false;
  pendingThisSession=false;
  window.POTE_UNIVERSE_MIGRATED=false;
  window.POTE_APP_READY=false;
  window.dispatchEvent(new Event("pote:user-logout"));
  window.POTE_BRAND_MIGRATED=false;
  if (adminOpen) adminOpen.hidden = true;
  if (planBadge) planBadge.hidden = true;
  if (planCountdown) planCountdown.hidden = true;
  clearTimeout(loginWatchdog);
  if (!user) {
    clearTimeout(timer);
    ready = false;
    active = null;
    lastJson = "";
    window.POTE_AUTH = null;
    logged.textContent = "";
    window.POTE_APP?.reset();
    loginBtn.disabled = false;
    setStatus("Não conectado");
    const oldMigration=document.getElementById("poteLegacyMigration");
    if(oldMigration)oldMigration.hidden=true;
    setMessage("Entre com sua conta Google para acessar seu espaço.");
    setGate(true);
    return;
  }
  try {
    const oldMigration=document.getElementById("poteLegacyMigration");
    if(oldMigration)oldMigration.hidden=true;
    await loadUser(user, myEpoch);
  } catch (e) {
    if(e.code==="migration/required")void offerLegacyMigration(user);
    ready = false;
    setGate(true);
    loginBtn.disabled = false;
    showBrowserHint();
    setMessage("Falha ao carregar sua conta: " + (e.code==="migration/required"?e.message:(e.code||e.message)) + ". Nenhum dado foi liberado.");
    setStatus("Acesso bloqueado até resolver a conexão");
  }
}, error => {
  setGate(true);
  setMessage("Falha de autenticação: " + (error.code || "desconhecida"));
});
