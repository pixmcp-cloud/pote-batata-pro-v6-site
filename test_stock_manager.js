const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const elements=new Map();
const document={
 getElementById(id){return elements.get(id)||null},
 querySelectorAll(){return []}
};
let renderCount=0,persistCount=0,lastToast="",lastAlert="";
const ctx={window:{POTE_AUTH:{role:"admin",franchiseActive:false}},document,JSON,Math,Number,
 String,Array,Map,Set,Date,console,
 state:{data:{ingredients:[],purchases:[],stockMovements:[]}},
 field:(label,id,value)=>'<label>'+label+'<input id="'+id+'" value="'+(value||'')+'"></label>',
 select:(label,id)=>'<select id="'+id+'"></select>',
 render(){renderCount++},persist(){persistCount++},toast(x){lastToast=x},
 uid(){return "test-id-"+Math.random().toString(36).slice(2)},
 alert(x){lastAlert=x},
 prompt(){return null}
};
vm.createContext(ctx);
vm.runInContext(read("stock_math.js"),ctx);
vm.runInContext(read("stock_ui.js"),ctx);
const S=ctx.window.POTE_STOCK,UI=ctx.window.POTE_STOCK_UI;
assert.equal(S.number("1.234,50"),1234.5);
assert.equal(S.number("1.234"),1234);
assert.equal(S.number("0,90"),0.9);
assert(Number.isNaN(S.number("")));
assert.equal(S.formatStock({measureUnit:"g",stock:3000}),"3 kg");
assert.equal(S.formatStock({measureUnit:"g",stock:23000}),"23 kg");
assert.equal(S.formatStock({measureUnit:"ml",stock:1500}),"1,5 L");
assert.equal(S.formatStock({measureUnit:"un",stock:2}),"2 un");
const ing={id:"batata-doce",name:"Batata doce",category:"Base",measureUnit:"g",
 purchasePrice:90,purchaseQuantity:25,purchaseUnit:"kg",yield:90,stock:3000,
 minimum:500,source:"Preço de referência"};
ctx.state.data.ingredients.push(ing);
let panel=UI.renderPanel(ctx.state,ctx.state.data.ingredients);
assert(panel.toLowerCase().includes("estoque atual"));
assert(panel.includes("3 kg"));
assert(/R\$\s*90,00/.test(panel),"Preço de referência R$90 deve ser separado do saldo");
assert(panel.includes("25 kg (embalagem, não estoque)"),"A quantidade da embalagem não pode se confundir com estoque");
assert(panel.includes("90%"),"Rendimento deve ter identificação própria");
for(const phrase of ["Valor TOTAL pago","Quantidade recebida","Últimas compras","Conferir / ajustar saldo"])
 assert(panel.includes(phrase),"Área de estoque deve esclarecer "+phrase);
assert(read("stock_ui.js").includes("Saldo depois:"),"O saldo previsto deve aparecer na prévia da compra");
const items=ctx.state.data;
const beforePurchases=items.purchases.length;
const result=S.purchase({ingredient:ing,quantity:"20",unit:"kg",paidTotal:"180,00",
 supplier:"Fornecedor Local",purchases:items.purchases,movements:items.stockMovements,
 makeId:()=>String(++renderCount)});
assert.equal(result.previous,3000);
assert.equal(result.added,20000);
assert.equal(result.next,23000);
assert.equal(ing.stock,23000);
assert.equal(ing.purchaseQuantity,20);
assert.equal(ing.purchasePrice,180);
assert.equal(ing.purchaseUnit,"kg");
assert.equal(items.purchases.length,beforePurchases+1);
assert.equal(items.purchases[0].totalPaid,180);
assert.equal(items.purchases[0].previousStock,3000);
assert.equal(items.purchases[0].afterStock,23000);
assert.equal(items.stockMovements[0].quantity,20000);
assert.equal(S.formatStock(ing),"23 kg");
assert.equal(ing.purchasePrice/(ing.purchaseQuantity*1000),0.009);
panel=UI.renderPanel(ctx.state,ctx.state.data.ingredients);
assert(panel.includes("23 kg"),"Novo estoque aparece após a compra");
assert(panel.includes("180,00"),"Total pago aparece no histórico");
const stockBefore=ing.stock;
assert.throws(()=>S.purchase({ingredient:ing,quantity:"2",unit:"L",paidTotal:"20",
 purchases:items.purchases,movements:items.stockMovements,makeId:()=>String(Math.random())}),/Unidade incompatível/);
assert.throws(()=>S.purchase({ingredient:ing,quantity:"0",unit:"kg",paidTotal:"20",
 purchases:items.purchases,movements:items.stockMovements,makeId:()=>String(Math.random())}),/maior que zero/);
assert.throws(()=>S.purchase({ingredient:ing,quantity:"20",unit:"kg",paidTotal:"",
 purchases:items.purchases,movements:items.stockMovements,makeId:()=>String(Math.random())}),/valor total/);
assert.equal(ing.stock,stockBefore,"Compra inválida jamais altera estoque");
const adjustment=S.adjust({ingredient:ing,quantity:"22",unit:"kg",reason:"contagem",
 movements:items.stockMovements,makeId:()=>String(++renderCount)});
assert.equal(ing.stock,22000);
assert.equal(adjustment.delta,-1000);
assert.equal(items.purchases.length,1,"Ajuste manual não deve ser registrado como compra");
assert.equal(items.stockMovements[0].quantity,-1000);
assert.equal(items.stockMovements[0].reason,"Ajuste manual: contagem");
const legacyCost={...ing,stock:25000,purchasePrice:90,purchaseQuantity:25,purchaseUnit:"kg",source:"Simulação varejo, alterar"};
assert(UI.costUnit(legacyCost).includes("25 kg"));
assert(UI.costUnit(legacyCost).includes("embalagem, não estoque"));
const state=ctx.state;
ctx.window.POTE_AUTH.franchiseActive=true;
state.data.ingredients.push({id:"fr-batata",name:"Batata oficial",measureUnit:"g",stock:5000,
 templateOrigin:"franchise",purchasePrice:40,purchaseQuantity:5,purchaseUnit:"kg"});
state.data.ingredients.push({id:"legacy-batata",name:"Batata modelo",measureUnit:"g",stock:0,
 templateOrigin:"batataria",purchasePrice:90,purchaseQuantity:25,purchaseUnit:"kg"});
panel=UI.renderPanel(state,state.data.ingredients);
assert(panel.includes("Batata oficial"),"Estoque oficial da franquia aparece");
assert(!panel.includes("Batata modelo"),"Insumos de demonstração da batataria não devem invadir a franquia");
const built=read("public/index.html");
assert(built.includes('stock_math.js?v=v3-wave1-20261116'));
assert(built.includes('stock_ui.js?v=kitchen-motoboy-20261116'));
assert(built.includes('stock_ui.css?v=stock-clear-20261115'));
assert(!built.includes("PRO • ACESSO SIMULADO"),"Não pode chamar assinatura real de simulada");
assert(built.includes("FRANQUIA • OFICIAL"));
assert(built.includes("PRO • LICENÇA ATIVA"));
assert(!built.includes("function registerPurchase(id){if(!pro())"),"Prompt antigo não pode continuar");
assert(built.includes('POTE_STOCK_UI?.renderPanel(state,data)'));
assert(built.includes('POTE_STOCK_UI?.adjustStock(id)'));
const original=read("source/pote_app_base.html");
assert(original.includes("POTE_STOCK_UI?.renderPanel"));
const scripts=[...built.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(m=>!m[1].includes('application/json'));
assert(scripts.length>=1);
for(const script of scripts){new vm.Script(script[2],{filename:"generated-application.js"})}
console.log("PASS: estoque real, 3+20=23 kg, compra R$180, rendimento separado, histórico, auditoria, franquia e selo PRO real.");
