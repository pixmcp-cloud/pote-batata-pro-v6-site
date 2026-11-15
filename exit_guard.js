/* Guardas de navegação para sessões autenticadas. Navegadores móveis podem restringir beforeunload. */
(function(){
"use strict";
if(window.POTE_EXIT)return;
let armed=false,leaving=false,dialog=null;
const logged=()=>!!window.POTE_AUTH?.uid;
function ensure(){
 if(dialog)return dialog;
 dialog=document.createElement("div");dialog.id="poteExitConfirm";dialog.hidden=true;
 dialog.innerHTML='<section class="pote-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="poteExitTitle">'+
  '<small>CONFIRMAÇÃO DE SAÍDA</small><h2 id="poteExitTitle">Deseja sair da Gestão Pro?</h2>'+
  '<p>Você pode continuar na tela atual. Verifique a sincronização antes de sair para não perder alterações recentes.</p>'+
  '<div class="pote-exit-actions"><button id="poteExitStay" type="button" class="btn">Permanecer no aplicativo</button>'+
  '<button id="poteExitLeave" type="button" class="btn line">Sair desta página</button></div></section>';
 document.body.appendChild(dialog);
 document.getElementById("poteExitStay").addEventListener("click",()=>{dialog.hidden=true});
 document.getElementById("poteExitLeave").addEventListener("click",()=>{
  dialog.hidden=true;leaving=true;history.go(-2);
 });
 return dialog;
}
function arm(){
 if(!logged()||armed)return;
 armed=true;leaving=false;
 try{history.pushState({poteProtected:true},"",location.href)}catch(e){console.warn("Proteção do botão voltar indisponível",e)}
}
function disarm(){armed=false;leaving=true;if(dialog)dialog.hidden=true}
window.addEventListener("popstate",()=>{
 if(!logged()||!armed||leaving)return;
 try{history.pushState({poteProtected:true},"",location.href)}catch(e){}
 ensure().hidden=false;
});
window.addEventListener("beforeunload",event=>{
 if(!logged()||leaving)return;
 // O navegador decide se exibe o aviso nativo de navegação; em Android pode não mostrar.
 event.preventDefault();event.returnValue="";
});
window.addEventListener("pote:user-ready",arm);
window.addEventListener("pote:user-logout",disarm);
if(logged())arm();
window.POTE_EXIT={arm,disarm,confirmLogout:()=>!logged()||window.confirm(
 "Sair da sua conta? O aplicativo fechará a sessão Google. Confira se os dados estão sincronizados antes de confirmar."
 ),isArmed:()=>armed};
})();
