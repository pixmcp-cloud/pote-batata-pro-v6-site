import assert from "node:assert/strict";
class Stub{
 constructor(){this.listeners={};this.children=new Map();this.dataset={};this.classList={toggle:()=>{}};this.hidden=false;this.style={};this.attributes={};this.textContent="";this.innerHTML="";}
 addEventListener(event,fn){this.listeners[event]=fn}
 setAttribute(k,v){this.attributes[k]=v}
 focus(){}
 querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Stub());return this.children.get(selector)}
 appendChild(child){this.children.set(child.id||("auto-"+this.children.size),child)}
}
const body=new Stub(),events={},appData={recipes:[{
 id:"fr-1",templateOrigin:"franchise",items:[{id:"fr-batata",g:200}]
}],ingredients:[{id:"fr-batata",name:"Batata",stock:1000,measureUnit:"g",yield:100}],
 beverages:[{id:"b1",name:"Água",size:"500 ml",stock:10}],orders:[]};
globalThis.document={body,createElement:()=>new Stub()};
globalThis.window={POTE_APP_READY:true,POTE_AUTH:{franchiseActive:true},
 POTE_APP:{snapshot:()=>({data:structuredClone(appData)})},
 addEventListener:(event,fn)=>{events[event]??=[];events[event].push(fn)},
 go:()=>{globalThis.goCount++},POTE_STOCK_UI:{jumpToNeed:(id,kind)=>{globalThis.lastNeed={id,kind}}},
 POTE_STOCK_EXT:{}};
globalThis.goCount=0;
await import("./franchise_shopping_list.mjs");
const module=window.POTE_SHOPPING_LIST;
assert(module,"A lista deve ser registrada na conta");
const button=body.children.get("poteShoppingListButton"),dialog=body.children.get("poteShoppingListDialog");
assert(button&&!button.hidden,"A lista deve permanecer visível com estoque em dia");
assert(button.innerHTML.includes("Lista de Compras"));
assert.equal(button.querySelector("#poteShoppingListCount").textContent,0);
assert.equal(module.items().length,0);
appData.ingredients[0].stock=600;appData.beverages[0].stock=9;
for(const fn of events["pote:changed"])fn();
assert.equal(button.querySelector("#poteShoppingListCount").textContent,2);
button.listeners.click();
assert.equal(dialog.hidden,false);
const html=dialog.querySelector("#poteShoppingItems").innerHTML;
assert(html.includes("Batata")&&html.includes("Água"));
assert(html.includes("400 g")&&html.includes("1 un"),"A lista exibe quantidades para repor");
dialog.querySelector("#poteShoppingItems").listeners.click({
 target:{closest:()=>({dataset:{stockId:"fr-batata",stockKind:"ingredient"}})}
});
assert.equal(dialog.hidden,true);
assert.equal(goCount,1);
assert.deepEqual(lastNeed,{id:"fr-batata",kind:"ingredient"});
window.POTE_AUTH.franchiseActive=false;
for(const fn of events["pote:franchise-updated"])fn();
assert.equal(button.hidden,true,"Não mostrar dados de franquia fora da conta licenciada");
window.POTE_AUTH.franchiseActive=true;
for(const fn of events["pote:franchise-updated"])fn();
assert.equal(button.hidden,false);
console.log("PASS: botão de Lista de Compras sempre visível na franquia, modal, reposição, contagem e isolamento por licença.");
