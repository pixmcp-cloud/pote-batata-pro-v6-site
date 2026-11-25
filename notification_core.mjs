/* Notification model shared by delivery imports and verified administrator broadcasts.
   Does not call external APIs or synthesize marketplace events. */
export const TYPES=Object.freeze(["info","promo","urgent"]);
const dateMs=value=>{
 if(!value)return 0;
 if(typeof value?.toMillis==="function")return value.toMillis();
 if(typeof value?.seconds==="number")return value.seconds*1000;
 const n=Date.parse(String(value));return Number.isFinite(n)?n:0;
};
const text=(x,limit)=>String(x??"").trim().slice(0,limit);
export function notificationState(data){
 if(!data.notificationCenter||typeof data.notificationCenter!=="object"||Array.isArray(data.notificationCenter))
  data.notificationCenter={read:{},version:1};
 if(!data.notificationCenter.read||typeof data.notificationCenter.read!=="object")
  data.notificationCenter.read={};
 return data.notificationCenter;
}
export function fromAnnouncements(announcements=[],now=Date.now()){
 return announcements.filter(x=>x&&x.active!==false&&(!x.expiresAt||dateMs(x.expiresAt)>now))
  .map(x=>({
    id:"broadcast:"+text(x.id,140),
    kind:"broadcast",priority:TYPES.includes(x.type)?x.type:"info",
    title:text(x.title,110),body:text(x.body,700),href:/^https:\/\/[^\s]+$/i.test(x.url||"")?text(x.url,350):"",
    at:dateMs(x.createdAt),source:"Administração",cta:x.url?"Abrir link":""
  })).filter(x=>x.title&&x.body);
}
export function fromOrders(orders=[]){
 return orders.filter(x=>x&&x.key&&x.externalId&&x.provider&&x.status!=="cancelled")
  .map(x=>({
   id:"order:"+x.key,kind:"order",priority:"urgent",
   title:"Pedido importado · "+text(x.provider,40),
   body:"Pedido #"+text(x.externalId,80)+" · "+(Array.isArray(x.items)?x.items.length:0)+
    " item(ns). Aguardando conferência no Hub.",
   at:dateMs(x.importedAt)||dateMs(x.createdAt),
   source:"Hub de Delivery",href:"",cta:"Abrir Hub"
  }));
}
export function fromSafetyAlerts(alerts=[]){
 return alerts.filter(x=>x&&typeof x.id==="string"&&["possible_accident","help_requested"].includes(x.kind)&&Number.isSafeInteger(x.atMs)).map(x=>({id:"safety:"+x.id+":"+x.atMs,kind:"safety",priority:"urgent",title:x.kind==="help_requested"?"⚠ Motoboy pediu ajuda":"⚠ Alerta de possível acidente",body:"Pedido "+text(x.orderCode,24)+". "+(x.kind==="help_requested"?"Entregador solicitou ajuda.":"Parada brusca detectada; ocorrência não confirmada.")+" Contate o entregador quando for seguro. Em emergência, acione 192 ou 193.",at:x.atMs,source:"Segurança da entrega",href:"",safetyRef:x.hasLocation===true&&/^[a-f0-9]{64}$/.test(x.orderId||"")?{id:x.orderId,kind:x.kind,atMs:x.atMs}:null}));
}
export function mergeNotifications(announcements=[],orders=[],read={},now=Date.now(),safety=[]){
 const merged=[...fromSafetyAlerts(safety),...fromOrders(orders),...fromAnnouncements(announcements,now)].sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
 const seen=new Set();
 return merged.filter(x=>{
  if(seen.has(x.id))return false;seen.add(x.id);return true;
 }).map(x=>({...x,unread:!read[x.id]}));
}
export function unreadCount(notifications){return notifications.filter(x=>x.unread).length}
export function markRead(read,id,now=Date.now()){
 if(!id||read[id])return false;
 read[id]=new Date(now).toISOString();
 const keys=Object.keys(read);
 if(keys.length>500){
  const remove=keys.sort((a,b)=>Date.parse(read[a])-Date.parse(read[b])).slice(0,keys.length-500);
  for(const k of remove)delete read[k];
 }
 return true;
}
export function validateBroadcast({title,body,url="",type="info",expiry=null}){
 const record={title:text(title,110),body:text(body,700),url:text(url,350).trim(),
   type:TYPES.includes(type)?type:"info"};
 if(record.title.length<4||record.title.length>110)throw Error("Título precisa ter de 4 a 110 caracteres.");
 if(record.body.length<8||record.body.length>700)throw Error("Mensagem precisa ter de 8 a 700 caracteres.");
 if(url&&(!/^https:\/\/[^\s]+$/i.test(record.url)||record.url.length>350))throw Error("Link deve usar HTTPS.");
 if(expiry){
  const date=new Date(expiry+"T23:59:59-03:00");
  if(!Number.isFinite(date.getTime())||date.getTime()<Date.now()||date.getTime()>Date.now()+366*86400000)
   throw Error("Escolha um vencimento entre amanhã e um ano.");
  record.expiresAt=date;
 }else record.expiresAt=null;
 return record;
}
