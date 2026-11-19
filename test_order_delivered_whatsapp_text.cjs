const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("source/pote_app_base.html","utf8");
const built=fs.readFileSync("public/index.html","utf8");
const begin=source.indexOf("function notifyOrderWhatsApp(id){");
const finish=source.indexOf("\nfunction updateOrderSuggestedPrice()",begin);
assert(begin>=0&&finish>begin,"Missing real WhatsApp handler");
const functionSource=source.slice(begin,finish);
assert(built.includes("Se curtir, marca a gente no Instagram"),"Built page lacks merchant-approved delivery copy");
function generate(order,brand={name:"POTÊ BATATA",instagram:"@potebatata"}){
 const captures=[],requests=[];
 const window={open:(url,where,features)=>captures.push({url,where,features})};
 const ctx={state:{data:{orders:[order],brand}},window,
  money:v=>"R$ "+Number(v).toFixed(2),num:v=>Number(v)||0,
  confirm:question=>{requests.push(question);return true}};
 vm.createContext(ctx);
 vm.runInContext(functionSource,ctx);
 ctx.notifyOrderWhatsApp(order.id);
 assert.equal(captures.length,1);
 assert.equal(captures[0].where,"_blank");
 assert.match(captures[0].features,/noopener/);
 assert.equal(requests.length,1);
 const url=new URL(captures[0].url);
 assert.equal(url.host,"wa.me");
 return {text:url.searchParams.get("text"),to:url.pathname};
}
const base={id:"8wqxcnto",status:"entregue",qty:1,price:21.9,
 name:"Frango Cremoso",clientName:"Cliente",clientPhone:"48999999999"};
const exact="Olá Cliente! Seu pedido *#8WQXCNTO* foi *entregue*! Muito obrigado pela preferência na *POTÊ BATATA*. Se curtir, marca a gente no Instagram @potebatata! 😍";
const delivered=generate(base);
assert.equal(delivered.text,exact,"WhatsApp message must match approved copy exactly");
assert.equal(delivered.to,"/5548999999999","Phone country prefix and digits retained");
assert(!/você é a prioridade|tira aquela foto|foto top|💛🥔|🙌/.test(delivered.text));
assert.equal(generate({...base,clientName:"Maria",id:"abcdef12",clientPhone:"5548999999999"},
 {name:"Café da Praça",instagram:"@cafedapraca"}).text,
 "Olá Maria! Seu pedido *#ABCDEF12* foi *entregue*! Muito obrigado pela preferência na *Café da Praça*. Se curtir, marca a gente no Instagram @cafedapraca! 😍",
 "Other tenants need their own brand");
assert.equal(generate({...base,clientName:"",clientPhone:""},
 {name:"Meu Negócio",instagram:""}).text,
 "Olá Cliente! Seu pedido *#8WQXCNTO* foi *entregue*! Muito obrigado pela preferência na *Meu Negócio*. 😍",
 "No Instagram: no malformed CTA or doubled whitespace");
assert.match(generate({...base,status:"recebido"}).text,/Recebemos o seu pedido/);
assert.match(generate({...base,status:"em_producao"}).text,/em produção/);
console.log("PASS delivered WhatsApp exact text, Markdown, emoji, order ID, contact, tenant, empty Instagram and other statuses.");
