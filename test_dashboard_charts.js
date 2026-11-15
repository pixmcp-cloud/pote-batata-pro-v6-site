const assert=require("node:assert/strict");
global.window={};
require("./dashboard_charts.js");
assert.equal(typeof window.POTE_CHARTS.render,"function");
const empty=window.POTE_CHARTS.render({orders:[]});
assert(empty.includes("Faturamento diário"));
assert(empty.includes("Sabores mais vendidos"));
assert(empty.includes("Faturamento × contribuição"));
assert(empty.includes("DADOS REAIS"));
assert(empty.includes("Sem sabores vendidos ainda"));
assert(!empty.includes("2846"));
const today=new Date();
const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
const html=window.POTE_CHARTS.render({orders:[
{id:"1",date,name:"Carne com cheddar",qty:2,price:30,profit:12,status:"entregue"},
{id:"2",date,name:"Pizza",qty:1,price:25,profit:7,status:"recebido"},
{id:"3",date,name:"CANCELADO",qty:20,price:9999,profit:1000,status:"cancelado"}
]});
assert(html.includes("R$ 85,00")||html.includes("R$ 85,00"));
assert(html.includes("Carne com cheddar"));
assert(!html.includes("CANCELADO"));
assert(html.includes("3</strong>"));
assert(html.includes("Faturamento diário"));
console.log("PASS: 3 gráficos de dados reais, zerados e isolamento de pedidos cancelados.");
