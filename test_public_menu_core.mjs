import assert from "node:assert/strict";
import {slugify,validSlug,cents,publicImage,buildMenuCandidates,makePublicMenu,sanitizeReadMenu,menuHeroSequence,groupDrinkProducts} from "./public_menu_core.mjs";
assert.equal(slugify("Potê Batata Pro!"),"pote-batata-pro");
assert.equal(validSlug("pote-batata-a1020"),true);
for(const slug of ["", "xx", "Pote Batata", "../../foo", "loja@"," aaaa","áaaa"])assert.equal(validSlug(slug),false);
assert.equal(cents(38.50),3850);
assert.equal(cents(-1),0);assert.equal(cents("abc"),0);
assert.equal(publicImage("data:image/png;base64,Zm9v"),"../assets/generic/business-batataria.svg");
const state={data:{
 businessType:"batataria",
 brand:{name:"Potê Batata",subtitle:"Batataria premium",bank:"123",accessToken:"dont-share"},
 recipes:[
  {id:"r01",name:"Carne com cheddar",category:"Salgados",tagline:"Recheada",price:38.5,photoUrl:"https://storage.example.test/image.jpg?token=PRIVATE_TOKEN",ingredients:[{name:"segredo"}],purchasePrice:19,clients:[{phone:"123"}]},
  {id:"r02",name:"Sem estoque",unavailable:true,price:30},
  {id:"r03",name:"Franquia bloqueada",franchiseLocked:true,price:30},
  {id:"r04",name:"Sem preço",price:0}
 ],
 beverages:[{id:"agua",name:"Água 500ml",size:"500ml",sellPrice:4,purchasePrice:1.5,stock:100}],
 orders:[{id:"pedido1",client:"Sigiloso",phone:"1111"}],
 ingredients:[{id:"insumo1",cost:90}],
 clients:[{name:"Cliente Sigiloso",phone:"1111"}]
}};
const priceFor=r=>r.price;
const list=buildMenuCandidates(state,{priceFor});
assert.deepEqual(list.map(x=>x.id),["r01","bev-agua"]);
assert.equal(list[0].priceCents,3850);
assert.equal(list[0].image,"../assets/generic/business-batataria.svg","foto privada deve ser descartada");
assert.equal(list[1].priceCents,400);
const doc=makePublicMenu(state,{ownerUid:"uid-owner",slug:"pote-batata-a1020",selectedIds:["r01","bev-agua"],priceFor});
assert.equal(doc.published,true);
assert.equal(doc.items.length,2);
for(const forbidden of ["accessToken","purchasePrice","orders","clients","stock","ingredients","segredo","Sigiloso","bank"])assert.equal(JSON.stringify(doc).includes(forbidden),false,"Não compartilhar "+forbidden);
assert.deepEqual(Object.keys(doc).sort(),["businessType","color","items","ownerUid","published","schemaVersion","slug","subtitle","title"].sort());
assert.deepEqual(sanitizeReadMenu({...doc,items:[{...doc.items[0],priceCents:3850}]},doc.slug).items.map(x=>x.id),["r01"]);
assert.equal(sanitizeReadMenu({...doc,published:false},doc.slug),null);
assert.equal(sanitizeReadMenu({...doc,slug:"outra-loja-a1234"},doc.slug),null);
assert.throws(()=>makePublicMenu(state,{ownerUid:"uid-owner",slug:"pote-batata-a1020",selectedIds:[],priceFor}),/Selecione/);
assert.throws(()=>makePublicMenu(state,{ownerUid:"uid-owner",slug:"pote-batata-a1020",selectedIds:["r01"],priceFor,previous:{ownerUid:"outro"}}),/pertence/);
console.log("PASS: menu comercial isolado dos dados privados, preço, slugs e publicação explícita");

const withOfficial=buildMenuCandidates(state,{priceFor,imageFor:r=>r.id==="r01"?"./assets/recipes/r05.webp":null});
assert.equal(withOfficial[0].image,"../assets/recipes/r05.webp");
const withPrivate=buildMenuCandidates(state,{priceFor,imageFor:()=>"https://example.test/private?token=SECRET"});
assert.equal(withPrivate[0].image,"../assets/generic/business-batataria.svg");
assert.equal(buildMenuCandidates(state,{priceFor})[0].image,"../assets/generic/business-batataria.svg");

const menuWithPhoto=makePublicMenu(state,{ownerUid:"uid-owner",slug:"pote-batata-a1020",selectedIds:["r01"],priceFor,imageFor:()=>"./assets/recipes/r05.webp"});
assert.equal(sanitizeReadMenu(menuWithPhoto,menuWithPhoto.slug).items[0].image,"../assets/recipes/r05.webp","caminho publicado deve sobreviver à leitura pública");
assert.equal(publicImage("../../assets/recipes/r05.webp"),"../assets/generic/business-batataria.svg");

const withIngredients=structuredClone(state);withIngredients.data.ingredients=[{id:"a",name:"Batata",cost:5,stock:100},{id:"b",name:"Muçarela",cost:99},{id:"c",name:"Pote",category:"Embalagem"}];withIngredients.data.recipes[0].items=[{id:"a",g:500},{id:"b",g:40},{id:"a",g:5},{id:"c",g:1},{id:"unknown",g:7}];
const options={slug:"loja-teste",ownerUid:"uid-owner",selectedIds:["r01"],priceFor};
assert(!("ingredientNames" in makePublicMenu(withIngredients,options).items[0]));
const approved=makePublicMenu(withIngredients,{...options,includeIngredientNames:true});
assert.deepEqual(approved.items[0].ingredientNames,["Batata","Muçarela"]);
assert.deepEqual(sanitizeReadMenu(approved,approved.slug).items[0].ingredientNames,["Batata","Muçarela"]);
assert(!JSON.stringify(approved.items[0].ingredientNames).includes("500"));
assert.deepEqual(sanitizeReadMenu({...approved,items:[{...approved.items[0],ingredientNames:[{name:"privado"}, "Batata", "Batata"]}]},approved.slug).items[0].ingredientNames,["Batata"]);
console.log("PASS: nomes de ingredientes somente por opção explícita, sem quantidades, embalagem ou custos");

const comboState=structuredClone(state);comboState.data.combos=[{id:"combo-pdv",name:"Combo operacional"}];comboState.data.recipes.push({id:"combo-old",name:"Combo antigo",category:"Combos",price:40});
assert(!buildMenuCandidates(comboState,{priceFor}).some(x=>x.id==="combo-old"||x.id==="combo-pdv"));
assert.deepEqual(sanitizeReadMenu({...doc,items:[...doc.items,{...doc.items[0],id:"combo-old",category:"Combos"}]},doc.slug).items.map(x=>x.id),["r01","bev-agua"]);
assert.equal(comboState.data.combos.length,1);
console.log("PASS: combos fora do cardápio público, dados operacionais preservados");

const drinkState=structuredClone(state);drinkState.data.beverages=[{id:"lata",name:"Refrigerante",size:"350 ml",sellPrice:7,flavors:["Cola","Guaraná","Laranja"]}];const drink=makePublicMenu(drinkState,{slug:"loja-bebidas",ownerUid:"uid-owner",selectedIds:["bev-lata"],priceFor});assert.deepEqual(sanitizeReadMenu(drink,drink.slug).items[0].flavors,["Cola","Guaraná","Laranja"]);assert.equal(sanitizeReadMenu(drink,drink.slug).items[0].size,"350 ml");

// Two tenants with same recipe ids, different approved photos; never inherit Potê assets.
const ownA=structuredClone(state),ownB=structuredClone(state);
ownA.data.brand.name="Pizzaria A";ownB.data.brand.name="Hamburgueria B";
ownA.data.recipes[0].imageUrl="./assets/recipes/r05.webp";ownA.data.recipes[0].photoUrl="https://private.test/?token=SECRET";
const pa="data:image/webp;base64,UklGRg==",pb="data:image/webp;base64,V0VCUA==";
const oa=makePublicMenu(ownA,{...options,slug:"pizzaria-a",publishedPhotos:new Map([["r01",pa]])});
const ob=makePublicMenu(ownB,{...options,slug:"hamburgueria-b",publishedPhotos:new Map([["r01",pb]])});
assert.deepEqual(menuHeroSequence(sanitizeReadMenu(oa,oa.slug).items).map(x=>x?.image??null),[null,pa]);
assert.deepEqual(menuHeroSequence(sanitizeReadMenu(ob,ob.slug).items).map(x=>x?.image??null),[null,pb]);
assert.equal(menuHeroSequence(buildMenuCandidates(ownA,{priceFor})).length,0);
assert.equal(menuHeroSequence([{image:"../assets/recipes/r05.webp",category:"Salgados"}]).length,0);
assert.equal(menuHeroSequence([{image:"../assets/recipes/r05.webp",category:"Salgados"}],{demo:true}).length,2);
assert(!JSON.stringify(oa).includes("SECRET"));assert.equal(publicImage("data:image/webp;base64,"+"A".repeat(12001)),"../assets/generic/business-batataria.svg");
console.log("PASS: carrossel por loja, fotos próprias e nenhum vazamento de fotos Potê");

const sodaStore=structuredClone(state);sodaStore.data.beverages=[{id:"a",name:"Refrigerante Cola",size:"600 ml",sellPrice:9,stock:3},{id:"b",name:"Refrigerante Cola Zero Açúcar",size:"600 ml",sellPrice:10,stock:2},{id:"c",name:"Refrigerante Soda",size:"600 ml",sellPrice:9,stock:0}];const sodaDoc=makePublicMenu(sodaStore,{...options,selectedIds:["bev-a","bev-b","bev-c"]});const sg=groupDrinkProducts(sanitizeReadMenu(sodaDoc,sodaDoc.slug).items)[0];assert.deepEqual(sg.flavors,["Cola","Guaraná","Laranja","Soda"]);assert.deepEqual(sg.drinkVariants.map(v=>[v.type,v.available,v.priceCents]),[["Normal",true,900],["Zero",true,1000],["Normal",false,900]]);assert(!JSON.stringify(sodaDoc).includes("stock"));

const unavailableCheap=groupDrinkProducts([{id:"x",title:"Refrigerante Cola",category:"Bebidas",size:"600 ml",priceCents:700,available:false},{id:"y",title:"Refrigerante Cola Zero",category:"Bebidas",size:"600 ml",priceCents:1000,available:true}]);assert.equal(unavailableCheap[0].priceCents,1000);

const waters=groupDrinkProducts([{id:"sem",title:"Água Mineral sem gás",category:"Bebidas",size:"500ml",available:true,priceCents:400},{id:"com",title:"Água Mineral com gás",category:"Bebidas",size:"Garrafa 500 ml",available:false,priceCents:500}]);assert.equal(waters.length,1);assert.deepEqual(waters[0].waterVariants.map(v=>[v.type,v.available,v.priceCents]),[["Sem gás",true,400],["Com gás",false,500]]);

const {publicWhatsapp}=await import("./public_menu_core.mjs");assert.equal(publicWhatsapp("(48) 99995-1729"),"5548999951729");assert.equal(publicWhatsapp("123"),"");assert.equal(publicWhatsapp("https://example.com/5548999951729"),"");const contact=makePublicMenu(state,{...options,whatsapp:"(48) 99995-1729"});assert.equal(sanitizeReadMenu(contact,contact.slug).whatsapp,"5548999951729");assert(!("whatsapp" in makePublicMenu(state,options)));

const deliveryState={...state,data:{...state.data,settings:{deliveryCity:"Sombrio",deliveryUF:"SC",deliveryPolicy:{enabled:true,mode:"fixed",maxDistanceMeters:null,neighborhoods:[{enabled:true}]}}}};const deliveryDoc=makePublicMenu(deliveryState,{...options,checkoutSiteKey:"sitekey_12345"});assert.equal(deliveryDoc.deliveryEnabled,true);assert.equal(sanitizeReadMenu(deliveryDoc,deliveryDoc.slug).deliveryEnabled,true);assert(!JSON.stringify(deliveryDoc).includes("Sombrio"));assert.equal(makePublicMenu(deliveryState,options).deliveryEnabled,undefined);
