const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=x=>fs.readFileSync(x,"utf8");
const seed=JSON.parse(read("source/pote_app_base.html").match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/)[1]);
function init(){
 const window={};
 const sandbox={window,Date,JSON,Object,Array,Math,Number,String,Map,Set,console};
 vm.createContext(sandbox);
 vm.runInContext(read("universe_templates.js"),sandbox);
 vm.runInContext(read("universe_core.js"),sandbox);
 return window;
}
const w=init(),U=w.POTE_UNIVERSES,T=w.POTE_UNIVERSE_TEMPLATES;
assert.deepEqual(Object.keys(T).sort(),["hamburgueria","hotdog","lancheria","pizzaria","stats"].sort());
assert.equal(T.pizzaria.recipes.length,30);
assert.equal(T.hamburgueria.recipes.length,30);
assert.equal(T.hotdog.recipes.length,20);
assert.equal(T.lancheria.recipes.length,0);
assert.equal(T.lancheria.ingredients.length,0);
assert.deepEqual(Array.from(T.pizzaria.recipes.slice(0,5).map(x=>x.name)),
 ["Calabresa","Frango com Requeijão","Marguerita","Muçarela","Portuguesa"]);
assert.deepEqual(Array.from(T.hamburgueria.recipes.slice(0,4).map(x=>x.name)),
 ["Cheeseburger Clássico","X-Salada","X-Tudo","X-Bacon"]);
for(const type of ["pizzaria","hamburgueria","hotdog"]){
 const data=T[type],ids=new Set(data.ingredients.map(x=>x.id));
 assert(data.recipes.every(x=>x.items.length>=3&&x.steps.length>=4),"Cada ficha precisa de ingredientes e modo de preparo");
 assert(data.recipes.every(x=>x.items.every(i=>ids.has(i.id))),"Todos os insumos devem existir");
 assert(data.recipes.every(x=>x.imageUrl.includes(type)),"Imagem genérica do ramo incorreta");
 assert(data.ingredients.every(x=>x.price===0&&x.stock===0&&x.purchasePrice===0),
  "Sem custos e estoque fictícios");
 assert(data.recipes.every(x=>x.templateOrigin===type&&x.pricingReady===false));
}
const allIds=[...T.pizzaria.recipes,...T.hamburgueria.recipes,...T.hotdog.recipes].map(x=>x.id);
assert.equal(new Set(allIds).size,80);
const cleanState=()=>({data:{brand:{name:"Meu Negócio",phone:"4899999999",logoUrl:"./assets/generic/business-neutral.svg"},
 settings:{portion:500,estimatedMonthlyUnits:0,margin:50},businessType:"",businessTemplates:{},
 recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[],checklist:[]},
 unlocked:null,creatives:[]});
const st=cleanState();
const b=U.switchTo(st,"batataria",seed);
assert.equal(b.recipesAdded,26);
assert.equal(st.data.recipes.length,26);
st.data.orders.push({id:"batata-venda-1",total:110});
st.data.ingredients[0].stock=3600;
st.data.clients.push({id:"cliente-batata",name:"Cliente A"});
st.data.recipes.push({id:"batata-custom",name:"Batataria própria",items:[],steps:[]});
let r=U.switchTo(st,"pizzaria",seed);
assert.equal(r.recipesAdded,30);
assert.equal(st.data.recipes.length,30);
assert(st.data.recipes.every(x=>x.templateOrigin==="pizzaria"));
assert.equal(st.data.orders.length,0,"Pedidos de Batataria não devem aparecer em Pizzaria");
assert.equal(st.data.clients.length,0,"Clientes de um universo não aparecem no outro");
assert(st.data.ingredients.every(x=>!x.name.toLowerCase().includes("batata inglesa")));
st.data.orders.push({id:"pizza-venda-1",total:210});
st.data.ingredients[0].stock=1500;
st.data.ingredients[0].price=19;
st.data.recipes.push({id:"pizza-propria",name:"Pizza especial",items:[],steps:[]});
r=U.switchTo(st,"hamburgueria",seed);
assert.equal(r.recipesAdded,30);
assert.equal(st.data.orders.length,0);
assert.equal(st.data.recipes.length,30);
assert(st.data.recipes.every(x=>x.templateOrigin==="hamburgueria"));
r=U.switchTo(st,"hotdog",seed);
assert.equal(r.recipesAdded,20);
assert.equal(st.data.orders.length,0);
assert.equal(st.data.recipes.length,20);
r=U.switchTo(st,"lancheria",seed);
assert.equal(r.recipesAdded,0);
assert.equal(st.data.recipes.length,0);
assert.equal(st.data.ingredients.length,0);
assert.equal(st.data.orders.length,0);
const prior=U.switchTo(st,"pizzaria",seed);
assert.equal(prior.already,true);
assert.equal(st.data.recipes.length,31);
assert.equal(st.data.orders[0].id,"pizza-venda-1");
assert.equal(st.data.ingredients[0].stock,1500);
assert.equal(st.data.ingredients[0].price,19);
U.switchTo(st,"batataria",seed);
assert.equal(st.data.recipes.length,27);
assert.equal(st.data.orders[0].id,"batata-venda-1");
assert.equal(st.data.ingredients[0].stock,3600);
assert.equal(st.data.clients[0].id,"cliente-batata");
assert(st.data.businessUniverses.pizzaria.recipes.some(x=>x.id==="pizza-propria"));
const legacy=cleanState();
legacy.data.businessType="pizzaria";
legacy.data.recipes=structuredClone(seed.recipes).map(r=>({...r,templateOrigin:"batataria"}));
legacy.data.ingredients=structuredClone(seed.ingredients);
legacy.data.orders=[{id:"legacy-sale",recipeId:"r01",total:99}];
r=U.switchTo(legacy,"pizzaria",seed);
assert.equal(legacy.data.recipes.length,30,"Migração antiga precisa remover batatas da pizzaria");
assert(legacy.data.recipes.every(x=>x.templateOrigin==="pizzaria"));
assert.equal(legacy.data.orders.length,1,"Não apagar pedidos históricos na migração");
assert(legacy.data.businessUniverses.batataria.recipes.length===26,"Preservar fichas de batata no universo certo");
U.switchTo(legacy,"batataria",seed);
assert.equal(legacy.data.recipes.length,26,"Não duplicar Batataria após migração");
assert(legacy.data.recipes.every(x=>x.templateOrigin==="batataria"));
const source=read("business_setup.js");
for(const id of ["batataria","pizzaria","hamburgueria","hotdog","lancheria"])
 assert(source.includes('id:"'+id+'"'),"Seletor de universo incompleto: "+id);
assert(source.includes("POTE_UNIVERSES.switchTo(state,type,SEED)"));
assert(source.includes("Franquia oficial Potê Batata"));
const built=read("public/index.html");
assert(built.includes('universe_templates.js?v=universes-20261115'));
assert(built.includes('universe_core.js?v=v3-wave1-20261116'));
assert(built.includes('business_setup.js?v=business-universes-20261115'));
const firebase=read("firebase_integration.js");
assert(firebase.includes("POTE_UNIVERSE_MIGRATED"));
console.log("PASS: 30 pizzas, 30 hambúrgueres, 20 Hot Dogs, Lancheria vazia, sem receitas misturadas, custos próprios e dados preservados.");
