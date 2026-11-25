import test from "node:test";
import assert from "node:assert/strict";
import {observeAbruptStop} from "./courier-safety.mjs";
import {mergeNotifications} from "../notification_core.mjs";
test("rapid deceleration is a possible incident, not loss of GPS",()=>{
 const p=observeAbruptStop(null,{speed:12,accuracy:5},1000).state;
 assert.equal(observeAbruptStop(p,{speed:0,accuracy:5},3000).suspect,true);
 assert.equal(observeAbruptStop(p,{speed:0,accuracy:50},3000).suspect,false);
 assert.equal(observeAbruptStop(p,{speed:null,accuracy:5},3000).suspect,false);
 assert.equal(observeAbruptStop(p,{speed:0,accuracy:5},8000).suspect,false);
 assert.equal(observeAbruptStop(p,{speed:6,accuracy:5},3000).suspect,false);
});
test("urgent private safety notification is not a confirmed accident",()=>{
 const items=mergeNotifications([],[],{},1000,[{id:"abc",orderCode:"#P0000001",kind:"possible_accident",atMs:1000}]);
 assert.equal(items[0].priority,"urgent");assert.match(items[0].title,/possível acidente/);assert.equal(items[0].unread,true);
});

test("emergency notification exposes only an authorized retrieval reference",()=>{
 const ref={id:"a".repeat(64),kind:"possible_accident",atMs:1000};
 const item=mergeNotifications([],[],{},1000,[{id:"alert",orderId:ref.id,orderCode:"#P0000001",kind:ref.kind,atMs:ref.atMs,hasLocation:true}])[0];
 assert.deepEqual(item.safetyRef,ref);assert.equal(item.href,"");
});
