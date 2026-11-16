/* Verificação de dependências críticas após a carga dos scripts.
   A interface não deve permitir operações parciais quando um módulo falhou. */
(function(root){
"use strict";
const critical={
 estoque:"POTE_STOCK",
 pedidos:"POTE_ORDER",
 cancelamentos:"POTE_CANCEL",
 perdas:"POTE_LOSSES",
 pagamentos:"POTE_PAYMENT",
 precificação:"POTE_FINANCE"
};
const optional={
 radar:"POTE_GARIMPO",franquias:"POTE_UNIVERSES",
 reposição:"POTE_STOCK_UI",auditoria:"POTE_APP_AUDIT"
};
function scan(){
 const missing=Object.entries(critical).filter(([,name])=>!root[name]).map(([label])=>label);
 const warning=Object.entries(optional).filter(([,name])=>!root[name]).map(([label])=>label);
 const result={safeToOperate:missing.length===0,missing,warnings:warning,at:new Date().toISOString()};
 root.POTE_MODULE_HEALTH=result;
 if(missing.length){
  const el=document.getElementById("poteSyncStatus");
  if(el){el.textContent="MÓDULO INDISPONÍVEL: "+missing.join(", ")+". Produção bloqueada.";el.setAttribute?.("role","alert")}
  console.error("Dependências críticas ausentes:",missing);
 }
 return result;
}
root.POTE_HEALTH={scan};
root.addEventListener?.("pote:user-ready",scan);
root.addEventListener?.("pote:license-updated",()=>{
 if(root.POTE_APP_READY&&root.POTE_MODULE_HEALTH?.safeToOperate===false)scan();
});
})(typeof window!=="undefined"?window:globalThis);
