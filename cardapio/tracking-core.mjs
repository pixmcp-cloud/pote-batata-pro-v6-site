export const messages={recebido:"Pedido recebido • Aguardando preparo",em_preparo:"Em preparo • Estamos preparando seu pedido",finalizado:"Pedido finalizado • Pronto para retirada",saiu_entrega:"Saiu para entrega • Seu pedido está a caminho",entregue:"Seu pedido foi entregue • Obrigado pela preferência",cancelado:"Pedido cancelado"};
export const terminal=o=>["entregue","cancelado"].includes(o?.status);
export function elapsed(o,now=Date.now()){
 if(!o)return null;
 if(terminal(o))return Number.isSafeInteger(o.durationSeconds)&&o.durationSeconds>=0?o.durationSeconds:null;
 const start=Date.parse(o.createdAt);
 return Number.isFinite(start)?Math.max(0,Math.floor((now-start)/1000)):null;
}
export function formatElapsed(n){return Number.isSafeInteger(n)&&n>=0?[Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,"0")).join(":"):"--:--:--";}
export function orderCode(o){return "#P"+String(o?.lines?.[0]?.orderNumber??0).padStart(7,"0")}
export function statusText(o){return o?.status==="finalizado"&&o.deliveryType==="Tele-entrega"?"Pedido finalizado • Aguardando saída":messages[o?.status]||"Aguardando atualização";}
