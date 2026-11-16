import assert from "node:assert/strict";
import {CHANNELS,EXAMPLE,parseImport,normalizeOrder,deduplicate,suggestRecipes,
 emptyHub,ensureHub,stageOrders,markLinked,validChannel} from "./delivery_hub_core.mjs";
assert.equal(CHANNELS.length,12);
assert.equal(CHANNELS.filter(x=>x.doc.startsWith("https://")).length,12);
assert(!validChannel("other"));assert(validChannel("ifood"));
const ca=normalizeOrder("cardapioai",{
 nomeCliente:"Ana",telefoneCliente:"48999999999",numeroPedido:"BR-77",
 endereco:"Rua Um, 1",valorCompra:52.9,tipoPedido:"Pedido Delivery",
 produtos:[{nome:"(pdv: 789) | Pastel de Carne",quantidade:2,valor:23.95,
 adicionais:[{nome:"Queijo",quantidade:1,valor:5}]}]}, {storeAlias:"balneario"});
assert.equal(ca.externalId,"BR-77");
assert.equal(ca.storeId,"balneario");
assert.equal(ca.items.length,1);
assert.equal(ca.items[0].qty,2);
assert.equal(ca.items[0].modifiers.length,1);
assert.equal(ca.total,52.9);
assert.equal(ca.kind,"delivery");
assert.equal(ca.name,"Ana");
const ola=normalizeOrder("olaclick",EXAMPLE.olaclick,{storeAlias:"fromform"});
assert.equal(ola.storeId,"demo-store");
assert.equal(ola.externalId,"DEMO-102");
assert.equal(ola.items[0].unitPrice,35);
assert.equal(ola.deliveryFee,7);
const od=normalizeOrder("ifood",EXAMPLE.opendelivery,{storeAlias:"empresa"});
assert.equal(od.items[0].name,"Batata recheada");
const cancelled=normalizeOrder("aiqfome",
 {id:"b",is_cancelled:true,store_id:"x",items:[{name:"Pastel",qty:1}]});
assert.equal(cancelled.status,"cancelled");
assert.equal(normalizeOrder("olaclick",{event_type:"ORDER_DELETED",data:{id:"del-1",merchant_id:"a",items:[{name:"Pizza",quantity:1,price:9}]}},{storeAlias:"a"}).status,"cancelled");
const batch=parseImport("cardapioai",[{
 numeroPedido:"N1",nomeCliente:"Claudia",produtos:[{nome:"Pizza Calabresa",quantidade:1,valor:37}]
},{numeroPedido:"N1",nomeCliente:"Claudia",produtos:[{nome:"Pizza Calabresa",quantidade:1,valor:37}]},
{numeroPedido:"N2",nomeCliente:"Davi",produtos:[{nome:"Frango",quantidade:2,valor:25}]}],{storeAlias:"x"});
assert.equal(batch.rows.length,2,"Duplicidade de pedidos no lote");
const h=emptyHub();
assert.equal(stageOrders(h,batch.rows,{free:false}).imported,2);
assert.equal(stageOrders(h,batch.rows,{free:false}).duplicates,2);
markLinked(h,batch.rows[0].key,0,{localOrderId:"o-local-1",universe:"pizzaria"});
assert.equal(h.orders[0].approved,true);
assert.throws(()=>markLinked(h,batch.rows[0].key,0,{localOrderId:"dup"}),/já registrado/);
const id2=emptyHub();
assert.equal(stageOrders(id2,batch.rows.slice(0,1),{free:true}).imported,1);
assert.throws(()=>stageOrders(id2,batch.rows.slice(1),{free:true}),/FREE/);
const byEmailA={data:{}},byEmailB={data:{}};
ensureHub(byEmailA).orders.push(ca);
assert.equal(ensureHub(byEmailB).orders.length,0,"Cada email precisa de fila própria");
assert.equal(deduplicate([ca],[ca,ola]).unique.length,1);
const ranked=suggestRecipes({name:"Pastel de Carne"},[{id:"1",name:"Pastel de Carne"},{id:"2",name:"Pastel de Queijo"}]);
assert.equal(ranked[0].score,100);
for(const bad of [
 {numeroPedido:"",produtos:[{nome:"Pastel",quantidade:1}],nomeCliente:"X"},
 {numeroPedido:"1",produtos:[]},
 {numeroPedido:"2",produtos:[{nome:"",quantidade:1}]}
])assert.throws(()=>normalizeOrder("cardapioai",bad,{storeAlias:"x"}));
assert.throws(()=>parseImport("ifood",Array.from({length:51},(_,i)=>({id:i,items:[{name:"X",qty:1}]}))),/50/);
assert.deepEqual(JSON.parse(JSON.stringify(ca)).items[0].modifiers[0].name,"Queijo");
console.log("PASS: 12 canais; adaptadores Cardapio.ai, OlaClick, OpenDelivery, aiqfome; importação, dedup, 2 contas isoladas e FREE limitado.");
