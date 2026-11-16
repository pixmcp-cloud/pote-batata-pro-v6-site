/* Teclado contextual de inputs — somente campos realmente numéricos.
 * inputmode altera o teclado do celular, sem converter o valor nem aceitar letras.
 * Mantém teclado comum para nomes, descrições, endereços e observações. */
(function(root){
"use strict";
if(root.POTE_NUMERIC_INPUT)return;
const PHONE=/(?:^|[._-])(?:phone|telefone|celular|whatsapp)(?:$|[._-])|(?:Phone|Telefone|WhatsApp)$/;
const MONEY=/(?:price|preco|valor|cost|custo|fee|tax|margin|markup|gain|amount|cash|money|received|recebido|discount|desconto|troco|payment|pix|sangria|suprimento|reembolso)/i;
const QUANTITY=/(?:qty|quant|stock|estoque|minimum|minimo|weight|peso|gram|volume|volume|yield|rendimento|percent|percentage|unidade|units|metas?|tempo|time|times|hour|kg|ml|litro|porcao)/i;
const ENUM_IDS=/^(?:amt-|times-|pote-price-|pote-cost-)/i;
function infer(el){
 if(!el||String(el.tagName||"").toUpperCase()!=="INPUT")return "";
 const type=String(el.getAttribute?.("type")||el.type||"text").toLowerCase();
 const allowed=["text","number","tel"];
 if(!allowed.includes(type)||el.disabled||el.readOnly)return "";
 const chosen=el.getAttribute?.("inputmode");
 if(chosen)return chosen;
 const explicit=el.getAttribute?.("data-numeric");
 if(explicit==="decimal"||explicit==="numeric"||explicit==="tel")return explicit;
 if(type==="tel")return "tel";
 if(type==="number")return el.getAttribute?.("step")==="1"?"numeric":"decimal";
 const key=String(el.id||el.name||"");
 if(/(?:Phone|Telefone|WhatsApp)|^(?:phone|telefone|celular)$/i.test(key)||PHONE.test(key))return "tel";
 if(MONEY.test(key)||ENUM_IDS.test(key))return "decimal";
 if(QUANTITY.test(key))return "decimal";
 const label=el.closest?.("label")?.textContent||"";
 if(/\(R\$\)|\(\s*(?:g|kg|ml|L|un|%)\s*\)|\b(?:valor|preço|custo)\s*\(R\$\)/i.test(label))return "decimal";
 return "";
}
function apply(el){
 const mode=infer(el);
 if(mode&&!el.hasAttribute("inputmode")){
  el.setAttribute("inputmode",mode);
  if(mode==="decimal"||mode==="numeric")el.setAttribute("enterkeyhint","done");
 }
 return mode;
}
function scan(rootNode){
 if(!rootNode)return 0;
 let count=0;
 if(String(rootNode.tagName||"").toUpperCase()==="INPUT")count+=!!apply(rootNode);
 for(const input of rootNode.querySelectorAll?.("input")||[])count+=!!apply(input);
 return count;
}
const observer=typeof MutationObserver!=="undefined"?new MutationObserver(records=>{
 for(const entry of records)for(const node of entry.addedNodes||[])
  if(node.nodeType===1)scan(node);
}):null;
function start(){
 if(!document.body)return;
 scan(document.body);
 observer?.observe(document.body,{childList:true,subtree:true});
}
document.addEventListener("focusin",e=>apply(e.target),true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
root.POTE_NUMERIC_INPUT={infer,apply,scan};
})(typeof window!=="undefined"?window:globalThis);
