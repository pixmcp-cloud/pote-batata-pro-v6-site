import assert from "node:assert/strict";
import {validateInventoryJournalDiff} from "./inventory_integrity.mjs";
const item=(group,id,stock,universe="batataria")=>({
 universe,group,id,rank:0,item:{id,name:id,stock}
});
const movement=(id,ingredientId,quantity,previousStock,afterStock,universe="batataria")=>({
 universe,group:"stockMovements",id,rank:0,
 item:{id,ingredientId,quantity,previousStock,afterStock,reason:"Produção",referenceId:"pedido-1"}
});
const ch=(before,after)=>({kind:"record",before,after,key:after?.id||before?.id});
const potato=item("ingredients","batata",1000);
const now=item("ingredients","batata",750);
const valid={changes:[
 ch(potato,now),
 ch(null,movement("m1","batata",-250,1000,750))
]};
assert.equal(validateInventoryJournalDiff(valid).checked,1);
assert.throws(()=>validateInventoryJournalDiff({changes:[ch(potato,now)]}),/sem movimentação/);
assert.throws(()=>validateInventoryJournalDiff({changes:[
 ch(potato,now),ch(null,movement("m1","batata",-200,1000,800))
]}),/sem movimentação/);
assert.throws(()=>validateInventoryJournalDiff({changes:[
 ch(potato,now),ch(null,movement("m1","batata",-250,1000,760))
]}),/saldos incompatíveis/);
assert.equal(validateInventoryJournalDiff({changes:[
 ch(potato,now),
 ch(null,movement("m1","batata",-100,1000,900)),
 ch(null,movement("m2","batata",-150,900,750))
]}).checked,1);
assert.equal(validateInventoryJournalDiff({changes:[
 ch(item("beverages","cola",10),item("beverages","cola",8)),
 ch(null,movement("drink1","bev:cola",-2,10,8))
]}).checked,1);
assert.throws(()=>validateInventoryJournalDiff({changes:[
 ch(item("beverages","cola",10),item("beverages","cola",8)),
 ch(null,movement("drink1","cola",-2,10,8))
]}),/sem movimentação/);
assert.throws(()=>validateInventoryJournalDiff({changes:[
 ch(potato,now),ch(null,movement("x","batata",-250,1000,750,"pizzaria"))
]}),/sem movimentação/);
assert.equal(validateInventoryJournalDiff({changes:[
 ch(item("ingredients","batata",100),item("ingredients","batata",900))
]}).checked,0,"Entradas/ajustes de saldo demonstrativo preservados");
console.log("PASS F02 preflight: baixa rastreada, saldo exato, bebida, múltiplos movimentos, isolamento de universo e bloqueio de falta de movimento.");
