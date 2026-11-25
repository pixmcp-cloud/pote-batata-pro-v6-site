const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const listeners={},docListeners={},store=new Map(),local=new Map(),elements=new Map();let now=1000,callback=null,dialog;
const fake=()=>({hidden:true,textContent:"",value:0,events:{},addEventListener(n,f){this.events[n]=f;}});
const state={tab:"home"};
const window={POTE_APP_READY:false,POTE_AUTH:null,addEventListener(n,f){listeners[n]=f}};
const document={body:{append(e){dialog=e}},addEventListener(n,f){docListeners[n]=f},querySelector(){return dialog?.open?dialog:null},getElementById(){return {click(){}}},createElement(){return {open:false,setAttribute(){},querySelector(id){if(!elements.has(id))elements.set(id,fake());return elements.get(id)},addEventListener(n,f){this[n]=f},showModal(){this.open=true},close(){this.open=false}}}};
const storage=m=>({getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
const ctx={window,document,state,sessionStorage:storage(store),localStorage:storage(local),Date:{now:()=>now},setInterval:f=>{callback=f;return 1},clearInterval:()=>{callback=null},setTimeout:f=>f()};
vm.runInNewContext(fs.readFileSync("pro_offer.js","utf8"),ctx);
function auth(a){window.POTE_APP_READY=true;window.POTE_AUTH=a;listeners["pote:user-ready"]();}
function free(uid){auth({uid,role:"free",plan:"free"});}
const seconds=()=>elements.get("#poteOfferSeconds").textContent;
const close=()=>elements.get("#poteOfferClose").events.click();
function advance(ms){now+=ms;callback();}
function click(trusted=true){docListeners.click({isTrusted:trusted,target:{closest(selector){return selector==="#poteProOffer"?null:this},getAttribute(){return null}}});}
auth({uid:"paid",role:"free",plan:"pro",proActive:true});assert(!dialog);
auth({uid:"franchise",role:"free",plan:"franchise",franchiseActive:true});assert(!dialog);
auth({uid:"master",role:"admin",plan:"admin"});assert(!dialog);
free("one");assert(dialog.open);assert.equal(seconds(),"15");assert(elements.get("#poteOfferClose").hidden);
close();assert(dialog.open);advance(14000);assert.equal(seconds(),"01");advance(1000);assert.equal(seconds(),"00");close();assert(!dialog.open);
listeners["pote:user-ready"]();assert(!dialog.open);
for(let i=0;i<60;i++)click(false);assert(!dialog.open);
for(let i=0;i<49;i++)click();assert(!dialog.open);
state.tab="orders";click();assert(!dialog.open,"não interromper pedido");
state.tab="home";click();assert(dialog.open);assert.equal(seconds(),"05");advance(5000);close();assert(!dialog.open);
click();assert(!dialog.open);
listeners["pote:user-logout"]({detail:{signedOut:true}});free("one");assert(dialog.open);assert.equal(seconds(),"10");
window.POTE_AUTH.proActive=true;listeners["pote:license-updated"]();assert(!dialog.open);
listeners["pote:user-logout"]({detail:{signedOut:true}});free("other");assert.equal(seconds(),"15");
console.log("PASS: FREE 15/10/5s, 50 cliques válidos, espera por Home, isolamento e exclusão PRO");