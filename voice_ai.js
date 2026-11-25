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
function renderChars(){
 const field=$("csVoiceText"),label=$("csVoiceChars"),seconds=Number($("csVoiceDuration")?.value||15);
 if(!field||!label)return;
 const cap=seconds*10;field.maxLength=cap;
 label.textContent=field.value.length+" / "+cap+" caracteres · "+seconds/15+" IA"+(field.value.length>cap?" · Reduza o texto ou escolha outra duração.":"");
}
function clear(){quote=null;uid=null;if($("csAiWallet"))$("csAiWallet").hidden=true;if($("csAiPackages"))$("csAiPackages").hidden=true;if($("csAiHistory")){$("csAiHistory").replaceChildren();$("csAiHistory").hidden=true;}renderQuota(null);if($("csVoiceAudio")){$("csVoiceAudio").pause();$("csVoiceAudio").removeAttribute("src");$("csVoiceAudio").hidden=true;}if($("csVoiceDownload")){$("csVoiceDownload").removeAttribute("href");$("csVoiceDownload").hidden=true;}if($("csVoiceForm"))$("csVoiceForm").hidden=true;if($("csVoiceGenerate"))$("csVoiceGenerate").disabled=true;if(url)URL.revokeObjectURL(url);url=null;}
const permitted=()=>{
 const p=window.POTE_AUTH,flag=p?.accessPolicy?.voiceAiEnabled;
 if(!auth.currentUser||p?.uid!==auth.currentUser.uid||flag===false)return false;
 if(p.role==="admin"||p.franchiseActive===true)return true;
 return p.proActive===true&&(p.plan==="lifetime"||(p.plan==="pro"&&Number.isFinite(p.expiresAt)&&p.expiresAt>Date.now()));
};
const packages=Object.freeze([[5,990],[10,1790],[25,3990],[50,6990],[75,9490],[100,11990]].map(Object.freeze));
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
  $("csVoiceText").value=["creativeHeadline","creativeBody","creativeCta"].map(id=>$(id)?.value||"").filter(Boolean).join(". ").slice(0,750);
  $("csVoiceDuration").value=String(Math.min(75,Math.max(15,Math.ceil($("csVoiceText").value.length/150)*15)));
  $("csVoiceForm").hidden=false;renderQuota(data.franchiseAllocation);renderChars();
  state("Saldo de IA: "+data.balance+" créditos. "+allocationText(data.franchiseAllocation)+" Confira o orçamento antes de gerar.");
  $("csVoicePrice").onclick=price;
  $("csVoiceGenerate").onclick=generate;
  for(const id of ["csVoiceText","csVoiceSelect","csVoiceDuration"])$(id).oninput=()=>{renderChars();quote=null;$("csVoiceGenerate").disabled=true;$("csVoiceQuote").textContent="Recalcule o orçamento."};
 }catch(e){clear();state(e.message)}
}
function allocationText(q){return q?" Sua cota: "+q.share+" créditos do provedor · usados/reservados: "+q.used+" · disponíveis: "+q.remaining+" · "+q.count+" franquias ativas.":"";}
async function price(){
 if(busy)return;busy=true;quote=null;$("csVoiceGenerate").disabled=true;
 try{
  const text=$("csVoiceText").value.trim(),voiceId=$("csVoiceSelect").value;
  const seconds=Number($("csVoiceDuration").value);
  if(![15,30,45,60,75].includes(seconds)||!text||text.length>seconds*10)throw Error("Ajuste o texto ao limite da duração escolhida.");
  const data=await(await api("/quote",{text,voiceId,seconds})).json();
  if(!Number.isSafeInteger(data.credits)||data.credits!==seconds/15||data.seconds!==seconds||typeof data.quoteId!=="string")throw Error("Orçamento inválido.");
  quote={id:data.quoteId,credits:data.credits,text,voiceId,seconds};renderQuota(data.franchiseAllocation);
  $("csVoiceQuote").textContent="Custo: "+data.credits+" créditos IA · saldo: "+data.balance+allocationText(data.franchiseAllocation);
  $("csVoiceGenerate").disabled=data.balance<data.credits;if(data.balance<data.credits){$("csAiWallet").hidden=false;state("Saldo insuficiente. Consulte os pacotes na carteira IA.");}
 }catch(e){state(e.message)}finally{busy=false}
}
async function generate(){
 if(busy||!quote||auth.currentUser?.uid!==uid||!permitted())return;
 const q=quote; if(q.text!==$("csVoiceText").value.trim()||q.voiceId!==$("csVoiceSelect").value||q.seconds!==Number($("csVoiceDuration").value))return;
 if(!confirm("Consumir "+q.credits+" IA para a locução de "+q.seconds+" segundos estimados?"))return;
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
  <header class="iau-header"><button class="iau-back iau-orb" type="button" data-iau-close aria-label="Voltar ao PDV"><span>IA</span></button><span class="iau-brand"><strong>PDV</strong><small>MULTIVERSAL</small></span><button class="iau-back iau-close" type="button" data-iau-close aria-label="Fechar carteira">×</button></header>
  <section class="iau-hero"><h1 id="poteAiUniverseTitle"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 9V7l15-5 2 6M4 9h18a3 3 0 0 1 3 3v12H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Zm21 5h-7a3 3 0 0 0 0 6h7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg> Carteira <span>IA COIN</span></h1><p>Sua moeda para usar os recursos de IA</p></section>
  <div id="iauGate" role="status"></div>
  <div id="iauContent" hidden>
   <section class="iau-wallet"><div id="iauWalletArt" aria-hidden="true"></div><div class="iau-wallet-info"><small>Saldo disponível</small><div class="iau-balance-line"><strong id="iauBalance">—</strong><span>IA COIN</span></div><div class="iau-wallet-actions"><button type="button" id="iauBuyScroll">Comprar IA COIN</button><button type="button" id="iauHistoryBtn">Histórico</button><button type="button" id="iauRefresh" class="iau-refresh" aria-label="Atualizar saldo">↻</button></div></div></section><section class="iau-rules"><strong>ⓘ FREE não usa IA</strong><span>Acesso à IA disponível para <b>PRO, Vitalício e Franquia</b></span></section>
   <section id="iauHistory" hidden aria-label="Extrato de créditos"></section>
   <section class="iau-store" id="iauStore"><h2><span aria-hidden="true">▱</span> Loja de IA COIN</h2><p>Escolha um pacote e abasteça sua carteira IA COIN</p><div class="iau-grid" id="iauPackages"></div><div id="iauPurchase" role="status" hidden></div></section>
   <section class="iau-services"><h2>Seu poder criativo</h2><button type="button" id="iauVoice">Locução profissional <span>›</span></button><p>Chef IA e imagens: integração de consumo em preparação.</p></section>
  </div>
  <footer class="iau-footer">IA COIN · Uso interno · Não transferível · Sem conversão em dinheiro</footer>
 </div>`;
document.body.append(universe);
const u=id=>universe.querySelector('#'+id);
// Original vector artwork: ridged gold edge, holographic face and stacked coins.
const coin=(tier,prefix='pack'+tier)=>{
 const n=[1,2,3,5,7,10][tier],id='iau-'+prefix;
 const stack=Array.from({length:n-1},(_,j)=>{
  const x=47+(j%3)*34,y=104-Math.floor(j/3)*13;
  return '<g transform="translate('+x+' '+y+')"><ellipse cy="7" rx="27" ry="10" fill="url(#'+id+'-edge)" stroke="#d9a34b"/><rect x="-27" y="0" width="54" height="8" fill="url(#'+id+'-edge)"/><ellipse rx="27" ry="10" fill="url(#'+id+'-face)" stroke="#ffe2a2" stroke-width="1.8"/><ellipse rx="21" ry="7" fill="none" stroke="#e078ff" opacity=".75"/></g>';
 }).join('');
 return '<svg class="iau-coin-art" viewBox="0 0 180 132" aria-hidden="true"><defs><linearGradient id="'+id+'-edge"><stop stop-color="#663507"/><stop offset=".23" stop-color="#f4cb73"/><stop offset=".43" stop-color="#7f420e"/><stop offset=".65" stop-color="#ffdc83"/><stop offset="1" stop-color="#7b3c19"/></linearGradient><radialGradient id="'+id+'-face" cx=".28" cy=".22" r=".86"><stop stop-color="#765df4"/><stop offset=".42" stop-color="#251651"/><stop offset=".8" stop-color="#130c2d"/><stop offset="1" stop-color="#30267b"/></radialGradient><linearGradient id="'+id+'-rim" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#00e8ff"/><stop offset=".35" stop-color="#9868ff"/><stop offset=".65" stop-color="#f853ed"/><stop offset="1" stop-color="#ffd789"/></linearGradient></defs><ellipse cx="90" cy="116" rx="69" ry="9" fill="none" stroke="#00deff" opacity=".52"/>'+stack+'<g transform="translate('+ (n===1?90:109)+' 63) rotate(-17)"><ellipse cx="5" cy="5" rx="38" ry="48" fill="url(#'+id+'-edge)" stroke="#f8d27b" stroke-width="2"/><ellipse rx="38" ry="48" fill="url(#'+id+'-face)" stroke="#ffe19a" stroke-width="3"/><ellipse rx="33" ry="43" fill="none" stroke="url(#'+id+'-rim)" stroke-width="5"/><ellipse rx="28" ry="37" fill="none" stroke="#b79dff" stroke-dasharray="1 5" stroke-width="2"/><ellipse rx="23" ry="31" fill="none" stroke="#9774e2" opacity=".5"/><text y="9" text-anchor="middle" fill="#f7d8ff" stroke="#c490ff" stroke-width=".6" font-family="system-ui,sans-serif" font-size="29" font-weight="900">IA</text><path d="M-24 -31Q-10 -45 6 -43" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g></svg>';
};
u('iauWalletArt').innerHTML=coin(3,'wallet');
u('iauPackages').innerHTML=packages.map(([amount,cents],i)=>'<article class="iau-pack" data-tier="'+i+'"><div class="iau-coins">'+coin(i)+'</div><div class="iau-amount"><strong>'+amount+'</strong> <span>IA COIN</span></div><b>'+brl(cents)+'</b><button type="button" data-package="'+i+'"><span aria-hidden="true">＋</span> Comprar</button></article>').join('');
u('iauBuyScroll').addEventListener('click',()=>{if(permitted())u('iauStore').scrollIntoView({block:'start'});});
const isOwnAdmin=()=>{const p=window.POTE_AUTH,user=auth.currentUser;return !!user&&p?.uid===user.uid&&p.role==='admin'&&user.email?.toLowerCase()==='pixmcp@gmail.com';};
const creditDialog=document.createElement('dialog');
creditDialog.id='iauAdminCredit';creditDialog.setAttribute('aria-labelledby','iauAdminCreditTitle');
creditDialog.innerHTML='<h2 id="iauAdminCreditTitle">Adicionar IA COIN</h2><p id="iauCreditPrompt"></p><p id="iauCreditStatus" role="status" aria-live="polite"></p><div class="iau-credit-actions"><button type="button" id="iauCreditCancel">Cancelar</button><button type="button" id="iauCreditConfirm">Adicionar saldo</button></div>';
document.body.append(creditDialog);
const cd=id=>creditDialog.querySelector('#'+id);
let selectedCredit=null,creditBusy=false;
function closeCredit(){if(creditBusy)return;if(creditDialog.open)creditDialog.close();selectedCredit=null;}
cd('iauCreditCancel').addEventListener('click',closeCredit);
creditDialog.addEventListener('cancel',e=>{if(creditBusy)e.preventDefault();else selectedCredit=null;});
function showCredit(amount){
 if(creditBusy||!isOwnAdmin())return;
 selectedCredit={amount,uid:auth.currentUser.uid,eventId:crypto.randomUUID()};
 cd('iauCreditPrompt').textContent='Adicionar '+amount+' IA COIN à sua própria conta ADM? Sem cobrança real.';
 cd('iauCreditStatus').textContent='';cd('iauCreditConfirm').disabled=false;cd('iauCreditConfirm').textContent='Adicionar saldo';cd('iauCreditCancel').disabled=false;cd('iauCreditCancel').textContent='Cancelar';
 if(!creditDialog.open)creditDialog.showModal();
}
cd('iauCreditConfirm').addEventListener('click',async()=>{
 const selected=selectedCredit;if(creditBusy||!selected||!isOwnAdmin()||auth.currentUser?.uid!==selected.uid)return;
 creditBusy=true;cd('iauCreditConfirm').disabled=true;cd('iauCreditCancel').disabled=true;cd('iauCreditStatus').textContent='Registrando saldo…';
 try{
  const api=window.POTE_ADMIN_PERMISSIONS;if(!api?.addOwnWalletPackage)throw Error('Módulo ADM indisponível. Atualize a página.');
  const next=await api.addOwnWalletPackage(selected.amount,selected.eventId,selected.uid);
  if(auth.currentUser?.uid!==selected.uid||!isOwnAdmin())return;
  cd('iauCreditStatus').textContent='Adicionado com sucesso! Novo saldo: '+next.toLocaleString('pt-BR')+' IA COIN.';
  cd('iauCreditCancel').textContent='Fechar';selectedCredit=null;
  if(universe.open)await universeRefresh();
  void refreshWallet();
 }catch(e){
  if(auth.currentUser?.uid===selected.uid&&isOwnAdmin()){
   cd('iauCreditStatus').textContent=e.code==='permission-denied'?'O Firebase recusou o ajuste. Verifique as permissões da carteira e a autorização ADM. Nenhum saldo foi confirmado.':'Não foi possível confirmar o ajuste: '+(e.code||e.message)+'. Você pode tentar novamente sem duplicar o crédito.';
   cd('iauCreditConfirm').disabled=false;cd('iauCreditConfirm').textContent='Tentar novamente';
  }
 }finally{creditBusy=false;cd('iauCreditCancel').disabled=false;if(auth.currentUser?.uid!==selected.uid)closeCredit();}
});
let universeSeq=0;
async function universeRefresh(){
 const seq=++universeSeq,user=auth.currentUser;
 const allowed=permitted();u('iauPackages').querySelectorAll('[data-package]').forEach(b=>{b.textContent=isOwnAdmin()?'+ Adicionar':'+ Comprar';});u('iauContent').hidden=!allowed;u('iauGate').hidden=allowed;
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
 if(isOwnAdmin()){showCredit(pack[0]);return;}
 const panel=u('iauPurchase');panel.hidden=false;panel.textContent=pack[0]+' IA COIN por '+brl(pack[1])+'. Checkout PIX ainda não homologado. Nenhum pagamento ou crédito foi registrado.';panel.scrollIntoView({block:'nearest'});
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
  for(const entry of snap.docs){const d=entry.data(),row=document.createElement('p');row.textContent=(d.delta>0?'+':'')+d.delta+' IA COIN · '+String(d.reason||'Movimentação')+' · saldo '+d.after;panel.append(row);}
 }catch{if(seq===universeSeq)panel.textContent='Extrato indisponível.';}
});
u('iauVoice').addEventListener('click',()=>{if(!permitted())return;closeUniverse();if(typeof go==='function'){go('creative');requestAnimationFrame(()=>document.getElementById('csVoiceStudio')?.scrollIntoView({block:'start'}));}});
window.POTE_IA_UNIVERSE={open:openUniverse,close:closeUniverse,isOpen:()=>universe.open};
window.addEventListener('pote:user-logout',()=>{if(creditDialog.open)creditDialog.close();selectedCredit=null;closeUniverse();});
for(const name of ['pote:license-updated','pote:profile-updated'])window.addEventListener(name,()=>{if(universe.open)void universeRefresh();});
window.dispatchEvent(new Event('pote:ia-universe-ready'));
