export const STEPS={recebido:{label:"Recebido",color:"#ff4747"},em_preparo:{label:"Em produção",color:"#ff9f32"},finalizado:{label:"Concluído",color:"#ffdf40"},saiu_entrega:{label:"Saiu para entrega",color:"#55ff80"}};
export function groupOnlineOrders(orders=[]){
 const map=new Map();
 for(const o of orders){if(o?.source!=="public-checkout"||!o.checkoutId||!o.consumerUid)continue;
  if(!map.has(o.checkoutId))map.set(o.checkoutId,[]);map.get(o.checkoutId).push(o);
 }
 return [...map].map(([id,all])=>{
  const rows=all.filter(o=>o.status!=="cancelado");
  if(!rows.length||rows.every(o=>o.status==="entregue"))return null;
  const pending=rows.filter(o=>o.status==="recebido");
  const production=rows.filter(o=>o.status==="em_producao"&&o.stockDeducted===true);
  const delivery=rows[0].deliveryType==="Tele-entrega";
  const ready=rows.every(o=>o.checkoutReadyAt),sent=rows.every(o=>o.checkoutDispatchedAt);
  let status="recebido",action=null,label="Aguardando conferência",ids=[];
  if(production.length)status="em_preparo";
  if(pending.length){action="produce";label=production.length?"Continuar produção":"Iniciar produção";ids=pending.map(o=>o.id);}
  else if(production.length===rows.length){
   if(!ready){action="ready";label="Concluir preparo";}
   else if(delivery&&!sent){status="finalizado";action="dispatch";label="Saiu para entrega";}
   else {status=delivery?"saiu_entrega":"finalizado";action="deliver";label=delivery?"Confirmar entrega":"Confirmar retirada";}
   ids=[rows[0].id];
  }else if(ready)status=sent?"saiu_entrega":"finalizado";
  const createdAt=rows.map(o=>o.createdAt).filter(v=>Number.isFinite(Date.parse(v))).sort()[0]||null;
  const first=rows.reduce((a,b)=>(a.orderNumber??Infinity)<=(b.orderNumber??Infinity)?a:b);
  return {id,status,action,label,ids,createdAt,delivery,code:"#P"+String(first.orderNumber||0).padStart(7,"0"),customer:first.clientName||"Cliente",address:delivery?first.clientAddress||"":"",items:rows.map(o=>String(o.qty)+"x "+o.name),lineCount:rows.length};
 }).filter(Boolean).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
}
export function duration(createdAt,now=Date.now()){
 const start=Date.parse(createdAt);if(!Number.isFinite(start))return "--:--:--";
 const n=Math.max(0,Math.floor((now-start)/1000));
 return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,"0")).join(":");
}
