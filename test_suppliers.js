const fs = require("fs"), vm = require("vm"), assert = require("assert");
const code = fs.readFileSync(__dirname + "/supplier_integration.js", "utf8");
const listeners=new Map(), requests=[];
let now=100_000, gpsCalls=0, fail=false, hang=false, gpsSuccess;
function timer(callback, delay) {
 if(delay===6000&&!hang)return null;
 return setImmediate(()=>{now+=delay;callback();});
}
const elements = {
 supplierCity:{value:"Balneário Gaivota, SC"},
 supplierRadius:{value:"10"},
 supplierLookupStatus:{textContent:""},
 supplierSearchResults:{innerHTML:""}
};
let renders=0,persists=0,uidCount=0;
const fakeFeature = {properties:{name:"Supermercado Real",osm_type:"N",osm_id:123,osm_key:"shop",osm_value:"supermarket",city:"Balneário Gaivota",state:"SC",countrycode:"BR"},geometry:{coordinates:[-49.5809,-29.1553]}};
const fakeCity = {...fakeFeature,properties:{countrycode:"BR",osm_value:"city"}};
const context = {
 console, URL, AbortController, setTimeout:timer, clearTimeout:clearImmediate, Date:{now:()=>now}, Math, Promise,
 localStorage:{setItem:()=>assert.fail("A busca não deve persistir cidade ou GPS")},
 addEventListener:(event,cb)=>listeners.set(event,[...(listeners.get(event)||[]),cb]),
 navigator:{geolocation:{getCurrentPosition:yes=>{gpsCalls++;gpsSuccess=yes;}}},
 isSecureContext:true,
 document:{getElementById:id=>elements[id]||null},
 pageSuppliers:()=>'<div>Pesquisa habilitada nesta simulação. Nenhuma chamada externa será enviada.<h3>Adicionar manualmente</h3></div>',
 escapeHtml:v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),
 pro:()=>true,
 toast:()=>{}, uid:()=>String(++uidCount),
 state:{data:{suppliers:[]}},persist:()=>{persists++},render:()=>{renders++},
 fetch:async(url,options)=>{
  requests.push({url:new URL(url),at:now,options});
  if(hang)return new Promise((_,reject)=>options.signal.addEventListener("abort",()=>reject(new DOMException("timeout","AbortError")),{once:true}));
  if(fail)return {ok:false,status:429};
  if(!new URL(url).searchParams.has("lat"))return {ok:true,json:async()=>({features:[fakeCity]})};
  return {ok:true,json:async()=>({features:[null,{...fakeFeature,geometry:{coordinates:[null,null]}},
   {...fakeFeature,properties:{...fakeFeature.properties,name:"Dado inválido",osm_type:["N"]}},
   fakeFeature]})};
 }
};
context.window=context;
vm.createContext(context);
vm.runInContext(code,context);
assert(context.pageSuppliers().includes("Busca piloto"));
assert.equal(gpsCalls,0);
context.supplierGps();
gpsSuccess({coords:{latitude:-29.1553,longitude:-49.5809,accuracy:22}});
assert(elements.supplierLookupStatus.textContent.includes("GPS autorizado"));
assert.equal(requests.length,0,"Selecionar GPS ainda não envia a posição ao Photon");
(async()=>{
 await Promise.all([context.searchSupplier(),context.searchSupplier()]);
 assert(elements.supplierSearchResults.innerHTML.includes("Supermercado Real"));
 assert(!elements.supplierSearchResults.innerHTML.includes("Dado inválido"));
 assert.equal(requests.length,4,"Cliques simultâneos não repetem chamadas");
 for(const [index,request] of requests.entries()){
  assert.equal(request.url.searchParams.get("lat"),"-29.16");
  assert.equal(request.url.searchParams.get("lon"),"-49.58");
  assert.equal(request.options.cache,"no-store");
  assert.equal(request.options.referrerPolicy,"no-referrer");
  assert.equal(request.options.credentials,"omit");
  if(index)assert(request.at-requests[index-1].at>=1100);
 }
 await context.searchSupplier();
 assert.equal(requests.length,4,"O cache evita consultas repetidas na mesma área");
 context.poteSaveSupplierFromMap(0);
 assert(context.state.data.suppliers.length===1);
 assert(renders===1 && persists===1);

 elements.supplierCity.value="Sombrio, SC";
 await context.searchSupplier();
 assert.equal(requests[4].url.searchParams.has("lat"),false,"Editar cidade volta à busca manual");
 assert.equal(requests[4].url.searchParams.get("q"),"Sombrio, SC, Brasil");
 for(const listener of listeners.get("pote:user-logout"))listener();
 assert.equal(elements.supplierSearchResults.innerHTML,"");
 context.poteSaveSupplierFromMap(0);
 assert.equal(renders,1,"Resultados da conta encerrada não podem ser cadastrados");

 fail=true;
 const beforeFailure=requests.length;
 await context.searchSupplier();
 assert.equal(requests.length,beforeFailure+1,"A troca de conta limpa o cache");
 assert(elements.supplierSearchResults.innerHTML.includes("Pesquisar no Google Maps"));
 assert(elements.supplierSearchResults.innerHTML.includes("Sombrio"));
 await context.searchSupplier();
 assert.equal(requests.length,beforeFailure+1,"HTTP 429 interrompe novas consultas no intervalo");

 now+=60_000;
 fail=false;
 hang=true;
 await context.searchSupplier();
 assert(elements.supplierLookupStatus.textContent.includes("tempo disponível"));
 assert(elements.supplierSearchResults.innerHTML.includes("Pesquisar no Google Maps"));
 hang=false;

 now+=60_000;
 const provider=context.POTE_SUPPLIER_SEARCH;
 const beforeBudget=requests.length;
 for(let i=0;i<16;i++)await provider.request("api",{q:"teste "+i,limit:8});
 await assert.rejects(provider.request("api",{q:"consulta extra",limit:8}),/Limite de consultas/);
 assert.equal(requests.length,beforeBudget+16);
 console.log("PASS: GPS opt-in, cache, espaçamento, limite, timeout, fallback e isolamento da busca de fornecedores.");
})().catch(e=>{console.error(e);process.exitCode=1});
