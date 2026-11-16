/* Pastelaria — 50 fichas-modelo originais (40 salgadas + 10 doces).
   Compilação de combinações culinárias comuns, sem importar dados financeiros.
   Foto compartilhada por todos os sabores; o operador pode trocar depois. */
(function(){
"use strict";
window.POTE_UNIVERSE_TEMPLATES??={};
if(window.POTE_UNIVERSE_TEMPLATES.pastelaria)return;
const savory=[
 ["Carne Tradicional","Carne moída cozida:115;Cebola:15;Tomate:15;Cheiro-verde:5"],
 ["Carne com Queijo","Carne moída cozida:95;Muçarela:55;Cebola:12"],
 ["Carne com Ovo","Carne moída cozida:100;Ovo cozido:50;Azeitona:15"],
 ["Carne com Azeitona","Carne moída cozida:110;Azeitona:35;Cebola:12"],
 ["Carne com Cheddar","Carne moída cozida:105;Cheddar cremoso:55"],
 ["Carne com Bacon","Carne moída cozida:100;Bacon frito escorrido:45;Cebola:15"],
 ["Carne Seca com Requeijão","Carne seca dessalgada cozida:115;Requeijão cremoso:60;Cebola:15"],
 ["Carne Seca com Abóbora","Carne seca dessalgada cozida:100;Abóbora cabotiá cozida:75;Cebola:15"],
 ["Frango com Catupiry","Frango cozido e desfiado:110;Requeijão cremoso:65"],
 ["Frango com Queijo","Frango cozido e desfiado:105;Muçarela:65"],
 ["Frango com Milho","Frango cozido e desfiado:110;Milho verde cozido:45;Requeijão cremoso:35"],
 ["Frango com Bacon","Frango cozido e desfiado:100;Bacon frito escorrido:45;Requeijão cremoso:40"],
 ["Frango com Cheddar","Frango cozido e desfiado:110;Cheddar cremoso:65"],
 ["Pizza","Muçarela:75;Presunto:60;Tomate:30;Orégano:2"],
 ["Portuguesa","Muçarela:50;Presunto:45;Ovo cozido:50;Cebola:20;Azeitona:10"],
 ["Bauru","Presunto:75;Muçarela:75;Tomate:30"],
 ["Queijo Muçarela","Muçarela:150;Orégano:2"],
 ["Quatro Queijos","Muçarela:55;Provolone:35;Parmesão:25;Requeijão cremoso:55"],
 ["Queijo, Tomate e Orégano","Muçarela:115;Tomate:45;Orégano:3"],
 ["Muçarela com Bacon","Muçarela:95;Bacon frito escorrido:65"],
 ["Presunto e Queijo","Presunto:75;Muçarela:75"],
 ["Calabresa Acebolada","Calabresa cozida em rodelas:125;Cebola:45"],
 ["Calabresa com Queijo","Calabresa cozida em rodelas:100;Muçarela:70"],
 ["Calabresa com Requeijão","Calabresa cozida em rodelas:105;Requeijão cremoso:65"],
 ["Bacon com Cheddar","Bacon frito escorrido:85;Cheddar cremoso:80"],
 ["Palmito Cremoso","Palmito cozido:125;Molho branco espesso:55"],
 ["Palmito com Requeijão","Palmito cozido:115;Requeijão cremoso:65"],
 ["Palmito com Milho","Palmito cozido:105;Milho verde cozido:55;Molho branco espesso:35"],
 ["Brócolis com Queijo","Brócolis cozido e escorrido:110;Muçarela:70"],
 ["Brócolis com Bacon","Brócolis cozido e escorrido:100;Bacon frito escorrido:65;Muçarela:30"],
 ["Escarola com Queijo","Escarola refogada e escorrida:110;Muçarela:70"],
 ["Espinafre com Ricota","Espinafre cozido e escorrido:90;Ricota:85;Alho:5"],
 ["Caprese","Muçarela:95;Tomate:60;Manjericão:10"],
 ["Milho com Queijo","Milho verde cozido:95;Muçarela:90"],
 ["Camarão com Requeijão","Camarão limpo e cozido:115;Requeijão cremoso:65"],
 ["Camarão ao Alho","Camarão limpo e cozido:135;Alho:12;Salsinha:8;Azeite:8"],
 ["Atum com Cebola","Atum escorrido:125;Cebola:40;Tomate:25"],
 ["Bacalhau com Azeitona","Bacalhau dessalgado cozido:115;Azeitona:25;Cebola:35;Azeite:10"],
 ["Estrogonofe de Carne","Estrogonofe de carne frio e espesso:160;Batata palha:25"],
 ["Estrogonofe de Frango","Estrogonofe de frango frio e espesso:160;Batata palha:25"]
];
const sweets=[
 ["Chocolate ao Leite","Chocolate ao leite:130;Creme de leite:30"],
 ["Chocolate Branco","Chocolate branco:130;Creme de leite:30"],
 ["Brigadeiro","Brigadeiro firme:155;Granulado de chocolate:15"],
 ["Beijinho","Beijinho firme:140;Coco ralado:25"],
 ["Prestígio","Chocolate ao leite:90;Beijinho firme:90;Coco ralado:15"],
 ["Romeu e Julieta","Goiabada:85;Queijo minas:90"],
 ["Doce de Leite","Doce de leite firme:160"],
 ["Doce de Leite com Coco","Doce de leite firme:120;Coco ralado:35"],
 ["Banana com Canela","Banana em rodelas:125;Açúcar:15;Canela em pó:3"],
 ["Chocolate com Morango","Chocolate ao leite:115;Morango higienizado e bem seco:85"]
];
const slug=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const parse=s=>s.split(";").map(term=>{const pos=term.lastIndexOf(":");return [term.slice(0,pos),Number(term.slice(pos+1))]});
const ingredients=new Map(),recipes=[],photo="./assets/recipes/pastelaria-cardapio.jpg";
function addIngredient(name){
 const key="ps-in-"+slug(name);
 if(!ingredients.has(key))ingredients.set(key,{id:key,name,category:"Insumo",price:0,purchasePrice:0,
  yield:100,stock:0,minimum:0,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",
  source:"Informe custo, lote, rendimento e fornecedor reais antes de vender",imageUrl:"",templateOrigin:"pastelaria"});
 return key;
}
function stepsFor(name,extras,sweet){
 const summary=extras.map(([ingredient,quantity])=>quantity+" g de "+ingredient).join("; ");
 return [
  "Higienize a bancada e os utensílios. Separe 110 g de massa fresca para pastel, "+summary+" e registre os ingredientes utilizados por unidade.",
  sweet?
   "Prepare o recheio doce firme e frio; se usar fruta, higienize, escorra e seque bem para não umedecer a massa.":
   "Prepare previamente os recheios de carne, aves, pescados ou vegetais com cocção segura; escorra líquidos e deixe resfriar antes de rechear.",
  "Abra a massa em espessura uniforme, distribua o recheio deste sabor no centro sem sobrecarregar e umedeça levemente as bordas.",
  "Dobre, retire o excesso de ar e sele as bordas com garfo ou carretilha para impedir vazamentos. Evite contato do recheio com a borda.",
  "Frite em óleo adequado por volta de 175–180 °C, em pequenas quantidades, até obter massa dourada e crocante; escorra em suporte apropriado.",
  "Confirme peso, cocção, apresentação, temperatura de serviço e alergênicos (glúten e possíveis leite, ovo, soja, pescados ou crustáceos). Ajuste tempos e rendimento ao seu equipamento."
 ];
}
for(const [sweet,rows] of [[false,savory],[true,sweets]]){
 for(const [name,detail] of rows){
  const extras=parse(detail),base=[["Massa fresca para pastel",110],["Óleo de fritura absorvido",12]];
  const items=[...base,...extras].map(([ingredient,g])=>({id:addIngredient(ingredient),g}));
  const k=recipes.length+1;
  recipes.push({id:"ps-"+String(k).padStart(2,"0"),name,category:sweet?"Doces":"Salgados",
   tagline:"Pastel "+(sweet?"doce":"salgado")+" de "+name.toLowerCase()+". Receita-modelo editável; valide custos e preparo antes da venda.",
   difficulty:"Fácil",time:sweet?20:25,portionWeightG:110+12+extras.reduce((a,x)=>a+x[1],0),
   items,steps:stepsFor(name,extras,sweet),featured:k<=8,imageUrl:photo,
   pricingMode:"gain",targetGainPct:100,templateOrigin:"pastelaria",businessUniverse:"pastelaria",
   modelRecipe:true,pricingReady:false});
 }
}
if(savory.length!==40||sweets.length!==10||recipes.length!==50)throw Error("Catálogo Pastelaria inválido");
window.POTE_UNIVERSE_TEMPLATES.pastelaria={recipes,ingredients:[...ingredients.values()]};
window.POTE_UNIVERSE_TEMPLATES.stats={...(window.POTE_UNIVERSE_TEMPLATES.stats||{}),pastelPicks:50};
})();
