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

// V6: falsos positivos da classificação antiga por fragmento (gram, pix, stock, payment).
for(const id of ["brandInstagram","instagram","motoPix","poteAdmPaymentRef","stockPurchaseSupplier","stockBeverageSupplier","stockUpdateSupplier","stockUpdateReason","lossStockNote","lossOrderNote","bevSize","garimpoSize","supplierCity","poteSupDelivery-x","poteSupNotes-x","clientNote","hubStore","paymentReference","stockItemName","deliveryTimeNotes","taxpayerName","programDescription"]){
 const el=input({id});assert.equal(helper.apply(el),"",id);assert.equal(el.getAttribute("inputmode"),null,id);
}
for(const id of ["motoRateDelivery","motoRateKm","motoRateDay","motoTripKm","poteSupProdPrice-abc","stockPurchasePaid","stockUpdateQty","poteAdmPaymentAmount"]){
 const el=input({id});assert.equal(helper.apply(el),"decimal",id);
}
for(const id of ["motoPhone","poteSupNewPhone","poteSupPhone-abc","vitrinePhone"]){
 const el=input({id});assert.equal(helper.apply(el),"tel",id);
}
for(const label of ["Nome do fornecedor (R$)","Observações (kg)","Volume / embalagem","Chave PIX","Código do pagamento"]){
 assert.equal(helper.apply(input({label})),"",label);
}
const insta=input({id:"brandInstagram",attrs:{inputmode:"text"}});
assert.equal(helper.apply(insta),"text");assert.equal(insta.getAttribute("inputmode"),"text");
for(const mode of ["numeric","decimal","tel","text","email","url"]){
 const el=input({id:"brandInstagram",attrs:{inputmode:mode}});assert.equal(helper.apply(el),mode);
}
const explicit=input({id:"newMetric",attrs:{"data-numeric":"decimal"}});assert.equal(helper.apply(explicit),"decimal");
const dynamicText=input({id:"stockPurchaseSupplier"}),dynamicNumber=input({id:"stockPurchaseQty"}),dynamicPhone=input({id:"brandPhone"});
assert.equal(helper.scan({tagName:"DIV",querySelectorAll:()=>[dynamicText,dynamicNumber,dynamicPhone]}),2);
assert.equal(dynamicText.getAttribute("inputmode"),null);
assert.equal(dynamicNumber.getAttribute("inputmode"),"decimal");assert.equal(dynamicPhone.getAttribute("inputmode"),"tel");
console.log("PASS V6: regressão de teclado em campos de texto, PIX, referência, fornecedores, estoque, telefone e valores.");
