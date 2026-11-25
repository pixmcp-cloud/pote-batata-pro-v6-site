import {CHECKOUT_ENDPOINT} from "./checkout-config.mjs";
const routes=["orders/create","orders/resolve","orders/read","orders/assign","orders/invite","orders/accept-invite","orders/transition","orders/confirm-payment","tracking/start","tracking/publish","tracking/read","tracking/clear"];
export function createCheckoutApi({endpoint=CHECKOUT_ENDPOINT,token,requestFetch=fetch}={}){
 let base;try{const u=new URL(endpoint);if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash)throw Error();base=u.origin}catch{}
 return {enabled:!!base,async request(route,data){
  if(!base||!routes.includes(route))throw Object.assign(Error("disabled"),{code:"checkout_disabled"});
  const idToken=await token();if(!idToken)throw Object.assign(Error("login"),{code:"authentication_required"});
  const res=await requestFetch(base+"/v1/"+route,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+idToken},body:JSON.stringify(data),signal:AbortSignal.timeout(25000),redirect:"error",cache:"no-store",credentials:"omit"});
  const b=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(Error("order failed"),{code:b.error,status:res.status});return b;
 }};
}
export async function getOrderAuth(){
 const [{app},sdk]=await Promise.all([import("../firebase_app.mjs"),import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js")]);
 const auth=sdk.getAuth(app);await auth.authStateReady();return {app,auth,sdk};
}
export async function signInForOrder(){
 const a=await getOrderAuth();if(!a.auth.currentUser)await a.sdk.signInWithPopup(a.auth,new a.sdk.GoogleAuthProvider());return a;
}
const digest=async x=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(x)))),b=>b.toString(16).padStart(2,"0")).join("");
export async function checkoutIdentity({storage,uid,slug,request,random=()=>crypto.randomUUID()}){
 // Preserve idempotency across network errors without storing personal details.
 const key="pote-web-pending:"+uid+":"+slug,fingerprint=await digest(request);
 let old;try{old=JSON.parse(storage.getItem(key)||"null")}catch{}
 if(old&&old.fingerprint!==fingerprint)throw Object.assign(Error("pending other order"),{code:"pending_other_order"});
 const operationId=old?.operationId||random();
 storage.setItem(key,JSON.stringify({fingerprint,operationId}));
 return {operationId,clear:()=>{const current=JSON.parse(storage.getItem(key)||"null");if(current?.operationId===operationId)storage.removeItem(key)}};
}
export function checkoutRequest({slug,cart,form,subtotalCents,quote,uid}){
 const delivery=form.fulfillment==="entrega";
 if(!["entrega","retirada"].includes(form.fulfillment)||!["pix","cartao","dinheiro"].includes(form.payment)||!Array.isArray(cart)||!cart.length||!Number.isSafeInteger(subtotalCents)||subtotalCents<=0)throw Error("invalid_checkout");
 if(delivery&&(!quote||quote.identity!==uid||quote.slug!==slug||quote.expiresAt<=Date.now()||!Number.isSafeInteger(quote.feeCents)))throw Object.assign(Error("quote required"),{code:"delivery_quote_invalid"});
 return {slug,lines:cart.map(x=>({id:x.id,quantity:x.quantity,addonIds:x.addonIds||[],note:String(x.note||"")})),fulfillment:form.fulfillment,payment:form.payment,customerName:String(form.customerName||"").trim(),customerPhone:String(form.customerPhone||"").trim(),quoteId:delivery?quote.quoteId:null,expectedTotalCents:subtotalCents+(delivery?quote.feeCents:0)};
}

export function pendingCheckout(storage,uid,slug){
 const key="pote-web-pending:"+uid+":"+slug;
 let record;try{record=JSON.parse(storage.getItem(key)||"null")}catch{return null}
 if(!record||typeof record.operationId!=="string")return null;
 return {operationId:record.operationId,clear(){const current=JSON.parse(storage.getItem(key)||"null");if(current?.operationId===record.operationId)storage.removeItem(key);}};
}
