import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {notificationState,mergeNotifications,unreadCount,markRead} from "./notification_core.mjs";

const uid="demo-google-account";
const callbacks=new Map(),elements=new Map();
let onAnnouncements=null,writes=0,currentUrl="https://pdv.livresom.com/";
const elm=id=>{
 if(elements.has(id))return elements.get(id);
 const events=new Map(),cls=new Set();
 const fake={id,hidden:false,innerHTML:"",textContent:"",dataset:{},
   addEventListener:(ev,fn)=>events.set(ev,fn),trigger:(ev,args)=>events.get(ev)?.(args),
   setAttribute(){},focus(){this.focused=true},querySelectorAll(){return[]},
   classList:{add:x=>cls.add(x),remove:x=>cls.delete(x),toggle:(x,on)=>on?cls.add(x):cls.delete(x),contains:x=>cls.has(x)}
 };
 elements.set(id,fake);return fake;
};
const root=elm("poteNotifications");
const document={body:{appendChild(){}},createElement:()=>root,getElementById:elm,
 addEventListener(name,handler){callbacks.set("document:"+name,handler)}};
const account={currentUser:{uid}};
const window={POTE_AUTH:{uid,role:"free"},addEventListener(name,handler){callbacks.set("window:"+name,handler)},
 dispatchEvent(event){callbacks.get("window:"+event.type)?.(event)}};
const state={data:{notificationCenter:{read:{}},deliveryHub:{orders:[]}}};
const context={window,document,state,Date,JSON,Map,Set,String,Number,Array,console,
 getApp:()=>({}),getAuth:()=>account,getFirestore:()=>({}),collection:()=>({}),
 onSnapshot:(_q,callback)=>{onAnnouncements=callback;return()=>{}},
 query:()=>({}),orderBy:()=>({}),limit:()=>({}),
 notificationState,mergeNotifications,unreadCount,markRead,
 persist(){writes++;window.dispatchEvent(new Event("pote:changed"));}
};
vm.createContext(context);
let source=readFileSync("notifications.js","utf8").replace(/^import .*;\s*$/gm,"");
assert(!source.includes("import {"),"Notification imports should be stripped for isolated UI test");
vm.runInContext(source,context,{filename:"notifications.js"});
onAnnouncements({docs:[{id:"notice-demo",data:()=>({
 active:true,title:"Teste",body:"essa é uma mensagem de teste",
 url:"https://pdv.livresom.com/login",type:"info",
 createdAt:{seconds:1794959880}
})}]});
window.POTE_NOTIFY.open();
const list=elm("poteNoticeList");
assert.match(list.innerHTML,/<button[^>]*data-notice-detail="broadcast:notice-demo"[^>]*>Ver mensagem<\/button>/);
assert(!list.innerHTML.includes('target="_blank"'),"Ver mensagem must not navigate to a new login tab");
assert.equal(window.POTE_NOTIFY.viewMessage("broadcast:notice-demo"),true);
assert.equal(elm("poteNoticeDetail").hidden,false);
assert.equal(elm("poteNoticeList").hidden,true);
assert.equal(elm("poteNoticeTools").hidden,true);
assert.match(elm("poteNoticeDetail").innerHTML,/<h3>Teste<\/h3>/);
assert.match(elm("poteNoticeDetail").innerHTML,/essa é uma mensagem de teste/);
assert.match(elm("poteNoticeDetail").innerHTML,/<a[^>]*target="_blank"[^>]*>Abrir link externo \(nova aba\)<\/a>/);
assert.equal(currentUrl,"https://pdv.livresom.com/");
assert.equal(window.POTE_NOTIFY.unread,0,"Opening and reading an in-app notice marks it as read");
assert.equal(writes,1,"Reading a notice persists only its read status");
window.POTE_NOTIFY.backToList();
assert.equal(elm("poteNoticeDetail").hidden,true);
assert.equal(elm("poteNoticeList").hidden,false);
window.POTE_NOTIFY.close();
assert.equal(elm("poteNoticeDrawer").hidden,true);
account.currentUser=null;window.POTE_AUTH=null;
callbacks.get("window:pote:user-logout")();
assert.equal(root.hidden,true);
assert.equal(window.POTE_NOTIFY.viewMessage("broadcast:notice-demo"),false);
console.log("PASS: Ver mensagem stays in PDV, no login redirect, full notice inline, explicit optional link, back, read receipt and logout.");
