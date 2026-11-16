const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const els=new Map();const field=(id,value)=>els.set(id,{value});
let saves=0,renders=0,confirms=true,index=0;
const drink={id:"cola",name:"Refrigerante Cola",size:"Lata 350 ml",sellPrice:7,purchasePrice:7,purchaseQuantity:1,stock:11};
const state={data:{beverages:[drink],purchases:[{id:"original",totalPaid:7}],stockMovements:[],ingredients:[],orders:[]}};
const ctx={state,document:{getElementById:id=>els.get(id)||null},window:{
 POTE_STOCK:{number:v=>{let x=String(v??"").trim().replace(/\\./g,"").replace(",",".");return Number(x)}},
 POTE_STOCK_STATUS:{reserved:()=>({beverages:new Map([["cola",2]])}),classify:b=>({level:"good",label:"ESTOQUE BOM",available:b.stock-2,reservation:2})},
 confirm:()=>confirms
 },console,Math,Intl,Number,String,Array,Map,Date,Set,
 persist(){saves++},render(){renders++},toast(){},uid(){return "id"+ ++index}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync("stock_ext.js","utf8"),ctx);
const S=ctx.window.POTE_STOCK_EXT;assert(S);
let html=S.renderBeverages();
assert(html.includes("stock-margin-zero"),"Venda de R$7 e compra de R$7 precisam destacar margem zero");
assert(html.includes("MARGEM BRUTA ZERO"),"Alerta claro para margem zero");
assert(html.includes("ESTOQUE BOM"),"Saúde do estoque deve continuar independente");
assert(html.includes("Editar compra, venda e unidades"));
drink.sellPrice=6;
html=S.renderBeverages();assert(html.includes("stock-margin-loss")&&html.includes("PREJUÍZO BRUTO"));
drink.sellPrice=7;
field("bevEditPaid-cola","42,00");field("bevEditQty-cola","12");
field("bevEditSale-cola","9,00");field("bevEditStock-cola","15");
assert.equal(S.saveBeverageEdit("cola"),true);
assert.equal(drink.purchasePrice,42);assert.equal(drink.purchaseQuantity,12);
assert.equal(drink.sellPrice,9);assert.equal(drink.stock,15);
assert.equal(state.data.stockMovements[0].quantity,4,"Ajuste deve gerar movimentação, sem criar uma compra");
assert.equal(state.data.purchases.length,1,"Edição não pode criar compra falsa");
assert.equal(drink.priceAudit.length,1,"Histórico de valores deve ser preservado");
assert(S.renderBeverages().includes("stock-margin-profit"));
field("bevEditPaid-cola","42");field("bevEditQty-cola","12");
field("bevEditSale-cola","9");field("bevEditStock-cola","1");
confirms=false;assert.equal(S.saveBeverageEdit("cola"),false,"Não reduzir abaixo de reservas sem consentimento");
assert.equal(drink.stock,15);
assert(saves===1&&renders===1);
console.log("PASS: margem zero e prejuízo alertados, lucro bruto separado de estoque, edição de compra/venda/unidades, estorno auditável e histórico protegido.");
