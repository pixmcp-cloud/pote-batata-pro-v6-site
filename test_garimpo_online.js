const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const els=new Map();
for(const k of ["garimpoMarkets","garimpoMarketDetails","garimpoMarketList","garimpoOnlineStatus","garimpoOnlineItem","garimpoOnlineResults","garimpoSelectedOnline","garimpoMPHResults","garimpoItem"])
 els.set(k,{innerHTML:"",textContent:"",value:"",scrollIntoView(){}});
const state={data:{ingredients:[{id:"q",name:"Queijo mussarela",measureUnit:"g"}],beverages:[],garimpoOffers:[],suppliers:[]}};
const ctx={state,console,Map,Set,Intl,Date,Math,Number,String,Object,Array,JSON,URL,
 document:{getElementById:k=>els.get(k)||null},window:{confirm:()=>true,render(){},POTE_NOTICE:{show(){}}},
 navigator:{},alert(){},toast(){},uid:()=>String(Date.now()),persist(){}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("garimpo.js","utf8"),ctx);
const G=ctx.window.POTE_GARIMPO;
G.setCenter({lat:-29.15,lon:-49.58});
G.setMarketSearch([{name:"Giassi",city:"Sombrio",lat:-29.1,lon:-49.62,osmId:"N:2",address:"Rua Central",phone:"48999951111"}]);
const preview=G.render();assert(preview.includes('garimpoMarketDetails'));
assert(preview.includes('garimpoOnlineResults'));
G.mount();
assert(els.get("garimpoMarkets").innerHTML.includes("garimpo-market-click"));
assert.equal(G.marketDetails(0),true);
assert(els.get("garimpoMarketDetails").innerHTML.includes("Traçar rota"));
assert(els.get("garimpoMarketDetails").innerHTML.includes("WhatsApp"));
assert(els.get("garimpoMarketDetails").innerHTML.includes("Site / encarte oficial"));
els.get("garimpoOnlineItem").value="ing:q";
ctx.fetch=async()=>({ok:true,json:async()=>({source:"giassi.com.br",collectedAt:new Date().toISOString(),products:[
 {name:"Queijo Mussarela Fatiado Tirol 300g",brand:"Tirol",price:15.79,url:"https://www.giassi.com.br/queijo/p",validUntil:"2099-01-01"},
 {name:"Frango Sadia 1kg",brand:"Sadia",price:18,url:"https://www.giassi.com.br/frango/p",validUntil:"2099-01-01"}
]})});
(async()=>{
 assert.equal(await G.loadPublicPrices(),true);
 assert(els.get("garimpoOnlineResults").innerHTML.includes("15,79"));
 assert(!els.get("garimpoOnlineResults").innerHTML.includes("Frango Sadia"));
 assert(els.get("garimpoOnlineResults").innerHTML.includes("preço online"));
 ctx.fetch=async()=>({ok:false,json:async()=>({ok:false,error:"STALE_SNAPSHOT",snapshot_reference_date:"2026-11-15",message:"base desatualizada"})});
 els.get("garimpoItem").value="ing:q";
 assert.equal(await G.lookupMPH(),false);
 assert(els.get("garimpoMPHResults").textContent.includes("desatualizada"));
 console.log("PASS: mercados clicáveis com mapa, contato e rota; Giassi com preços online, link e marca; MPH desatualizado sem oferta fictícia.");
})().catch(err=>{console.error(err);process.exitCode=1});
