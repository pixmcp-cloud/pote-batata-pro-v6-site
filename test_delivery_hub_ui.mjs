import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const elements=new Map(),msgs=[];
function get(id){
 if(!elements.has(id))elements.set(id,{value:"",innerHTML:"",files:[],classList:{add(){},remove(){}},disabled:false});
 return elements.get(id);
}
const recipe={id:"rc1",name:"Pastel de Carne",items:[{id:"ins1",g:100}]};
globalThis.state={mode:"adm",tab:"deliveryhub",data:{businessType:"batataria",
 businessUniverses:{pastelaria:{recipes:[recipe],orders:[],ingredients:[]}},
 recipes:[],orders:[],ingredients:[],settings:{},brand:{}}};
globalThis.window={POTE_AUTH:{uid:"acct-123",role:"admin",proActive:true},
 POTE_SYNC_GUARD:{blocked:false},
 POTE_ACCESS:{requireService(){return true},allowsUniverse(){return true}},
 POTE_BUSINESS:{choose(type){
  state.data.businessUniverses[state.data.businessType]={recipes:state.data.recipes,orders:state.data.orders,ingredients:state.data.ingredients};
  const branch=state.data.businessUniverses[type];state.data.recipes=branch.recipes;
  state.data.orders=branch.orders;state.data.ingredients=branch.ingredients;state.data.businessType=type;
  }},
 POTE_PAYMENT:{sync(){}}
};
globalThis.document={getElementById:get,querySelectorAll:()=>[]};
globalThis.toast=m=>msgs.push(String(m));
globalThis.alert=m=>msgs.push(String(m));
globalThis.confirm=()=>true;
let persisted=0;
globalThis.persist=()=>persisted++;
globalThis.go=tab=>{state.tab=tab};
globalThis.updateOrderSuggestedPrice=()=>get("orderPrice").value="40";
globalThis.window.render=()=>{get("page").innerHTML=window.POTE_DELIVERY_HUB.render()};
await import("./delivery_hub.js?ui-test=1");
const hub=window.POTE_DELIVERY_HUB;
const start=hub.render();
assert(start.includes("12")&&start.includes("Hub de Delivery")&&start.includes("Cardapio.ai"));
assert(start.includes("🔒 Sem conexão ativa"));
assert(start.includes("Importação sem chave de API"));
assert(start.includes("Nenhum pedido externo registrado"));
assert(!start.includes("olk_live_")&&!start.includes("client_secret"));
get("hubJson").value=JSON.stringify({
 numeroPedido:"EXT-101",nomeCliente:"Cliente Piloto",tipoPedido:"Pedido Delivery",
 endereco:"Rua do Cliente, 25",valorCompra:47.9,produtos:[{nome:"Pastel de Carne",quantidade:1,valor:42.9,
 adicionais:[{nome:"Queijo",quantidade:1,valor:5}]}]});
get("hubStore").value="minha-loja";
hub.analyze();
assert(get("hubAnalysis").innerHTML.includes("Prévia: 1 pedido(s) válido(s)"));
assert.equal(hub.status.count,0,"Prévia não deve salvar pedidos");
hub.commit();
assert.equal(hub.status.count,1);
assert.equal(persisted,1);
assert.equal(state.data.orders.length,0,"Importação não gera venda diretamente");
hub.commit();assert.equal(hub.status.count,1,"Clique duplo não duplica");
assert(hub.render().includes("EXT-101"));
get("hubMap-0-0").value="pastelaria::rc1";
hub.prepare(0,0);
assert.equal(state.data.businessType,"pastelaria");
assert.equal(state.tab,"orders");
assert.equal(get("orderItem").value,"recipe:rc1");
assert.equal(get("orderQty").value,"1");
assert.equal(get("orderChannel").value,"marketplace");
assert.equal(get("orderAddress").value,"Rua do Cliente, 25");
assert(get("orderNote").value.includes("Queijo"));
assert(hub.beforeRegister(state,"recipe:rc1",1,42.9));
const local={id:"local-100",recipeId:"rc1",qty:1,price:42.9};
state.data.orders.push(local);
hub.onRegistered(local);
assert.equal(local.externalProvider,"cardapioai");
assert.equal(local.externalOrderId,"EXT-101");
assert.equal(state.data.deliveryHub.orders[0].approved,true);
get("hubMap-0-0").value="pastelaria::rc1";
hub.prepare(0,0);
assert(msgs.some(x=>x.includes("já registrado")));
assert.equal(state.data.orders.length,1);
window.POTE_AUTH={uid:"acct-123",role:"free",proActive:false};
state.tab="deliveryhub";
hub.select("olaclick");hub.example();
assert(get("hubJson").value.includes("DEMO-102"),"Exemplo sem dados externos");
hub.analyze();hub.commit();
assert.equal(hub.status.count,1,"DEMO não entra na fila");
assert(readFileSync("source/pote_app_base.html","utf8").includes("window.POTE_DELIVERY_HUB?.beforeRegister?.(state,item,qty,price)===false"));
assert(readFileSync("source/pote_app_base.html","utf8").includes("window.POTE_DELIVERY_HUB?.onRegistered?.(order)"));
console.log("PASS: UI Hub (12 canais), prévia, importar uma vez, associar a Pastelaria, registro supervisionado, duplicate guard e DEMO sem gravar.");
