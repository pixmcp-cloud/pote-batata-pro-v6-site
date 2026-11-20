import test from "node:test";
import assert from "node:assert/strict";
import {auditOrderSequence} from "../src/order_sequence_audit.mjs";
const universe="batataria";
const v2State={data:{businessType:universe,orderSequenceLast:120}};
const orders=(...numbers)=>numbers.map((n,i)=>({record:{universe,group:"orders",
 id:"order-"+i,item:{orderNumber:n}}}));
const audit=(rows,options={})=>auditOrderSequence({universe,v2State,orderRecords:rows,
 listingComplete:true,...options});
test("F02 historical metadata >= numbered orders is ready for atomic bootstrap",()=>{
 const r=audit(orders(119,120));
 assert.equal(r.status,"ready");assert.equal(r.action,"initialize_after_authorization");
 assert.equal(r.proposedLast,120);
});
test("F02 counter never silently resets on incomplete Firestore listing",()=>{
 assert.throws(()=>auditOrderSequence({universe,v2State,orderRecords:orders(120)}),/incomplete/);
 assert.throws(()=>auditOrderSequence({universe,v2State,listingComplete:true}),/incomplete/);
});
test("F02 duplicate public numbers or record IDs prevent migration",()=>{
 const duplicate=audit(orders(119,119));assert.equal(duplicate.status,"blocked");
 assert.equal(duplicate.reason,"duplicate_public_numbers");
 const ids=orders(119,120);ids[1].record.id=ids[0].record.id;
 assert.equal(audit(ids).reason,"invalid_or_repeated_order_ids");
});
test("F02 historical unnumbered orders require manual review, not automatic overwrite",()=>{
 const r=audit(orders(120,undefined));
 assert.equal(r.status,"manual_review");assert.equal(r.reason,"historical_unnumbered_orders");
});
test("F02 metadata behind history requires manual review",()=>{
 const r=audit(orders(119,121));
 assert.equal(r.status,"manual_review");assert.equal(r.proposedLast,121);
});
test("F02 existing sequence control must cover both metadata and history",()=>{
 const r=audit(orders(119,120),{control:{version:1,universe,last:119}});
 assert.equal(r.status,"blocked");assert.equal(r.reason,"sequence_control_inconsistent");
 const good=audit(orders(119,120),{control:{version:1,universe,last:122}});
 assert.equal(good.status,"ready");assert.equal(good.last,122);
});
test("F02 audit ignores unrelated tenant universes but never infers an absent universe",()=>{
 const r=audit([...orders(119),{record:{universe:"pizzaria",group:"orders",
   id:"foreign",item:{orderNumber:120}}}]);
 assert.equal(r.numbered,1);
 assert.equal(audit(orders(119),{v2State:{data:{businessType:"pizzaria"}}}).reason,
 "universe_missing");
});
