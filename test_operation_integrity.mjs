import assert from "node:assert/strict";
import {recordId} from "./v2_store_core.mjs";
import {validateProductionJournalDiff,validateCancellationJournalDiff,validateCashJournalDiff} from "./operation_integrity.mjs";
const universe="batataria";
const rec=(group,id,item)=>({universe,group,id,rank:1,item:{id,...item}});
const change=(before,after)=>({kind:"record",key:recordId(universe,(after||before).group,(after||before).id),before,after});
const old=rec("orders","order-1",{status:"em_producao",stockRestored:false,
 qty:2,items:[{id:"batata",g:100,yieldPct:100}],
 beverageItems:[{id:"agua",qty:1}],stockDeducted:true,cashSessionId:"s1",
 price:50,paymentMethod:"Dinheiro",paymentStatus:"pago"});
const cancelled=rec("orders","order-1",{...old.item,status:"cancelado",stockRestored:true,cancelStockAction:"devolvido"});
const oldPotato=rec("ingredients","batata",{stock:500}),newPotato=rec("ingredients","batata",{stock:700});
const oldWater=rec("beverages","agua",{stock:10}),newWater=rec("beverages","agua",{stock:12});
const move=(id,ingredientId,quantity,reason)=>rec("stockMovements",id,{
 ingredientId,quantity,reason,referenceId:"order-1"});
const good={changes:[
 change(old,cancelled),change(oldPotato,newPotato),change(oldWater,newWater),
 change(null,move("m1","batata",200,"Estorno de estoque por cancelamento")),
 change(null,move("m2","bev:agua",2,"Estorno bebida por cancelamento"))
]};
assert.equal(validateCancellationJournalDiff(good).returns,1);
assert.throws(()=>validateCancellationJournalDiff({changes:good.changes.slice(0,-1)}),/incompleto/i);
assert.throws(()=>validateCancellationJournalDiff({changes:[
 ...good.changes.slice(0,2),change(oldWater,rec("beverages","agua",{stock:11})),...good.changes.slice(3)
]}),/reposição física/);
assert.throws(()=>validateCancellationJournalDiff({changes:[
 ...good.changes.slice(0,-1),change(null,move("m2","bev:agua",3,"Estorno bebida por cancelamento"))
]}),/incompleto/);
const lossOrder=rec("orders","order-1",{...old.item,status:"cancelado",stockReturnDeclined:true,lossEventId:"loss-1"});
assert.throws(()=>validateCancellationJournalDiff({changes:[change(old,lossOrder)]}),/evento de prejuízo/);
assert.equal(validateCancellationJournalDiff({changes:[change(old,lossOrder),
 change(null,rec("losses","loss-1",{type:"order",orderId:"order-1"}))]}).losses,1);

const unpaidCancelled=rec("orders","order-1",{...old.item,status:"cancelado"});
const before={meta:{},records:new Map([[recordId(universe,"orders","order-1"),unpaidCancelled]])};
const newRefund=rec("cashMovements","refund-1",{kind:"reembolso",orderId:"order-1",originSessionId:"s1",sessionId:"s2",
 amount:100,reason:"Devolução",at:"2026-11-18T10:00:00Z"});
const next={meta:{},records:new Map([...before.records,[recordId(universe,"cashMovements","refund-1"),newRefund]])};
const changes={changes:[change(null,newRefund)]};
assert.equal(validateCashJournalDiff(before,next,changes).checked,1);
assert.throws(()=>validateCashJournalDiff(before,next,{changes:[change(null,rec("cashMovements","refund-1",
 {...newRefund.item,amount:99}))]}),/Valor financeiro divergente/);
const dup=rec("cashMovements","refund-2",{...newRefund.item,id:"refund-2"});
const duplicate={...next,records:new Map([...next.records,[recordId(universe,"cashMovements","refund-2"),dup]])};
assert.throws(()=>validateCashJournalDiff(before,duplicate,{changes:[change(null,dup)]}),/duplicado/);
const late=rec("cashMovements","late-1",{kind:"late_payment",orderId:"order-1",originSessionId:"s1",
 sessionId:"s2",amount:100,paymentMethod:"pix",reference:"comprovante",at:"2026-11-18T10:00:00Z"});
const live=rec("orders","order-1",{...old.item,status:"recebido",paymentStatus:"nao_pago",paymentConfirmedAt:null});
const past={meta:{},records:new Map([[recordId(universe,"orders","order-1"),live]])};
const now={meta:{},records:new Map([...past.records,[recordId(universe,"cashMovements","late-1"),late]])};
assert.equal(validateCashJournalDiff(past,now,{changes:[change(null,late)]}).checked,1);
assert.throws(()=>validateCashJournalDiff(past,now,{changes:[change(null,rec("cashMovements","late-1",
 {...late.item,originSessionId:"wrong"}))]}),/Turno/);
const initial=rec("orders","order-1",{...old.item,status:"recebido",stockDeducted:false});
const inProduction=rec("orders","order-1",{...old.item,status:"em_producao",stockDeducted:true});
const negativeMoves=[
 change(null,move("prod-1","batata",-200,"Produção")),
 change(null,move("prod-2","bev:agua",-2,"Bebida vendida"))
];
assert.equal(validateProductionJournalDiff({changes:[change(initial,inProduction),...negativeMoves]}).produced,1);
assert.throws(()=>validateProductionJournalDiff({changes:[change(initial,inProduction),negativeMoves[0]]}),/Consumo sem baixa/);
assert.throws(()=>validateProductionJournalDiff({changes:[change(initial,inProduction),negativeMoves[0],
 change(null,move("prod-2","bev:agua",-3,"Bebida vendida"))]}),/Consumo sem baixa/);
const pixOrder=rec("orders","order-1",{...unpaidCancelled.item,paymentMethod:"Pix"});
const invalidRefundState={...next,records:new Map([...next.records,[recordId(universe,"orders","order-1"),pixOrder]])};
assert.throws(()=>validateCashJournalDiff(before,invalidRefundState,changes),/Reembolso/);
console.log("PASS F02/F05/F20: production journal, physical returns, order losses, refund value, duplicate events, shift and payment checks.");
