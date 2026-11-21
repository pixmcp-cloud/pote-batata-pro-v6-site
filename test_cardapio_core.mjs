import assert from "node:assert/strict";
import { money,validProduct,itemUnitCents,makeLine,normalizeCart,addLine,cartTotals,demoSummary } from "./cardapio/cardapio-core.mjs";

const salgado={id:"p1",title:"Salgado",priceCents:3290,addons:[
  {id:"queijo",label:"Queijo",priceCents:490},
  {id:"bacon",label:"Bacon",priceCents:590}
]};
const bebida={id:"p2",title:"Bebida",priceCents:700,addons:[]};
assert.equal(validProduct(salgado),true);
assert.equal(validProduct({id:"x",title:"Erro",priceCents:-1,addons:[]}),false);
assert.equal(money(3290),"R$ 32,90");
assert.equal(itemUnitCents(salgado,["queijo","queijo","inexistente"]),3780,"adicional repetido não duplica cobrança");
const line=makeLine(salgado,2,["bacon","queijo","queijo"],"sem cebola");
assert.deepEqual(line.addonIds,["bacon","queijo"]);
assert.equal(line.quantity,2);
assert.equal(itemUnitCents(salgado,line.addonIds),4370);
let cart=addLine([],line,[salgado,bebida]);
cart=addLine(cart,makeLine(salgado,1,["queijo","bacon"],"sem cebola"),[salgado,bebida]);
assert.equal(cart.length,1,"mesma personalização combina linhas");
assert.equal(cart[0].quantity,3);
cart=addLine(cart,makeLine(bebida,1),[salgado,bebida]);
assert.deepEqual(cartTotals(cart,[salgado,bebida]),{count:4,subtotalCents:13810});
assert.deepEqual(normalizeCart([{id:"desconhecido",quantity:9},null], [salgado,bebida]),[]);
assert.equal(normalizeCart([{id:"p1",quantity:999}], [salgado])[0].quantity,99);
const summary=demoSummary({cart,products:[salgado,bebida],fulfillment:"entrega",payment:"pix",customerName:"Ana",customerPhone:"",address:"Rua A"});
assert.match(summary,/NÃO É UM PEDIDO REAL/);
assert.match(summary,/NÃO EFETUA VENDA/);
assert.match(summary,/Entrega \(taxa não calculada\)/);
assert.match(summary,/R\$ ?138,10/);
assert.ok(!summary.includes("PAGAMENTO APROVADO"));
console.log("OK: preços em centavos, carrinho, adicionais e prévia sem transação");
