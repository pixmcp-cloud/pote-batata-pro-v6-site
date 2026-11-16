/* Avisos de versão: cada nova notícia volta a aparecer. Preferência isolada por conta e navegador. */
(function(){
"use strict";
if(window.POTE_RELEASE_NEWS)return;
const RELEASE={
 id:"2026-11-16-franquia-precos40-03",
 date:"16/11/2026",
 title:"Preços sugeridos por sabor e custos de teste a 40%",
 items:[
  ["Nova base para contas de teste","A operação passou a utilizar registros V2 separados por conta e negócio. Os pedidos e cadastros antigos de teste não são importados automaticamente. O código anterior continua preservado."],
  ["Estoque e pedidos mais protegidos","Gravações de estoque e pedidos utilizam transações com detecção de conflitos entre dispositivos. Caso haja divergência, exporte o backup e entre novamente."],
  ["Preços comerciais de teste","Os 26 sabores agora têm preços sugeridos por tipo de recheio, com base em referências de cardápios de SC. O custo direto estimado vale 40% do preço-base (não diminui com descontos). Valores simulados não representam notas fiscais nem compras reais."],
  ["Radar de Preço nacional","Os mercados são buscados conforme GPS, com cache temporário e fontes regionais. Ofertas de clube têm comparação separada."],
  ["Backups e auditoria","Importação exige confirmação, cópia prévia e validação. Uma falha de módulo essencial bloqueia operações críticas."],
  ["Galeria e imagens","A galeria ainda mantém imagens locais no dispositivo. A sincronização em nuvem não foi ativada para evitar custos adicionais."]
 ]
};
const $=id=>document.getElementById(id);
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let lastShown="",visible=false;
function key(){
 const uid=String(window.POTE_AUTH?.uid||"").trim();
 if(!uid)return "";
 return "pote-release-hidden:"+uid+":"+RELEASE.id;
}
function dismissed(){
 try{return !!key()&&localStorage.getItem(key())==="yes"}catch(_){return false}
}
function remember(){
 try{if(key())localStorage.setItem(key(),"yes")}catch(e){console.warn("Preferência de notícias só nesta sessão",e)}
}
function create(){
 let dialog=$("poteReleaseNews");if(dialog)return dialog;
 dialog=document.createElement("div");dialog.id="poteReleaseNews";dialog.hidden=true;
 dialog.innerHTML='<section class="pote-news-dialog" role="dialog" aria-modal="true" aria-labelledby="poteNewsTitle">'+
 '<small>ATUALIZAÇÃO DO APLICATIVO · '+safe(RELEASE.date)+'</small>'+
 '<h2 id="poteNewsTitle">'+safe(RELEASE.title)+'</h2>'+
 '<p>Veja as novidades disponíveis nesta atualização:</p>'+
 '<div class="pote-news-list">'+RELEASE.items.map(x=>'<article><strong>'+safe(x[0])+'</strong><span>'+safe(x[1])+'</span></article>').join("")+'</div>'+
 '<label class="pote-news-checkbox"><input type="checkbox" id="poteNewsDontShow"><span>✔ Não mostrar novamente esta notícia</span></label>'+
 '<button type="button" id="poteNewsClose" class="btn">Entendi · continuar usando</button>'+
 '<small>Quando houver uma nova notícia, o aviso reaparecerá mesmo que você marque esta opção.</small>'+
 '</section>';
 document.body.appendChild(dialog);
 $("poteNewsClose").addEventListener("click",close);
 return dialog;
}
function open(force=false){
 if(!window.POTE_AUTH?.uid||!window.POTE_APP_READY)return false;
 if(!force&&(dismissed()||lastShown===RELEASE.id))return false;
 const dialog=create();
 $("poteNewsDontShow").checked=dismissed();
 dialog.hidden=false;visible=true;lastShown=RELEASE.id;
 $("poteNewsClose")?.focus?.();
 return true;
}
function close(){
 if($("poteNewsDontShow")?.checked)remember();
 const dialog=$("poteReleaseNews");if(dialog)dialog.hidden=true;
 visible=false;
}
function logout(){
 close();lastShown="";
}
window.addEventListener("pote:user-ready",()=>open());
window.addEventListener("pote:user-logout",logout);
window.POTE_RELEASE_NEWS={RELEASE,open,close,dismissed,key,isVisible:()=>visible};
if(window.POTE_APP_READY&&window.POTE_AUTH?.uid)open();
})();
