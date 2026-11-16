const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
function input({id="",name="",type="text",label="",attrs={}}={}){
 const values=new Map(Object.entries(attrs));
 return {tagName:"INPUT",id,name,type,disabled:false,readOnly:false,
  getAttribute:key=>values.get(key)|| (key==="type"?type:null),
  hasAttribute:key=>values.has(key),
  setAttribute:(key,val)=>values.set(key,val),
  closest:selector=>selector==="label"?{textContent:label}:null,
  attrs:values};
}
const events={},body={tagName:"BODY",querySelectorAll:()=>[]};
const doc={body,readyState:"complete",addEventListener:(type,cb)=>events[type]=cb};
const context={window:{},document:doc,MutationObserver:class{constructor(fn){this.callback=fn}observe(){}},console};
vm.createContext(context);vm.runInContext(fs.readFileSync("numeric_keyboard.js","utf8"),context);
const helper=context.window.POTE_NUMERIC_INPUT;
assert(helper);
for(const [id,mode] of [
 ["orderPrice","decimal"],["orderQty","decimal"],["orderCashReceived","decimal"],
 ["bevCost","decimal"],["bevStock","decimal"],["bevMinimum","decimal"],
 ["addonQty","decimal"],["priceTax","decimal"],["builderQty","decimal"],
 ["poteShoppingQty","decimal"],["amt-123","decimal"],["times-10","decimal"],
 ["clientPhone","tel"],["brandPhone","tel"],["supplierPhone","tel"],
 ["brandName",""],["clientName",""],["supplierName",""],
 ["orderAddress",""],["orderNote",""],["bevName",""],["brandSlogan",""]
]){const el=input({id});assert.equal(helper.infer(el),mode,id);
 helper.apply(el);assert.equal(el.getAttribute("inputmode"),mode||null,id)}
const cash=input({name:"openingCash"});
assert.equal(helper.apply(cash),"decimal");
assert.equal(cash.getAttribute("inputmode"),"decimal");
assert.equal(cash.getAttribute("enterkeyhint"),"done");
const counted=input({name:"countedCash"});assert.equal(helper.apply(counted),"decimal");
const custom=input({id:"custom",label:"Valor (R$)"});assert.equal(helper.apply(custom),"decimal");
const human=input({id:"orderNote",label:"Observação de entrega"});assert.equal(helper.apply(human),"");
const existing=input({id:"orderPrice",attrs:{inputmode:"numeric"}});
assert.equal(helper.apply(existing),"numeric");assert.equal(existing.getAttribute("inputmode"),"numeric");
const qty=input({id:"any",type:"number",attrs:{step:"1"}});
assert.equal(helper.apply(qty),"numeric");
const pct=input({id:"any",type:"number",attrs:{step:"0.01"}});
assert.equal(helper.apply(pct),"decimal");
const password=input({id:"bankPassword",type:"password"});
assert.equal(helper.apply(password),"");
const child=input({id:"orderPrice"});
const fragment={tagName:"DIV",querySelectorAll:()=>[child]};
assert.equal(helper.scan(fragment),1);
assert.equal(child.getAttribute("inputmode"),"decimal");
const onFocus=input({name:"amount"});events.focusin({target:onFocus});
assert.equal(onFocus.getAttribute("inputmode"),"decimal");
console.log("PASS: teclado numérico para preço, estoque, quantidades e troco; teclado normal em campos de texto e telefone contextual.");
