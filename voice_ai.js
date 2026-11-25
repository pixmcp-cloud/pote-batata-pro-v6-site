/* Locução IA: cliente sem credenciais do provedor, sem débito local.
 * Servidor autorizado deve fornecer status, orçamento e execução.
 * Sem endpoint comercial homologado: falha fechada. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,collection,query,orderBy,limit,getDocs} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
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
function clear(){quote=null;uid=null;if($("csAiWallet"))$("csAiWallet").hidden=true;if($("csAiPackages"))$("csAiPackages").hidden=true;if($("csAiHistory")){$("csAiHistory").replaceChildren();$("csAiHistory").hidden=true;}renderQuota(null);if($("csVoiceAudio")){$("csVoiceAudio").pause();$("csVoiceAudio").removeAttribute("src");$("csVoiceAudio").hidden=true;}if($("csVoiceDownload")){$("csVoiceDownload").removeAttribute("href");$("csVoiceDownload").hidden=true;}if($("csVoiceForm"))$("csVoiceForm").hidden=true;if($("csVoiceGenerate"))$("csVoiceGenerate").disabled=true;if(url)URL.revokeObjectURL(url);url=null;}
const permitted=()=>{
 const p=window.POTE_AUTH,flag=p?.accessPolicy?.voiceAiEnabled;
 if(!auth.currentUser||p?.uid!==auth.currentUser.uid||flag===false)return false;
 if(p.role==="admin"||p.franchiseActive===true)return true;
 return p.proActive===true&&(p.plan==="lifetime"||(p.plan==="pro"&&Number.isFinite(p.expiresAt)&&p.expiresAt>Date.now()));
};
const packages=Object.freeze([[1,150],[5,700],[25,3250],[50,6250],[75,8250],[100,10000]].map(Object.freeze));
const brl=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function refreshWallet(){
 const user=auth.currentUser,root=$("csAiWallet"),label=$("csAiBalance"),status=$("csAiWalletStatus");
 if(!user||!root||!permitted())return;
 root.hidden=false;label.textContent="Consultando…";status.textContent="";
 try{
  const snap=await getDoc(doc(db,"users",user.uid,"aiWallet","main"));
  if(auth.currentUser?.uid!==user.uid||!permitted()||root!==$("csAiWallet"))return;
  const n=snap.exists()?snap.data().balance:0;
  if(!Number.isSafeInteger(n)||n<0)throw Error("Saldo inválido.");
  label.textContent=n.toLocaleString("pt-BR")+" créditos";
 }catch(e){if(auth.currentUser?.uid===user.uid&&root===$("csAiWallet")){label.textContent="Indisponível";status.textContent="Carteira aguardando publicação das regras ou sincronização.";}}
}
async function history(){
 const user=auth.currentUser,panel=$("csAiHistory");if(!user||!panel||!permitted())return;
 panel.hidden=!panel.hidden;if(panel.hidden)return;
 panel.textContent="Consultando histórico…";
 try{
  const data=await getDocs(query(collection(db,"users",user.uid,"aiWallet","main","entries"),orderBy("at","desc"),limit(30)));
  if(auth.currentUser?.uid!==user.uid||!permitted()||panel!==$("csAiHistory"))return;
  panel.replaceChildren();
  if(data.empty){panel.textContent="Nenhuma movimentação registrada.";return;}
  for(const entry of data.docs){
   const d=entry.data(),row=document.createElement("p");row.className="cs-voice-state";
   const date=d.at?.toDate?.();row.textContent=(date?date.toLocaleString("pt-BR"):"Data pendente")+" · "+(d.delta>0?"+":"")+d.delta+" créditos · "+String(d.reason||"Movimentação")+" · saldo "+d.after;
   panel.append(row);
  }
 }catch(e){if(panel===$("csAiHistory"))panel.textContent="Histórico indisponível.";}
}
function shop(){window.POTE_IA_UNIVERSE?.open();}
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
 if(!permitted())return state("IA exclusiva para PRO ativo, vitalício e franquias. FREE e teste gratuito não podem usar IA. Bloqueios do ADM continuam válidos.");
 void refreshWallet();
 if(!endpoint())return state("Acesso ao plano reconhecido. Carteira disponível conforme regras publicadas; geração depende de licença comercial e servidor. Nenhum crédito será debitado.");
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
  $("csVoiceGenerate").disabled=data.balance<data.credits;if(data.balance<data.credits){$("csAiWallet").hidden=false;state("Saldo insuficiente. Consulte os pacotes na carteira IA.");}
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
window.POTE_VOICE_AI={open,shop,history};
window.addEventListener("pote:profile-updated",()=>{if(!permitted()){clear();state("IA bloqueada: confira seu plano ou permissão ADM.");}});
window.addEventListener("pote:user-logout",clear);

/* IA Universe: isolated full-screen wallet, no simulated credit or payment. */
const universe=document.createElement('dialog');
universe.id='poteAiUniverse';
universe.setAttribute('aria-labelledby','poteAiUniverseTitle');
universe.innerHTML=`
 <div class="iau-shell">
  <header class="iau-header"><button class="iau-back" type="button" data-iau-close aria-label="Voltar ao PDV">‹</button><span class="iau-brand">PDV MULTIVERSAL / IA</span><button class="iau-back" type="button" data-iau-close aria-label="Fechar carteira">×</button></header>
  <section class="iau-hero"><div><small>INTELIGÊNCIA ARTIFICIAL · PREMIUM</small><h1 id="poteAiUniverseTitle">IA <span>UNIVERSE</span></h1><p>Seu universo de inteligência artificial começa aqui.</p></div><div class="iau-core" aria-hidden="true">IA</div></section>
  <div id="iauGate" role="status"></div>
  <div id="iauContent" hidden>
   <section class="iau-wallet"><div><small>CARTEIRA DIGITAL · SALDO REAL</small><strong id="iauBalance">—</strong><span>Moedas IA disponíveis</span><p>Créditos adquiridos não expiram. Cotas de franquia são contabilizadas separadamente.</p></div><div class="iau-wallet-actions"><button type="button" id="iauHistoryBtn">Extrato</button><button type="button" id="iauRefresh">Atualizar saldo</button></div></section>
   <section id="iauHistory" hidden aria-label="Extrato de créditos"></section>
   <section class="iau-store"><div class="iau-section-label">LOJA DE CRÉDITOS</div><h2>Escolha seu pacote</h2><p>Selecione a quantidade ideal para suas campanhas.</p><div class="iau-grid" id="iauPackages"></div><div id="iauPurchase" role="status" hidden></div></section>
   <section class="iau-services"><h2>Seu poder criativo</h2><button type="button" id="iauVoice">Locução profissional <span>›</span></button><p>Chef IA e imagens: integração de consumo em preparação.</p></section>
  </div>
  <footer class="iau-footer">Moedas de uso interno · Não transferíveis · Sem conversão em dinheiro</footer>
 </div>`;
document.body.append(universe);
const u=id=>universe.querySelector('#'+id);
const coin=(i)=>'<div class="iau-coins" aria-hidden="true">'+Array.from({length:[1,3,5,7,9,12][i]},(_,j)=>'<i style="--x:'+((j%3-1)*28)+'px;--y:'+(21-Math.floor(j/3)*10)+'px">IA</i>').join('')+'</div>';
u('iauPackages').innerHTML=packages.map(([amount,cents],i)=>`<article class="iau-pack" data-tier="${i}"><small>ENERGIA CRIATIVA</small>${coin(i)}<strong>${amount}</strong><span>MOEDAS IA</span><b>${brl(cents)}</b><button type="button" data-package="${i}">Comprar</button></article>`).join('');
let universeSeq=0;
async function universeRefresh(){
 const seq=++universeSeq,user=auth.currentUser;
 const allowed=permitted();u('iauContent').hidden=!allowed;u('iauGate').hidden=allowed;
 u('iauGate').textContent=allowed?'':'Acesso exclusivo aos planos PRO ativo, Vitalício e Franquia. FREE e teste gratuito não compram nem utilizam IA. Seu saldo anterior permanece preservado.';
 u('iauBalance').textContent='—';u('iauHistory').replaceChildren();u('iauHistory').hidden=true;u('iauPurchase').hidden=true;
 if(!allowed||!user)return;
 try{
  const snap=await getDoc(doc(db,'users',user.uid,'aiWallet','main'));
  if(seq!==universeSeq||!universe.open||auth.currentUser?.uid!==user.uid||!permitted())return;
  const balance=snap.exists()?snap.data().balance:0;if(!Number.isSafeInteger(balance)||balance<0)throw Error('Saldo inválido');
  u('iauBalance').textContent=balance.toLocaleString('pt-BR');
 }catch{if(seq===universeSeq&&universe.open)u('iauBalance').textContent='Indisponível';}
}
function closeUniverse(){if(universe.open)universe.close();}
function openUniverse(){
 if(!auth.currentUser||!window.POTE_APP_READY)return;
 if(!universe.open)universe.showModal();
 void universeRefresh();window.dispatchEvent(new Event('pote:ia-universe-state'));
}
universe.addEventListener('close',()=>{++universeSeq;u('iauBalance').textContent='—';u('iauHistory').replaceChildren();u('iauPurchase').hidden=true;window.dispatchEvent(new Event('pote:ia-universe-state'));});
universe.querySelectorAll('[data-iau-close]').forEach(b=>b.addEventListener('click',closeUniverse));
u('iauRefresh').addEventListener('click',universeRefresh);
u('iauPackages').addEventListener('click',e=>{
 const b=e.target.closest('[data-package]');if(!b||!permitted())return;
 const pack=packages[Number(b.dataset.package)];if(!pack)return;
 const panel=u('iauPurchase');panel.hidden=false;panel.textContent=pack[0]+' moedas IA por '+brl(pack[1])+'. Checkout PIX ainda não homologado. Nenhum pagamento ou crédito foi registrado.';panel.scrollIntoView({block:'nearest'});
});
u('iauHistoryBtn').addEventListener('click',async()=>{
 const user=auth.currentUser,panel=u('iauHistory');if(!user||!permitted())return;
 panel.hidden=!panel.hidden;if(panel.hidden)return;
 const seq=universeSeq;panel.textContent='Consultando extrato…';
 try{
  const snap=await getDocs(query(collection(db,'users',user.uid,'aiWallet','main','entries'),orderBy('at','desc'),limit(30)));
  if(seq!==universeSeq||!universe.open||auth.currentUser?.uid!==user.uid||!permitted())return;
  panel.replaceChildren();
  if(snap.empty)panel.textContent='Nenhuma movimentação.';
  for(const entry of snap.docs){const d=entry.data(),row=document.createElement('p');row.textContent=(d.delta>0?'+':'')+d.delta+' IA · '+String(d.reason||'Movimentação')+' · saldo '+d.after;panel.append(row);}
 }catch{if(seq===universeSeq)panel.textContent='Extrato indisponível.';}
});
u('iauVoice').addEventListener('click',()=>{if(!permitted())return;closeUniverse();if(typeof go==='function'){go('creative');requestAnimationFrame(()=>document.getElementById('csVoiceStudio')?.scrollIntoView({block:'start'}));}});
window.POTE_IA_UNIVERSE={open:openUniverse,close:closeUniverse,isOpen:()=>universe.open};
window.addEventListener('pote:user-logout',closeUniverse);
for(const name of ['pote:license-updated','pote:profile-updated'])window.addEventListener(name,()=>{if(universe.open)void universeRefresh();});
window.dispatchEvent(new Event('pote:ia-universe-ready'));
