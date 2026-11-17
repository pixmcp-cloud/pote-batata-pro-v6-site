const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=x=>fs.readFileSync(x,"utf8");
const elements=new Map(),notices=[];
function el(id){
 if(!elements.has(id))elements.set(id,{id,value:"",innerHTML:"",textContent:"",hidden:false,
 dataset:{},disabled:false,classList:{add(){},remove(){}},focus(){},scrollIntoView(){},
 addEventListener(){},querySelector(){return {hidden:false}},getAttribute(){return null}});
 return elements.get(id);
}
const document={
 getElementById(id){return id==="poteStockUpdate"&&!elements.has(id)?null:el(id)},
 createElement(){return {id:"",hidden:true,innerHTML:"",querySelector(){return {hidden:false}},
  addEventListener(){}}},
 body:{appendChild(node){elements.set(node.id,node)}},
 querySelectorAll(sel){if(sel===".stock-update-purchase")return [el("purchaseA"),el("purchaseB")];
 if(sel===".stock-update-adjust")return [el("adjustA")];return []},
 querySelector(){return null}
};
const batata={id:"batata",name:"Batata",category:"Base",measureUnit:"g",stock:0,
 purchasePrice:0,purchaseQuantity:1,purchaseUnit:"kg",yield:100,minimum:500};
const pote={id:"pote",name:"Pote 500 g",category:"Embalagem",measureUnit:"un",stock:2,
 purchasePrice:20,purchaseQuantity:10,purchaseUnit:"un",yield:100,minimum:0};
const bebida={id:"cola",name:"Refrigerante Cola",size:"600 ml",measureUnit:"un",stock:0,minimum:5};
const data={ingredients:[batata,pote],beverages:[bebida],orders:[],purchases:[],stockMovements:[],settings:{}};
const state={data,tab:"ingredients"};
const window={POTE_AUTH:{uid:"test-user"},confirm(){return true}};
let pers=0,renders=0,nid=0;
const ctx={window,document,state,console,JSON,Number,String,Math,Date,Map,Array,Set,Intl,
 uid(){return "movement-"+(++nid)},persist(){pers++},render(){renders++},toast(x){notices.push(x)},
 alert(x){notices.push(x)},setTimeout(){},CSS:{escape:x=>String(x)},SEED:{ingredients:[{
 id:"seedfork",name:"Garfo original",stock:123,measureUnit:"un",category:"Embalagem",
 purchasePrice:5,purchaseQuantity:10,purchaseUnit:"un",yield:100}]}
};
vm.createContext(ctx);
for(const f of ["stock_math.js","stock_status.js","stock_update_modal.js"])
 vm.runInContext(source(f),ctx,{filename:f});
const S=window.POTE_STOCK,U=window.POTE_STOCK_UPDATE;
assert(S&&U);
U.open("ingredient","pote","purchase");
assert.equal(el("stockUpdateTitle").textContent,"Atualização de estoque");
assert(el("stockUpdateSnapshot").innerHTML.includes("Reservado"));
el("stockUpdateQty").value="2";el("stockUpdatePackage").value="12";
el("stockUpdatePaid").value="96,00";el("stockUpdateSupplier").value="Distribuidor Teste";
U.update();let calculation=U.calc();
assert.equal(calculation.quantity,24);
assert.equal(calculation.after,26);
assert.equal(calculation.paid,96);
assert.equal(U.save(),true);
assert.equal(pote.stock,26);
assert.equal(pote.purchasePrice,96);
assert.equal(pote.purchaseQuantity,24);
assert.equal(data.purchases.length,1);
assert.equal(data.purchases[0].packagesPurchased,2);
assert.equal(data.purchases[0].packageContent,12);
assert.equal(data.purchases[0].totalPaid,96);
U.open("ingredient","batata","purchase");
el("stockUpdateQty").value="2";el("stockUpdatePackage").value="10";
el("stockUpdatePaid").value="180,00";U.update();
assert.equal(U.calc().baseAmount,20000);
assert.equal(U.save(),true);
assert.equal(batata.stock,20000,"2 caixas de 10 kg = 20 mil gramas");
assert.equal(S.formatStock(batata),"20 kg");
assert.equal(data.purchases.at(0).enteredQuantity,20);
U.open("ingredient","batata","adjust");
el("stockUpdateQty").value="0";el("stockUpdatePackage").value="1";U.update();
assert.equal(U.calc().valid,true,"Conferência aceita saldo zero");
assert.equal(U.save(),true);
assert.equal(batata.stock,0);
assert.equal(data.purchases.length,2,"Conferência não gera compra");
assert(data.stockMovements.some(m=>m.quantity===-20000));
U.open("beverage","cola","purchase");
el("stockUpdateQty").value="3";el("stockUpdatePackage").value="10";
el("stockUpdatePaid").value="240,00";U.update();
assert.equal(U.calc().quantity,30);
assert.equal(U.save(),true);
assert.equal(bebida.stock,30);
assert.equal(bebida.purchasePrice,240);
assert.equal(data.purchases.at(0).itemKind,"beverage");
batata.stock="20.000,50";
U.open("ingredient","batata","purchase");
el("stockUpdateQty").value="1,25";el("stockUpdatePaid").value="16,90";
assert.equal(U.calc().after,21250.5);
assert.equal(U.save(),true);
assert.equal(batata.stock,21250.5);
batata.stock=1234;
U.open("ingredient","batata","adjust");
assert.equal(el("stockUpdateQty").value,"1,234");
assert.equal(U.calc().after,1234,"Salvar o campo preenchido não altera o saldo por um fator de mil");
batata.stock="saldo inválido";
U.open("ingredient","batata","adjust");
assert.equal(el("stockUpdateQty").value,"");
assert.equal(U.save(),false,"A conferência requer uma contagem informada quando o saldo é inválido");
el("stockUpdateQty").value="2";
assert.equal(U.save(),true);
assert.equal(batata.stock,2000);
assert.equal(data.stockMovements.at(0).previousStock,null);
U.open("ingredient","seedfork","purchase");
assert(el("stockUpdateSnapshot").textContent.includes("não está no estoque"));
assert.equal(U.recover("seedfork"),true);
const restored=data.ingredients.find(x=>x.id==="seedfork");
assert(restored&&restored.stock===0,"Cadastro original recuperado com saldo ZERO");
U.open("ingredient","missing-abc","purchase");
assert(el("stockUpdateError").innerHTML.includes("Cadastro indisponível"));
assert.equal(data.ingredients.some(i=>i.id==="missing-abc"),false,"Não inventar cadastro");
assert(pers>=4&&renders>=4);
const pub=source("public/index.html");
for(const script of ["stock_update_modal.js?v=v4-stock-balance-20261117",
 "stock_math.js?v=v4-stock-balance-20261117"])
 assert(pub.includes(script),"Script ausente: "+script);
console.log("PASS: compra por dúzia/atacado 10 kg, valor pago, saldo físico, bebida, conferência zero e recuperação sem estoque fictício.");
