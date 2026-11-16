const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const elements=new Map(),n=(id,value)=>elements.set(id,{value});
let persistCount=0,renderCount=0,index=0;
const state={data:{suppliers:[
 {id:"regional",osmId:"N:1",name:"Mercado GPS",city:"Gaivota"},
 {id:"old",name:"Fornecedor antigo",phone:"48 99995-1729",products:[],notes:"Preservar"}
]}};
const context={state,console,Intl,Math,Number,String,Date,Map,Set,
 document:{getElementById:id=>elements.get(id)||null},
 window:{confirm:()=>true,prompt:()=>null},pro:()=>true,
 pageSuppliers:()=>'<div class="box"><h2>Fornecedores</h2><div class="actions">GPS</div><h3>Adicionar manualmente</h3><p>Contatos salvos</p></div>',
 toast(){},persist(){persistCount++},render(){renderCount++},uid(){return String(++index)}};
vm.createContext(context);
vm.runInContext(fs.readFileSync("supplier_directory.js","utf8"),context);
const S=context.window.POTE_SUPPLIER_CONTACTS;
assert(S,"Módulo de contatos não carregou");
assert.equal(S.people().length,1,"Fornecedor pessoal existente deve ser preservado");
assert.equal(S.regional().length,1,"Cadastro GPS deve ficar separado");
assert(context.pageSuppliers().includes("Pesquisar Fornecedor"));
assert(context.pageSuppliers().includes("Meus Fornecedores"));
assert(context.pageSuppliers().includes('id="poteSupplierSearchSection"'));
assert.equal(S.contactNumber("(48) 99995-1729"),"5548999951729");
assert.equal(S.contactNumber("999951729"),"");
assert(S.waLink(S.people()[0]).includes("https://wa.me/5548999951729?text="));
n("poteSupNewName","João do Queijo");n("poteSupNewPhone","48 99999-1111");
n("poteSupNewCity","Sombrio");n("poteSupNewDelivery","Entregas nas terças");n("poteSupNewNotes","Pix");
assert.equal(S.addContact(),true);
const person=S.people().find(x=>x.name==="João do Queijo");
assert(person&&person.deliveryTerms==="Entregas nas terças");
n("poteSupProdName-"+person.id,"Queijo");n("poteSupProdQty-"+person.id,"5");
n("poteSupProdUnit-"+person.id,"kg");n("poteSupProdPrice-"+person.id,"125,00");
assert.equal(S.addProduct(person.id),true);
const price=S.pricePer(person.products[0]);
assert.equal(price.unit,"kg");assert.equal(price.rate,25);
n("poteSupProdName-old","Queijo");n("poteSupProdQty-old","500");
n("poteSupProdUnit-old","g");n("poteSupProdPrice-old","10");
assert.equal(S.addProduct("old"),true);
assert.equal(S.pricePer(S.people().find(s=>s.id==="old").products[0]).rate,20);
const cheapest=S.bestOffers().get("queijo|kg");
assert.equal(cheapest.contact.id,"old","G / kg devem ser comparáveis");
assert.equal(S.regional().length,1,"Produtos de pessoas não podem misturar estabelecimentos GPS");
assert(context.pageSuppliers().includes("Menor preço por produto"));
assert(context.pageSuppliers().includes("WhatsApp"));
assert(persistCount>=3&&renderCount>=3);
console.log("PASS: agenda pessoal e GPS independentes, contatos existentes preservados, WhatsApp, produtos, preço por unidade, comparação e persistência.");
