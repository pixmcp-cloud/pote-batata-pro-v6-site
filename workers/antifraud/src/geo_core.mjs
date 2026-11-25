// V6 delivery pricing: integer centavos, road distance, fail closed.
export class GeoError extends Error {
 constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
export const slugOk=x=>typeof x==="string"&&/^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/.test(x);
export const uidOk=x=>typeof x==="string"&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export const brPoint=p=>p&&typeof p.lat==="number"&&typeof p.lon==="number"&&
 Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=-34&&p.lat<=6&&p.lon>=-74&&p.lon<=-28;
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function normalizeConfig(raw){
 if(!raw||typeof raw!=="object"||!brPoint(raw.origin)||typeof raw.enabled!=="boolean"||
 !int(raw.baseCents,0,100000)||!int(raw.perKmCents,0,100000)||!int(raw.minCents,0,100000)||
 !int(raw.maxMeters,500,50000)||!["drive","motorcycle","bicycle"].includes(raw.mode))
 throw new GeoError("invalid_delivery_config");
 return {enabled:raw.enabled,origin:{lat:raw.origin.lat,lon:raw.origin.lon},
 baseCents:raw.baseCents,perKmCents:raw.perKmCents,minCents:raw.minCents,maxMeters:raw.maxMeters,mode:raw.mode};
}
export function airMeters(a,b){
 if(!brPoint(a)||!brPoint(b))throw new GeoError("invalid_coordinates");
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return Math.round(6371000*2*Math.asin(Math.min(1,Math.sqrt(x))));
}
export function deliveryFee(config,meters){
 const c=normalizeConfig(config);
 if(!c.enabled)throw new GeoError("delivery_disabled",409);
 if(!int(meters,0,1000000))throw new GeoError("invalid_route",502);
 if(meters>c.maxMeters)throw new GeoError("outside_delivery_area",422);
 return Math.max(c.minCents,c.baseCents+Math.ceil(c.perKmCents*meters/1000));
}
export function parsePlaces(raw){
 if(!Array.isArray(raw?.features))throw new GeoError("invalid_geo_response",502);
 return raw.features.map(f=>f?.properties).filter(p=>p?.country_code==="br"&&brPoint(p)&&
 typeof p.formatted==="string"&&p.formatted.length>0).slice(0,5).map(p=>({
 address:p.formatted.slice(0,240),lat:p.lat,lon:p.lon,
 number:String(p.housenumber||"").slice(0,20),street:String(p.street||"").slice(0,120),
 city:String(p.city||p.town||p.municipality||"").slice(0,100),postcode:String(p.postcode||"").slice(0,12),
 type:String(p.result_type||"").slice(0,30)
 }));
}
export function parseRoute(raw){
 const p=raw?.features?.[0]?.properties;
 if(!p||!Number.isFinite(p.distance)||p.distance<0||p.distance>1000000||
 !Number.isFinite(p.time)||p.time<0||p.time>86400)throw new GeoError("invalid_route",502);
 return {meters:Math.ceil(p.distance),seconds:Math.ceil(p.time)};
}
export function addressQuery(x){
 if(typeof x!=="string"||x.trim().length<4||x.length>220||/[\u0000-\u001f]/.test(x))
 throw new GeoError("invalid_address");
 return x.trim().replace(/\s+/g," ");
}
export function validQuote(q,{uid,slug,version,now=Date.now()}){
 return Boolean(q&&q.uid===uid&&q.slug===slug&&q.version===version&&q.expiresAt>now&&
 int(q.feeCents,0,5100000)&&brPoint(q.destination)&&typeof q.address==="string");
}
export function quotaDecision({total=0,user=0,shop=0,cost=1}={}){
 if(!int(cost,1,5)||!int(total,0,100000)||!int(user,0,100000)||!int(shop,0,100000))
 return false;
 // Conservative allocation: leaves headroom for manual tests and other projects.
 return total+cost<=1800&&user+cost<=50&&shop+cost<=600;
}
