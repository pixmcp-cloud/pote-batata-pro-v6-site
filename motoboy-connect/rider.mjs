import {firebaseConfig} from "../firebase_app.mjs";
import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {makeConnectPanel} from "./connect-client.mjs?v=4";
const app=getApps().find(a=>a.name==="pote-courier")||initializeApp(firebaseConfig,"pote-courier"),auth=getAuth(app),$=id=>document.getElementById(id);
const id=location.hash.slice(1);let panel=null;
$("riderLogin").onclick=async()=>{try{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});await signInWithPopup(auth,p)}catch(e){$("riderStatus").textContent=e.message}};
$("riderLogout").onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{panel?.close();panel=null;$("riderLogin").hidden=!!user;$("riderLogout").hidden=!user;
 if(!user||!user.emailVerified||!user.providerData.some(p=>p.providerId==="google.com"))return;
 if(!/^[a-f0-9-]{36}$/i.test(id)){$("riderStatus").textContent="Abra o convite individual enviado pela loja.";return;}
 $("riderStatus").textContent="Conta conectada. GPS preciso obrigatório para aceitar, iniciar, comunicar e concluir a entrega. A localização é compartilhada somente durante o percurso. Você pode sair a qualquer momento.";
 panel=makeConnectPanel({role:"courier",id,container:$("riderPanel"),token:()=>{if(auth.currentUser?.uid!==user.uid)throw Error("Conta alterada.");return user.getIdToken()}});
});
window.addEventListener("pagehide",()=>panel?.close());
