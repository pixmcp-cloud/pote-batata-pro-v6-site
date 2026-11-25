import test from "node:test";
import assert from "node:assert/strict";
import {planPublicCheckout,transitionDelivery,deliveryElapsed,formatElapsed} from "../src/public_checkout_core.mjs";
const now=1700000000000;
function fixture(){
 return {buyerUid:"buyer",now,menu:{slug:"loja-a",ownerUid:"owner",businessType:"batataria",published:true,items:[{id:"r1",title:"Batata",priceCents:3800},{id:"bev-b1",title:"Refrigerante",priceCents:700}]},
 request:{slug:"loja-a",operationId:"a".repeat(32),lines:[{id:"r1",quantity:2,addonIds:[],note:""},{id:"bev-b1",quantity:1,addonIds:[],note:"Gelado"}],fulfillment:"entrega",payment:"pix",customerName:"Cliente Teste",customerPhone:"48999999999",quoteId:"quote-12345678901234567890",feeCents:1,totalCents:1},
 recipes:new Map([["r1",{items:[{id:"i1",g:200}],packagingIngredientIds:["pkg"]}]]),
 ingredients:new Map([["i1",{stock:800,yield:80,name:"Batata"}],["pkg",{stock:3,category:"Embalagem",measureUnit:"un",name:"Pote"}]]),
 beverages:new Map([["b1",{stock:4,name:"Refri"}]]),settings:{usePackagingStock:true},
 existingOrders:[{orderNumber:7,businessType:"batataria",status:"recebido",qty:1,items:[{id:"i1",g:200,yieldPct:80}],beverageItems:[]}],lastSequence:6,
 deliveryConfigVersion:"v1",quote:{id:"quote-12345678901234567890",uid:"buyer",slug:"loja-a",version:"v1",expiresAt:now+60000,feeCents:1000,destination:{lat:-29,lon:-51},address:"Rua Teste 10"}};
}
test("server prices and physical reservation including yield and packaging",()=>{
 const p=planPublicCheckout(fixture());assert.equal(p.subtotalCents,8300);assert.equal(p.feeCents,1000);assert.equal(p.totalCents,9300);assert.equal(p.code,"#P0000008");
 assert.deepEqual(p.reservation,[{key:"ingredients:i1",quantity:500},{key:"ingredients:pkg",quantity:2},{key:"beverages:b1",quantity:1}]);
 assert.equal(p.paymentStatus,"pending");assert.equal(p.deliveryStatus,"recebido");
});
test("reject insufficient stock including outstanding reservations",()=>{
 const f=fixture();f.ingredients.get("i1").stock=749;assert.throws(()=>planPublicCheckout(f),/insufficient_stock/);
});
test("reject expired quote, foreign buyer or stale config and unsupported extras",()=>{
 for(const bad of [{uid:"other"},{expiresAt:now},{version:"old"}]){
  const f=fixture();Object.assign(f.quote,bad);assert.throws(()=>planPublicCheckout(f),/delivery_quote_invalid/);
 }
 const f=fixture();f.request.lines[0].addonIds=["invented"];assert.throws(()=>planPublicCheckout(f),/invalid_cart_line/);
});
test("pickup ignores client price, no delivery quote needed",()=>{
 const f=fixture();f.request.fulfillment="retirada";f.quote=null;
 const p=planPublicCheckout(f);assert.equal(p.totalCents,8300);assert.equal(p.address,"");
});
test("status, actor and monotonic time; immutable stopped clock",()=>{
 let o={...planPublicCheckout(fixture()),courierUid:"courier"};
 assert.throws(()=>transitionDelivery(o,"em_producao",{actorUid:"buyer",now:now+1}),/forbidden/);
 o=transitionDelivery(o,"em_producao",{actorUid:"owner",now:now+10000});
 o=transitionDelivery(o,"finalizado",{actorUid:"owner",now:now+20000});
 assert.throws(()=>transitionDelivery(o,"entregue",{actorUid:"owner",now:now+25000}),/dispatch_required/);
 o=transitionDelivery(o,"saiu_entrega",{actorUid:"courier",now:now+30000});
 assert.throws(()=>transitionDelivery(o,"entregue",{actorUid:"other",now:now+36000}),/forbidden/);
 o=transitionDelivery(o,"entregue",{actorUid:"courier",now:now+65000});
 assert.equal(o.durationSeconds,65);assert.equal(deliveryElapsed(o,now+500000),65);assert.equal(formatElapsed(o.durationSeconds),"00:01:05");
 assert.throws(()=>transitionDelivery(o,"cancelado",{actorUid:"owner",now:now+66000}),/invalid_transition/);
});
