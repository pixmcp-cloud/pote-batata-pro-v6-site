/* Janela AVISO Potê: substitui títulos técnicos dos alertas nativos. */
(function(){
"use strict";
let container=null,oldFocus=null;
function ensure(){
 if(container&&container.isConnected)return container;
 container=document.createElement("div");
 container.id="poteNoticeDialog";
 container.className="pote-notice-overlay";
 container.hidden=true;
 container.innerHTML='<section class="pote-notice-panel" role="alertdialog" aria-modal="true" aria-labelledby="poteNoticeHeading" aria-describedby="poteNoticeText"><div class="pote-notice-mark">!</div><h2 id="poteNoticeHeading">AVISO</h2><p id="poteNoticeText"></p><button type="button" class="btn" id="poteNoticeOK">Entendi</button></section>';
 document.body.appendChild(container);
 const close=()=>{container.hidden=true;if(oldFocus?.focus)oldFocus.focus();};
 container.querySelector("#poteNoticeOK").addEventListener("click",close);
 container.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();close();}else if(event.key==="Tab"){event.preventDefault();container.querySelector("#poteNoticeOK").focus();}});
 return container;
}
function notice(message){
 if(!document?.body)return;
 const el=ensure();oldFocus=document.activeElement;
 el.querySelector("#poteNoticeText").textContent=String(message??"");
 el.hidden=false;el.querySelector("#poteNoticeOK").focus();
}
window.POTE_NOTICE={show:notice};
window.alert=notice;
})();