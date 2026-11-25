const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const listeners={},store=new Map(),elements=new Map();let now=1000,callback=null,logout=0,dialog;
const fake=()=>({hidden:true,textContent:"",value:0,events:{},addEventListener(n,f){this.events[n]=f;}});
const window={POTE_APP_READY:false,POTE_AUTH:null,addEventListener(n,f){listeners[n]=f}};
const document={body:{append(e){dialog=e}},getElementById(){return {click(){logout++}}},createElement(){return {open:false,setAttribute(){},querySelector(id){if(!elements.has(id))elements.set(id,fake());return elements.get(id)},addEventListener(n,f){this[n]=f},showModal(){this.open=true},close(){this.open=false}}}};
const ctx={window,document,sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},Date:{now:()=>now},setInterval:f=>{callback=f;return 1},clearInterval:()=>{callback=null}};
vm.runInNewContext(fs.readFileSync("pro_offer.js","utf8"),ctx);
function auth(a){window.POTE_APP_READY=true;window.POTE_AUTH=a;listeners["pote:user-ready"]();}
auth({uid:"paid",role:"free",plan:"pro",proActive:true});assert(!dialog);
auth({uid:"franchise",role:"free",plan:"franchise",franchiseActive:true});assert(!dialog);
auth({uid:"master",role:"admin",plan:"admin"});assert(!dialog);
auth({uid:"one",role:"free",plan:"free"});assert(dialog.open);assert.equal(elements.get("#poteOfferSeconds").textContent,"30");assert(elements.get("#poteOfferClose").hidden);
elements.get("#poteOfferClose").events.click();assert(dialog.open);
now+=29000;callback();assert.equal(elements.get("#poteOfferSeconds").textContent,"01");assert(elements.get("#poteOfferClose").hidden);
now+=1000;callback();assert.equal(elements.get("#poteOfferSeconds").textContent,"00");assert(!elements.get("#poteOfferClose").hidden);elements.get("#poteOfferClose").events.click();assert(!dialog.open);
listeners["pote:user-ready"]();assert(!dialog.open);
listeners["pote:user-logout"]({detail:{signedOut:true}});auth({uid:"one",role:"free",plan:"free"});assert(dialog.open);assert.equal(elements.get("#poteOfferSeconds").textContent,"30");
window.POTE_AUTH.proActive=true;listeners["pote:license-updated"]();assert(!dialog.open);
console.log("PASS: oferta FREE 30s, fechamento, nova sessão e exclusão de PRO/franquia/ADM");