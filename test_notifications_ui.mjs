import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {notificationState,mergeNotifications,unreadCount,markRead} from "./notification_core.mjs";
const uid="test-google-account-123";
const listeners=new Map(),elements=new Map();let noticesListener,disconnectCount=0,saved=0;
function element(id){
 if(!elements.has(id)){
  const bound=new Map(),classes=new Set();
  elements.set(id,{id,hidden:false,innerHTML:"",textContent:"",dataset:{},style:{},
   setAttribute(name,value){this[name]=value},
   addEventListener(name,fn){bound.set(name,fn)},
   trigger(name,details={}){bound.get(name)?.(details)},
   classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k),contains:k=>classes.has(k)}
  });
 }
 return elements.get(id);
}
const root=element("poteNotifications");
const document={body:{appendChild(){}},createElement:()=>root,
 getElementById:element,addEventListener(){}};
const window={
 POTE_AUTH:{uid,role:"free"},
 addEventListener(name,cb){listeners.set(name,cb)},
 dispatchEvent(event){listeners.get(event.type)?.(event)}
};
const auth={currentUser:{uid}};
const state={data:{deliveryHub:{orders:[{
 key:"ifood/store/991",externalId:"991",provider:"ifood",
 importedAt:"2026-11-16T23:30:00Z",items:[{name:"Pastel"}],status:"received"
}]}}};
const context={
 document,window,app:{},auth,state,console,Date,JSON,Map,Set,Number,String,Array,Event,
 getApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
 collection:()=>({}),query:()=>({}),orderBy:()=>({}),limit:()=>({}),
 onSnapshot:(q,cb)=>{noticesListener=cb;return ()=>disconnectCount++},
 notificationState,mergeNotifications,unreadCount,markRead,
 persist:()=>{saved++;window.dispatchEvent(new Event("pote:changed"))},
 go:()=>{},navigator:{}
};
vm.createContext(context);
let code=readFileSync("notifications.js","utf8");
code=code.replace(/^import .*;\s*$/gm,"");
assert(!code.includes("import {"),"Imports ES module devem ser substituídos no teste");
vm.runInContext(code,context,{filename:"notifications.js"});
assert(root.innerHTML.includes("poteBell"));
assert(root.innerHTML.includes("poteNoticeDrawer"));
assert(!root.hidden);
assert.equal(window.POTE_NOTIFY.unread,1,"Pedido manual importado aparece com contador");
assert(element("poteBell").classList.contains("has-unread"));
assert.equal(element("poteNoticeCount").textContent,"1");
noticesListener({docs:[{id:"n-1",data:()=>({
 active:true,title:"Desconto especial",body:"20% de desconto no PRO, por tempo limitado.",
 type:"promo",createdAt:{seconds:1794872400}})}]});
assert.equal(window.POTE_NOTIFY.unread,2,"Comunicado do ADM chega em tempo real");
window.POTE_NOTIFY.open();
assert(!element("poteNoticeDrawer").hidden);
assert(element("poteNoticeList").innerHTML.includes("Desconto especial"));
window.POTE_NOTIFY.mark("broadcast:n-1");
assert.equal(saved,1,"Marcar leitura precisa salvar apenas a própria conta");
assert.equal(window.POTE_NOTIFY.unread,1);
window.POTE_NOTIFY.markAll();
assert.equal(window.POTE_NOTIFY.unread,0);
assert(element("poteNoticeCount").hidden);
assert(!element("poteBell").classList.contains("has-unread"));
window.POTE_AUTH=null;auth.currentUser=null;
listeners.get("pote:user-logout")();
assert(root.hidden,"Após logout nenhuma notificação pode vazar visualmente");
assert.equal(disconnectCount,1,"Desinscrever a escuta do usuário anterior");
assert.equal(window.POTE_NOTIFY.unread,0);
console.log("PASS: sininho fixo, importação de pedido, broadcast realtime, contador, lidas persistidas e logout isolado.");
