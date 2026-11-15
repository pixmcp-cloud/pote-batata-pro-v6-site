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
const logged = document.getElementById("poteLoggedAs");

let active = null;
let saving = false;
let queued = false;
let ready = false;
let timer = null;
let lastJson = "";
let epoch = 0;

function setStatus(v) { syncEl.textContent = v; }
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
  const claims = await getIdTokenResult(user, true);
  const admin = user.email?.toLowerCase() === "pixmcp@gmail.com" &&
    claims.claims.email_verified === true &&
    claims.claims.firebase?.sign_in_provider === "google.com";
  window.POTE_AUTH = { uid: user.uid, email: user.email, role: admin ? "admin" : "free" };
  active = user;
  const profile = doc(db, "users", user.uid);
  const existing = await getDoc(profile);
  if (!existing.exists()) {
    await setDoc(profile, {
      displayName: user.displayName || "",
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  const record = await getDoc(refFor(user));
  if (index !== epoch) return;
  if (record.exists() && record.data().state) {
    window.POTE_APP.applyState(record.data().state);
    lastJson = JSON.stringify(safeState());
  } else {
    window.POTE_APP.reset();
    const start = safeState();
    await setDoc(refFor(user), { state: start, updatedAt: serverTimestamp() });
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
  loginBtn.disabled = true;
  setMessage("Abrindo login Google...");
  try {
    await signInWithPopup(auth, google);
  } catch (e) {
    loginBtn.disabled = false;
    setMessage("Não foi possível entrar: " + (e.code || "erro de autenticação") + ". Use o Chrome ou Edge atualizado.");
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
    setMessage("Falha ao carregar sua conta: " + (e.code || e.message) + ". Nenhum dado foi liberado.");
    setStatus("Acesso bloqueado até resolver a conexão");
  }
}, error => {
  setGate(true);
  setMessage("Falha de autenticação: " + (error.code || "desconhecida"));
});
