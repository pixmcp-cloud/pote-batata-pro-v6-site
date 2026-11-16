/* Avisos de versão: cada nova notícia volta a aparecer. Preferência isolada por conta e navegador. */
(function(){
"use strict";
if(window.POTE_RELEASE_NEWS)return;
const RELEASE={
 id:"2026-11-15-perdas-unidades-contextuais-06",
 date:"15/11/2026",
 title:"Novidades da Gestão Pro",
 items:[
  ["Unidade certa para cada perda","Água, refrigerante e outras bebidas embaladas agora usam garrafa/lata por unidade. Embalagens usam unidades; leite e molhos em L/ml; alimentos sólidos em kg/g."],
  ["Perdas e prejuízos","Registre descarte de ingredientes, avaria de bebidas, cancelamentos após produção e pedidos não pagos, sem baixar duas vezes."],
  ["Sobra e lucro separados","Os relatórios passam a separar contribuição da venda, despesas fixas, custo perdido e valor não recebido."],
  ["Reposição da franquia","Potes, talheres e sacolas usados na produção ficam visíveis na lista de estoque. Use Repor estoque faltante para abrir a compra correspondente."],
  ["Atualização de estoque","Nova janela para compras por unidade, dúzia, pacote de 10, quilogramas, litros ou lote personalizado, sempre registrando quanto foi pago."],
  ["Cancelamento de pedidos","Escolha entre devolver ingredientes/embalagens e bebidas ao estoque ou registrar a perda. A mesma devolução não pode acontecer duas vezes."],
  ["Adicionais sem duplicação","Uma única área de adicionais, com quantidade livre para bacon 2×, 3× ou mais, e preço e baixa proporcionais."],
  ["Estoque prioritário","Itens faltantes agora aparecem primeiro. Vermelho: faltante, laranja: baixo e verde: saldo suficiente, descontadas as reservas."],
  ["Lixeira de produtos","Excluir ou restaurar cadastros do estoque. Para potes duplicados, transferir o saldo e substituir nas receitas sem apagar o histórico."],
  ["Pedidos e recibos","Comandas completas, personalização dos ingredientes e pagamento com troco automático."],
  ["Combos e bebidas","Águas, refrigerantes e combo de batata + refri com desconto de 5%."]
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
