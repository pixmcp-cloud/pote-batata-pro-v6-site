import assert from "node:assert/strict";
class FakeEl {
 constructor(){this.id="";this.listeners={};this.nodes=new Map();this.hidden=false;this.attrs={};this.classList={toggle(){}};
 this.dataset={};this.textContent="";this.innerHTML="";this.parentElement=null;this.style={};this.value="";}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,v){this.listeners[k]=v}
 appendChild(child){child.parentElement=this;this.nodes.set(child.id||"item"+this.nodes.size,child)}
 querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new FakeEl());return this.nodes.get(selector)}
 focus(){}
}
const body=new FakeEl(),events=new Map(),app={
 data:{cashSessions:[],cashMovements:[],orders:[],brand:{name:"Potê de Teste"}}
};
let writes=0,lastEvent=0;
const homeHeading=new FakeEl();
globalThis.document={body,createElement:()=>new FakeEl(),querySelector:s=>s===".ops-heading"?homeHeading:null,getElementById:()=>null};
Object.defineProperty(globalThis,"navigator",{value:{onLine:true},configurable:true});
globalThis.window={
 POTE_APP_READY:true,POTE_AUTH:{uid:"t1",role:"free",proActive:false,franchiseActive:false,email:"teste"},
 POTE_APP:{snapshot:()=>structuredClone(app),applyState:next=>{app.data=structuredClone(next.data);writes++}},
 POTE_SYNC_GUARD:{blocked:false},
 addEventListener:(name,fn)=>{events.set(name,[...(events.get(name)||[]),fn])},
 dispatchEvent:()=>{lastEvent++},
 confirm:()=>true,prompt:()=>null,
 open:()=>({document:{open(){},write(){},close(){}}})
};
await import("./pdv_cash_ui.mjs");
const api=window.POTE_PDV;
assert(api,"PDV must be registered");
const button=body.nodes.get("potePdvTrigger"),panel=body.nodes.get("potePdvDialog");
assert.equal(button.hidden,true,"FREE account must not access cashier");
assert.equal(api.getSessionId(),null);
window.POTE_AUTH.proActive=true;
api.refresh();
assert.equal(button.hidden,false,"PRO should see PDV button");
api.open();
assert.equal(panel.hidden,false);
assert(panel.querySelector("#potePdvBody").innerHTML.includes("Abrir turno"));
assert(panel.querySelector("#potePdvBody").innerHTML.includes('name="openingCash" placeholder="Ex.: 100,00" inputmode="decimal"'),
 "O fundo de troco deve chamar o teclado decimal");
const openingBody=panel.querySelector("#potePdvBody");
const originalHTML=openingBody.innerHTML;
document.activeElement={matches:selector=>selector.includes("input")};
panel.contains=element=>element===document.activeElement;
api.refresh();
assert.equal(openingBody.innerHTML,originalHTML,
 "Atualização de dados não deve destruir o campo focado no celular");
document.activeElement=null;
api.refresh();
assert.equal(openingBody.innerHTML,originalHTML,"O painel deve voltar a renderizar ao perder o foco");
assert.equal(api.getSessionId(),null);
assert(api.ticketHtml({id:"p1",name:"Batata",qty:1,price:29.9,items:[{id:"i",ingredientName:"Batata",g:250}],paymentStatus:"Informado",paymentMethod:"Pix"},
 {kitchen:false,brand:"Test"}).includes("COMPROVANTE NÃO FISCAL"));
assert(!api.ticketHtml({id:"p1",name:"Batata",qty:1,price:29.9,items:[]},{kitchen:true}).includes("R$"));
const order={id:"o1",name:"Batata",price:29.9,qty:1,deliveryFee:0,status:"entregue",
 paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro",cashSessionId:"s1"};
app.data.cashSessions=[{id:"s1",status:"open",openedAt:"2026-11-16T10:00:00",openingCash:100,operator:"Operador"}];
app.data.orders.push(order);
api.refresh();
assert.equal(api.getSessionId(),"s1");
const html=panel.querySelector("#potePdvBody").innerHTML;
assert(html.includes("R$")&&html.includes("Marcar")===false);
assert(html.includes("29,90"));
assert(html.includes("Cozinha")&&html.includes("Recibo"));
assert(html.includes("Fechar caixa"));
assert(html.includes('name="countedCash" placeholder="Ex.: 150,00" inputmode="decimal"'),
 "A contagem final deve abrir o teclado decimal");
assert(html.includes('name="amount" placeholder="Ex.: 50,00" inputmode="decimal"'),
 "O valor de sangrias e suprimentos deve abrir o teclado decimal");
window.POTE_AUTH.role="free";window.POTE_AUTH.proActive=false;
api.refresh();
assert.equal(button.hidden,true);
assert.equal(api.getSessionId(),null);
assert.equal(panel.hidden,true);
console.log("PASS PDV UI: access isolation, persistent cashier button, reports, non-fiscal receipts and kitchen tickets.");
