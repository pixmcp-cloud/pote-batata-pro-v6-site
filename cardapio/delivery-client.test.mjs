import test from "node:test";
import assert from "node:assert/strict";
import {createDeliveryClient,quoteCurrent} from "./delivery-client.mjs";
test("disabled unless explicit HTTPS origin, never sends key",async()=>{
 let calls=0;const fetch=async()=>{calls++;return Response.json({ok:true})};
 const c=createDeliveryClient({endpoint:"",token:async()=>"token",requestFetch:fetch});
 assert.equal(c.enabled,false);await assert.rejects(()=>c.request("quote",{}));assert.equal(calls,0);
 assert.equal(createDeliveryClient({endpoint:"http://example.com",token:async()=>""}).enabled,false);
 const active=createDeliveryClient({endpoint:"https://example.com",token:async()=>"token",requestFetch:async(u,r)=>{assert.equal(u,"https://example.com/v1/geo/quote");assert.equal(r.headers.Authorization,"Bearer token");assert.equal(r.redirect,"error");assert.equal(r.credentials,"omit");assert.ok(!r.body.includes("apiKey"));return Response.json({feeCents:400});}});
 assert.deepEqual(await active.request("quote",{slug:"loja-a",point:{lat:-29,lon:-51}}),{feeCents:400});
 await assert.rejects(()=>active.request("orders/create",{}));
});
test("quote invalidated on expiry, address, user or store changes",()=>{
 const q={expiresAt:100,identity:"user",slug:"loja-a",addressInput:"Rua teste",feeCents:500};
 const input={now:99,identity:"user",slug:"loja-a",address:"Rua teste"};
 assert.ok(quoteCurrent(q,input));
 for(const changes of [{now:100},{identity:"other"},{slug:"loja-b"},{address:"Rua outra"}])assert.equal(quoteCurrent(q,{...input,...changes}),false);
});
