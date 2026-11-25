/* Área comercial: a licença é sempre definida pelo servidor/ADM. */
(function(){
"use strict";
const CONTACT="5548999951729";
const rows=[
 ["Segmentos","1 segmento escolhido","6 segmentos"],
 ["Cardápio público","Consulta e WhatsApp","Consulta e WhatsApp"],
 ["Propagandas internas","Sim","Não"],
 ["Gestão de receitas","Acesso limitado","Acesso ampliado"],
 ["Estoque e precificação","Recursos básicos","Recursos avançados"],
 ["Relatórios e criativos","Recursos básicos","Recursos avançados"],
 ["IA e integrações","Conforme disponibilidade","Conforme licença e homologação"]
];
let dialog=null;
const current=()=>window.POTE_APP_READY&&window.POTE_AUTH?.uid?window.POTE_AUTH:null;
const status=a=>a.role==="admin"?"ADM":a.franchiseActive?"Franquia":a.proActive?"PRO ativo":"FREE";
function close(){if(dialog?.open)dialog.close();}
function update(){
 const a=current(),b=document.getElementById("potePlansButton");if(b)b.hidden=!a;
 if(!a){close();return;}
 if(dialog?.open){dialog.querySelector("#potePlansStatus").textContent="Seu plano: "+status(a);const link=dialog.querySelector("#potePlansContact");link.textContent=a.proActive?"Consultar ou renovar licença":"Solicitar assinatura PRO";link.href="https://wa.me/"+CONTACT+"?text="+encodeURIComponent(a.proActive?"Olá! Quero consultar as condições de renovação da licença PRO.":"Olá! Quero conhecer o valor e contratar o plano PRO do PDV.");}
}
function open(){
 if(!current())return;
 if(!dialog){
  dialog=document.createElement("dialog");dialog.id="potePlansDialog";dialog.setAttribute("aria-labelledby","potePlansTitle");
  dialog.innerHTML='<div class="pote-plans-head"><span class="pote-offer-logo">PRO</span><button type="button" id="potePlansClose" aria-label="Fechar planos">×</button></div><h2 class="pote-plans-title" id="potePlansTitle">Escolha a sua experiência</h2><p id="potePlansStatus" class="pote-plans-status"></p><table class="pote-plans-table"><thead><tr><th>Recursos</th><th>FREE</th><th>PRO</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table><p class="pote-plans-note">Uma assinatura para todos os segmentos. Consulte valores, disponibilidade de recursos e condições com a equipe. Integração automática de pedidos, pagamentos online e demais recursos em homologação não estão incluídos como disponíveis.</p><a class="pote-plans-cta" id="potePlansContact" target="_blank" rel="noopener noreferrer">Solicitar assinatura PRO</a><p class="pote-plans-note">Solicitar não ativa a licença nem realiza cobrança. A liberação depende da confirmação pelo responsável da plataforma.</p><a class="pote-plans-support" href="mailto:contato@livresom.com">Dúvidas: contato@livresom.com</a>';
  document.body.append(dialog);dialog.querySelector("#potePlansClose").addEventListener("click",close);
 }
 if(!dialog.open)dialog.showModal();update();
}
window.POTE_PLANS={open};
document.getElementById("potePlansButton")?.addEventListener("click",open);
window.addEventListener("pote:user-ready",update);
window.addEventListener("pote:license-updated",update);
window.addEventListener("pote:user-logout",()=>{close();const b=document.getElementById("potePlansButton");if(b)b.hidden=true;});
update();
})();