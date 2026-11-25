// Independent read-only Geoapify bridge; no stock/order/payment writes.
import {verifyFirebaseToken} from "./auth.mjs";
import {GeoError,slugOk,uidOk,brPoint,normalizeConfig,airMeters,deliveryFee,parsePlaces,parseRoute,addressQuery,quotaDecision} from "./geo_core.mjs";
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
const error=(code,status)=>{throw new GeoError(code,status)};
const object=x=>x&&typeof x==="object"&&!Array.isArray(x);
const keyOk=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{20,80}$/.test(x);
async function body(req){
 if(!req.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))error("invalid_content_type",415);
 const reader=req.body?.getReader();if(!reader)error("invalid_json",400);
 let size=0,parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;
 size+=value.byteLength;if(size>4096){await reader.cancel();error("invalid_json",400)}parts.push(value)}}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
 try{const b=JSON.parse(new TextDecoder().decode(bytes));if(!object(b))throw Error();return b}catch{error("invalid_json",400)}
}
async function readMenu(env,slug,token,requestFetch){
 if(!/^[a-z][a-z0-9-]{2,50}$/.test(env.FIREBASE_PROJECT_ID||""))error("not_configured",503);
 const url="https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/publicMenus/"+encodeURIComponent(slug);
 const r=await requestFetch(url,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(8000),redirect:"error"});
 if([403,404].includes(r.status))error("store_unavailable",404);
 if(!r.ok)error("store_lookup_failed",503);
 const fields=(await r.json()).fields||{};
 return {ownerUid:fields.ownerUid?.stringValue,published:fields.published?.booleanValue===true,slug:fields.slug?.stringValue};
}
async function internal(env,name,action,data){
 if(!env.GEO_GATE)error("not_configured",503);
 const stub=env.GEO_GATE.get(env.GEO_GATE.idFromName(name));
 const r=await stub.fetch("https://internal/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 if(!r.ok){const b=await r.json().catch(()=>({}));error(b.error||"geo_gate_unavailable",r.status)}
 return r.json();
}
export class GeoGate {
 constructor(state){this.storage=state.storage}
 async alarm(){await this.storage.deleteAll()}
 async fetch(req){
  try{
   const a=new URL(req.url).pathname.slice(1),b=await req.json();
   if(a==="quota"){
    if(!uidOk(b.uid)||!slugOk(b.slug))error("invalid_scope",400);
    const result=await this.storage.transaction(async tx=>{
     const total=await tx.get("total")||0,u="uid:"+b.uid,s="shop:"+b.slug;
     const user=await tx.get(u)||0,shop=await tx.get(s)||0;
     if(!quotaDecision({total,user,shop,cost:b.cost}))return false;
     await tx.put({total:total+b.cost,[u]:user+b.cost,[s]:shop+b.cost});return true
    });
    if(!await this.storage.getAlarm())await this.storage.setAlarm(Date.now()+2*86400000);
    if(!result)error("daily_quota_exhausted",429);
    return reply({ok:true});
   }
   if(a==="config-get")return reply({config:await this.storage.get("config")||null});
   if(a==="config-set"){
    if(!uidOk(b.uid))error("invalid_scope",400);
    const config={...normalizeConfig(b.config),ownerUid:b.uid,version:crypto.randomUUID()};
    await this.storage.put("config",config);return reply({config});
   }
   if(a==="quote-put"){
    if(!keyOk(b.id)||!uidOk(b.quote?.uid)||!slugOk(b.quote?.slug))error("invalid_quote",400);
    // A separate object per quote, automatically purged; never publicly readable.
    await this.storage.put("quote",{...b.quote,id:b.id});await this.storage.setAlarm(b.quote.expiresAt+60000);
    return reply({ok:true});
   }
   if(a==="quote-get"){
    if(!keyOk(b.id)||!uidOk(b.uid)||!slugOk(b.slug))error("invalid_quote",400);
    const q=await this.storage.get("quote");
    if(!q||q.id!==b.id||q.uid!==b.uid||q.slug!==b.slug||q.expiresAt<=Date.now())error("quote_unavailable",404);
    return reply({quote:q});
   }
   return reply({error:"not_found"},404);
  }catch(e){return reply({error:e instanceof GeoError?e.code:"geo_gate_unavailable"},e instanceof GeoError?e.status:503)}
 }
}
export function createGeoWorker({verify=verifyFirebaseToken,requestFetch=fetch,menuReader=readMenu,gate=internal,clock=()=>Date.now()}={}){
 const cache=new Map();
 async function call(env,scope,path,params,cost){
  if(!keyOk(env.GEOAPIFY_API_KEY))error("not_configured",503);
  const now=clock(),cacheKey=JSON.stringify([scope.uid,scope.slug,path,params]);
  const hit=cache.get(cacheKey);if(hit&&hit.until>now)return hit.value;
  await gate(env,"day:"+new Date(now).toISOString().slice(0,10),"quota",{...scope,cost});
  const url=new URL("https://api.geoapify.com/v1/"+path);
  url.search=new URLSearchParams({...params,apiKey:env.GEOAPIFY_API_KEY});
  let response;try{response=await requestFetch(url,{redirect:"error",signal:AbortSignal.timeout(10000)})}
  catch{error("geo_provider_unavailable",503)}
  if(!response.ok)error(response.status===429?"geo_provider_quota":"geo_provider_unavailable",response.status===429?429:503);
  let raw;try{raw=await response.json()}catch{error("invalid_geo_response",502)}
  const value=path==="routing"?parseRoute(raw):parsePlaces(raw);
  for(const [k,v] of cache)if(v.until<=now)cache.delete(k);
  if(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(cacheKey,{until:now+120000,value});return value;
 }
 const getConfig=async(env,slug)=> (await gate(env,"store:"+slug,"config-get",{})).config;
 return {async fetch(req,env){
  const origin=req.headers.get("Origin"),allowed=String(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(origin&&!allowed.includes(origin))return reply({error:"origin_not_allowed"},403);
  const cors=origin?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type","Vary":"Origin"}:{};
  const path=new URL(req.url).pathname;
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method==="GET"&&path==="/health")return reply({status:"ok",enabled:env.ENABLE_GEO==="true",checkoutEnabled:false},200,cors);
  if(req.method!=="POST"||!["/v1/geo/config/get","/v1/geo/config/set","/v1/geo/autocomplete","/v1/geo/geocode","/v1/geo/reverse","/v1/geo/quote"].includes(path))return reply({error:"not_found"},404,cors);
  try{
   if(env.ENABLE_GEO!=="true")error("geo_disabled",423);
   const auth=req.headers.get("Authorization")||"";
   if(!/^Bearer [^\s]+$/.test(auth))error("authentication_required",401);
   const token=auth.slice(7);
   let user;try{user=await verify(token,env.FIREBASE_PROJECT_ID)}catch{error("invalid_identity",401)}
   if(!uidOk(user?.uid))error("invalid_identity",401);
   const canaries=String(env.GEO_CANARY_UIDS||"").split(",").map(x=>x.trim()).filter(uidOk);
   if(!canaries.includes(user.uid))error("canary_required",403);
   const b=await body(req);if(!slugOk(b.slug))error("invalid_store",400);
   const slug=b.slug,scope={uid:user.uid,slug},menu=await menuReader(env,slug,token,requestFetch);
   if(menu.slug!==slug||!uidOk(menu.ownerUid))error("store_unavailable",404);
   const owner=menu.ownerUid===user.uid;
   if(path.startsWith("/v1/geo/config/")){
    if(!owner)error("owner_required",403);
    if(path.endsWith("/get")){
     const current=await getConfig(env,slug);
     return reply({config:current?.ownerUid===user.uid?current:null},200,cors);
    }
    const config=normalizeConfig(b.config);
    const locations=await call(env,scope,"geocode/reverse",{lat:String(config.origin.lat),lon:String(config.origin.lon),lang:"pt",limit:"1"},1);
    if(!locations.length||airMeters(config.origin,locations[0])>500)error("invalid_store_location",422);
    return reply(await gate(env,"store:"+slug,"config-set",{uid:user.uid,config}),200,cors);
   }
   if(!menu.published&&!owner)error("store_unavailable",404);
   const config=await getConfig(env,slug);
   if(path==="/v1/geo/geocode"&&owner){
    const results=await call(env,scope,"geocode/search",{text:addressQuery(b.text),filter:"countrycode:br",lang:"pt",limit:"5"},1);
    return reply({results},200,cors);
   }
   if(!config||config.ownerUid!==menu.ownerUid||!config.enabled)error("delivery_disabled",409);
   const c=normalizeConfig(config);
   if(path==="/v1/geo/autocomplete"||path==="/v1/geo/geocode"){
    const results=await call(env,scope,path.endsWith("autocomplete")?"geocode/autocomplete":"geocode/search",
     {text:addressQuery(b.text),filter:"countrycode:br",bias:"proximity:"+c.origin.lon+","+c.origin.lat,lang:"pt",limit:"5"},1);
    return reply({results:results.filter(p=>airMeters(c.origin,p)<=c.maxMeters)},200,cors);
   }
   if(!brPoint(b.point))error("invalid_coordinates",400);
   const point={lat:b.point.lat,lon:b.point.lon};
   if(airMeters(c.origin,point)>c.maxMeters)error("outside_delivery_area",422);
   const results=await call(env,scope,"geocode/reverse",{lat:String(point.lat),lon:String(point.lon),lang:"pt",limit:"1"},1);
   const location=results[0];
   if(!location||airMeters(point,location)>100)error("address_not_confirmed",422);
   if(path==="/v1/geo/reverse")return reply({results},200,cors);
   if(!location.street)error("address_not_confirmed",422);
   const route=await call(env,scope,"routing",{waypoints:c.origin.lat+","+c.origin.lon+"|"+point.lat+","+point.lon,
    mode:c.mode,units:"metric",lang:"pt"},2);
   const feeCents=deliveryFee(c,route.meters),now=clock(),id=crypto.randomUUID(),expiresAt=now+10*60000;
   const quote={id,uid:user.uid,slug,version:config.version,destination:point,address:location.address,
    feeCents,meters:route.meters,seconds:route.seconds,expiresAt};
   await gate(env,"quote:"+id,"quote-put",{id,quote});
   return reply({quoteId:id,address:quote.address,feeCents,meters:route.meters,seconds:route.seconds,expiresAt,checkoutEnabled:false},200,cors);
  }catch(e){return reply({error:e instanceof GeoError?e.code:"geo_unavailable"},e instanceof GeoError?e.status:503,cors)}
 }};
}
export default createGeoWorker();
