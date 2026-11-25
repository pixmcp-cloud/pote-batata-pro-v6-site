import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_DELIVERY_POLICY,validateDeliveryPolicy,quoteDelivery} from "../src/delivery_pricing.mjs";
const policy={...DEFAULT_DELIVERY_POLICY,enabled:true,neighborhoods:[
 {id:"centro",name:"Centro",feeCents:400,enabled:true},
 {id:"sao-jose",name:"São José",feeCents:650,enabled:true},
 {id:"blocked",name:"Área bloqueada",feeCents:900,enabled:false}
]};
const quote=(options={},overrides={})=>quoteDelivery({...policy,...overrides},{subtotalCents:3000,...options});
test("default is disabled, configured default is R$0.50/km",()=>{
 assert.equal(DEFAULT_DELIVERY_POLICY.perKmCents,50);
 assert.throws(()=>quoteDelivery(DEFAULT_DELIVERY_POLICY,{subtotalCents:3000,routeMeters:5000}),/indisponível/);
 assert.equal(quote({routeMeters:6000}).feeCents,300);
 assert.equal(quote({routeMeters:2500}).feeCents,125);
});
test("fixed neighborhood priority and customizable price",()=>{
 assert.equal(quote({verifiedNeighborhoodId:"centro",routeMeters:20000}).feeCents,400);
 assert.equal(quote({verifiedNeighborhoodId:"sao-jose",routeMeters:1000},{minFeeCents:1000}).feeCents,650);
 assert.equal(quote({routeMeters:3000},{perKmCents:200,minFeeCents:800}).feeCents,800);
 assert.equal(quote({verifiedNeighborhoodId:"centro",routeMeters:6000},{mode:"distance"}).feeCents,300);
 assert.throws(()=>quote({routeMeters:1000},{mode:"fixed"}),/não atendido/);
});
test("limit and blocked zone cannot be bypassed by promotion",()=>{
 assert.throws(()=>quote({verifiedNeighborhoodId:"blocked",routeMeters:1000},{freeAboveCents:100}),/fora da área/);
 assert.throws(()=>quote({verifiedNeighborhoodId:"centro",routeMeters:6000},{maxDistanceMeters:5000,freeAboveCents:100}),/fora do limite/);
 assert.throws(()=>quote({verifiedNeighborhoodId:"centro"},{maxDistanceMeters:5000}),/rota indisponível/);
 assert.throws(()=>quote({}),/confirmar a distância/);
 assert.throws(()=>quote({routeMeters:-1}),/inválida/);
 assert.throws(()=>quote({routeMeters:1.2}),/inválida/);
});
test("free delivery preserves standard fee and discount",()=>{
 assert.deepEqual(quote({routeMeters:6000},{freeAboveCents:3000}),{method:"distance",neighborhoodId:null,routeMeters:6000,standardFeeCents:300,feeCents:0,discountCents:300});
 assert.equal(quote({routeMeters:6000},{freeAboveCents:3001}).feeCents,300);
});
test("rejects duplicate normalized neighborhoods, negative or invalid fees",()=>{
 assert.throws(()=>validateDeliveryPolicy({...policy,neighborhoods:[...policy.neighborhoods,{id:"other",name:"  SAO   JOSE  ",feeCents:2,enabled:true}]}),/duplicado/);
 assert.throws(()=>validateDeliveryPolicy({...policy,perKmCents:-50}),/inválida/);
 assert.throws(()=>validateDeliveryPolicy({...policy,neighborhoods:[{id:"x",name:"Centro",feeCents:-1,enabled:true}]}),/inválida/);
 assert.throws(()=>quote({routeMeters:3000,subtotalCents:"3000"}),/Subtotal/);
});
