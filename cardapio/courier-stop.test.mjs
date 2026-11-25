import test from "node:test";
import assert from "node:assert/strict";
import {observeStop} from "./courier-stop.mjs";
const p={lat:-29.17,lon:-51.18,accuracy:10,speed:0};
test("alert exactly at three minutes, once per confirmed stop",()=>{
 let s=null;
 for(const at of [0,60000,120000,179999,180000,240000]){
  const r=observeStop(s,p,at);s=r.state;
  assert.equal(r.alert,at===180000);
 }
 const moving=observeStop(s,{...p,speed:4},250000);
 assert.equal(moving.state,null);assert.equal(moving.alert,false);
 let q=null;for(const at of [260000,320000,380000,440000]){const r=observeStop(q,p,at);q=r.state;assert.equal(r.alert,at===440000);}
});
test("poor accuracy, stale gaps, GPS loss and displacement do not create a stop",()=>{
 let s=observeStop(null,p,0).state;
 assert.equal(observeStop(s,p,180000).alert,false);
 assert.equal(observeStop(s,{...p,accuracy:40},60000).state,null);
 assert.equal(observeStop(s,null,60000).state,null);
 assert.equal(observeStop(s,{...p,lat:p.lat+.001},60000).state.since,60000);
});
