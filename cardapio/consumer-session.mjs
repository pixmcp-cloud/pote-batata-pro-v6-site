// Named Firebase app: separate browser session from merchant login.
// No users/{uid} profile is created by the consumer storefront.
import {firebaseConfig} from "../firebase_app.mjs";
import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,query,where,limit,orderBy,onSnapshot,getDocs} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
const app=getApps().find(x=>x.name==="pote-consumer")||initializeApp(firebaseConfig,"pote-consumer");
const auth=getAuth(app),db=getFirestore(app);
const verified=u=>u?.emailVerified===true&&u.providerData?.some(p=>p.providerId==="google.com");
const ready=new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{resolve();queueMicrotask(()=>stop())},()=>resolve())});
const list=uid=>collection(db,"consumerOrders",uid,"orders");
export function observe(callback){return onAuthStateChanged(auth,u=>callback(verified(u)?u:null),()=>callback(null))}
export async function login(){
 await ready;
 if(verified(auth.currentUser))return auth.currentUser;
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
 const result=await signInWithPopup(auth,provider);
 if(!verified(result.user))throw Error("Use uma conta Google verificada.");
 return result.user;
}
export async function token(user){
 if(!verified(user)||auth.currentUser?.uid!==user.uid)throw Error("Conta alterada. Entre novamente.");
 return user.getIdToken();
}
export async function logout(){return signOut(auth)}
export function listen(user,callback,onError){
 if(!verified(user)||auth.currentUser?.uid!==user.uid)throw Error("Sessão inválida.");
 return onSnapshot(query(list(user.uid),where("status","in",["recebido","em_preparo","finalizado","saiu_entrega"]),limit(30)),{includeMetadataChanges:true},s=>callback(s.docs.map(d=>d.data()),!s.metadata.fromCache),onError);
}
export async function history(user){
 if(!verified(user)||auth.currentUser?.uid!==user.uid)throw Error("Sessão inválida.");
 const s=await getDocs(query(list(user.uid),orderBy("createdAt","desc"),limit(50)));
 return s.docs.map(d=>d.data());
}
export function watchOrder(user,id,callback,onError){
 // Read exactly the active order and retain terminal update when it leaves the active query.
 if(!verified(user)||auth.currentUser?.uid!==user.uid)throw Error("Sessão inválida.");
 return onSnapshot(query(list(user.uid),where("checkoutId","==",id),limit(1)),{includeMetadataChanges:true},s=>callback(s.docs[0]?.data()||null,!s.metadata.fromCache),onError);
}
