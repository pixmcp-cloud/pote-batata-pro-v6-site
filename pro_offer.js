/* Oferta interna de assinatura, sem anúncios de terceiros ou serviço pago. */
(function(){
"use strict";
const KEY="pote-pro-offer-session-v2",SEEN="pote-pro-offer-seen-v2:",LIMIT=50;
let activeUid=null,deadline=0,interval=null,dialog=null,duration=10,kind="login",session=null;
const campaigns=[
 ["Seu negócio cresce.<br>O PRO acompanha.","Uma assinatura para operar todos os segmentos gastronômicos."],
 ["Controle seus custos.<br>Proteja seu lucro.","Precificação, estoque e ferramentas para administrar melhor seu delivery."],
 ["Mais organização.<br>Menos desperdício.","Fichas técnicas, gestão financeira e controle de estoque."],
 ["Expanda seu delivery.<br>Sem trocar de sistema.","Todos os segmentos gastronômicos com uma única assinatura PRO."]
];
function seen(uid){try{return localStorage.getItem(SEEN+uid)==="1";}catch{return false;}}
function markSeen(uid){try{localStorage.setItem(SEEN+uid,"1");}catch{}}
function save(){if(session)write(session);}
function finish(){if(!session)return;if(kind==="login"){session.done=true;markSeen(activeUid);}else{session.count=Math.max(0,session.count-LIMIT);}session.offer=null;save();close();}
const eligible=()=>{const a=window.POTE_AUTH;return Boolean(window.POTE_APP_READY&&a?.uid&&a.role!=="admin"&&!a.proActive&&!a.franchiseActive&&a.plan==="free");};
function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{return null;}}
function write(value){try{if(value)sessionStorage.setItem(KEY,JSON.stringify(value));else sessionStorage.removeItem(KEY);}catch{}}
function stop(){if(interval!==null){clearInterval(interval);interval=null;}}
function close(){stop();if(dialog?.open)dialog.close();}
function remaining(){return Math.max(0,Math.min(duration,Math.ceil((deadline-Date.now())/1000)));}
function tick(){
 if(!eligible()||window.POTE_AUTH.uid!==activeUid){close();return;}
 const seconds=remaining();
 dialog.querySelector("#poteOfferSeconds").textContent=String(seconds).padStart(2,"0");
 dialog.querySelector("#poteOfferProgress").value=duration-seconds;
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
 <button type="button" id="poteOfferPlans" class="pote-offer-cta">Comparar FREE e PRO</button>
 <a id="poteOfferContact" class="pote-offer-cta" href="https://wa.me/5548999951729?text=Ol%C3%A1%21%20Quero%20conhecer%20o%20plano%20PRO%20do%20PDV." target="_blank" rel="noopener noreferrer">Quero conhecer o PRO →</a>
 <progress id="poteOfferProgress" value="0" max="30" aria-label="Progresso da contagem regressiva"></progress><p id="poteOfferWait" class="pote-offer-wait">Você poderá fechar em instantes.</p>
 <button type="button" id="poteOfferLogout">Sair da conta</button></div></div>`;
 document.body.append(dialog);
 dialog.querySelector("#poteOfferClose").addEventListener("click",()=>{if(remaining()!==0)return;finish();});
 dialog.querySelector("#poteOfferPlans").addEventListener("click",()=>window.POTE_PLANS?.open());
 dialog.querySelector("#poteOfferLogout").addEventListener("click",()=>document.getElementById("poteExit")?.click());
 dialog.addEventListener("cancel",event=>{event.preventDefault();if(remaining()===0)finish();});
 return dialog;
}
function safeHome(){
 return typeof state!=="undefined"&&state.tab==="home"&&!window.POTE_SYNC_GUARD?.blocked&&!document.querySelector('dialog[open],#poteBusinessOverlay:not([hidden]),#poteAuthGate:not([hidden])');
}
function startOffer(type){
 if(!eligible()||dialog?.open||!session)return;
 kind=type;
 const prior=session.offer?.kind===type?session.offer:null;
 duration=prior?.duration===5||prior?.duration===10||prior?.duration===15?prior.duration:type==="repeat"?5:seen(activeUid)?10:15;
 deadline=Number.isFinite(prior?.deadline)?Math.min(prior.deadline,Date.now()+duration*1000):Date.now()+duration*1000;
 const number=prior?.campaign??(session.campaign||0);
 if(!prior)session.campaign=number+1;
 session.offer={kind:type,duration,deadline,campaign:number};save();
 const d=ensure(),campaign=campaigns[number%campaigns.length];
 d.querySelector("#poteOfferTitle").innerHTML=campaign[0];d.querySelector(".pote-offer-lead").textContent=campaign[1];
 d.querySelector("#poteOfferProgress").max=duration;
 d.showModal();tick();if(remaining()>0)interval=setInterval(tick,250);
}
function maybeRepeat(){
 if(eligible()&&session?.done&&session.count>=LIMIT&&safeHome())startOffer("repeat");
}
function show(){
 if(!eligible())return;
 const uid=window.POTE_AUTH.uid;if(dialog?.open&&activeUid===uid)return;
 activeUid=uid;
 const saved=read();session=saved?.uid===uid?{count:0,campaign:0,...saved}:{uid,done:false,count:0,campaign:seen(uid)?1:0,offer:null};
 save();if(!session.done)startOffer("login");else maybeRepeat();
}
document.addEventListener("click",event=>{
 if(!eligible()||!session?.done||dialog?.open||event.isTrusted!==true)return;
 const target=event.target?.closest?.('button,a,[role="button"],input[type="checkbox"],input[type="radio"],select');
 if(!target||target.disabled||target.getAttribute("aria-disabled")==="true"||target.closest("#poteProOffer"))return;
 session.count=Math.min(LIMIT,session.count+1);save();
 // Wait for the application's own handler and render; never interrupt an order or cash screen.
 setTimeout(maybeRepeat,0);
},true);
window.addEventListener("pote:user-ready",show);
window.addEventListener("pote:license-updated",()=>{if(!eligible()&&session){write(null);session=null;close();}});
window.addEventListener("pote:user-logout",event=>{close();const saved=read();if(event.detail?.signedOut||saved?.uid&&event.detail?.nextUid&&saved.uid!==event.detail.nextUid)write(null);activeUid=null;session=null;});
if(window.POTE_APP_READY)show();
})();