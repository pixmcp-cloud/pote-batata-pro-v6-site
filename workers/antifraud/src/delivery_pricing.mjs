// V6 delivery pricing, server-side foundation. Never accept distances or
// neighborhood identity directly from the checkout request as verified facts.
export const DEFAULT_DELIVERY_POLICY=Object.freeze({
 enabled:false,mode:"hybrid",perKmCents:50,minFeeCents:0,maxDistanceMeters:null,
 freeAboveCents:null,neighborhoods:Object.freeze([])
});
const modes=new Set(["distance","fixed","hybrid"]);
const fail=message=>{throw new RangeError(message)};
const int=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const cents=value=>int(value,0,10000000);
const safeText=(value,max)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export function neighborhoodKey(value){
 if(!safeText(value,80))fail("Informe um bairro válido.");
 return value.normalize("NFD").replace(/\p{M}/gu,"").trim().replace(/\s+/g," ").toLocaleLowerCase("pt-BR");
}
export function validateDeliveryPolicy(raw=DEFAULT_DELIVERY_POLICY){
 if(!raw||typeof raw!=="object"||typeof raw.enabled!=="boolean"||!modes.has(raw.mode)||
 !cents(raw.perKmCents)||raw.perKmCents===0||!cents(raw.minFeeCents)||
 (raw.maxDistanceMeters!==null&&!int(raw.maxDistanceMeters,1,200000))||
 (raw.freeAboveCents!==null&&!int(raw.freeAboveCents,1,10000000))||
 !Array.isArray(raw.neighborhoods)||raw.neighborhoods.length>100)fail("Configuração de frete inválida.");
 const keys=new Set(),ids=new Set();
 const neighborhoods=raw.neighborhoods.map(row=>{
  if(!row||typeof row.id!=="string"||!/^[A-Za-z0-9_-]{1,64}$/.test(row.id)||
   !safeText(row.name,80)||!cents(row.feeCents)||typeof row.enabled!=="boolean")fail("Bairro ou tarifa inválida.");
  const key=neighborhoodKey(row.name);
  if(keys.has(key)||ids.has(row.id))fail("Bairro duplicado.");
  keys.add(key);ids.add(row.id);
  return {id:row.id,name:row.name.trim(),feeCents:row.feeCents,enabled:row.enabled};
 });
 return {enabled:raw.enabled,mode:raw.mode,perKmCents:raw.perKmCents,minFeeCents:raw.minFeeCents,
  maxDistanceMeters:raw.maxDistanceMeters,freeAboveCents:raw.freeAboveCents,neighborhoods};
}
// The caller must independently resolve the destination against the store's
// city/service area and obtain a trusted road-route distance in meters.
// A disabled fixed neighborhood blocks delivery, including distance fallback.
export function quoteDelivery(raw,{verifiedNeighborhoodId=null,routeMeters=null,subtotalCents}={}){
 const policy=validateDeliveryPolicy(raw);
 if(!policy.enabled)fail("Tele-entrega indisponível.");
 if(!cents(subtotalCents))fail("Subtotal inválido.");
 if(routeMeters!==null&&!int(routeMeters,0,200000))fail("Distância de rota inválida.");
 if(verifiedNeighborhoodId!==null&&typeof verifiedNeighborhoodId!=="string")fail("Bairro inválido.");
 const zone=policy.neighborhoods.find(row=>row.id===verifiedNeighborhoodId);
 if(zone&&!zone.enabled)fail("Bairro fora da área de entrega.");
 // When a maximum is configured it applies to every delivery, including
 // fixed-price zones. Missing distance cannot bypass a configured limit.
 if(policy.maxDistanceMeters!==null&&(routeMeters===null||routeMeters>policy.maxDistanceMeters))fail("Endereço fora do limite ou rota indisponível.");
 let method,standardFeeCents;
 if(policy.mode!=="distance"&&zone){method="fixed";standardFeeCents=zone.feeCents;}
 else {
  if(policy.mode==="fixed")fail("Bairro não atendido.");
  if(routeMeters===null)fail("Não foi possível confirmar a distância.");
  method="distance";
  // Integer cents, nearest cent; a fixed price is not affected by the minimum.
  standardFeeCents=Math.max(policy.minFeeCents,Math.round(routeMeters*policy.perKmCents/1000));
  if(!cents(standardFeeCents))fail("Valor do frete fora do limite.");
 }
 const free=policy.freeAboveCents!==null&&subtotalCents>=policy.freeAboveCents;
 return {method,neighborhoodId:zone?.id??null,routeMeters,standardFeeCents,feeCents:free?0:standardFeeCents,discountCents:free?standardFeeCents:0};
}
