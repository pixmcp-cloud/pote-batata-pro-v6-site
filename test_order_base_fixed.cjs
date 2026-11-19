const fs=require("node:fs"),assert=require("node:assert/strict"),vm=require("node:vm");
const elements=new Map();
function node(id){if(!elements.has(id))elements.set(id,{id,value:"",innerHTML:""});return elements.get(id)}
const ingredients=[
 {id:"batata",name:"Batata inglesa (crua)",category:"Base",purchasePrice:8,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"leite",name:"Leite integral",category:"Laticinio",purchasePrice:5,purchaseQuantity:1,purchaseUnit:"L",measureUnit:"ml",yield:100},
 {id:"manteiga",name:"Manteiga",category:"Laticinio",purchasePrice:25,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"sal",name:"Sal e temperos secos",category:"Tempero",purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"carne",name:"Carne seca dessalgada",category:"Proteina",purchasePrice:65,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"cebola",name:"Cebola refogada",category:"Vegetal",purchasePrice:9,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"requeijao",name:"Requeijão cremoso",category:"Laticinio",purchasePrice:25,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"verde",name:"Cheiro-verde",category:"Finalização",purchasePrice:18,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100},
 {id:"batata_palha",name:"Batata palha",category:"Finalização",purchasePrice:26,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100}
];
const amounts={batata:205,leite:20,manteiga:9,sal:3,carne:112,cebola:30,requeijao:58,verde:4,batata_palha:10};
const recipe={id:"r08",name:"Carne seca",items:Object.entries(amounts).map(([id,g])=>({id,g}))};
const state={data:{businessType:"batataria",recipes:[recipe],ingredients,addons:[{id:"a01",name:"Bacon",ingredientId:"carne",quantity:35,sellPrice:6}]}};
node("orderItem").value="recipe:r08";
node("orderChannel").value="direto";
node("orderExtraBev").value="";
const window={},document={getElementById:node};
const ctx={window,document,state,console,Number,Map,Set,Array,Date,JSON,Intl,Math,
 optionQuote:()=>({recipe,price:21.9,fullPrice:21.9,variable:12,addons:[],beverages:[],contribution:9.9,estimatedProfit:8.5}),
 roundUpCommercial:n=>Math.ceil(n*100)/100,feeRate:()=>0,fixedPerUnit:()=>1,
 addonCost:()=>1,updateOrderSuggestedPrice(){}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("order_customization.js","utf8"),ctx);
const C=window.POTE_ORDER_CUSTOM;
const list=Array.from(C.options().ingredients,x=>x.id);
assert.deepEqual(list,["carne","cebola","requeijao","verde","batata_palha"]);
const html=C.render();
for(const id of ["batata","leite","manteiga","sal"])
 assert(!html.includes('data-remove-ingredient="'+id+'"'),"Base cannot have remove checkbox: "+id);
for(const id of ["carne","cebola","requeijao","verde","batata_palha"])
 assert(html.includes('data-remove-ingredient="'+id+'"'),"Fillings remain removable "+id);
assert.match(html,/Base fixa protegida/);
assert.match(html,/Retirar recheios e coberturas/);
for(const fixed of ["batata","leite","manteiga","sal"]){
 assert.equal(C.remove(fixed,true),false,"Even direct API calls must refuse base "+fixed);
 assert(C.adjustQuote(ctx.optionQuote()).recipe.items.some(x=>x.id===fixed));
}
assert.equal(C.remove("carne",true),true);
const quote=C.adjustQuote(ctx.optionQuote());
assert(!quote.recipe.items.some(x=>x.id==="carne"));
assert(quote.recipe.items.some(x=>x.id==="batata"));
assert.equal(quote.removedIngredients[0].name,"Carne seca dessalgada");
assert.equal(recipe.items.length,9,"Original recipe remains unchanged");
C.delta("a01",2);
assert.equal(C.adjustQuote(ctx.optionQuote()).customAddons[0].count,2,"Extras still unlimited");
C.reset();
assert.equal(C.adjustQuote(ctx.optionQuote()).recipe.items.length,9);
state.data.businessType="pizzaria";
C.reset();
assert(C.options().ingredients.some(x=>x.id==="leite"),"Other businesses are not forced to use potato-base rules");
console.log("PASS: 4 fixed base ingredients hidden and protected; only 5 fillings/removable toppings, price, 2 extras and original recipe remain valid.");
