import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, serverTimestamp, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {createV2Store} from "./v2_storage.mjs?v=kitchen-motoboy-20261116";
import {stableJson,matchesRemote,nextRevision,jsonBytes,MAX_APPSTATE_BYTES,pendingKey,makePending} from "./sync_guard.mjs?v=safety-20261116";
import { resolveLicense, dateBR, licenseCountdown } from "./license_terms.mjs?v=plans-20261115-years";

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
let pendingThisSession=false;
let v2Store=null;
// A versão V2 inicia contas de teste limpas em coleções por registro, sem migrar appState/main.
const useV2=window.POTE_USE_V2!==false;
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

function setStatus(v) { if (syncEl) syncEl.textContent = v; }
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
function resolvePendingConflict(){
 if(!active||!syncBlocked)return false;
 // Exportação é explícita; não é possível verificar se o navegador salvou o arquivo.
 try{downloadPending()}catch(error){setStatus("Falha ao exportar backup. Conflito preservado.");return false}
 if(!window.confirm("Foi solicitado o download do backup pendente. Confira se o arquivo foi salvo. Recarregar a versão da nuvem descarta estas alterações locais, que só poderão ser recuperadas pelo JSON exportado. Continuar?"))return false;
 try{localStorage.removeItem(pendingKey(active.uid))}catch(error){setStatus("Não foi possível liberar o backup pendente.");return false}
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
window.POTE_SYNC_GUARD={downloadPending,resolvePendingConflict,get blocked(){return syncBlocked},hasPending:()=>Boolean(active&&existingPending(active.uid))};
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
      if(result.code==="sync/conflict"||result.code==="sync/invalid-state")syncBlocked=true;
      setStatus(result.code==="sync/conflict"?"CONFLITO DE ESTOQUE/PEDIDOS — exporte backup.":
       "Alterações ainda não sincronizadas: "+String(result.error||"sem conexão").slice(0,90));
      savePending(serialized,result.code||result.error||"erro V2");
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
  if(!syncBlocked&&JSON.stringify(safeState())===lastJson)return;
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
  if(existingPending(user.uid)){
    syncBlocked=true;
    setStatus("Backup local não sincronizado detectado. Exporte antes de continuar.");
  }else setStatus("Dados salvos na nuvem");
  setGate(false);
  showBackupButton();
  if(useV2){
    v2Store?.subscribe(result=>{
      if(index!==epoch||auth.currentUser?.uid!==user.uid)return;
      if(result.ok){lastJson=JSON.stringify(safeState());return}
      syncBlocked=true;
      savePending(JSON.stringify(safeState()),result.code||result.error||"atualização V2");
      setStatus("DIVERGÊNCIA ENTRE DISPOSITIVOS. Exporte backup e entre novamente.");
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
    setMessage("Entre com sua conta Google para acessar seu espaço.");
    setGate(true);
    return;
  }
  try {
    await loadUser(user, myEpoch);
  } catch (e) {
    ready = false;
    setGate(true);
    loginBtn.disabled = false;
    showBrowserHint();
    setMessage("Falha ao carregar sua conta: " + (e.code || e.message) + ". Nenhum dado foi liberado.");
    setStatus("Acesso bloqueado até resolver a conexão");
  }
}, error => {
  setGate(true);
  setMessage("Falha de autenticação: " + (error.code || "desconhecida"));
});
