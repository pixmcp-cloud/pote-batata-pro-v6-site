const fs=require("fs"),vm=require("vm"),assert=require("assert");
const html=fs.readFileSync(__dirname+"/public/index.html","utf8");
const simulation=fs.readFileSync(__dirname+"/simulation_panel.js","utf8");
const firebase=fs.readFileSync(__dirname+"/firebase_integration.js","utf8");
const from=html.indexOf("const POTE_ORIGINAL_LOGO="),to=html.indexOf("window.POTE_APP={",from);
assert(from>0 && to>from,"Missing clean-account implementation");
const bootstrap=html.slice(from,to);
const seed={
 data:{
  ingredients:[{id:"item",stock:500,price:7}],
  recipes:[{id:"r1",name:"Receita fictícia"}],
  suppliers:[{id:"sup"}],expenses:[{id:"ex"}],clients:[],orders:[{id:"o1",price:25}],
  recipeVersions:[],recipeTrash:[],purchases:[],stockMovements:[],
  beverages:[],addons:[],combos:[],prepBatches:[],
  cashSessions:[{id:"demo-cash"}],cashMovements:[{id:"demo-cash-movement"}],
  businessUniverses:{pizzaria:{orders:[{id:"archived-demo-order"}]}},
  checklist:[{id:"check",done:true}],
  settings:{estimatedMonthlyUnits:300,margin:50},brand:{name:"Potê Batata",logoUrl:"old-example"}
 },
 accounts:[{email:"fake"}],creatives:[],audit:[]
};
const sandbox={SEED:{brand:{}},window:{POTE_AUTH:null},original:()=>JSON.parse(JSON.stringify(seed)),JSON,Array,Object};
vm.createContext(sandbox);
vm.runInContext(bootstrap+"globalThis.checkAccount=poteFreshAccount;globalThis.isDemo=poteIsPristineSeed;",sandbox);
const fresh=sandbox.checkAccount();
const list=["ingredients","recipes","suppliers","expenses","clients","orders","recipeVersions",
 "recipeTrash","purchases","stockMovements","beverages","addons","combos","prepBatches",
 "losses","garimpoOffers","cashSessions","cashMovements"];
for(const k of list) assert.strictEqual(fresh.data[k].length,0,"Sample data leaked into "+k);
assert.strictEqual(fresh.data.settings.estimatedMonthlyUnits,0);
assert.strictEqual(fresh.data.checklist[0].done,false);
assert.strictEqual(fresh.data.brand.logoUrl,"./assets/generic/business-neutral.svg");
assert.strictEqual(fresh.data.brand.name,"Meu Negócio");
assert.strictEqual(fresh.data.businessType,"batataria","FREE inicia na Batataria com todos os universos acessíveis");
assert.deepStrictEqual(JSON.parse(JSON.stringify(fresh.data.businessUniverses)),{});
assert.deepStrictEqual(JSON.parse(JSON.stringify(fresh.data.businessTemplates)),{});
assert.strictEqual(sandbox.isDemo(seed),true,"Unmodified seeded FREE account must be detectable");
const custom=JSON.parse(JSON.stringify(seed));
custom.data.orders.push({id:"user-real-order",price:100});
assert.strictEqual(sandbox.isDemo(custom),false,"Never delete mixed real+demo orders silently");
const customized=JSON.parse(JSON.stringify(seed));
customized.data.recipes[0].name="Receita do cliente";
assert.strictEqual(sandbox.isDemo(customized),false,"Never erase customized recipes silently");
const alteredStock=JSON.parse(JSON.stringify(seed));
alteredStock.data.ingredients[0].stock=99;
assert.strictEqual(sandbox.isDemo(alteredStock),false,"Never erase adjusted stock silently");
const safeNew=JSON.parse(JSON.stringify(fresh));
assert.strictEqual(sandbox.isDemo(safeNew),false,"Clean account cannot be migrated again");
assert(firebase.includes("createV5Store({"),"Conta deve carregar somente armazenamento V5");
assert(firebase.includes("const useV5=true;"),"Nao permitir fallback legado");
assert(!firebase.includes('refFor(')&&!firebase.includes('offerLegacyMigration('),"Sem leitura e migracao legada");
assert(!/fetch\s*\(/.test(simulation),"Simulation panel should never fetch data");
assert(!/state\.data\s*=|state\.data\.[a-zA-Z]+\s*=|setDoc\s*\(/.test(simulation),"Simulation should not mutate operational data");
assert(html.includes("Painel de simulação") || html.includes("simulation_panel.js"));
assert.match(html, /state=poteFreshAccount\(\);\s*render\(\);\s*<\/script>/,
 "A beta deve iniciar com estado real vazio antes do primeiro render");
console.log("PASS: clean new accounts, protected existing edits, mock panel isolation, cloud migration guard.");
