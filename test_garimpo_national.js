const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs");
const elements=new Map();
for(const id of ["garimpoRegionalActions","garimpoRegionalSources","garimpoMPHAction","garimpoGiassiOnline","garimpoSearchStatus","garimpoMarkets","garimpoComparison","garimpoHistory","garimpoMarketList"]){
 elements.set(id,{innerHTML:"",textContent:"",hidden:true});
}
const state={data:{ingredients:[{id:"a",name:"Leite",measureUnit:"ml"}],beverages:[],suppliers:[],garimpoOffers:[]}};
const ctx={state,console,Number,String,Intl,Math,Date,Map,Set,Array,Object,JSON,URL,Blob,
 document:{getElementById:x=>elements.get(x)||null},window:{confirm:()=>true},navigator:{},
 toast(){},alert(){},persist(){},uid(){return "1"}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync("garimpo.js","utf8"),ctx);
const G=ctx.window.POTE_GARIMPO;
assert(!G.render().includes("Torres/RS"),"A tela nacional não pode ter cidades pré-fixadas");
assert(!G.render().includes("Stok Center"),"A marca regional não pode aparecer na tela inicial");
assert(!G.render().includes("Lages"),"A API local não pode aparecer para o país inteiro");
assert.equal(G.regionalLinks().length,0);
assert.equal(G.regionFromAddress({state:"Rio Grande do Sul"}),"RS");
assert.equal(G.regionFromAddress({state:"Santa Catarina"}),"SC");
assert.equal(G.regionFromAddress({"ISO3166-2-lvl4":"BR-SP"}),"SP");

G.setCenter({lat:-23.5505,lon:-46.6333});
G.setRegionInfo({state:"SP"});
assert.equal(G.regionalLinks().length,0,"São Paulo não deve oferecer Stok Torres, MPH Lages, ou links de SC/RS");
assert(!elements.get("garimpoRegionalActions").innerHTML.includes("Torres"));
assert(!elements.get("garimpoMPHAction").innerHTML);
assert.equal(elements.get("garimpoGiassiOnline").hidden,true);

G.setCenter({lat:-29.3389427,lon:-49.7271564});
G.setRegionInfo({state:"RS"});
assert(G.regionalLinks().some(x=>x.label.includes("Nota Gaúcha")));
assert(G.regionalLinks().some(x=>x.label.includes("Stok Center")));
assert(elements.get("garimpoRegionalActions").innerHTML.includes("região vizinha"));
assert(!G.regionalLinks().some(x=>x.label.includes("Menor Preço Brasil")));

G.setCenter({lat:-29.125,lon:-49.65});
G.setRegionInfo({state:"SC"});
assert(G.regionalLinks().some(x=>x.label.includes("Menor Preço Brasil")));
assert(G.regionalLinks().some(x=>x.label.includes("Stok Center")));
assert.equal(elements.get("garimpoGiassiOnline").hidden,false);
assert(!G.regionalLinks().some(x=>x.label.includes("Nota Gaúcha")));

G.setCenter({lat:-27.816,lon:-50.327});
G.setRegionInfo({state:"SC"});
assert(elements.get("garimpoMPHAction").innerHTML.includes("lookupMPH"));
assert(!G.regionalLinks().some(x=>x.label.includes("Stok Center")));

G.setCenter({lat:-8.0543,lon:-34.8813});
G.setRegionInfo({state:"PE"});
assert.equal(G.regionalLinks().length,0,"Recife não recebe ofertas do litoral sul");
assert(!elements.get("garimpoMPHAction").innerHTML);
assert.equal(elements.get("garimpoGiassiOnline").hidden,true);

ctx.navigator.geolocation={getCurrentPosition:success=>success({coords:{latitude:-23.5505,longitude:-46.6333}})};
ctx.fetch=async u=>{
 const url=String(u);
 if(url.includes("nominatim.openstreetmap.org"))return {ok:true,json:async()=>({address:{state:"São Paulo","ISO3166-2-lvl4":"BR-SP",city:"São Paulo"}})};
 if(url.includes("photon.komoot.io"))return {ok:true,json:async()=>({features:[
  {properties:{name:"Mercado Local",city:"São Paulo",osm_value:"supermarket",osm_type:"N",osm_id:1},geometry:{coordinates:[-46.6334,-23.5506]}},
  {properties:{name:"Mercado Distante",city:"Torres",osm_value:"supermarket",osm_type:"N",osm_id:2},geometry:{coordinates:[-49.7272,-29.339]}}
 ]})};
 throw Error("URL desconhecida "+url);
};
(async()=>{
 await G.discover();
 assert.equal(G.markets().length,1,"Resultados do raio de 30 km precisam excluir lojas de outro estado");
 assert.equal(G.markets()[0].name,"Mercado Local");
 assert.equal(G.regionalLinks().length,0);
 assert.equal(elements.get("garimpoGiassiOnline").hidden,true);
 console.log("PASS: app nacional neutro, SC/RS/Torres/Lages contextuais, São Paulo e Pernambuco isolados, GPS com raio real de 30 km.");
})().catch(e=>{console.error(e);process.exitCode=1});
