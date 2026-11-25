import assert from "node:assert/strict";
import {slugify,validSlug,cents,publicImage,buildMenuCandidates,makePublicMenu,sanitizeReadMenu} from "./public_menu_core.mjs";
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
