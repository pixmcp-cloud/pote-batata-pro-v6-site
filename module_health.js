/* F07/F15: versioned runtime contracts. A namespace without its methods is NOT healthy. */
(function(root){
"use strict";
const critical=Object.freeze({
 estoque:{name:"POTE_STOCK",methods:["number","purchase","adjust"]},
 pedidos:{name:"POTE_ORDER",methods:["checkOrder","checkBeforeProduce"]},
 cancelamentos:{name:"POTE_CANCEL",methods:["open","perform"]},
 perdas:{name:"POTE_LOSSES",methods:["stockLoss","recordCancelled"]},
 pagamentos:{name:"POTE_PAYMENT",methods:["toCents","validate","calculate"]},
 precificacao:{name:"POTE_FINANCE",methods:["parseNumber","result"]},
 custoHistorico:{name:"POTE_COST_HISTORY",methods:["unitCost","capture"]}
});
const optional=Object.freeze({
 radar:"POTE_GARIMPO",franquias:"POTE_UNIVERSES",
 reposicao:"POTE_STOCK_UI",auditoria:"POTE_APP_AUDIT"
});
function scan(){
 const missing=[],invalid=[];
 for(const [label,contract] of Object.entries(critical)){
  const module=root[contract.name];
  if(!module){missing.push(label);continue}
  const absent=contract.methods.filter(method=>typeof module[method]!=="function");
  if(absent.length)invalid.push({module:label,missingMethods:absent});
 }
 const warnings=Object.entries(optional).filter(([,name])=>!root[name]).map(([label])=>label);
 const unavailable=[...missing,...invalid.map(x=>x.module)];
 const result={version:1,safeToOperate:unavailable.length===0,missing:unavailable,
  invalid,warnings,at:new Date().toISOString()};
 root.POTE_MODULE_HEALTH=result;
 if(unavailable.length){
  const el=document.getElementById("poteSyncStatus");
  if(el){
   el.textContent="MODULO INDISPONIVEL: "+unavailable.join(", ")+". Producao bloqueada.";
   el.setAttribute?.("role","alert");
  }
  console.error("Dependencias criticas ausentes ou incompletas:",unavailable);
 }
 return result;
}
root.POTE_MODULE_CONTRACTS=Object.freeze({version:1,critical,optional});
root.POTE_HEALTH=Object.freeze({scan});
root.addEventListener?.("pote:user-ready",scan);
root.addEventListener?.("pote:license-updated",()=>{
 if(root.POTE_APP_READY&&root.POTE_MODULE_HEALTH?.safeToOperate===false)scan();
});
})(typeof window!=="undefined"?window:globalThis);
