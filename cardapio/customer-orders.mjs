import {CHECKOUT_ENDPOINT} from "./checkout-config.mjs";
import {createCheckoutApi,signInForOrder,checkoutIdentity,checkoutRequest,pendingCheckout} from "./checkout-api.mjs";
import {mountOrderLiveStatus,statusPresentation} from "./order-live-status.mjs";
import {money} from "./cardapio-core.mjs";
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
const btn=text=>{const x=el("button",text,"button button-quiet");x.type="button";return x};
const terminal=o=>["entregue","cancelado"].includes(o?.status);
const messages={delivery_quote_invalid:"Calcule novamente o frete.",price_changed:"O preço da loja mudou. Atualize o cardápio e confira o total.",insufficient_stock:"Estoque insuficiente. Revise os itens.",pending_other_order:"Existe uma tentativa de pedido pendente. Confira o histórico ou repita a mesma sacola.",monthly_delivery_limit:"A loja atingiu o limite de entregas automáticas.",plan_not_ready:"Esta loja ainda não habilitou pedidos online.",canary_required:"Checkout reservado à homologação.",checkout_disabled:"Checkout ainda não habilitado."};
function printView(view){
 const article=el("article",undefined,"customer-print-receipt");
 article.append(el("h2","Comprovante do pedido "+view.code),el("p","Documento não fiscal • "+view.store),el("p","Criado: "+new Date(view.createdAt).toLocaleString("pt-BR")),el("p",view.label));
 for(const x of view.lines||[]){article.append(el("p",x.qty+"× "+x.name+" — "+money(x.qty*x.unitPriceCents)));if(x.note)article.append(el("small",x.note));}
 article.append(el("p","Produtos: "+money(view.subtotalCents)),el("p","Entrega: "+money(view.feeCents)),el("strong","TOTAL "+money(view.totalCents)),el("p","Pagamento: "+(view.paymentStatus==="confirmed"?"Confirmado":"Pendente de confirmação")));
 if(view.address)article.append(el("p","Endereço: "+view.address));
 if(terminal(view)){const v=statusPresentation(view);article.append(el("p","Tempo total: "+(v?.clock||"—")));}
 document.body.append(article);document.body.classList.add("printing-customer-order");
 const cleanup=()=>{document.body.classList.remove("printing-customer-order");article.remove();window.removeEventListener("afterprint",cleanup)};
 window.addEventListener("afterprint",cleanup,{once:true});
 try{window.print()}finally{setTimeout(cleanup,60000)}
}
export function mountCustomerOrders({slug,checkoutButton,historyButton,getCart,getForm,subtotal,quoteFor,onSuccess,toast}){
 if(!CHECKOUT_ENDPOINT||!checkoutButton||!historyButton)return null;
 let session=null,api=null,authOff=null,off=null,uid=null,views=[],selected=null,busy=false,epoch=0,trackingTimer=null,trackingId=null,trackingEpoch=0;
 const footer=mountOrderLiveStatus();
 const dialog=el("dialog",undefined,"app-dialog customer-order-history");
 const header=el("header",undefined,"customer-history-header"),close=btn("Fechar"),title=el("h2","Meus pedidos");
 const list=el("div",undefined,"customer-history-list"),tracking=el("section",undefined,"customer-tracking-box");
 const resolveButton=btn("Verificar tentativa pendente");
 header.append(title,close);dialog.append(header,resolveButton,list,tracking);document.body.append(dialog);
 historyButton.hidden=false;checkoutButton.textContent="Confirmar pedido (homologação)";
 const sync=()=>{checkoutButton.disabled=busy||!getCart().length};
 const stopTracking=()=>{trackingEpoch++;trackingId=null;clearTimeout(trackingTimer);trackingTimer=null;tracking.replaceChildren()};
 const reset=()=>{epoch++;off?.();off=null;uid=null;views=[];selected=null;stopTracking();footer.update(null);list.replaceChildren();};
 close.addEventListener("click",()=>dialog.close());dialog.addEventListener("close",stopTracking);
 resolveButton.onclick=async()=>{
  if(busy)return;busy=true;sync();
  try{const user=await ensure(),pending=pendingCheckout(localStorage,user.uid,slug);
   if(!pending){toast("Nenhuma tentativa pendente neste navegador.");return;}
   const result=await api.request("orders/resolve",{slug,operationId:pending.operationId});
   if(result.resolved!==true)throw Error("unresolved");
   pending.clear();if(result.accepted){selected=result.result.id;toast("Pedido já confirmado: "+result.result.code+". Confira o histórico antes de pedir novamente.");}
   else toast("Tentativa anterior encerrada sem pedido. Você pode fazer novo pedido.");
  }catch{toast("Não foi possível resolver a tentativa. Nenhum novo pedido foi iniciado.");}finally{busy=false;sync();}
 };
 function render(online){
  list.replaceChildren();const active=views.find(x=>x.id===selected)||views.find(x=>!terminal(x))||views[0];
  selected=active?.id||null;footer.update(active||null,{online});
  if(trackingId&&!views.some(v=>v.id===trackingId&&v.status==="saiu_entrega"))stopTracking();
  for(const v of views){
   const card=el("article",undefined,"customer-order-card");
   card.append(el("strong",v.code+" • "+v.label),el("p",money(v.totalCents)+" · "+new Date(v.createdAt).toLocaleString("pt-BR")));
   for(const x of v.lines||[])card.append(el("small",x.qty+"× "+x.name));
   if(terminal(v)){const p=statusPresentation(v);card.append(el("p","Tempo total: "+(p?.clock||"—")));}
   const choose=btn("Acompanhar"),print=btn("Imprimir comprovante");choose.onclick=()=>{selected=v.id;footer.update(v,{online});};print.onclick=()=>printView(v);
   card.append(choose,print);
   if(v.status==="saiu_entrega"){
    const code=btn("Ver código da entrega"),track=btn("Localização do motoboy");
    code.onclick=async()=>{code.disabled=true;try{const identity=uid,stamp=epoch;const r=await api.request("orders/read",{id:v.id});if(stamp!==epoch||identity!==uid||!card.isConnected)return;
     if(r.status!=="saiu_entrega"||!/^\d{4}$/.test(r.deliveryCode||""))throw Error("unavailable");
     const p=el("p","Código: "+r.deliveryCode+" — informe somente após receber o pedido.");p.setAttribute("role","status");code.replaceWith(p);
    }catch{toast("Código indisponível. Atualize o pedido.");}finally{code.disabled=false;}};
    track.onclick=()=>void startTracking(v.id);card.append(code,track);
   }
   list.append(card);
  }
  if(!views.length)list.append(el("p","Nenhum pedido encontrado."));
 }
 async function startTracking(id){
  stopTracking();const stamp=trackingEpoch;trackingId=id;
  tracking.append(el("p","Solicitando localização do entregador…"));
  try{await api.request("tracking/start",{id});}catch{if(stamp===trackingEpoch)tracking.replaceChildren(el("p","Rastreamento indisponível."));return;}
  async function poll(){
   if(stamp!==trackingEpoch||!dialog.open||document.hidden||trackingId!==id)return;
   try{
    const b=await api.request("tracking/read",{id});if(stamp!==trackingEpoch)return;
    tracking.replaceChildren(el("strong","Localização do motoboy"));
    if(b.point){const statusLabels={live:"Ao vivo — última posição conhecida",unstable:"Conexão instável",stale:"Localização desatualizada",lost:"Sinal perdido — última posição conhecida"};
     const status=el("strong",statusLabels[b.point.freshness]||"Última posição conhecida");status.style.color=({live:"#16a34a",unstable:"#ca8a04",stale:"#ea580c",lost:"#dc2626"})[b.point.freshness]||"inherit";tracking.append(status);
     tracking.append(el("p","Última atualização: "+new Date(b.point.at).toLocaleTimeString("pt-BR")+" (há "+Math.floor((b.point.ageSeconds||0)/60)+" min)"));
     const link=el("a","Abrir posição no mapa");link.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(b.point.lat+","+b.point.lon);link.target="_blank";link.rel="noopener noreferrer";tracking.append(link);}
    else tracking.append(el("p","Aguardando localização atualizada."));
   }catch{if(stamp!==trackingEpoch)return;tracking.replaceChildren(el("p","Localização indisponível ou entrega encerrada."));}
   if(stamp===trackingEpoch)trackingTimer=setTimeout(poll,15000);
  }
  void poll();
 }
 document.addEventListener("visibilitychange",()=>{if(document.hidden)stopTracking()});
 window.addEventListener("offline",()=>footer.disconnect());
 async function ensure(){
  const a=await signInForOrder();session=a;
  const user=a.auth.currentUser;if(!user)throw Error("authentication_required");
  if(uid===user.uid&&off)return user;
  reset();uid=user.uid;api=createCheckoutApi({token:()=>a.auth.currentUser?.getIdToken()});
  const stamp=epoch,identity=uid,sdk=await import("https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js");
  if(stamp!==epoch||a.auth.currentUser?.uid!==identity)throw Error("session changed");
  const q=sdk.query(sdk.collection(sdk.getFirestore(a.app),"publicOrderViews"),sdk.where("buyerUid","==",identity),sdk.orderBy("createdAt","desc"),sdk.limit(30));
  off=sdk.onSnapshot(q,{includeMetadataChanges:true},snap=>{
   if(stamp!==epoch||a.auth.currentUser?.uid!==identity)return;
   views=snap.docs.map(d=>d.data()).filter(v=>v.buyerUid===identity);
   render(!snap.metadata.fromCache&&navigator.onLine);
  },()=>{if(stamp===epoch){footer.disconnect();list.replaceChildren(el("p","Histórico indisponível. Confira sua conexão."));}});
  authOff?.();authOff=a.sdk.onAuthStateChanged(a.auth,u=>{if((u?.uid||null)!==uid)reset()});
  return user;
 }
 historyButton.onclick=async()=>{try{await ensure();if(!dialog.open)dialog.showModal()}catch{toast("Entre com Google para consultar seus pedidos.")}};
 async function submit(){
  if(busy||!getCart().length)return;busy=true;sync();
  try{
   const user=await ensure();
   const request=checkoutRequest({slug,cart:getCart(),form:getForm(),subtotalCents:subtotal(),quote:quoteFor(),uid:user.uid});
   if(!request.customerName||!/^(?:\+?55)?\d{10,11}$/.test(request.customerPhone.replace(/[\s()-]/g,""))){toast("Informe nome e telefone válidos.");return;}
   const identity=await checkoutIdentity({storage:localStorage,uid:user.uid,slug,request});
   const result=await api.request("orders/create",{...request,operationId:identity.operationId});
   if(!result.ok||!result.id||result.totalCents!==request.expectedTotalCents)throw Error("response not confirmed");
   identity.clear();selected=result.id;
   if(session.auth.currentUser?.uid!==user.uid)return;
   onSuccess(result);if(!dialog.open)dialog.showModal();toast("Pedido "+result.code+" confirmado. Pagamento pendente.");
  }catch(e){toast(messages[e?.code]||"Não foi possível confirmar o pedido. Repita com a mesma sacola para evitar duplicação.");}
  finally{busy=false;sync();}
 }
 return {submit,sync};
}
