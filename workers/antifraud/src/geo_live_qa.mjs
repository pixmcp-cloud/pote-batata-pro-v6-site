// Temporary smoke worker. No production Firebase access, no user-supplied queries.
// Only a one-time random CI secret permits the fixed synthetic suite.
import {createGeoWorker,GeoGate} from "./geo_worker.mjs";
import {deliveryFee,validQuote} from "./geo_core.mjs";
export {GeoGate};
const reply=(x,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
const same=(a,b)=>{
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length||b.length<64)return false;
 let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;
};
export default {async fetch(req,env){
 if(req.method!=="POST"||new URL(req.url).pathname!=="/__qa"||
 !same(req.headers.get("Authorization"),"Bearer "+(env.QA_PROBE_SECRET||"")))return reply({error:"not_found"},404);
 if(env.QA_PROBE_SECRET?.length!==64)return reply({error:"not_found"},404);
 const slug="qa-"+crypto.randomUUID().slice(0,8),owner="qa-owner",buyer="qa-buyer";
 const diagnostics={provider:[]};
 const app=createGeoWorker({
  requestFetch:async(url,opts)=>{const response=await fetch(url,opts);diagnostics.provider.push({path:new URL(url).pathname,status:response.status});return response;},
  verify:async(token)=>{if(![owner,buyer,"qa-outsider"].includes(token))throw Error("invalid");return {uid:token}},
  menuReader:async(_e,s)=>({slug:s,ownerUid:owner,published:s===slug})
 });
 const e={GEO_GATE:env.GEO_GATE,GEOAPIFY_API_KEY:env.GEOAPIFY_API_KEY,ENABLE_GEO:"true",GEO_CANARY_UIDS:owner+","+buyer,ALLOWED_ORIGINS:"https://qa.example"};
 let phase="start";const checks=[];
 const must=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 const call=async(path,data={},who=buyer,origin="https://qa.example")=>{
  const r=await app.fetch(new Request("https://qa.internal/v1/geo/"+path,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,...(who?{Authorization:"Bearer "+who}:{})},body:JSON.stringify({slug,...data})}),e);
  const body=await r.json();diagnostics.last={path,status:r.status,error:body.error};return {status:r.status,body};
 };
 const gate=async(name,action,data)=>{
  const r=await env.GEO_GATE.get(env.GEO_GATE.idFromName(name)).fetch("https://internal/"+action,{method:"POST",body:JSON.stringify(data),headers:{"Content-Type":"application/json"}});
  return {status:r.status,body:await r.json()};
 };
 try{
  phase="access";
  must((await call("quote",{},null)).status===401,"anonymous_denied");
  must((await call("quote",{},"qa-outsider")).status===403,"noncanary_denied");
  must((await call("config/set",{},buyer)).status===403,"nonowner_denied");
  must((await call("quote",{},buyer,"https://evil.example")).status===403,"cors_denied");
  phase="geocode";
  const a=await call("geocode",{text:"Rua Sinimbu, 1500, Caxias do Sul, Rio Grande do Sul, Brasil"},owner);
  const b=await call("geocode",{text:"Rua Pinheiro Machado, 2000, Caxias do Sul, Rio Grande do Sul, Brasil"},owner);
  diagnostics.geocode=[a,b].map(x=>({status:x.status,error:x.body.error,count:x.body.results?.length,streetCount:x.body.results?.filter(p=>p.street).length}));
  const origin=a.body.results?.find(p=>p.street),dest=b.body.results?.find(p=>p.street);
  must(a.status===200&&b.status===200&&origin&&dest,"geocode_real_br");
  const point=p=>({lat:p.lat,lon:p.lon});
  phase="config";
  const config={enabled:true,origin:point(origin),baseCents:400,perKmCents:200,minCents:600,maxMeters:15000,mode:"motorcycle"};
  const set=await call("config/set",{config},owner);
  must(set.status===200&&set.body.config?.version,"store_origin_verified");
  const read=await call("config/get",{},owner);
  must(read.status===200&&read.body.config.version===set.body.config.version,"config_persisted");
  phase="autocomplete";
  const auto=await call("autocomplete",{text:"Rua Pinheiro Machado, Caxias do Sul"},buyer);
  must(auto.status===200&&auto.body.results?.length>0,"autocomplete_real_br");
  phase="reverse";
  const rev=await call("reverse",{point:point(dest)},buyer);
  must(rev.status===200&&rev.body.results?.length>0,"reverse_real_br");
  phase="quote";
  const q=await call("quote",{point:point(dest),feeCents:1},buyer);
  must(q.status===200&&q.body.meters>0&&q.body.seconds>0&&q.body.feeCents===deliveryFee(config,q.body.meters)&&q.body.checkoutEnabled===false,"motorcycle_route_server_fee");
  const stored=await gate("quote:"+q.body.quoteId,"quote-get",{id:q.body.quoteId,uid:buyer,slug});
  must(stored.status===200&&stored.body.quote.id===q.body.quoteId&&validQuote(stored.body.quote,{uid:buyer,slug,version:read.body.config.version}),"quote_persisted_and_bound");
  must((await gate("quote:"+q.body.quoteId,"quote-get",{id:q.body.quoteId,uid:owner,slug})).status===404,"foreign_quote_denied");
  must((await call("quote",{point:{lat:-23.55,lon:-46.63}},buyer)).status===422,"outside_area_denied");
  phase="quota";
  const key="qa-quota:"+crypto.randomUUID();
  const qs=await Promise.all(Array.from({length:11},()=>gate(key,"quota",{uid:buyer,slug,cost:5})));
  must(qs.filter(r=>r.status===200).length===10&&qs.filter(r=>r.status===429).length===1,"atomic_quota_user_50");
  phase="checkout";
  const order=await call("orders/create",{},buyer);
  must(order.status===404,"checkout_not_exposed");
  return reply({ok:true,checks,meters:q.body.meters,seconds:q.body.seconds,feeCents:q.body.feeCents});
 }catch(err){return reply({ok:false,phase,checks,diagnostics},500)}
}};
