import assert from "node:assert/strict";
import {checkFreeUniverseDelta} from "./free_limits.mjs?v=kitchen-motoboy-20261116";
const sample=(group,id,item={})=>({universe:"pastelaria",group,id,item});
const mock=(...rows)=>new Map(rows.map((r,i)=>[String(i),r]));
const seed=mock(sample("recipes","ps-1",{templateOrigin:"pastelaria",modelRecipe:true}),
 sample("recipes","ps-2",{templateOrigin:"pastelaria",modelRecipe:true}),
 sample("ingredients","ps-in-massa",{templateOrigin:"pastelaria"}));
assert(checkFreeUniverseDelta(new Map(),seed,"pastelaria").ok);
const one=mock(...seed.values(),sample("orders","o1"));
assert(checkFreeUniverseDelta(seed,one,"pastelaria").ok);
const two=mock(...one.values(),sample("orders","o2"));
assert.equal(checkFreeUniverseDelta(one,two,"pastelaria").ok,false);
assert.equal(checkFreeUniverseDelta(one,two,"batataria").ok,true);
assert(checkFreeUniverseDelta(two,two,"pastelaria").ok,"Dados históricos não devem ser apagados");
const ownRecipe=mock(...seed.values(),sample("recipes","mine",{name:"Meu pastel"}));
assert(checkFreeUniverseDelta(seed,ownRecipe,"pastelaria").ok);
const secondRecipe=mock(...ownRecipe.values(),sample("recipes","mine2",{name:"Outro"}));
assert.equal(checkFreeUniverseDelta(ownRecipe,secondRecipe,"pastelaria").ok,false);
const pizzaOrder=mock(...seed.values(),{universe:"pizzaria",group:"orders",id:"pizza-o1",item:{id:"pizza-o1"}});
const crossUniverse=mock(...pizzaOrder.values(),{universe:"pastelaria",group:"orders",id:"pastel-o2",item:{id:"pastel-o2"}});
assert.equal(checkFreeUniverseDelta(pizzaOrder,crossUniverse,"pastelaria").ok,false,"Trocar de ramo não deve renovar o limite FREE");
console.log("PASS: FREE 1 cadastro por função no conjunto dos ramos extras; modelos gratuitos não consomem a quota.");
