import {validPolicy,policyDigest,matchesAcceptance} from "./legal_core.mjs";
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
// Registration policy is activated only after the legal document and read rules are published.
export const LEGAL_REGISTRATION_ENABLED=false;
let pending=null;
export async function ensureLegalAcceptance({app,auth,required=false}){
 const user=auth.currentUser;if(!user)throw Error("authentication_required");
 if(!required&&!LEGAL_REGISTRATION_ENABLED)return false;
 const uid=user.uid,sdk=await import("https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js"),db=sdk.getFirestore(app);
 const check=()=>{if(auth.currentUser?.uid!==uid)throw Error("session_changed")};
 const snap=await sdk.getDocFromServer(sdk.doc(db,"legalPolicy","current"));check();
 const p=snap.exists()?snap.data():null;
 if(!p||p.active!==true){if(required)throw Error("legal_policy_unavailable");return false;}
 if(!validPolicy(p)||await policyDigest(p.text)!==p.sha256)throw Error("legal_policy_unavailable");
 const ref=sdk.doc(db,"users",uid,"legalAcceptances",p.version);
 const prior=await sdk.getDocFromServer(ref);check();
 if(prior.exists()&&matchesAcceptance(prior.data(),p,uid))return true;
 if(prior.exists())throw Error("legal_acceptance_inconsistent");
 if(pending?.uid===uid)return pending.promise;
 const promise=new Promise((resolve,reject)=>{
  const box=el("dialog");Object.assign(box.style,{maxWidth:"min(640px,92vw)",width:"92vw",maxHeight:"90dvh",padding:"20px",borderRadius:"16px",color:"#eee",background:"#181818",border:"1px solid #af934e",zIndex:"2147483647"});
  const title=el("h2","PDV MULTIVERSAL — Termos de Uso e Política de Privacidade");
  const sub=el("p","Versão "+p.version+" · "+p.controller+" · "+p.privacyContact);
  const content=el("pre",p.text);Object.assign(content.style,{whiteSpace:"pre-wrap",overflow:"auto",maxHeight:"42vh",fontFamily:"inherit",fontSize:"14px"});
  const label=el("label"),input=el("input");input.type="checkbox";label.append(input,document.createTextNode(" Li e concordo com os Termos de Uso e declaro estar ciente da Política de Privacidade."));
  const yes=el("button","Aceitar e continuar"),no=el("button","Não aceito"),msg=el("p");yes.disabled=true;yes.type=no.type="button";input.onchange=()=>{yes.disabled=!input.checked};
  let finished=false,off=null;
  const finish=(ok,error)=>{if(finished)return;finished=true;off?.();box.close();box.remove();if(ok)resolve(true);else reject(error||Error("legal_declined"));};
  box.addEventListener("cancel",e=>{e.preventDefault();finish(false)});
  no.onclick=()=>finish(false);
  yes.onclick=async()=>{if(!input.checked||yes.disabled)return;yes.disabled=true;no.disabled=true;input.disabled=true;msg.textContent="Registrando aceite no servidor…";try{
   check();try{await sdk.setDoc(ref,{uid,version:p.version,sha256:p.sha256,accepted:true,acceptedAt:sdk.serverTimestamp()});}catch(err){
    const concurrent=await sdk.getDocFromServer(ref);check();if(!concurrent.exists()||!matchesAcceptance(concurrent.data(),p,uid))throw err;
   }
   const saved=await sdk.getDocFromServer(ref);check();if(!matchesAcceptance(saved.data(),p,uid))throw Error("legal_acceptance_unconfirmed");finish(true);
  }catch(e){if(!finished){msg.textContent="Aceite não confirmado. Verifique a conexão ou atualize a página.";no.disabled=false;input.disabled=false;yes.disabled=!input.checked;}}};
  box.append(title,sub,content,label,el("p"),yes,no,msg);document.body.append(box);box.showModal();
  import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js").then(s=>{if(!finished)off=s.onAuthStateChanged(auth,u=>{if(u?.uid!==uid)finish(false,Error("session_changed"))})}).catch(()=>{});
 });
 pending={uid,promise};try{return await promise;}finally{if(pending?.promise===promise)pending=null}
}
export function openPublishedTerms({app,auth}){return ensureLegalAcceptance({app,auth});}
