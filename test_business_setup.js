const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const html=fs.readFileSync("source/pote_app_base.html","utf8");
const backup=html.match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/);
assert(backup,"Modelo do catálogo ausente");
const seed=JSON.parse(backup[1]);
assert.equal(seed.recipes.length,26);
assert.equal(seed.ingredients.length,45);
const script=fs.readFileSync("business_setup.js","utf8");
const templates=fs.readFileSync("universe_templates.js","utf8");
const core=fs.readFileSync("universe_core.js","utf8");
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
 const window={POTE_AUTH:user,addEventListener(){}};
 const ctx={SEED:seed,state,window,document,Node:{TEXT_NODE:3},Date,Math,JSON,String,Array,Object,
  confirm:()=>true,alert:()=>{},persist:()=>{persisted++},render:()=>{rendered++},toast:()=>{},console};
 vm.createContext(ctx);vm.runInContext(templates,ctx,{filename:"universe_templates.js"});
 vm.runInContext(fs.readFileSync("pastelaria_templates.js","utf8"),ctx,{filename:"pastelaria_templates.js"});
 vm.runInContext(core,ctx,{filename:"universe_core.js"});
 vm.runInContext(fs.readFileSync("access_control.js","utf8"),ctx,{filename:"access_control.js"});
 vm.runInContext(script,ctx,{filename:"business_setup.js"});
 return {ctx,state,window,document,get persistCount(){return persisted},get renderCount(){return rendered}};
}
const companyAccount=setup("free");
companyAccount.state.data.brand.name="Café da Ana";
companyAccount.window.POTE_BUSINESS.refresh();
assert.equal(companyAccount.document.getElementById("poteHeadName").textContent,"Café da Ana","Cabeçalho deve mostrar marca da conta cliente");
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
assert.equal(neutral.state.data.businessType,"batataria","FREE não troca o segmento");
neutral.window.POTE_AUTH.proActive=true;
neutral.window.POTE_BUSINESS.choose("pizzaria");
assert.equal(neutral.state.data.businessType,"pizzaria");
assert.equal(neutral.state.data.orders.length,0,"Pedidos de batata não devem aparecer na Pizzaria");
assert.equal(neutral.state.data.recipes.length,30,"Pizzaria deve receber 30 receitas próprias");
assert.equal(neutral.state.data.businessUniverses.batataria.orders.length,1,"Venda de Batataria deve ser arquivada");
assert.equal(neutral.state.data.businessUniverses.batataria.recipes.length,26,"Receitas de Batataria devem ser preservadas");
const pizza=setup("free");
pizza.window.POTE_BUSINESS.choose("pizzaria");
assert.equal(pizza.state.data.recipes.length,30,"Pizzaria deve receber 30 sabores próprios");
assert(pizza.state.data.recipes.every(x=>x.templateOrigin==="pizzaria"),"Batataria vazou na Pizzaria");
assert.equal(pizza.state.data.brand.name,"Minha Pizzaria");
const burger=setup("free");
burger.window.POTE_BUSINESS.choose("hamburgueria");
assert.equal(burger.state.data.recipes.length,30);
assert(burger.state.data.recipes.every(x=>x.templateOrigin==="hamburgueria"));
const dog=setup("free");
dog.window.POTE_BUSINESS.choose("hotdog");
assert.equal(dog.state.data.recipes.length,20);
const pastel=setup("free");pastel.window.POTE_BUSINESS.choose("pastelaria");
assert.equal(pastel.state.data.recipes.length,50);
assert.equal(pastel.state.data.recipes.filter(x=>x.category==="Doces").length,10);
const snack=setup("free");
snack.window.POTE_BUSINESS.choose("lancheria");
assert.equal(snack.state.data.businessType,"","Lancheria bloqueada mesmo antes da escolha");
snack.window.POTE_AUTH.proActive=true;snack.window.POTE_BUSINESS.choose("lancheria");
assert.equal(snack.state.data.businessType,"lancheria");
assert.equal(snack.state.data.recipes.length,0);
const franchise=setup("free");
franchise.window.POTE_AUTH.franchiseActive=true;
franchise.window.POTE_BUSINESS.choose("pizzaria");
assert.equal(franchise.state.data.businessType,"","Franquia não pode trocar para outro ramo");
franchise.window.POTE_BUSINESS.choose("batataria");
assert.equal(franchise.state.data.businessType,"batataria");
assert.equal(franchise.state.data.recipes.length,0,"As fichas oficiais devem vir do catálogo privado, não de uma importação genérica");
const admin=setup("admin");
admin.state.data.brand={name:"POTÊ BATATA",subtitle:"BATATA RECHEADA NO POTE",logoUrl:"./assets/pote-logo-original.jpg"};
admin.state.data.recipes=[{id:"r01",name:"Receita original",imageUrl:"./assets/recipes/r01.webp"}];
admin.window.POTE_BUSINESS.choose("batataria");
assert.equal(admin.state.data.brand.name,"POTÊ BATATA","Logo ou marca mestre alterada");
assert.equal(admin.state.data.recipes.length,1,"Arquivos da conta mestre foram sobrescritos");
assert.equal(admin.state.data.recipes[0].imageUrl,"./assets/recipes/r01.webp");
admin.state.data.orders=[{id:"adm-batata-sale",total:89}];
admin.state.data.ingredients=[{id:"adm-batata-stock",stock:3000,price:5.99}];
for(const [type,expected] of [["pizzaria",30],["hamburgueria",30],["hotdog",20],["lancheria",0],["pastelaria",50]]){
 admin.window.POTE_BUSINESS.choose(type);
 assert.equal(admin.window.POTE_AUTH.role,"admin","O ADM precisa continuar ADM em todos os universos");
 assert.equal(admin.state.data.businessType,type);
 assert.equal(admin.state.data.recipes.length,expected,"Quantidade de receitas incorreta em "+type);
 assert.equal(admin.state.data.orders.length,0,"Vendas de outro ramo apareceram em "+type);
 assert.equal(admin.state.data.brand.logoUrl.startsWith("./assets/generic/"),true,"Logo da matriz vazou em "+type);
 assert.equal(admin.document.getElementById("poteHeadSubtitle").textContent.includes("ADM"),true,"Identidade ADM deveria aparecer");
}
admin.window.POTE_BUSINESS.choose("batataria");
assert.equal(admin.state.data.brand.name,"POTÊ BATATA","Marca da matriz alterada");
assert.equal(admin.state.data.recipes.find(r=>r.id==="r01").name,"Receita original","Receita original alterada");
assert.equal(admin.state.data.orders[0].id,"adm-batata-sale","Venda ADM original perdida");
assert.equal(admin.state.data.ingredients.find(i=>i.id==="adm-batata-stock").stock,3000,"Estoque original perdido");
admin.window.POTE_BUSINESS.choose("pizzaria");
assert.equal(admin.state.data.recipes.length,30,"Ao voltar, o catálogo de Pizzaria foi duplicado");
admin.window.POTE_BUSINESS.choose("batataria");
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
assert(result.includes("business_setup.js?v=dois-icones-20261125"));
assert(result.includes("business_setup.css?v=business-universes-20261115"));
assert(result.includes("PDV MULTIVERSAL"),"Identidade neutra ausente");
assert(result.includes("POTE_NEUTRAL_BRAND"));
console.log("PASS: cinco universos, Pizzaria e Hamburgueria com 30 receitas cada, Hot Dog com 20 e Lancheria sem receitas.");

// V6: capas aprovadas, arte do ramo ativo e publicação dos WebP.
const businessCovers=["batataria","pizzaria","hamburgueria","hotdog","lancheria","pastelaria"];
for(const key of [...businessCovers,"negocio"]){
 const path="assets/generic/business-"+key+".webp";
 for(const file of [path,"public/"+path]){
  const data=fs.readFileSync(file);
  assert.equal(data.subarray(0,4).toString(),"RIFF",file);
  assert.equal(data.subarray(8,12).toString(),"WEBP",file);
  assert(data.length>10000,file+" deve conter a arte real");
 }
 if(key!=="negocio")assert(script.includes('photo:"./'+path+'"'),"Capa ausente: "+key);
}
assert(src.includes('id="poteBusinessImage" src="./assets/generic/business-negocio.webp"'));
assert(result.includes('id="poteBusinessImage" src="./assets/generic/business-negocio.webp"'));
const businessLabels={batataria:"Batataria",pizzaria:"Pizzaria",hamburgueria:"Hamburgueria",hotdog:"Hot Dog",lancheria:"Lancheria",pastelaria:"Pastelaria"};
for(const account of [companyAccount,neutral,admin,pizza,burger,dog,pastel,snack]){
 account.window.POTE_BUSINESS.refresh();
 const key=account.window.POTE_BUSINESS.current();
 assert.equal(account.document.getElementById("poteBusinessImage").src,"./assets/generic/business-"+(key||"negocio")+".webp");
 assert.equal(account.document.getElementById("poteBusinessHeroHint").textContent,key?businessLabels[key].toUpperCase():"ESCOLHA SEU RAMO");
}
for(const key of [...businessCovers,""]){
 companyAccount.state.data.businessType=key;
 companyAccount.window.POTE_BUSINESS.refresh();
 assert.equal(companyAccount.document.getElementById("poteBusinessImage").src,"./assets/generic/business-"+(key||"negocio")+".webp");
 assert.equal(companyAccount.document.getElementById("poteBusinessHeroHint").textContent,key?businessLabels[key].toUpperCase():"ESCOLHA SEU RAMO");
}
const businessCss=fs.readFileSync("business_setup.css","utf8");
assert(businessCss.includes("#poteOpsCards>.ops-business-card>strong"));
assert(businessCss.includes("border-bottom:1px solid #efbb64"));
assert(businessCss.includes("#poteOpsCards>.ops-business-card>.ops-business-hint"));
assert(result.includes("v6-artes-20261125-layout-2"));
assert(result.includes("v6-layout-20261125"));
console.log("PASS: sete artes WebP publicadas; Negócio acompanha os seis segmentos e fallback neutro.");
