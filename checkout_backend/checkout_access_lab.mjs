// G2: boundary for one isolated storefront, never accepts browser roles.
// Deliberately not a production route. Public projection includes no physical stock or private IDs.
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const buyerRoutes=new Set(["quote","submitSaved","recoverSubmit","status"]);
const merchantRoutes=new Set(["quote","submitSaved","recoverSubmit","status","transition","openCash","moveCash","closeCash","adjustStock","snapshot"]);
export function publicCatalog(manifest){
 if(!manifest||manifest.lab!==true||manifest.enabled!==true||manifest.channel!=="online"||!id(manifest.storeId)||!id(manifest.revision)||!Array.isArray(manifest.products)||manifest.products.length>60)fail("store_unavailable");
 const price=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
 const title=s=>typeof s==="string"&&s.trim().length>0&&s.length<=220;
 const products=manifest.products.filter(p=>p.available===true).map(p=>{
  if(!id(p.id)||!title(p.title)||!price(p.priceCents)||!Array.isArray(p.extras)||p.extras.length>20)fail("invalid_catalog");
  return {id:p.id,title:p.title,priceCents:p.priceCents,extras:p.extras.map(e=>{if(!id(e.id)||!title(e.title)||!price(e.priceCents))fail("invalid_catalog");return {id:e.id,title:e.title,priceCents:e.priceCents}})};
 });
 if(!price(manifest.deliveryFeeCents??0))fail("invalid_catalog");
 return {storeId:manifest.storeId,revision:manifest.revision,products,deliveryEnabled:manifest.deliveryEnabled===true,deliveryFeeCents:manifest.deliveryEnabled===true?manifest.deliveryFeeCents??0:0};
}
export function authorizeCheckoutRoute({surface,route,identity,body,store}={}){
 if(!identity||identity.emailVerified!==true||identity.provider!=="google.com"||!id(identity.uid))fail("login_required");
 if(!store||!id(store.ownerUid)||!id(store.online)||!id(store.counter)||!body||typeof body!=="object"||Array.isArray(body))fail("invalid_request");
 if(["uid","ownerUid","customerUid","role","token","projectId"].some(k=>Object.hasOwn(body,k)))fail("invalid_request");
 if(surface==="customer"){
  if(!buyerRoutes.has(route)||body.storeId!==store.online)fail("forbidden");
 }else if(surface==="merchant"){
  if(identity.uid!==store.ownerUid||!merchantRoutes.has(route))fail("forbidden");
  if(route==="quote"||route==="submitSaved"||route==="recoverSubmit"||route==="status"||route==="adjustStock"){if(body.storeId!==store.counter)fail("forbidden")}
  if(route==="transition"&&![store.online,store.counter].includes(body.storeId))fail("forbidden");
  if(["openCash","moveCash","closeCash","snapshot"].includes(route)&&Object.hasOwn(body,"storeId"))fail("invalid_request");
 }else fail("forbidden");
 return {uid:identity.uid};
}
