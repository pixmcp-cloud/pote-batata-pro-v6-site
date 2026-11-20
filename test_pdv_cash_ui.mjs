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
let writes=0,lastEvent=0,confirmations=0;
const homeHeading=new FakeEl();
const message=new FakeEl();
globalThis.document={body,createElement:()=>new FakeEl(),querySelector:s=>s===".ops-heading"?homeHeading:null,
 getElementById:id=>id==="potePdvMessage"?message:null};
globalThis.FormData=class {
 constructor(form){this.fields=Object.entries(form.fields)}
 entries(){return this.fields}
};
Object.defineProperty(globalThis,"navigator",{value:{onLine:true},configurable:true});
globalThis.window={
 POTE_APP_READY:true,POTE_AUTH:{uid:"t1",role:"free",proActive:false,franchiseActive:false,email:"teste"},
 POTE_APP:{snapshot:()=>structuredClone(app),applyState:next=>{app.data=structuredClone(next.data);writes++}},
 POTE_SYNC_GUARD:{blocked:false},
 addEventListener:(name,fn)=>{events.set(name,[...(events.get(name)||[]),fn])},
 dispatchEvent:()=>{lastEvent++},
 confirm:()=>{confirmations++;return true},prompt:()=>null,
 open:()=>({document:{open(){},write(){},close(){}}})
};
await import("./finance_core.js");
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
assert(panel.querySelector("#potePdvBody").innerHTML.includes("Abrir o caixa"));
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
const submit=(pdvForm,fields)=>panel.listeners.submit({preventDefault(){},target:{dataset:{pdvForm},fields}});
submit("open",{openingCash:"1.23,45"});
assert.match(message.textContent,/Valor monetário inválido/);
assert.equal(writes,0);
assert.equal(lastEvent,0);
submit("open",{openingCash:"R$ 1.234,56"});
assert.equal(app.data.cashSessions[0].openingCash,1234.56);
submit("movement",{kind:"suprimento",amount:"12 34,56",reason:"Troco"});
assert.match(message.textContent,/Valor monetário inválido/);
assert.equal(writes,1);
assert.equal(lastEvent,1);
submit("movement",{kind:"suprimento",amount:"10.50",reason:"Troco"});
assert.equal(app.data.cashMovements[0].amount,10.5);
submit("close",{countedCash:"1.245,060"});
assert.match(message.textContent,/Valor monetário inválido/);
assert.equal(writes,2);
assert.equal(confirmations,0);
submit("close",{countedCash:"1.245,06"});
assert.equal(app.data.cashSessions[0].countedCash,1245.06);
assert.equal(app.data.cashSessions[0].difference,0);
assert.equal(confirmations,1);
app.data.cashSessions=[];
app.data.cashMovements=[];
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
assert(html.includes("Conferir e fechar caixa"));
assert(html.includes("Recebimentos confirmados")&&html.includes("Dinheiro esperado na gaveta"));
assert(html.includes("Gráfico de recebimentos")&&html.includes("Pix")&&html.includes("Cartão"));
assert(html.includes("Confirme os pagamentos")&&html.includes("Aguardando recebimento")===false);
assert(html.includes("PASSO 4")&&html.includes("Quanto você contou em notas e moedas?"));

assert(html.includes('name="countedCash" placeholder="Ex.: 150,00" inputmode="decimal"'),
 "A contagem final deve abrir o teclado decimal");
assert(html.includes('name="amount" placeholder="Ex.: 50,00" inputmode="decimal"'),
 "O valor de sangrias e suprimentos deve abrir o teclado decimal");
// F20 server cutover rehearsal: no direct browser cash writes on a licensed
// account once the general Worker has been explicitly enabled.
const beforeF20=writes;
let opens=0,closes=0;
window.POTE_WORKER={enabled:true,
 async openCash(universe,cents,operator){
  opens++;assert.equal(universe,"batataria");assert.equal(cents,5000);
  assert(operator);return {ok:true,sessionId:"cf-turn-server-qa",bankReconciled:false};
 },
 async closeCash(universe,sessionId,cents){
  closes++;assert.equal(universe,"batataria");
  assert.equal(sessionId,"cf-turn-server-qa");assert.equal(cents,10500);
  return {ok:true,reconciliationStatus:"pending",bankReconciled:false};
 }};
app.data.cashSessions=[];app.data.cashMovements=[];
submit("open",{openingCash:"50,00"});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(opens,1,"Cash opening calls Worker once");
assert.equal(writes,beforeF20,"Worker opening never persists local V2 state");
assert.equal(app.data.cashSessions.length,0,"No phantom open shift before server reload");
submit("movement",{kind:"suprimento",amount:"10,00",reason:"Troco"});
assert.match(message.textContent,/Movimentação local bloqueada/);
assert.equal(writes,beforeF20,"Unmigrated cash movements must fail closed");
app.data.cashSessions=[{id:"cf-turn-server-qa",status:"open",
 openedAt:"2026-11-20T11:00:00Z",openingCash:50,operator:"QA"}];
submit("close",{countedCash:"105,00"});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(closes,1,"Cash closure calls Worker once");
assert.equal(writes,beforeF20,"Worker closure never persists browser-side close");
assert.equal(app.data.cashSessions[0].status,"open",
 "Only Firestore refresh may set the cash session closed");
assert.throws(()=>api.completeSalePayment(order,app.data),
 /não pode lançar recebimento local paralelo/);
window.POTE_WORKER={enabled:false};
console.log("PASS F20 cash UI: server-only open/close; no local cash/movements/payment writes when Worker enabled.");
window.POTE_AUTH.role="free";window.POTE_AUTH.proActive=false;
api.refresh();
assert.equal(button.hidden,true);
assert.equal(api.getSessionId(),null);
assert.equal(panel.hidden,true);
console.log("PASS PDV UI: access isolation, persistent cashier button, reports, non-fiscal receipts and kitchen tickets.");
