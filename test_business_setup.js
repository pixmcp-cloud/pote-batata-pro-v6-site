const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const html=fs.readFileSync("source/pote_app_base.html","utf8");
const backup=html.match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/);
assert(backup,"Modelo do catálogo ausente");
const seed=JSON.parse(backup[1]);
assert.equal(seed.recipes.length,26);
assert.equal(seed.ingredients.length,45);
const script=fs.readFileSync("business_setup.js","utf8");
function setup(role="free"){
 const user={uid:"test-"+role,email:role==="admin"?"pixmcp@gmail.com":"user@example.com",role};
 const brand={name:"Meu Negócio",subtitle:"GESTÃO DE ALIMENTAÇÃO",logoUrl:"./assets/generic/business-neutral.svg",phone:"",instagram:""};
 const state={data:{brand,recipes:[],ingredients:[],orders:[],businessType:"",businessTemplates:{}},unlocked:null};
 let persisted=0,rendered=0;
 const elements=new Map();
 function node(){return {hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},
  setAttribute(){},querySelectorAll(){return []},appendChild(){},innerHTML:"",textContent:"",src:"",value:""}}
 const document={
  body:{appendChild(){}},documentElement:{classList:{toggle(){}}},
  createElement(){return node()},getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id)},
  querySelector(){return null},querySelectorAll(){return []},addEventListener(){}
 };
 const window={POTE_AUTH:user};
 const ctx={SEED:seed,state,window,document,Node:{TEXT_NODE:3},Date,Math,JSON,String,Array,Object,
  confirm:()=>true,alert:()=>{},persist:()=>{persisted++},render:()=>{rendered++},toast:()=>{},console};
 vm.createContext(ctx);vm.runInContext(script,ctx,{filename:"business_setup.js"});
 return {ctx,state,window,document,get persistCount(){return persisted},get renderCount(){return rendered}};
}
const neutral=setup("free");
assert.equal(neutral.state.data.recipes.length,0,"Nova conta deve iniciar sem receitas");
assert.equal(neutral.window.POTE_BUSINESS.current(),"");
neutral.window.POTE_BUSINESS.choose("batataria");
assert.equal(neutral.state.data.businessType,"batataria");
assert.equal(neutral.state.data.brand.name,"Minha Batataria");
assert.equal(neutral.state.data.recipes.length,26,"Catálogo completo não carregado");
assert.equal(neutral.state.data.ingredients.length,45,"Ingredientes do catálogo não carregados");
assert(neutral.state.data.ingredients.every(i=>i.stock===0),"Estoque ilustrativo não pode contaminar a conta");
assert(neutral.state.data.recipes.every(r=>r.imageUrl.startsWith("./assets/generic/recipe-")),"Fotos originais não podem ser vinculadas");
assert(neutral.state.data.recipes.every(r=>r.imageUrl.endsWith(".svg")),"Imagens genéricas ausentes");
assert.equal(neutral.state.unlocked,"r01","Plano FREE mantém apenas a ficha inicial liberada");
const once=neutral.window.POTE_BUSINESS.importBatatariaTemplates();
assert.equal(once.already,true);
assert.equal(neutral.state.data.recipes.length,26,"Importação duplicou receitas");
assert.equal(neutral.state.data.ingredients.length,45,"Importação duplicou ingredientes");
neutral.state.data.orders.push({id:"real-order",value:140});
neutral.window.POTE_BUSINESS.choose("pizzaria");
assert.equal(neutral.state.data.businessType,"pizzaria");
assert.equal(neutral.state.data.orders.length,1,"Trocar ramo apagou venda real");
assert.equal(neutral.state.data.recipes.length,26,"Trocar ramo apagou receitas existentes");
const pizza=setup("free");
pizza.window.POTE_BUSINESS.choose("pizzaria");
assert.equal(pizza.state.data.recipes.length,0,"Pizzaria não deve receber receitas de Batataria");
assert.equal(pizza.state.data.brand.name,"Minha Pizzaria");
const burger=setup("free");
burger.window.POTE_BUSINESS.choose("hamburgueria");
assert.equal(burger.state.data.recipes.length,0);
const snack=setup("free");
snack.window.POTE_BUSINESS.choose("lancheria");
assert.equal(snack.state.data.recipes.length,0);
const admin=setup("admin");
admin.state.data.brand={name:"POTÊ BATATA",subtitle:"BATATA RECHEADA NO POTE",logoUrl:"./assets/pote-logo-original.jpg"};
admin.state.data.recipes=[{id:"r01",name:"Receita original",imageUrl:"./assets/recipes/r01.webp"}];
admin.window.POTE_BUSINESS.choose("batataria");
assert.equal(admin.state.data.brand.name,"POTÊ BATATA","Logo ou marca mestre alterada");
assert.equal(admin.state.data.recipes.length,1,"Arquivos da conta mestre foram sobrescritos");
assert.equal(admin.state.data.recipes[0].imageUrl,"./assets/recipes/r01.webp");
const legacy=setup("free");
legacy.state.data.brand={...seed.brand,logoUrl:"./assets/pote-logo-original.jpg",phone:"4899999999"};
assert.equal(legacy.window.POTE_BUSINESS.normalizeAccountBrand(),true);
assert.equal(legacy.state.data.brand.name,"Meu Negócio");
assert.equal(legacy.state.data.brand.logoUrl,"./assets/generic/business-neutral.svg");
assert.equal(legacy.state.data.brand.phone,"4899999999","Telefone existente não deve ser apagado");
const src=fs.readFileSync("source/pote_app_base.html","utf8");
assert(src.includes("business:'Negócio'"),"Navegação não apresenta Negócio");
assert(src.includes("ops-business-card"),"Card de Negócio ausente da Home");
assert(src.includes("window.POTE_AUTH?.role==='admin'"),"Fotos originais não estão protegidas por visualização");
const menu=fs.readFileSync("floating_menu.js","utf8");
assert(menu.includes('["business","Negócio"]'));
const result=fs.readFileSync("public/index.html","utf8");
assert(result.includes("business_setup.js?v=business-20261115"));
assert(result.includes("business_setup.css?v=business-20261115"));
assert(result.includes("GESTÃO PRO"),"Identidade neutra ausente");
assert(result.includes("POTE_NEUTRAL_BRAND"));
console.log("PASS: quatro segmentos, catálogo de 26 receitas, 45 ingredientes, estoque zerado, marca neutra e conta mestre preservada.");
