import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

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

let active = null;
let saving = false;
let queued = false;
let ready = false;
let timer = null;
let lastJson = "";
let epoch = 0;
let loginWatchdog = null;
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
function refFor(user) { return doc(db, "users", user.uid, "appState", "main"); }

async function sync() {
  if (!ready || !active || auth.currentUser?.uid !== active.uid) return;
  if (saving) { queued = true; return; }
  const value = safeState();
  const serialized = JSON.stringify(value);
  if (serialized === lastJson) return;
  saving = true;
  const user = active;
  setStatus("Salvando na nuvem...");
  try {
    await setDoc(refFor(user), { state: value, updatedAt: serverTimestamp() }, { merge: true });
    lastJson = serialized;
    setStatus("Dados salvos na nuvem");
  } catch (e) {
    setStatus("Falha ao salvar: mantenha um backup");
    console.warn("Firestore sync:", e.code || e.message);
  } finally {
    saving = false;
    if (queued) { queued = false; queueSave(); }
  }
}

function queueSave() {
  if (!ready || !active) return;
  clearTimeout(timer);
  timer = setTimeout(sync, 1300);
}
window.addEventListener("pote:changed", queueSave);

async function loadUser(user, index) {
  setGate(true);
  setMessage("Verificando conta e carregando seus dados...");
  ready = false;
  clearTimeout(timer);
  const claims = await withDeadline(getIdTokenResult(user, true), 15000, "verificação do Google");
  const admin = user.email?.toLowerCase() === "pixmcp@gmail.com" &&
    claims.claims.email_verified === true &&
    claims.claims.firebase?.sign_in_provider === "google.com";
  window.POTE_AUTH = { uid: user.uid, email: user.email, role: admin ? "admin" : "free" };
  active = user;
  const profile = doc(db, "users", user.uid);
  const existing = await withDeadline(getDoc(profile), 15000, "consulta do perfil");
  if (!existing.exists()) {
    await withDeadline(setDoc(profile, {
      displayName: user.displayName || "",
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), 15000, "criação do perfil");
  }
  const record = await withDeadline(getDoc(refFor(user)), 15000, "carregamento dos seus dados");
  if (index !== epoch) return;
  if (record.exists() && record.data().state) {
    window.POTE_APP.applyState(record.data().state);
    lastJson = JSON.stringify(safeState());
  } else {
    window.POTE_APP.reset();
    const start = safeState();
    await withDeadline(setDoc(refFor(user), { state: start, updatedAt: serverTimestamp() }), 15000, "primeira gravação");
    lastJson = JSON.stringify(start);
  }
  if (index !== epoch) return;
  ready = true;
  logged.textContent = user.email + (admin ? " • ADM" : " • FREE");
  loginBtn.disabled = false;
  setMessage("");
  setStatus("Dados salvos na nuvem");
  setGate(false);
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
  clearTimeout(timer);
  await sync();
  ready = false;
  setGate(true);
  setMessage("Saindo...");
  try {
    await signOut(auth);
  } catch (e) { setMessage("Não foi possível sair. Tente novamente."); }
});
onAuthStateChanged(auth, async user => {
  const myEpoch = ++epoch;
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
