// Consumer-only component; mount only after an authenticated order endpoint exists.
const labels={recebido:"Pedido recebido",em_producao:"Em preparo",finalizado:"Pedido finalizado",saiu_entrega:"Saiu para entrega",entregue:"Seu pedido foi entregue",cancelado:"Pedido cancelado"};
export function statusPresentation(view,{connected=false,now=Date.now(),receivedAt=now}={}){
 if(!view||!Object.hasOwn(labels,view.status)||!Number.isSafeInteger(view.elapsedSeconds)||view.elapsedSeconds<0)return null;
 const terminal=["entregue","cancelado"].includes(view.status);
 const extra=terminal||!connected?0:Math.max(0,Math.floor((now-receivedAt)/1000));
 const n=view.elapsedSeconds+extra;
 const clock=[Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(x=>String(x).padStart(2,"0")).join(":");
 return {label:labels[view.status],clock,live:connected&&!terminal,terminal};
}
export function mountOrderLiveStatus({host=document.body,clock=()=>Date.now()}={}){
 const footer=document.createElement("aside");footer.className="pote-order-live";footer.hidden=true;
 const indicator=document.createElement("span");indicator.className="pote-order-live-indicator";
 const lane=document.createElement("div");lane.className="pote-order-live-lane";
 const label=document.createElement("span");label.className="pote-order-live-text";lane.append(label);
 const time=document.createElement("time");time.className="pote-order-live-clock";
 footer.append(indicator,lane,time);footer.setAttribute("aria-label","Acompanhamento do pedido");
 label.setAttribute("role","status");label.setAttribute("aria-live","polite");host.append(footer);
 let current=null,connected=false,receivedAt=0,timer=null;
 const draw=()=>{const p=statusPresentation(current,{connected,now:clock(),receivedAt});footer.hidden=!p;
  if(!p)return;const text=p.live?"Ao vivo":p.terminal?"Finalizado":"Sem conexão";
  if(indicator.textContent!==text)indicator.textContent=text;indicator.dataset.live=String(p.live);
  if(label.textContent!==p.label)label.textContent=p.label;time.textContent=p.clock;
  if(p.terminal&&timer){clearInterval(timer);timer=null;}
 };
 return {update(view,{online=false}={}){current=view;connected=online;receivedAt=clock();draw();if(!timer&&view&&!["entregue","cancelado"].includes(view.status))timer=setInterval(draw,1000);},
  disconnect(){if(current){const p=statusPresentation(current,{connected,now:clock(),receivedAt});if(p){const [h,m,s]=p.clock.split(":").map(Number);current={...current,elapsedSeconds:h*3600+m*60+s};}}connected=false;receivedAt=clock();draw();},
  dispose(){if(timer)clearInterval(timer);footer.remove();current=null;}};
}
