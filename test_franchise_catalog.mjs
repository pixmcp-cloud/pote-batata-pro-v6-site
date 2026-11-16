import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildFranchiseCatalog,catalogFingerprint,mergeFranchiseCatalog,franchiseActive,FRANCHISE_LOGO} from "./franchise_catalog.mjs";
const read=p=>readFileSync(p,"utf8");
const originalData=JSON.parse(read("source/pote_app_base.html").match(/<script id="backup" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const matrix={data:structuredClone(originalData)};
matrix.data.brand.logoUrl=FRANCHISE_LOGO;
const images={r01:"./assets/recipes/r01.webp",r02:"./assets/recipes/r02.webp"};
const catalog=buildFranchiseCatalog(matrix,images);
assert.equal(catalog.brandId,"potebatata");
assert.equal(catalog.recipes.length,26);
assert.equal(catalog.ingredients.length,41,"Somente insumos usados em receitas devem ser compartilhados");
assert.equal(catalog.ingredients.find(i=>i.id==="batata").yield,83,"A matriz publica o rendimento técnico do ingrediente");
assert.equal(catalog.branding.logoUrl,FRANCHISE_LOGO);
assert.equal(catalog.recipes[0].imageUrl,images.r01);
assert(catalog.recipes[0].items.length>0);
assert.equal(catalog.recipes[0].items[0].id,"batata");
assert(!("clients" in catalog)&&!("orders" in catalog)&&!("expenses" in catalog));
const str=JSON.stringify(catalog);
for(const k of ['"purchasePrice"','"stock"','"price"','"minimum"','"suppliers"','"clients"','"orders"','"audit"']){
 assert(!str.includes(k),"Informação privada incluída no catálogo: "+k);
}
assert.equal(franchiseActive({franchise:{brandId:"potebatata",status:"active"}}),true);
assert.equal(franchiseActive({franchise:{brandId:"potebatata",status:"revoked"}}),false);
assert.equal(franchiseActive({franchise:{brandId:"outro",status:"active"}}),false);
const fresh={data:{brand:{name:"Meu Negócio",logoUrl:"./assets/generic/business-neutral.svg",phone:"489999-0000"},
 businessType:"pizzaria",recipes:[],ingredients:[],clients:[{id:"c1",name:"Cliente privado"}],
 orders:[{id:"o1",amount:150}],expenses:[{id:"e1",amount:20}],businessTemplates:{}}};
const r1=mergeFranchiseCatalog(fresh,catalog);
assert.equal(r1.recipesAdded,26);
assert.equal(r1.ingredientsAdded,41);
assert.equal(fresh.data.recipes.length,26);
assert.equal(fresh.data.ingredients.length,41);
assert(fresh.data.ingredients.every(i=>i.price===0&&i.stock===0),"Franquia não herda estoque nem preços");
assert.equal(fresh.data.brand.name,"POTÊ BATATA");
assert.equal(fresh.data.brand.logoUrl,FRANCHISE_LOGO);
assert.equal(fresh.data.brand.phone,"489999-0000","Telefone próprio deve permanecer");
assert.equal(fresh.data.businessType,"batataria");
assert.equal(fresh.data.orders.length,1);
assert.equal(fresh.data.clients.length,1);
assert.equal(fresh.data.expenses.length,1);
const again=mergeFranchiseCatalog(fresh,catalog);
assert.equal(again.changed,false,"Não regravar catálogo idêntico");
assert.equal(fresh.data.recipes.length,26,"Não duplicar receitas");
assert.equal(fresh.data.ingredients.length,41,"Não duplicar insumos");
const originalCost=fresh.data.ingredients.find(i=>i.id==="fr-batata");
originalCost.stock=5300;originalCost.price=7.25;originalCost.purchasePrice=6.20;
const firstRecipe=fresh.data.recipes.find(r=>r.id==="fr-r01");
firstRecipe.targetGainPct=145;
const newer=structuredClone(catalog);
newer.recipes.push({id:"r27",name:"Novo sabor Matriz",category:"Especial",tagline:"Lançamento",
 difficulty:"Fácil",time:30,imageUrl:"./assets/recipes/r01.webp",featured:true,
 items:[{id:"batata",g:225}],steps:["Prepare com qualidade"]});
newer.ingredients.find(i=>i.id==="batata").name="Batata para preparo";
const r2=mergeFranchiseCatalog(fresh,newer);
assert.equal(r2.recipesAdded,1,"Novo sabor cadastrado pela matriz deve aparecer na franquia");
assert.equal(fresh.data.recipes.length,27);
assert.equal(fresh.data.recipes.find(r=>r.id==="fr-r27").name,"Novo sabor Matriz");
assert.equal(originalCost.stock,5300,"Estoque de unidade jamais pode ser substituído");
assert.equal(originalCost.price,7.25,"Custo de unidade jamais pode ser substituído");
assert.equal(firstRecipe.targetGainPct,145,"Margem da franquia jamais pode ser alterada");
assert.equal(fresh.data.clients.length,1);
assert.notEqual(catalogFingerprint(catalog),catalogFingerprint(newer));
const removed=structuredClone(newer);removed.recipes=removed.recipes.filter(r=>r.id!=="r01");
mergeFranchiseCatalog(fresh,removed);
assert.equal(firstRecipe.franchiseLocked,true,"Sabor retirado pela matriz deve deixar de ser oferecido");
assert.equal(fresh.data.orders.length,1,"Retirar sabor não pode apagar histórico de vendas");
const revoked=mergeFranchiseCatalog(fresh,removed,{active:false});
assert.equal(revoked.recipesLocked,27);
assert(fresh.data.recipes.every(r=>r.franchiseLocked),"Receitas oficiais devem ser bloqueadas após revogação");
assert.equal(fresh.data.brand.logoUrl,"./assets/generic/business-neutral.svg");
assert.equal(fresh.data.clients.length,1);
assert.equal(fresh.data.orders.length,1);
const adminUI=read("admin_console.js"),firebase=read("firebase_integration.js"),module=read("franchise_sync.js");
for(const marker of ["poteAdmFranchiseActivate","poteAdmFranchiseRevoke","changeFranchise","franchiseAudit",
  "brandId:\"potebatata\""]){assert(adminUI.includes(marker),"Controles ADM ausentes: "+marker)}
assert(adminUI.includes('batch.update(ref,{franchise,updatedAt:now})'));
assert(firebase.includes("rawUserFranchise"));
assert(firebase.includes("pote:franchise-updated"));
assert(firebase.includes('window.POTE_AUTH.plan = admin ? "admin" : franchise ? "franchise"'));
for(const marker of ["onSnapshot(catalogRef","buildFranchiseCatalog","mergeFranchiseCatalog",
 "pote:user-ready","pote:changed","setDoc(catalogRef"]){assert(module.includes(marker),marker)}
const rules=read("firestore.rules");
assert(rules.includes("match /franchiseCatalog/{catalogId}"));
assert(rules.includes("function isActivePoteFranchise()"));
assert(rules.includes("request.resource.data.publisherUid == request.auth.uid"));
assert(rules.includes("match /franchiseAudit/{eventId}"));
assert(rules.includes(".hasOnly(['displayName', 'photoURL', 'updatedAt'])"));
const src=read("source/pote_app_base.html");
assert(src.includes("window.POTE_AUTH?.franchiseActive"));
assert(src.includes("state.data.recipes.filter(r=>!r.franchiseLocked&&!(window.POTE_AUTH?.franchiseActive&&r.templateOrigin==='batataria'))"),"Uma franquia não deve exibir fichas genéricas duplicadas");
const business=read("business_setup.js");
assert(business.includes("window.POTE_AUTH?.franchiseActive"));
const html=read("public/index.html");
assert(html.includes('franchise_sync.js?v=estimate-60-20261116'));
assert(html.includes('adm-franchise-20261115'));
console.log("PASS: franquia com marca/fotos oficiais, novos sabores automáticos, custos e estoque exclusivos, revogação e auditoria ADM.");
