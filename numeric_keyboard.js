/* Teclado contextual de inputs — somente campos realmente numéricos.
 * inputmode altera o teclado do celular, sem converter ou validar o valor.
 * Mantém teclado comum para nomes, descrições, endereços e observações. */
(function(root){
"use strict";
if(root.POTE_NUMERIC_INPUT)return;
// Somente identificadores conhecidos, ou metadados explícitos do campo.
 // Não usar fragmentos como gram, pix, stock, payment, time: fazem parte de campos de texto.
const PHONE_KEYS=new Set("phone telefone celular whatsapp clientphone brandphone supplierphone vitrinephone motophone potesupnewphone".split(" "));
const DECIMAL_KEYS=new Set("orderprice orderqty ordercashreceived bevcost bevstock bevminimum addonqty priceTax builderqty poteshoppingqty openingcash countedcash amount motoratedelivery motoratekm motorateday mototripkm priceunits pricepkg priceother pricedelivery pricefee pricemktfee pricemargin pricegain prepraw prepclean shoppingqty expenseval bevprice addonprice combodiscount orderdelivery orderweight creativeold creativesale vitrinedeliv vitrinecashreceived garimpoqty garimpoprice stockpurchaseqty stockpurchasepaid stockbeverageqty stockbeveragepaid stockupdateqty stockupdatepackcustom stockupdatepaid lossstockqty newingprice newingquantity newingyield poteadmpaymentamount".toLowerCase().split(" "));
const DYNAMIC_DECIMAL=/^(?:amt-|times-|pote-price-|pote-cost-|potesupprodprice-)[\w.-]+$/i;
const DYNAMIC_PHONE=/^potesupphone-[\w.-]+$/i;
const TEXT_KEYS=new Set("brandinstagram instagram motopix poteadmpaymentref stockpurchasesupplier stockbeveragesupplier stockupdatesupplier stockupdatereason lossstocknote lossordernote bevsize garimposize".split(" "));
// Rótulo genérico permitido somente se for inequivocamente numérico, não por fragmento.
const NUMERIC_LABEL=/^(?:valor|preço|custo|quantidade|peso|volume|rendimento|margem)\s*\(\s*(?:R\$|g|kg|ml|l|un|%)\s*\)$/i;
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
 const key=String(el.id||el.name||"").toLowerCase();
 if(TEXT_KEYS.has(key))return "";
 if(PHONE_KEYS.has(key)||DYNAMIC_PHONE.test(key))return "tel";
 if(DECIMAL_KEYS.has(key)||DYNAMIC_DECIMAL.test(key))return "decimal";
 const label=String(el.closest?.("label")?.textContent||"").trim();
 if(NUMERIC_LABEL.test(label))return "decimal";
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
