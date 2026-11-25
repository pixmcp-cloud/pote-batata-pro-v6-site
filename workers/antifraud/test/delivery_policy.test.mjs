import test from "node:test";
import assert from "node:assert/strict";
import {deliveryEntitlement,trackingAccess,nextTrackingPoint,visibleTrackingPoint,buyerDestination} from "../src/delivery_policy.mjs";
import {buyerOrderView,receiptData} from "../src/public_delivery_view.mjs";
import {statusPresentation} from "../../../cardapio/order-live-status.mjs";
const now=1700000000000;
const order={id:"o1",buyerUid:"buyer",courierUid:"courier",ownerUid:"owner",slug:"loja-a",code:"#P0000001",fulfillment:"entrega",deliveryStatus:"saiu_entrega",createdAt:new Date(now-60000).toISOString(),deliveryUpdatedAt:new Date(now-10000).toISOString(),lines:[{name:"Batata",qty:1,unitPriceCents:3000,note:""}],subtotalCents:3000,feeCents:600,totalCents:3600,paymentMethod:"pix",paymentStatus:"pending",address:"Rua Teste",privateCost:10};
const point={lat:-29.168,lon:-51.179,accuracy:10};
test("merchant plan, expiry, quotas and blocked universe",()=>{
 assert.equal(deliveryEntitlement({profile:{},universe:"batataria",used:10}).canStartDelivery,false);
 const profile={license:{status:"active",kind:"pro",expiresAt:new Date(now+1000).toISOString()}};
 assert.equal(deliveryEntitlement({profile,universe:"batataria",used:599,now}).remaining,1);
 assert.equal(deliveryEntitlement({profile,universe:"batataria",used:600,now}).canStartDelivery,false);
 assert.equal(deliveryEntitlement({profile,universe:"batataria",now:now+1001}).plan,"free");
 assert.equal(deliveryEntitlement({profile:{...profile,accessPolicy:{blockedUniverses:["batataria"]}},universe:"batataria",now}).plan,"blocked");
});
test("GPS only assigned courier writes and own customer reads; stops at terminal state",()=>{
 assert.equal(trackingAccess(order,"owner","read"),false);
 assert.equal(trackingAccess(order,"buyer","publish"),false);
 assert.throws(()=>nextTrackingPoint({order,actorUid:"courier",point,now,consent:false}),/tracking_forbidden/);
 const a=nextTrackingPoint({order,actorUid:"courier",point,now,consent:true});assert.ok(a.accepted);
 assert.equal(nextTrackingPoint({order,actorUid:"courier",previous:a.point,point:{...point,lat:point.lat+.001},now:now+14000,consent:true}).accepted,false);
 assert.equal(nextTrackingPoint({order,actorUid:"courier",previous:a.point,point,now:now+20000,consent:true}).accepted,false);
 assert.equal(nextTrackingPoint({order,actorUid:"courier",previous:a.point,point,now:now+60000,consent:true}).accepted,true);
 assert.ok(visibleTrackingPoint({order,actorUid:"buyer",point:a.point,now:now+1000}));
 assert.equal(visibleTrackingPoint({order,actorUid:"buyer",point:a.point,now:now+120000}),null);
 assert.throws(()=>visibleTrackingPoint({order:{...order,deliveryStatus:"entregue"},actorUid:"buyer",point:a.point,now}),/tracking_forbidden/);
 assert.throws(()=>buyerDestination({order,actorUid:"buyer",point,consent:true}),/destination_forbidden/);
 assert.deepEqual(buyerDestination({order:{...order,deliveryStatus:"recebido"},actorUid:"buyer",point,consent:true}),{lat:point.lat,lon:point.lon});
});
test("private customer projection, receipt and immutable LED after completion",()=>{
 assert.throws(()=>buyerOrderView(order,"other",now),/order_forbidden/);
 const v=buyerOrderView(order,"buyer",now);assert.equal(v.elapsedSeconds,60);assert.equal(v.privateCost,undefined);assert.equal(v.courierUid,undefined);
 assert.deepEqual(statusPresentation(v,{connected:true,receivedAt:now,now:now+2000}),{label:"Saiu para entrega",clock:"00:01:02",live:true,terminal:false});
 const done={...order,deliveryStatus:"entregue",deliveredAt:new Date(now).toISOString(),clockStoppedAt:new Date(now).toISOString()};
 const r=receiptData(done,"buyer",now+100000);assert.equal(r.elapsedText,"00:01:00");assert.equal(r.durationSeconds,60);assert.equal(r.nonFiscal,true);assert.equal(r.paymentStatus,"pending");
 assert.equal(statusPresentation(r,{connected:true,receivedAt:now,now:now+500000}).clock,"00:01:00");
});
