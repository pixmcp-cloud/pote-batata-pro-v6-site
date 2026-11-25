/* Locução IA: cliente sem credenciais do provedor, sem débito local.
 * Servidor autorizado deve fornecer status, orçamento e execução.
 * Sem endpoint comercial homologado: falha fechada. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
const auth=getAuth(app),$=id=>document.getElementById(id);
let quote=null,busy=false,url=null,uid=null;
const endpoint=()=>null; // configuração versionada somente após homologação de servidor comercial
function state(message){if($("csVoiceState"))$("csVoiceState").textContent=message;}
function renderQuota(q){
 const panel=$("csVoiceQuota");if(!panel)return;panel.hidden=!q;if(!q)return;
 const fmt=x=>Number(x).toLocaleString("pt-BR");
 $("csVoiceLimit").textContent=fmt(q.share);
 $("csVoiceRemaining").textContent=fmt(q.remaining);
 $("csVoiceUsed").textContent=fmt(q.used);
 $("csVoiceProgress").max=Math.max(1,q.share);$("csVoiceProgress").value=Math.min(q.share,q.used);
 $("csVoiceShare").textContent=q.count+" franquia(s) ativa(s) · "+(20/q.count).toLocaleString("pt-BR",{maximumFractionDigits:3})+"% da cota total por franquia. Limite coletivo: 20%.";
}
function renderChars(){if($("csVoiceChars")&&$("csVoiceText"))$("csVoiceChars").textContent=$("csVoiceText").value.length+" / 777 caracteres";}
function clear(){quote=null;uid=null;renderQuota(null);if($("csVoiceAudio")){$("csVoiceAudio").pause();$("csVoiceAudio").removeAttribute("src");$("csVoiceAudio").hidden=true;}if($("csVoiceDownload")){$("csVoiceDownload").removeAttribute("href");$("csVoiceDownload").hidden=true;}if($("csVoiceForm"))$("csVoiceForm").hidden=true;if($("csVoiceGenerate"))$("csVoiceGenerate").disabled=true;if(url)URL.revokeObjectURL(url);url=null;}
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
  $("csVoiceForm").hidden=false;renderQuota(data.franchiseAllocation);renderChars();
  state("Saldo de IA: "+data.balance+" créditos. "+allocationText(data.franchiseAllocation)+" Confira o orçamento antes de gerar.");
  $("csVoicePrice").onclick=price;
  $("csVoiceGenerate").onclick=generate;
  for(const id of ["csVoiceText","csVoiceSelect"])$(id).oninput=()=>{quote=null;$("csVoiceGenerate").disabled=true;$("csVoiceQuote").textContent="Recalcule o orçamento."};
 }catch(e){clear();state(e.message)}
}
function allocationText(q){return q?" Sua cota: "+q.share+" créditos do provedor · usados/reservados: "+q.used+" · disponíveis: "+q.remaining+" · "+q.count+" franquias ativas.":"";}
async function price(){
 if(busy)return;busy=true;quote=null;$("csVoiceGenerate").disabled=true;
 try{
  const text=$("csVoiceText").value.trim(),voiceId=$("csVoiceSelect").value;
  const data=await(await api("/quote",{text,voiceId})).json();
  if(!Number.isSafeInteger(data.credits)||data.credits<1||typeof data.quoteId!=="string")throw Error("Orçamento inválido.");
  quote={id:data.quoteId,credits:data.credits,text,voiceId};renderQuota(data.franchiseAllocation);
  $("csVoiceQuote").textContent="Custo: "+data.credits+" créditos IA · saldo: "+data.balance+allocationText(data.franchiseAllocation);
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
  state("Locução pronta. Consulte novamente o saldo antes de outra geração.");renderQuota(null);
 }catch(e){state(e.message+" Consulte o histórico antes de tentar novamente.")}finally{busy=false}
}
window.POTE_VOICE_AI={open};
window.addEventListener("pote:profile-updated",()=>{if(!permitted()){clear();state("🔒 Locução bloqueada pelo ADM.");}});
window.addEventListener("pote:user-logout",clear);
