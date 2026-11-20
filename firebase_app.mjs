/* Firebase único do Potê Batata Pro. Dependência ES module garante a criação
 * do app ANTES dos módulos de ADM, notificações, franquia e autenticação.
 * Configuração Firebase Web é pública; credenciais privadas ficam no servidor. */
import {initializeApp,getApp,getApps} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
export const firebaseConfig=Object.freeze({
  apiKey:"AIzaSyCG8KCd6LKhYOIH3eLxifoT7IC9k3oMYCk",
  authDomain:"potobatata-b71f3.firebaseapp.com",
  projectId:"potobatata-b71f3",
  appId:"1:947524221002:web:ece242260f26bb46418eb3",
  messagingSenderId:"947524221002",
  storageBucket:"potobatata-b71f3.firebasestorage.app"
});
export const app=getApps().length?getApp():initializeApp(firebaseConfig);
