import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {validateBroadcast} from "./notification_core.mjs";
const classes=new Set(),elements=new Map(),clicked=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{id,value:"",textContent:"",innerHTML:"",disabled:false,
  classList:{toggle:(k,enable)=>enable?classes.add(k):classes.delete(k)},
  addEventListener:(key,fn)=>clicked.set(id+":"+key,fn),
  dataset:{}
 });
 return elements.get(id);
}
const overlay=element("poteAdmOverlay");
overlay.hidden=false;overlay.querySelector=()=>({appendChild(panel){assert(panel.innerHTML.includes("Central de Comunicados"))}});
const auth={currentUser:{uid:"admin-1",email:"pixmcp@gmail.com"}},window={POTE_AUTH:{uid:"admin-1",role:"admin"}};
const write=[],updates=[];let adminClaim=true;
const context={document:{getElementById:element,createElement:()=>element("admin-panel")},window,app:{},
 getApp:()=>({}),getAuth:()=>auth,getIdTokenResult:async()=>({claims:{email_verified:true,potebatataAdmin:adminClaim,firebase:{sign_in_provider:"google.com"}}}),
 getFirestore:()=>({}),collection:()=>({}),doc:()=>({id:"boardcast-abcdef123456"}),
 query:()=>({}),orderBy:()=>({}),limit:()=>({}),
 getDocs:async()=>({empty:true,docs:[]}),setDoc:async(ref,obj)=>{write.push(obj)},
 updateDoc:async(ref,obj)=>{updates.push(obj)},serverTimestamp:()=>({__server:true}),
 Timestamp:{fromDate:date=>({millis:date.getTime()})},
 validateBroadcast,confirm:()=>true,Date,JSON,Math,String,Number,Array,console};
vm.createContext(context);
let js=readFileSync("admin_broadcast.js","utf8").replace(/^import .*;\s*$/gm,"");
assert(!js.includes("import {"));
vm.runInContext(js,context,{filename:"admin_broadcast.js"});
element("poteBroadcastTitle").value="Black Friday do Potê";
element("poteBroadcastBody").value="Desconto de 20% no plano PRO, sujeito aos termos da campanha.";
element("poteBroadcastUrl").value="https://livresom.com/alpha";
element("poteBroadcastType").value="promo";
await window.POTE_ADMIN_BROADCAST.send();
assert.equal(write.length,1);
assert.equal(write[0].title,"Black Friday do Potê");
assert.equal(write[0].type,"promo");
assert.equal(write[0].actorUid,"admin-1");
assert.equal(write[0].active,true);
assert(write[0].createdAt.__server);
assert.equal(element("poteBroadcastTitle").value,"");
auth.currentUser={uid:"other-1",email:"outro@gmail.com"};
window.POTE_AUTH={uid:"other-1",role:"free"};
element("poteBroadcastTitle").value="Mensagem não autorizada";
element("poteBroadcastBody").value="Este comunicado jamais deve ser gravado no banco.";
await window.POTE_ADMIN_BROADCAST.send();
assert.equal(write.length,1,"Conta FREE não pode gravar broadcast");
auth.currentUser={uid:"admin-1",email:"pixmcp@gmail.com"};
window.POTE_AUTH={uid:"admin-1",role:"admin"};
adminClaim=false;
 await window.POTE_ADMIN_BROADCAST.send();
 assert.equal(write.length,1,"Same email without custom admin claim cannot publish");
 adminClaim=true;
 await window.POTE_ADMIN_BROADCAST.deactivate("boardcast-abcdef123456");
assert.equal(updates.length,1);
assert.equal(updates[0].active,false);
console.log("PASS: broadcast via ADM autenticado, promoções, links HTTPS, rejeição FREE e desativação.");
