/* Locução IA: cliente sem credenciais do provedor, sem débito local.
 * Servidor autorizado deve fornecer status, orçamento e execução.
 * Sem endpoint comercial homologado: falha fechada. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
const auth=getAuth(app),$=id=>document.getElementById(id);
let quote=null,busy=false,url=null,uid=null;
const endpoint=()=>null; // configuração versionada somente após homologação de servidor comercial
function state(message){if($("csVoiceState"))$("csVoiceState").textContent=message;}
function clear(){quote=null;uid=null;if($("csVoiceForm"))$("csVoiceForm").hidden=true;if($("csVoiceGenerate"))$("csVoiceGenerate").disabled=true;if(url)URL.revokeObjectURL(url);url=null;}
const permitted=()=>{const p=window.POTE_AUTH,flag=p?.accessPolicy?.voiceAiEnabled;return !!auth.currentUser&&p?.uid===auth.currentUser.uid&&(flag===true||(flag!==false&&p?.franchiseActive===true));};
async function api(path,body){
 const user=auth.currentUser,root=endpoint();
 if(!permitted()||!root)throw Error("Locução indisponível: autorização e servidor comercial obrigatórios.");
 const token=await user.getIdToken();
 const res=await fetch(root+path,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body)});
 if(!res.ok)throw Error("Servidor recusou a operação. Nenhum débito local efetuado.");
 if(auth.currentUser?.uid!==user.uid||!permitted())throw Error("Conta ou autorização alterada.");
 return res;
}
async function open(){
 clear();
 if(!permitted())return state("🔒 Locução bloqueada pelo ADM. O plano PRO não concede acesso automático; franquias ativas têm acesso padrão.");
 if(!endpoint())return state("🔓 Acesso reconhecido. Geração bloqueada até a ativação de uma licença comercial e servidor seguro. Nenhum crédito será debitado.");
 try{
  const data=await(await api("/status",{})).json();
  if(data.commercialReady!==true||data.authorized!==true)return state("Serviço comercial indisponível.");
  uid=auth.currentUser.uid;
  const select=$("csVoiceSelect");select.replaceChildren(...data.voices.map(v=>new Option(v.name,v.id)));
  $("csVoiceText").value=["creativeHeadline","creativeBody","creativeCta"].map(id=>$(id)?.value||"").filter(Boolean).join(". ").slice(0,777);
  $("csVoiceForm").hidden=false;
  state("Saldo de IA: "+data.balance+" créditos. Confira o orçamento antes de gerar.");
  $("csVoicePrice").onclick=price;
  $("csVoiceGenerate").onclick=generate;
  for(const id of ["csVoiceText","csVoiceSelect"])$(id).oninput=()=>{quote=null;$("csVoiceGenerate").disabled=true;$("csVoiceQuote").textContent="Recalcule o orçamento."};
 }catch(e){clear();state(e.message)}
}
async function price(){
 if(busy)return;busy=true;quote=null;$("csVoiceGenerate").disabled=true;
 try{
  const text=$("csVoiceText").value.trim(),voiceId=$("csVoiceSelect").value;
  const data=await(await api("/quote",{text,voiceId})).json();
  if(!Number.isSafeInteger(data.credits)||data.credits<1||typeof data.quoteId!=="string")throw Error("Orçamento inválido.");
  quote={id:data.quoteId,credits:data.credits,text,voiceId};
  $("csVoiceQuote").textContent="Custo: "+data.credits+" créditos IA · saldo: "+data.balance+(data.franchiseQuotaRemaining!=null?" · Cota de franquias restante: "+data.franchiseQuotaRemaining:"");
  $("csVoiceGenerate").disabled=data.balance<data.credits;
 }catch(e){state(e.message)}finally{busy=false}
}
async function generate(){
 if(busy||!quote||auth.currentUser?.uid!==uid||!permitted())return;
 const q=quote; if(q.text!==$("csVoiceText").value.trim()||q.voiceId!==$("csVoiceSelect").value)return;
 if(!confirm("Consumir "+q.credits+" créditos IA para gerar a locução?"))return;
 busy=true;quote=null;$("csVoiceGenerate").disabled=true;
 try{
  const res=await api("/generate",{quoteId:q.id});
  if(!res.headers.get("content-type")?.startsWith("audio/mpeg"))throw Error("Resposta não contém MP3.");
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(await res.blob());
  $("csVoiceAudio").src=url;$("csVoiceAudio").hidden=false;$("csVoiceDownload").href=url;$("csVoiceDownload").hidden=false;
  state("Locução pronta. Consulte novamente o saldo antes de outra geração.");
 }catch(e){state(e.message+" Consulte o histórico antes de tentar novamente.")}finally{busy=false}
}
window.POTE_VOICE_AI={open};
window.addEventListener("pote:profile-updated",()=>{if(!permitted()){clear();state("🔒 Locução bloqueada pelo ADM.");}});
window.addEventListener("pote:user-logout",clear);
