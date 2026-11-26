// B02.1 status component: no network, auth or database dependency.
// Integrator must supply a verified private subscription to customerOrder().
// Server times are authoritative; elapsedMs on terminal snapshots is frozen.
const labels=Object.freeze({received:"Pedido recebido",preparing:"Em preparo",ready:"Pedido finalizado",out_for_delivery:"Saiu para entrega",delivered:"Seu pedido foi entregue",cancelled:"Pedido cancelado"});
export function statusView(order,{connected=false,serverNowMs}={}){
 if(!order||!Object.hasOwn(labels,order.status)||!Number.isSafeInteger(order.createdAt)||order.createdAt<0)throw Error("invalid_snapshot");
 const terminal=["delivered","cancelled"].includes(order.status);
 const elapsed=terminal?order.elapsedMs:Math.max(0,serverNowMs-order.createdAt);
 if(!Number.isSafeInteger(elapsed)||elapsed<0)throw Error("invalid_elapsed");
 const seconds=Math.floor(elapsed/1000),pad=n=>String(n).padStart(2,"0");
 return {label:labels[order.status],live:connected===true&&!terminal,terminal,elapsedMs:elapsed,clock:pad(Math.floor(seconds/3600))+":"+pad(Math.floor(seconds/60)%60)+":"+pad(seconds%60)};
}
// DOM renderer for future authenticated storefront integration. No innerHTML of data.
export function mountOrderTicker(root,{subscribe,now=()=>Date.now()}={}){
 if(!root||typeof subscribe!=="function")throw Error("ticker_config");
 const doc=root.ownerDocument;root.classList.add("checkout-live-footer");
 const live=doc.createElement("span"),message=doc.createElement("span"),clock=doc.createElement("time");
 live.className="checkout-live-label";message.className="checkout-live-message";clock.className="checkout-live-clock";
 message.setAttribute("role","status");message.setAttribute("aria-live","polite");
 root.replaceChildren(live,message,clock);
 let snapshot=null,connected=false,offset=0,timer=null,closed=false;
 function paint(){if(closed)return;if(!snapshot){live.textContent="";message.textContent="Aguardando pedido";clock.textContent="";return;}
  try{const v=statusView(snapshot,{connected,serverNowMs:now()+offset});live.textContent=v.live?"ao vivo ●":v.terminal?"encerrado":"reconectando";live.dataset.live=String(v.live);if(message.textContent!==v.label)message.textContent=v.label;clock.textContent=v.clock;if(v.terminal&&timer!==null){clearInterval(timer);timer=null;}}
  catch{live.textContent="";message.textContent="Status indisponível";clock.textContent="";}
 }
 const unsubscribe=subscribe((event)=>{
  if(closed)return;
  if(event?.order&&Number.isSafeInteger(event.serverNowMs)){snapshot=event.order;offset=event.serverNowMs-now();}
  connected=event?.connected===true;paint();
 });
 if(!snapshot||!["delivered","cancelled"].includes(snapshot.status))timer=setInterval(paint,1000);
 paint();
 return ()=>{closed=true;if(timer!==null)clearInterval(timer);if(typeof unsubscribe==="function")unsubscribe();root.replaceChildren();};
}
