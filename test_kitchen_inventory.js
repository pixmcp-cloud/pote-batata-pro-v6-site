const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const clone=x=>JSON.parse(JSON.stringify(x));
let warnings=[],persisted=0,rendered=0;
const sandbox={window:{},console,Date,JSON,Math,Number,String,Array,Map,Set,
 confirm:()=>true,alert:m=>warnings.push(m),persist:()=>persisted++,render:()=>rendered++,
 document:{getElementById:()=>null,querySelectorAll:()=>[]},
 state:null};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("universe_core.js","utf8"),sandbox);
vm.runInContext(fs.readFileSync("kitchen_inventory.js","utf8"),sandbox);
const K=sandbox.window.POTE_KITCHEN,U=sandbox.window.POTE_UNIVERSES;
function ing(id,name,stock){return {id,name,measureUnit:"g",stock,purchasePrice:30,price:30,purchaseQuantity:1,purchaseUnit:"kg",yield:100}}
function account(a,b){return {data:{businessType:"batataria",ingredients:[ing("b","Muçarela",a)],
 recipes:[],orders:[{id:"old-sale"}],settings:{},brand:{},businessTemplates:{},
 businessUniverses:{pizzaria:{ingredients:[ing("p","Muçarela",b)],orders:[{id:"pizza-sale"}],
 recipes:[],settings:{},brand:{},businessTemplates:{}}}}};}
const legacy=account(200,0);sandbox.state=legacy;
assert.equal(K.mode(legacy),"separate","Contas antigas não podem ser unidas automaticamente");
K.setMode("shared");
assert.equal(K.mode(legacy),"shared");
assert.equal(legacy.data.kitchenStock.inventory["mucarela|g"].stock,200);
legacy.data.ingredients[0].stock=160;K.capture(legacy);
assert.equal(legacy.data.kitchenStock.inventory["mucarela|g"].stock,160);
U.switchTo(legacy,"pizzaria",null,{skipTemplates:true});
assert.equal(legacy.data.ingredients[0].stock,160);
assert.equal(legacy.data.orders[0].id,"pizza-sale");
legacy.data.ingredients[0].stock=90;K.capture(legacy);
U.switchTo(legacy,"batataria",null,{skipTemplates:true});
assert.equal(legacy.data.ingredients[0].stock,90,"Saldo deve seguir a cozinha e não o ramo");
assert.equal(legacy.data.orders[0].id,"old-sale","Não misturar vendas");
assert.equal(legacy.data.businessUniverses.pizzaria.ingredients[0].stock,90,"Projeção deve atingir o universo consultado");
K.setMode("separate");
assert.equal(K.mode(legacy),"shared","Não permitir duplicar saldo ao separar sem conciliação");
const other=account(5,8);sandbox.state=other;K.setMode("shared");
assert.equal(K.mode(other),"separate","Não somar saldos positivos diferentes entre universos");
assert.equal(other.data.ingredients[0].stock,5);
assert.equal(other.data.businessUniverses.pizzaria.ingredients[0].stock,8);
assert(warnings.some(w=>w.includes("saldos positivos")),"Deve explicar conflito");
const independent=account(0,0);sandbox.state=independent;K.setMode("shared");
assert.equal(independent.data.kitchenStock.inventory["mucarela|g"].stock,0);
assert.equal(legacy.data.kitchenStock.inventory["mucarela|g"].stock,90,"Outra conta não pode afetar o saldo da anterior");
const clean=account(0,0);clean.data.kitchenStock={mode:"shared",inventory:{}};sandbox.state=clean;
K.project(clean);assert.equal(K.mode(clean),"shared");
K.setMode("separate");assert.equal(K.mode(clean),"separate");
console.log("PASS: estoque por conta, conciliação sem soma dupla, projeção entre ramos e bloqueio de separação com saldo.");
