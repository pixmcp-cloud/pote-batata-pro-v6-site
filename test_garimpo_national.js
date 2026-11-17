const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs");
const elements=new Map();
for(const id of ["garimpoRegionalActions","garimpoRegionalSources","garimpoMPHAction","garimpoGiassiOnline","garimpoSearchStatus","garimpoMarkets","garimpoComparison","garimpoHistory","garimpoMarketList"]){
 elements.set(id,{innerHTML:"",textContent:"",hidden:true});
}
const state={data:{ingredients:[{id:"a",name:"Leite",measureUnit:"ml"}],beverages:[],suppliers:[],garimpoOffers:[]}};
const requests=[],listeners=new Map();
let now=Date.now(),gpsCalls=0,position={latitude:-23.5505,longitude:-46.6333},offline=false;
class Clock extends Date {static now(){return now;}}
const ctx={state,console,Number,String,Intl,Math,Date:Clock,Map,Set,Array,Object,JSON,URL,Blob,AbortController,
 setTimeout:(callback,ms)=>ms===6000?null:setImmediate(()=>{now+=ms;callback();}),clearTimeout:clearImmediate,
 document:{getElementById:x=>elements.get(x)||null},
 window:{confirm:()=>true,isSecureContext:true,addEventListener:(event,cb)=>listeners.set(event,[...(listeners.get(event)||[]),cb])},
 navigator:{permissions:{query:()=>assert.fail("Abrir a página não deve consultar GPS")},
  geolocation:{getCurrentPosition:success=>{gpsCalls++;success({coords:position});}}},
 toast(){},alert(){},persist(){},uid(){return "1"}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("supplier_integration.js","utf8"),ctx);
vm.runInContext(fs.readFileSync("garimpo.js","utf8"),ctx);
const G=ctx.window.POTE_GARIMPO;
assert(G.render().includes("Radar de Preço"));
assert(!G.render().includes("<h2>Garimpo"));
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

ctx.fetch=async u=>{
 const url=new URL(u);
 requests.push(url);
 assert.equal(url.hostname,"photon.komoot.io");
 if(offline)return {ok:false,status:503};
 if(url.pathname==="/reverse/")return {ok:true,json:async()=>({features:[
  {properties:{state:"São Paulo",city:"São Paulo",countrycode:"BR"},geometry:{coordinates:[-46.6333,-23.5505]}}
 ]})};
 if(url.pathname==="/api/")return {ok:true,json:async()=>({features:[
  {properties:{name:"Mercado Local",city:"São Paulo",osm_value:"supermarket",osm_type:"N",osm_id:1},geometry:{coordinates:[-46.6334,-23.5506]}},
  {properties:{name:"Mercado Distante",city:"Torres",osm_value:"supermarket",osm_type:"N",osm_id:2},geometry:{coordinates:[-49.7272,-29.339]}},
  {properties:{name:"Mercado Inválido",city:"São Paulo",osm_value:"supermarket",osm_type:"N",osm_id:3},geometry:{coordinates:[-46.6,NaN]}}
 ]})};
 throw Error("URL desconhecida "+url);
};
(async()=>{
 G.mount();
 assert.equal(gpsCalls,0,"Abrir o Radar não pede GPS, mesmo em um navegador que oferece geolocalização");
 assert.equal(requests.length,0);
 await G.discover();
 assert.equal(gpsCalls,1);
 assert(requests.every(request=>request.searchParams.get("lat")==="-23.55"&&request.searchParams.get("lon")==="-46.63"));
 assert.equal(G.markets().length,1,"Resultados do raio de 30 km precisam excluir lojas de outro estado");
 assert.equal(G.markets()[0].name,"Mercado Local");
 assert.equal(G.regionalLinks().length,0);
 assert.equal(elements.get("garimpoGiassiOnline").hidden,true);
 const firstSearch=requests.length;
 await G.discover();
 assert.equal(requests.length,firstSearch,"A mesma região usa resultados armazenados em memória");
 now+=13*60_000;
 offline=true;
 await G.discover();
 assert.equal(requests.length,firstSearch+1);
 assert.equal(G.markets()[0].name,"Mercado Local");
 assert.match(elements.get("garimpoSearchStatus").textContent,/resultados anteriores/);
 position={latitude:-8.0543,longitude:-34.8813};
 await G.discover();
 assert.equal(G.markets().length,0,"O fallback não exibe mercados de outra localização");
 for(const listener of listeners.get("pote:user-logout"))listener();
 assert.equal(G.markets().length,0);
 console.log("PASS: GPS por ação explícita, raio real de 30 km, cache e fallback sem misturar regiões.");
})().catch(e=>{console.error(e);process.exitCode=1});
