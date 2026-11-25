import {OperationalError} from "./domain.mjs";
import {validateDeliveryPolicy,quoteDelivery,neighborhoodKey} from "./delivery_pricing.mjs";
const deny=(message,code="delivery_unavailable",status=409)=>{throw new OperationalError(message,status,code)};
const clean=(x,max)=>typeof x==="string"&&x.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(x)?x.trim():null;
export function deliveryInput(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).length!==5||!["cep","number","complement","expectedFeeCents","expectedAddress"].every(k=>Object.hasOwn(raw,k)))deny("Endereço inválido.","invalid_checkout",400);
 const cep=clean(raw.cep,9),number=clean(raw.number,16),complement=clean(raw.complement,80),expectedAddress=clean(raw.expectedAddress,360);
 if(!cep||!/^\d{5}-?\d{3}$/.test(cep)||!number||!/^\d{1,7}[A-Za-z]?$/.test(number)||complement===null||expectedAddress===null||!Number.isSafeInteger(raw.expectedFeeCents)||raw.expectedFeeCents<0||raw.expectedFeeCents>10000000)deny("Informe CEP, número e complemento válidos.","invalid_checkout",400);
 return {cep:cep.replace("-",""),number,complement,expectedFeeCents:raw.expectedFeeCents,expectedAddress};
}
// Lookup only the CEP, never customer name, phone or complement. No bulk
// requests and no fabricated distance. A generic CEP cannot verify a zone.
export async function lookupPostalCode(cep){
 try{
  const res=await fetch("https://viacep.com.br/ws/"+cep+"/json/",{signal:AbortSignal.timeout(5000),redirect:"error",headers:{Accept:"application/json"}});
  if(!res.ok)return null;
  const raw=await res.json();return raw?.erro?null:raw;
 }catch{return null}
}
export async function resolveDelivery({input,settings,subtotalCents,lookup=lookupPostalCode,env}){
 if(env.ENABLE_PUBLIC_DELIVERY!=="true")deny("Tele-entrega em homologação.","delivery_disabled",423);
 let policy;try{policy=validateDeliveryPolicy(settings?.deliveryPolicy)}catch{deny("Loja precisa revisar as tarifas.")}
 const city=clean(settings?.deliveryCity,80),uf=clean(settings?.deliveryUF,2);
 if(!policy.enabled||!city||!uf||! /^[A-Z]{2}$/.test(uf))deny("Loja não configurada para tele-entrega.");
 if(policy.mode==="distance"||policy.maxDistanceMeters!==null)deny("Distância por rota ainda indisponível. Consulte a loja.","route_unavailable");
 const postal=await lookup(input.cep);
 const street=clean(postal?.logradouro,100),district=clean(postal?.bairro,80),locality=clean(postal?.localidade,80);
 if(!street||!district||!locality||String(postal?.cep||"").replace("-","")!==input.cep)deny("CEP sem rua e bairro verificáveis. Consulte a loja.","address_unverified");
 if(postal.uf!==uf||neighborhoodKey(locality)!==neighborhoodKey(city))deny("Endereço fora da cidade atendida.","outside_service_area");
 const zone=policy.neighborhoods.find(z=>neighborhoodKey(z.name)===neighborhoodKey(district));
 if(!zone)deny("Bairro sem tarifa cadastrada. Consulte a loja.","route_unavailable");
 let quote;try{quote=quoteDelivery(policy,{verifiedNeighborhoodId:zone.id,subtotalCents})}catch(e){deny(e.message)}
 const cost=Number(settings.deliveryCostPerOrder??0);
 if(!Number.isFinite(cost)||cost<0||cost>100000||Math.abs(cost*100-Math.round(cost*100))>1e-6)deny("Loja precisa revisar o custo previsto de entrega.");
 const address=street+", "+input.number+" · "+district+" · "+locality+"/"+uf+" · CEP "+input.cep+(input.complement?" · "+input.complement:"");
 if(address.length>360)deny("Endereço muito longo.","invalid_checkout",400);
 return {...quote,address,cep:input.cep,costCents:Math.round(cost*100)};
}
