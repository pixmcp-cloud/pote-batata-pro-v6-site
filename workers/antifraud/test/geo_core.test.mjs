import test from "node:test";
import assert from "node:assert/strict";
import {normalizeConfig,deliveryFee,airMeters,parsePlaces,parseRoute,validQuote,quotaDecision,addressQuery} from "../src/geo_core.mjs";
const c={enabled:true,origin:{lat:-29.168,lon:-51.179},baseCents:400,minCents:600,perKmCents:200,maxMeters:10000,mode:"motorcycle"};
test("integer centavos, minimum and road distance",()=>{
 assert.equal(deliveryFee(c,0),600);assert.equal(deliveryFee(c,3201),1041);
 assert.throws(()=>deliveryFee(c,10001),/outside_delivery_area/);
 assert.throws(()=>deliveryFee({...c,enabled:false},100),/delivery_disabled/);
 assert.throws(()=>normalizeConfig({...c,perKmCents:-1}),/invalid_delivery_config/);
});
test("coordinates and Brazilian filter",()=>{
 assert.equal(airMeters(c.origin,c.origin),0);
 assert.ok(airMeters(c.origin,{lat:-29.18,lon:-51.19})>1000);
 assert.throws(()=>airMeters(c.origin,{lat:0,lon:0}));
 const p={formatted:"Rua teste, Brasil",country_code:"br",lat:-29.168,lon:-51.179};
 assert.equal(parsePlaces({features:[{properties:p},{properties:{...p,country_code:"us"}}]}).length,1);
 assert.deepEqual(parseRoute({features:[{properties:{distance:1200.1,time:80.5}}]}),{meters:1201,seconds:81});
 assert.throws(()=>parseRoute({features:[]}),/invalid_route/);
 assert.throws(()=>addressQuery("abc"));
});
test("quotas fail closed and quote bound to user, store and current config",()=>{
 assert.ok(quotaDecision({total:2498,cost:2,user:48,shop:598}));
 for(const state of [{total:2500},{total:2499,cost:2},{user:50},{shop:600},{cost:-1}])assert.equal(quotaDecision(state),false);
 const q={uid:"buyer",slug:"loja-a",version:"v",expiresAt:100,feeCents:500,destination:c.origin,address:"Rua teste"};
 assert.equal(validQuote(q,{uid:"buyer",slug:"loja-a",version:"v",now:99}),true);
 assert.equal(validQuote(q,{uid:"other",slug:"loja-a",version:"v",now:99}),false);
 assert.equal(validQuote(q,{uid:"buyer",slug:"loja-a",version:"v",now:100}),false);
 assert.equal(validQuote(q,{uid:"buyer",slug:"loja-a",version:"v2",now:99}),false);
});
