// G2 synthetic customer-only surface. No merchant API, credentials or modules.
import {createGoogleCheckoutBridge} from "./google_checkout_bridge_lab.mjs";
import {mountOrderTicker} from "./order_ticker.mjs";
if(!["127.0.0.1","localhost"].includes(location.hostname))throw Error("Local lab only");
const $=id=>document.getElementById(id),op=()=>crypto.randomUUID(),money=n=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const el=(tag,t)=>{const e=document.createElement(tag);if(t!==undefined)e.textContent=t;return e};
const feedback=t=>$("feedback").textContent=t;
async function req(path,body,token){const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error??"operation_not_confirmed"),{code:data.error});return data}
const catalog=await req("/customer/catalog",{}),auth={currentUser:null},listeners=new Set();
let quote=null,busy=false,stopTicker=null;
// Synthetic SDK fixture only: popup interface is injected, no real Google auth.
const sdk={GoogleAuthProvider:class{},onAuthStateChanged:(a,cb)=>{listeners.add(cb);return()=>listeners.delete(cb)},signInWithPopup:async()=>{const s=await req("/customer/login",{});auth.currentUser={uid:s.uid,emailVerified:true,providerData:[{providerId:"google.com"}],getIdToken:async()=>s.token};for(const cb of listeners)cb(auth.currentUser)},signOut:async()=>{auth.currentUser=null;for(const cb of listeners)cb(null)}};
const {client,signOut}=createGoogleCheckoutBridge({auth,sdk,send:(kind,body,token)=>req("/customer/api/"+kind,body,token),subscribePrivate:(storeId,orderId,next,error)=>{
 let stopped=false,timer;const poll=async()=>{try{const u=auth.currentUser;if(!u)return;const result=await req("/customer/api/status",{storeId,orderId},await u.getIdToken());if(!stopped&&auth.currentUser===u){next({customerUid:u.uid,storeId,status:result,connected:true,serverNowMs:result.createdAt+result.elapsedMs});if(["delivered","cancelled"].includes(result.status))clearInterval(timer)}}catch{if(!stopped)error()}};
 timer=setInterval(poll,1000);poll();return()=>{stopped=true;clearInterval(timer)};
}});
const journal=client.recovery({storeId:catalog.storeId,storage:sessionStorage,newOperationId:op});
function pending(){return auth.currentUser?journal.pending():null}
function sync(){const p=pending();$("quote").disabled=busy||!!p;$("submit").disabled=busy||!!p||!quote;$("recover").disabled=busy;$("retry-order").hidden=!p;$("retry-order").disabled=busy;$("logout").hidden=!auth.currentUser;$("logout").disabled=busy;for(const x of document.querySelectorAll("input,select"))x.disabled=busy||!!p;}
function clear(){quote=null;$("quote-total").textContent="";sync()}
function cart(){return {lines:[...document.querySelectorAll("[data-product]")].filter(x=>Number(x.value)>0).map(x=>({productId:x.dataset.product,quantity:Number(x.value),extras:[...document.querySelectorAll("[data-extra]")].filter(y=>y.dataset.forProduct===x.dataset.product&&Number(y.value)>0).map(y=>({id:y.dataset.extra,quantity:Number(y.value)}))})),fulfillment:$("fulfillment").value,paymentMethod:$("method").value,...($("fulfillment").value==="delivery"?{address:$("address").value}:{})}}
for(const p of catalog.products){const a=el("article"),q=el("input");a.append(el("h2",p.title),el("p",money(p.priceCents)));q.type="number";q.min=0;q.max=99;q.value=0;q.dataset.product=p.id;q.setAttribute("aria-label","Quantidade "+p.title);q.oninput=clear;a.append(q);for(const e of p.extras){const l=el("label",e.title+" · "+money(e.priceCents)),v=el("input");v.type="number";v.min=0;v.max=10;v.value=0;v.dataset.extra=e.id;v.dataset.forProduct=p.id;v.oninput=clear;l.append(v);a.append(l)}$("products").append(a)}
if(!catalog.deliveryEnabled)$("fulfillment").querySelector('[value="delivery"]').disabled=true;
$("fulfillment").onchange=()=>{$("address-label").hidden=$("fulfillment").value!=="delivery";clear()};$("address").oninput=clear;$("method").onchange=clear;
async function guard(fn){if(busy)return;busy=true;try{sync();await fn()}catch(e){feedback("Não concluído: "+(e.code??e.message))}finally{busy=false;try{sync()}catch{feedback("Recuperação indisponível; não envie outro pedido.")}}}
function resolved(result){if(result.state==="committed"){quote=null;for(const e of document.querySelectorAll("[data-product],[data-extra]"))e.value=0;$("quote-total").textContent="";feedback("Pedido #"+result.order.id+" registrado.");if(stopTicker)stopTicker();$("ticker").hidden=false;stopTicker=mountOrderTicker($("ticker"),{subscribe:emit=>client.watch(catalog.storeId,result.order.id,emit)})}else if(result.state==="unconfirmed")feedback("Tentativa não confirmada. Consulte novamente ou repita a mesma confirmação.");else feedback("Nenhuma tentativa pendente nesta sessão.")}
$("quote").onclick=()=>guard(async()=>{const input=cart();if(!input.lines.length)throw Error("Escolha um produto.");if(auth.currentUser&&pending())return resolved(await journal.recover());const q=await client.quote({storeId:catalog.storeId,operationId:op(),input});if(pending()){quote=null;return resolved(await journal.recover())}quote=q;$("quote-total").textContent="Total confirmado: "+money(q.totalCents);feedback("Confira o valor antes de confirmar.")});
$("submit").onclick=()=>guard(async()=>{if(quote)resolved(await journal.begin(quote))});
$("recover").onclick=()=>guard(async()=>resolved(await journal.recover()));$("retry-order").onclick=()=>guard(async()=>resolved(await journal.retry()));
$("logout").onclick=()=>guard(async()=>{await signOut();quote=null;if(stopTicker)stopTicker();stopTicker=null;$("ticker").hidden=true;$("quote-total").textContent="";$("address").value="";for(const e of document.querySelectorAll("[data-product],[data-extra]"))e.value=0;feedback("Sessão encerrada.")});
sync();document.body.dataset.ready="true";
