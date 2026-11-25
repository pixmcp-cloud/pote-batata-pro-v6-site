import {terminal,elapsed,formatElapsed,orderCode,statusText} from "./tracking-core.mjs";
export function createConsumerUI({slug,notify,money}){
 const $=id=>document.getElementById(id),bar=$("liveOrderBar"),dialog=$("consumerHistory");
 let api=null,user=null,unsubscribe=null,watch=null,tracked=null,active=[],live=false,epoch=0,selection=0,timer=null,loading=null;
 function paint(){
  bar.hidden=!tracked;document.body.classList.toggle("has-live-order",Boolean(tracked));
  if(!tracked){delete bar.dataset.status;return;}
  bar.dataset.status=["recebido","em_preparo","finalizado","saiu_entrega","entregue","cancelado"].includes(tracked.status)?tracked.status:"unknown";
  $("liveConnection").textContent=terminal(tracked)?"REGISTRADO":live?"AO VIVO":"OFFLINE";
  $("liveDot").classList.toggle("is-live",live&&!terminal(tracked));
  $("liveCode").textContent=orderCode(tracked);
  const text=statusText(tracked);if($("liveMessage").textContent!==text)$("liveMessage").textContent=text;
  $("liveTimer").textContent=formatElapsed(elapsed(tracked));
  if(terminal(tracked)&&timer!==null){clearInterval(timer);timer=null}
  if(!terminal(tracked)&&timer===null)timer=setInterval(()=>{$("liveTimer").textContent=formatElapsed(elapsed(tracked))},1000);
 }
 function reset(){
  epoch++;selection++;unsubscribe?.();watch?.();unsubscribe=watch=null;tracked=null;active=[];live=false;
  if(timer!==null){clearInterval(timer);timer=null}paint();
 }
 function follow(order){
  if(!order||!user)return;
  if(tracked?.checkoutId===order.checkoutId&&watch)return;
  const selected=++selection;
  watch?.();watch=null;tracked=order;live=false;paint();
  const index=epoch,uid=user.uid,id=order.checkoutId;
  const current=()=>index===epoch&&selected===selection&&user?.uid===uid&&tracked?.checkoutId===id;
  if(!terminal(order))watch=api.watchOrder(user,id,(next,connected)=>{
   if(!current()||!next||next.checkoutId!==id)return;
   tracked=next;live=connected;paint();
   if(terminal(next)&&connected){watch?.();watch=null;}
  },()=>{if(current()){live=false;paint()}});
 }
 function accept(next){
  if(user?.uid===next?.uid)return;
  reset();user=next;$("consumerLogout").hidden=!user;
  if(!user){$("consumerList").replaceChildren();return}
  const index=epoch,uid=user.uid;
  unsubscribe=api.listen(user,(orders,connected)=>{
   if(index!==epoch||user?.uid!==uid)return;
   active=orders.filter(o=>o.slug===slug).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   // The list discovers an initial order; only its own listener can update the
   // selected order or claim a live connection. Keep an explicitly viewed receipt.
   if(!tracked&&active.length)follow(active[0]);
   paint();
  },()=>{});
 }
 async function load(){
  if(!loading)loading=import("./consumer-session.mjs?v=1").then(module=>{api=module;api.observe(accept);return api;}).catch(e=>{loading=null;throw e});
  return loading;
 }
 async function requireLogin(){const service=await load();const account=await service.login();accept(account);return {uid:account.uid,token:await service.token(account)}}
 async function openHistory(){
  try{
   await requireLogin();const index=epoch,uid=user.uid;
   const rows=await api.history(user);
   if(index!==epoch||user?.uid!==uid)return;
   const container=$("consumerList");container.replaceChildren();
   if(!rows.length){const p=document.createElement("p");p.textContent="Nenhum pedido registrado.";container.append(p)}
   for(const o of rows){
    const article=document.createElement("article"),title=document.createElement("strong"),detail=document.createElement("p"),items=document.createElement("p");
    title.textContent=o.storeTitle+" · "+orderCode(o);detail.textContent=statusText(o)+" · "+money(o.totalCents)+" · "+formatElapsed(elapsed(o));
    items.textContent=(o.lines||[]).map(l=>l.qty+"x "+l.name+(l.status==="cancelado"?" (cancelado)":"")).join(" · ");
    const dates=document.createElement("p");
    const local=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString("pt-BR"):"—"};
    dates.textContent="Recebido: "+local(o.createdAt)+(o.finishedAt?" · "+(o.status==="entregue"?"Entregue":"Encerrado")+": "+local(o.finishedAt):"");
    article.append(title,detail,dates,items);
    if(o.deliveryType==="Tele-entrega"){const freight=document.createElement("p");freight.textContent=(o.status==="cancelado"?"Frete cancelado: ":"Frete: ")+money(o.deliveryFeeCents||0)+" · "+(o.deliveryAddress||"");article.append(freight);}
    if(terminal(o)){const print=document.createElement("button");print.type="button";print.className="button button-quiet";print.textContent="Imprimir comprovante";print.onclick=()=>{article.classList.add("consumer-print");document.body.classList.add("printing-consumer");try{window.print()}finally{article.classList.remove("consumer-print");document.body.classList.remove("printing-consumer")}};article.append(print);}
    if(o.slug===slug){const b=document.createElement("button");b.type="button";b.className="button button-quiet";b.textContent="Ver no letreiro";b.onclick=()=>{follow(o);dialog.close()};article.append(b)}
    container.append(article);
   }
   if(!dialog.open)dialog.showModal();
  }catch(e){notify(e.message||"Não foi possível consultar seus pedidos.")}
 }
 $("consumerAccount").addEventListener("click",openHistory);
 $("liveOrderBar").addEventListener("click",openHistory);
 $("consumerClose").addEventListener("click",()=>dialog.close());
 $("consumerLogout").addEventListener("click",async()=>{try{await api.logout();accept(null);dialog.close()}catch(e){notify(e.message)}});
 window.addEventListener("offline",()=>{live=false;paint()});
 // Restore an existing session silently; never initiate login while browsing.
 void load().catch(()=>{});
 return {requireLogin,async confirmed(result){
  if(!user)return;
  const provisional={checkoutId:result.checkoutId,slug,createdAt:result.createdAt||null,status:"recebido",totalCents:result.totalCents,lines:result.orderNumbers.map(n=>({orderNumber:n}))};
  // The server start is authoritative; no local estimate is retained if absent.
  if(!result.createdAt)provisional.createdAt=null;
  follow(provisional);
 }};
}
