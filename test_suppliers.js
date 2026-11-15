const fs = require("fs"), vm = require("vm"), assert = require("assert");
const code = fs.readFileSync(__dirname + "/supplier_integration.js", "utf8");
const storage = new Map();
const elements = {
 supplierCity:{value:"Balneário Gaivota, SC"},
 supplierRadius:{value:"10"},
 supplierLookupStatus:{textContent:""},
 supplierSearchResults:{innerHTML:""}
};
let renders=0,persists=0,uidCount=0;
const fakeFeature = {properties:{name:"Supermercado Real",osm_type:"N",osm_id:123,osm_key:"shop",osm_value:"supermarket",city:"Balneário Gaivota",state:"SC"},geometry:{coordinates:[-49.5809,-29.1553]}};
const context = {
 console, URL, AbortController, setTimeout, clearTimeout, Date, Math, Promise,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 navigator:{geolocation:{getCurrentPosition:yes=>yes({coords:{latitude:-29.1553,longitude:-49.5809,accuracy:22}})}},
 isSecureContext:true,
 document:{getElementById:id=>elements[id]||null},
 pageSuppliers:()=>'<div>Pesquisa habilitada nesta simulação. Nenhuma chamada externa será enviada.<h3>Adicionar manualmente</h3></div>',
 escapeHtml:v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),
 pro:()=>true,
 toast:()=>{}, uid:()=>String(++uidCount),
 state:{data:{suppliers:[]}},persist:()=>{persists++},render:()=>{renders++},
 fetch:async()=>({ok:true,json:async()=>({features:[fakeFeature]})})
};
context.window=context;
vm.createContext(context);
vm.runInContext(code,context);
assert(context.pageSuppliers().includes("Busca piloto"));
context.supplierGps();
assert(elements.supplierLookupStatus.textContent.includes("GPS autorizado"));
(async()=>{
 await context.searchSupplier();
 assert(elements.supplierSearchResults.innerHTML.includes("Supermercado Real"));
 context.poteSaveSupplierFromMap(0);
 assert(context.state.data.suppliers.length===1);
 assert(renders===1 && persists===1);
 console.log("OK: busca real simulada por mock, GPS, cadastro, estado e sincronização acionada");
})().catch(e=>{console.error(e);process.exitCode=1});
