import assert from "node:assert/strict";
import {notificationState,fromOrders,fromAnnouncements,mergeNotifications,unreadCount,markRead,validateBroadcast} from "./notification_core.mjs";
const data={};
assert.deepEqual(notificationState(data).read,{});
const now=Date.now();
const orders=[{key:"ifood/loja/a",provider:"ifood",externalId:"P-101",items:[{id:"1"}],importedAt:new Date(now).toISOString(),status:"received"},
 {key:"ifood/loja/a",provider:"ifood",externalId:"P-101",items:[{id:"1"}],status:"received"},
 {key:"cardapioai/loja/b",provider:"cardapioai",externalId:"P-102",items:[],status:"cancelled"}];
const broadcasts=[
 {id:"b1",type:"promo",title:"Desconto PRO",body:"20% de desconto neste mês.",active:true,createdAt:{seconds:Math.floor(now/1000)}},
 {id:"b2",type:"urgent",title:"Vencido",body:"Aviso já expirado e inativo.",active:true,expiresAt:new Date(now-1000),createdAt:new Date(now-2000)},
 {id:"b3",type:"info",title:"Desativado",body:"Não mostrar este aviso.",active:false,createdAt:new Date(now)}
];
assert.equal(fromOrders(orders).length,2);
assert.equal(fromAnnouncements(broadcasts,now).length,1);
let list=mergeNotifications(broadcasts,orders,notificationState(data).read,now);
assert.equal(list.length,2,"Avisos expirados, cancelados e duplicados não devem aparecer");
assert.equal(unreadCount(list),2);
assert(list.some(x=>x.id==="order:ifood/loja/a"));
assert(list.some(x=>x.id==="broadcast:b1"&&x.priority==="promo"));
assert(markRead(notificationState(data).read,"broadcast:b1",now));
assert.equal(markRead(notificationState(data).read,"broadcast:b1",now),false);
assert.equal(unreadCount(mergeNotifications(broadcasts,orders,data.notificationCenter.read,now)),1);
assert.equal(validateBroadcast({title:"Promoção de hoje",body:"Desconto somente para novos assinantes.",type:"promo"}).type,"promo");
assert.throws(()=>validateBroadcast({title:"x",body:"Mensagens para todos"}),/Título/);
assert.throws(()=>validateBroadcast({title:"Promo",body:"Curta"}),/Mensagem/);
assert.throws(()=>validateBroadcast({title:"Promo",body:"Condições de desconto",url:"javascript:alert(1)"}),/HTTPS/);
assert.throws(()=>validateBroadcast({title:"Promo",body:"Condições de desconto",expiry:"2020-01-01"}),/vencimento/i);
assert.equal(validateBroadcast({title:"Promo",body:"Condições de desconto",url:"https://livresom.com"}).url,"https://livresom.com");
const otherData={};assert.equal(unreadCount(mergeNotifications(broadcasts,orders,notificationState(otherData).read,now)),2,"Contas não compartilham leituras");
assert.equal(notificationState(otherData).read["broadcast:b1"],undefined);
for(let i=0;i<520;i++)markRead(data.notificationCenter.read,"custom:"+i,now+i);
assert(Object.keys(data.notificationCenter.read).length<=500);
console.log("PASS: notificações de pedidos e ADM, contador, leitura isolada por conta, datas e validação de promoções.");