/* Oferta interna de assinatura, sem anúncios de terceiros ou serviço pago. */
(function(){
"use strict";
const KEY="pote-pro-offer-session-v1",DURATION=30000;
let activeUid=null,deadline=0,interval=null,dialog=null;
const eligible=()=>{const a=window.POTE_AUTH;return Boolean(window.POTE_APP_READY&&a?.uid&&a.role!=="admin"&&!a.proActive&&!a.franchiseActive&&a.plan==="free");};
function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{return null;}}
function write(value){try{if(value)sessionStorage.setItem(KEY,JSON.stringify(value));else sessionStorage.removeItem(KEY);}catch{}}
function stop(){if(interval!==null){clearInterval(interval);interval=null;}}
function close(){stop();if(dialog?.open)dialog.close();}
function remaining(){return Math.max(0,Math.min(30,Math.ceil((deadline-Date.now())/1000)));}
function tick(){
 if(!eligible()||window.POTE_AUTH.uid!==activeUid){close();return;}
 const seconds=remaining();
 dialog.querySelector("#poteOfferSeconds").textContent=String(seconds).padStart(2,"0");
 dialog.querySelector("#poteOfferProgress").value=30-seconds;
 dialog.querySelector("#poteOfferClose").hidden=seconds>0;
 dialog.querySelector("#poteOfferWait").textContent=seconds?"Você poderá fechar em instantes.":"Você já pode fechar esta oferta.";
 if(!seconds)stop();
}
function ensure(){
 if(dialog)return dialog;
 dialog=document.createElement("dialog");
 dialog.id="poteProOffer";dialog.setAttribute("aria-labelledby","poteOfferTitle");
 dialog.innerHTML=`<div class="pote-offer-shell">
 <header class="pote-offer-head"><span class="pote-offer-logo">PRO</span><div class="pote-offer-timer"><span id="poteOfferSeconds" role="timer" aria-label="Segundos restantes">30</span><small>segundos</small></div><button type="button" id="poteOfferClose" hidden aria-label="Fechar oferta">×</button></header>
 <div class="pote-offer-content"><span class="pote-offer-eyebrow">GESTÃO PRO · SUA EMPRESA, SEM LIMITES DE SEGMENTO</span>
 <h2 id="poteOfferTitle">Seu negócio cresce.<br>O PRO acompanha.</h2><p class="pote-offer-lead">Uma assinatura para operar todos os segmentos gastronômicos.</p>
 <div class="pote-offer-segments"><span>🥔 Batataria</span><span>🍕 Pizzaria</span><span>🍔 Hamburgueria</span><span>🌭 Hot Dog</span><span>🥟 Pastelaria</span><span>🍽 Lancheria</span></div>
 <div class="pote-offer-benefits"><div>✓ Receitas e fichas técnicas ampliadas</div><div>✓ Estoque e gestão de desperdícios</div><div>✓ PDV, vendas e gestão financeira</div><div>✓ Precificação e margem de lucro</div><div>✓ Criativos e ferramentas de IA</div><div>✓ Radar de fornecedores e Delivery Hub</div></div>
 <p class="pote-offer-note">Consulte as condições da assinatura e a disponibilidade dos recursos. Integrações de pedidos e outros módulos em homologação não são anunciados como disponíveis.</p>
 <a id="poteOfferContact" class="pote-offer-cta" href="https://wa.me/5548999951729?text=Ol%C3%A1%21%20Quero%20conhecer%20o%20plano%20PRO%20do%20PDV." target="_blank" rel="noopener noreferrer">Quero conhecer o PRO →</a>
 <progress id="poteOfferProgress" value="0" max="30" aria-label="Progresso da contagem regressiva"></progress><p id="poteOfferWait" class="pote-offer-wait">Você poderá fechar em instantes.</p>
 <button type="button" id="poteOfferLogout">Sair da conta</button></div></div>`;
 document.body.append(dialog);
 dialog.querySelector("#poteOfferClose").addEventListener("click",()=>{if(remaining()!==0)return;write({uid:activeUid,done:true});close();});
 dialog.querySelector("#poteOfferLogout").addEventListener("click",()=>document.getElementById("poteExit")?.click());
 dialog.addEventListener("cancel",event=>{event.preventDefault();if(remaining()===0){write({uid:activeUid,done:true});close();}});
 return dialog;
}
function show(){
 if(!eligible())return;
 const uid=window.POTE_AUTH.uid;if(dialog?.open&&activeUid===uid)return;
 const saved=read();if(saved?.uid===uid&&saved.done===true)return;
 activeUid=uid;
 deadline=saved?.uid===uid&&Number.isFinite(saved.deadline)?Math.min(saved.deadline,Date.now()+DURATION):Date.now()+DURATION;
 write({uid,deadline});ensure().showModal();tick();
 if(remaining()>0)interval=setInterval(tick,250);
}
window.addEventListener("pote:user-ready",show);
window.addEventListener("pote:license-updated",()=>{if(dialog?.open&&!eligible()){write(null);close();}});
window.addEventListener("pote:user-logout",event=>{close();const saved=read();if(event.detail?.signedOut||saved?.uid&&event.detail?.nextUid&&saved.uid!==event.detail.nextUid)write(null);activeUid=null;});
if(window.POTE_APP_READY)show();
})();