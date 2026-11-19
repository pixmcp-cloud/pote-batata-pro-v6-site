const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const raw=fs.readFileSync("source/pote_app_base.html","utf8"),built=fs.readFileSync("public/index.html","utf8");
const start=raw.indexOf("function publicOrderCode(order){"),stop=raw.indexOf("\nfunction updateOrderSuggestedPrice()",start);
assert(start>=0&&stop>start);
assert(built.includes("Já está na fila de preparo 🙌🏻"));
function send(o){
 const opened=[],ctx={state:{data:{orders:[o],brand:{name:"POTÊ BATATA",instagram:"@potebatata"}}},
 window:{open:(url,target,flags)=>opened.push({url,target,flags})},confirm:()=>true,
 money:n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),num:n=>Number(n)||0};
 vm.createContext(ctx);vm.runInContext(raw.slice(start,stop),ctx);
 ctx.notifyOrderWhatsApp(o.id);
 assert.equal(opened.length,1);assert.equal(opened[0].target,"_blank");
 const url=new URL(opened[0].url);assert.equal(url.hostname,"wa.me");
 return {text:url.searchParams.get("text"),url};
}
const order={id:"gyhevkxr",status:"recebido",qty:1,name:"Carne Seca & Requeijão",price:38.5,clientName:"Cliente",clientPhone:"48999999999"};
assert.equal(send(order).text,"Olá Cliente! Recebemos o seu pedido N° *#GYHEVKXR*\n\n✅ 1x Carne Seca & Requeijão\n\nJá está na fila de preparo 🙌🏻\nO total ficou *R$ 38,50*");
assert.equal(send({...order,clientName:"Maria",qty:2,price:20,deliveryFee:5}).text,
 "Olá Maria! Recebemos o seu pedido N° *#GYHEVKXR*\n\n✅ 2x Carne Seca & Requeijão\n\nJá está na fila de preparo 🙌🏻\nO total ficou *R$ 45,00*");
assert.match(send({...order,status:"entregue"}).text,/foi \*entregue\*!/);
assert.match(send({...order,status:"em_producao"}).text,/em produção/);
assert(!send(order).text.includes("�"));assert(!send(order).text.includes("🥔"));
assert(send({...order,orderNumber:1}).text.includes("N° *#P0000001*"));
console.log("PASS: received WhatsApp has requested line breaks, bold total, UTF-8, total with delivery and existing statuses.");
