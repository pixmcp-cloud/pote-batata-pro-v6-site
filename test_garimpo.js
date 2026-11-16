const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const els=new Map(),id=v=>els.get(v)||null;
let persists=0,renders=0,ids=0,alertMessage="";
const state={data:{ingredients:[{id:"q",name:"Queijo mussarela",measureUnit:"g"}],
 beverages:[{id:"cola",name:"Refrigerante Cola",size:"350 ml",sellPrice:7}],
 suppliers:[{id:"market",osmId:"N:1",name:"Giassi",city:"Sombrio",lat:-29.10,lon:-49.62}],garimpoOffers:[]}};
const ctx={state,console,Number,String,Intl,Math,Date,Map,Set,Array,Object,JSON,URL,Blob,
 document:{getElementById:id,createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},
 window:{confirm:()=>true,open(){},render(){renders++}},navigator:{},
 toast(){},alert:s=>alertMessage=s,persist(){persists++},render(){renders++},uid(){return "offer-"+ ++ids;}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync("garimpo.js","utf8"),ctx);
const G=ctx.window.POTE_GARIMPO;
assert(G&&G.render().includes("Radar de Preço"));
assert(!G.render().includes("<h2>Garimpo"),"Nome antigo não pode aparecer no título");
assert(G.render().includes("Registrar oferta"));
assert(!G.render().includes("Torres/RS"),"Tela nacional não deve citar cidades");
assert.equal(G.regionalLinks().length,0,"Não sugerir fontes regionais sem localização");
G.setCenter({lat:-29.15,lon:-49.58});
assert.equal(G.markets().length,1);
assert(G.stocks().some(x=>x.id==="ing:q"));
assert(G.stocks().some(x=>x.id==="bev:cola"));
assert.equal(G.dist(-29.15,-49.58,-29.15,-49.58),0);
els.set("garimpoItem",{value:"ing:q"});
els.set("garimpoMarket",{value:"Giassi"});
els.set("garimpoBrand",{value:"Aurora"});
els.set("garimpoSize",{value:"1 kg"});
els.set("garimpoPrice",{value:"32,90"});
els.set("garimpoQty",{value:"1"});
els.set("garimpoUnit",{value:"kg"});
els.set("garimpoFrom",{value:"2026-11-15"});
els.set("garimpoUntil",{value:"2099-11-30"});
els.set("garimpoSource",{value:"https://example.com/encarte/oferta"});
els.set("garimpoReceipt",{checked:false});
assert.equal(G.addOffer(),true);
const o=G.offers()[0],item=G.stocks().find(x=>x.id==="ing:q");
assert.equal(o.regionVerified,true);
assert.equal(G.status(o,"2099-11-15"),"conferida manualmente");
assert.equal(G.status(o,"2099-12-01"),"vencida");
assert.equal(G.unitPrice(o).price,32.9);
assert(G.matcher(o,item));
assert.equal(G.best(item)?.id,o.id); // current day Nov 16, 2026
// This receipt must never enter valid/active offer comparisons.
els.get("garimpoReceipt").checked=true;
els.get("garimpoPrice").value="25";
els.get("garimpoUntil").value="";
els.get("garimpoSource").value="";
assert.equal(G.addOffer(),true);
assert.equal(G.status(G.offers()[0]),"histórico NFC-e (não é oferta atual)");
assert.equal(G.best(item)?.id,o.id);
assert(persists===2&&renders===2);
assert.equal(G.removeOffer(o.id),true);
assert(G.render().includes("Garimpo"));
console.log("PASS: GPS 30 km, itens cadastrados, margem por unidade, histórico NFC-e, validade, fontes verificáveis e comparação sem preços inventados.");

(async()=>{
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
  G.setCenter({lat:-27.811,lon:-50.325});
  G.setMarketSearch([{name:"Atacadão",city:"Lages",lat:-27.812,lon:-50.323,osmId:"N:99"}]);
  els.get("garimpoItem").value="ing:q";
  els.set("garimpoMPHResults",{innerHTML:"",textContent:""});
  els.set("garimpoCondition",{value:"normal"});
  ctx.fetch=async()=>({ok:true,json:async()=>({
   ok:true,meta:{city:"Lages",snapshot_current:true,reference_date:today},
   edge:{freshness:"CURRENT"},temporal_scope:"PRESENTE",
   offers:[{mercado:"Atacadão",descricao:"QUEIJO MUSSARELA 1KG",marca:"Marca A",
    preco_final:29.9,unidade:"1KG",tipo_preco:"PROMOCIONAL",data_inicio:"2026-11-01",
    data_fim:"2099-12-31",temporal_status:"VIGENTE"}]})});
  assert.equal(await G.lookupMPH(),true,"API MPH atual para Lages deve abrir resultados");
  assert(els.get("garimpoMPHResults").innerHTML.includes("Conferir e registrar referência de Lages"));
  assert.equal(G.fillFromMPH(0),true);
  assert.equal(els.get("garimpoMarket").value,"Atacadão — Lages/SC");
  assert.equal(els.get("garimpoPrice").value,"29.9");
  assert.equal(els.get("garimpoCondition").value,"promocional");
  assert.equal(els.get("garimpoQty").value,"","Quantidade deve exigir conferência da embalagem");
  console.log("PASS: API MPH atual respeita Lages, confere validade, mercado local e exige revisão humana da embalagem.");
})().catch(e=>{console.error(e);process.exitCode=1});
