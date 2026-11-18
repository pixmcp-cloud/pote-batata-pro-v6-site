import test from "node:test";
import assert from "node:assert/strict";
import {keyFor,recordPath,quantities,planOperation} from "../src/domain.mjs";
const operationId="cb1b159a-7019-4cd0-9f33-a2bb87575b1d";
const order={id:"o1",status:"recebido",qty:2,price:35,stockDeducted:false,
 items:[{id:"batata",g:100,yieldPct:80},{id:"queijo",g:30,yieldPct:100}],
 beverageItems:[{id:"suco",qty:1}]};
const stock=new Map([
 ["ingredients:batata",{id:"batata",name:"Batata",stock:400,measureUnit:"g"}],
 ["ingredients:queijo",{id:"queijo",name:"Queijo",stock:100,measureUnit:"g"}],
 ["beverages:suco",{id:"suco",name:"Suco",stock:8,measureUnit:"un"}]
]);
test("record IDs match browser V2 base64url encoding",()=>{
 const values=["batataria","ingredients","batata"];
 const bytes=new TextEncoder().encode(JSON.stringify(values));
 const expected=Buffer.from(bytes).toString("base64url");
 assert.equal(keyFor(...values),expected);
 assert.equal(recordPath("user123",...values),"users/user123/records/"+expected);
});
test("server computes exact consumption from stored order, not client",()=>{
 const qty=quantities(order);
 assert.equal(qty.get("ingredients:batata"),250);
 assert.equal(qty.get("ingredients:queijo"),60);
 assert.equal(qty.get("beverages:suco"),2);
 const result=planOperation({action:"produce",order,stock,universe:"batataria",
  operationId,at:"2026-11-18T15:00:00.000Z"});
 assert.equal(result.order.status,"em_producao");
 assert.equal(result.order.stockDeducted,true);
 assert.equal(result.movements.length,3);
 assert.equal(result.movements.reduce((n,m)=>n+m.quantity,0),-312);
 assert.equal(result.stockUpdates.find(x=>x.id==="batata").item.stock,150);
 assert.equal(result.stockUpdates.find(x=>x.id==="suco").item.stock,6);
 assert.deepEqual(order,{...order},"must not mutate source order");
});
test("insufficient stock and override requests fail safely",()=>{
 assert.throws(()=>planOperation({action:"produce",order,stock:new Map([
  ["ingredients:batata",{id:"batata",stock:1}],...Array.from(stock).filter(([k])=>k!=="ingredients:batata")
 ]),universe:"batataria",operationId,at:"2026-11-18T15:00:00Z"}),/Estoque insuficiente/);
 assert.throws(()=>quantities({...order,stockOverrideApproved:true}),/conferência manual/);
 assert.throws(()=>quantities({...order,qty:NaN}),/Quantidade/);
});
test("cancel before production releases reservation without inflating stock",()=>{
 const p=planOperation({action:"cancel",decision:"return",order,stock,
  universe:"batataria",operationId,at:"2026-11-18T16:00:00Z"});
 assert.equal(p.order.status,"cancelado");
 assert.equal(p.order.cancelStockAction,"sem-baixa");
 assert.equal(p.stockUpdates.length,0);
 assert.equal(p.movements.length,0);
});
test("cancel after production restores stock exactly once",()=>{
 const produced={...order,status:"em_producao",stockDeducted:true};
 const used=new Map([
  ["ingredients:batata",{id:"batata",name:"Batata",stock:150}],
  ["ingredients:queijo",{id:"queijo",name:"Queijo",stock:40}],
  ["beverages:suco",{id:"suco",name:"Suco",stock:6}]
 ]);
 const p=planOperation({action:"cancel",decision:"return",order:produced,stock:used,
  universe:"batataria",operationId,at:"2026-11-18T16:00:00Z"});
 assert.equal(p.order.stockRestored,true);
 assert.equal(p.stockUpdates.find(x=>x.id==="batata").item.stock,400);
 assert.equal(p.movements.filter(m=>m.quantity>0).length,3);
 assert.throws(()=>planOperation({action:"cancel",decision:"return",order:p.order,
  stock:used,universe:"batataria",operationId,at:"2026-11-18T16:00:00Z"}),/já cancelado/);
});
test("cancel after production records loss without inventing cost",()=>{
 const p=planOperation({action:"cancel",decision:"loss",order:{...order,
  status:"entregue",stockDeducted:true},stock,
  universe:"batataria",operationId,at:"2026-11-18T16:00:00Z"});
 assert.equal(p.order.stockReturnDeclined,true);
 assert.equal(p.stockUpdates.length,0);
 assert.equal(p.losses.length,1);
 assert.equal(p.losses[0].costKnown,false);
 assert.equal(p.losses[0].costLost,0);
});
