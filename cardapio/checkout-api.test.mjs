import test from "node:test";
import assert from "node:assert/strict";
import {createCheckoutApi,checkoutIdentity,checkoutRequest} from "./checkout-api.mjs";
test("disabled client and no secret or bearer forwarding",async()=>{
 let seen=0;const disabled=createCheckoutApi({endpoint:"",token:async()=>"token",requestFetch:()=>{seen++}});
 await assert.rejects(()=>disabled.request("orders/create",{}));assert.equal(seen,0);
 const api=createCheckoutApi({endpoint:"https://example.test",token:async()=>"token",requestFetch:async(u,o)=>{assert.equal(o.redirect,"error");assert.equal(o.credentials,"omit");assert.equal(o.headers.Authorization,"Bearer token");assert.ok(u.endsWith("/v1/orders/create"));return Response.json({ok:true})}});
 assert.equal((await api.request("orders/create",{})).ok,true);
});
test("network retry keeps same id; changed basket does not silently duplicate",async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const options={storage,uid:"u",slug:"loja-a",request:{customerName:"Cliente",customerPhone:"48999999999",total:6000},random:()=>"uuid-test"};
 const first=await checkoutIdentity(options),again=await checkoutIdentity({...options,random:()=>"different"});
 assert.equal(first.operationId,again.operationId);assert.ok(!JSON.stringify([...map.values()]).includes("48999999999"));
 await assert.rejects(()=>checkoutIdentity({...options,request:{total:7000}}),/pending other order/);
 again.clear();assert.equal(map.size,0);
});
test("price confirmation derives from cart and current authorized quote",()=>{
 const base={slug:"loja-a",cart:[{id:"r1",quantity:2,addonIds:[],note:""}],form:{fulfillment:"entrega",payment:"pix",customerName:"QA",customerPhone:"48999999999"},subtotalCents:6000,uid:"u"};
 const quote={identity:"u",slug:"loja-a",expiresAt:Date.now()+10000,feeCents:600,quoteId:"quote-id"};
 assert.equal(checkoutRequest({...base,quote}).expectedTotalCents,6600);
 assert.throws(()=>checkoutRequest({...base,quote:{...quote,identity:"other"}}),/quote required/);
});
