import {deliveryElapsed,formatElapsed,DELIVERY_LABELS} from "./public_checkout_core.mjs";
import {uidOk} from "./geo_core.mjs";
const terminal=o=>["entregue","cancelado"].includes(o.deliveryStatus);
export function buyerOrderView(order,uid,now=Date.now()){
 if(!uidOk(uid)||uid!==order?.buyerUid)throw Error("order_forbidden");
 if(!Object.hasOwn(DELIVERY_LABELS,order.deliveryStatus))throw Error("invalid_status");
 const elapsedSeconds=deliveryElapsed(order,now);
 if(elapsedSeconds===null)throw Error("invalid_clock");
 return {id:order.id||order.operationId,code:order.code,store:order.slug,status:order.deliveryStatus,
 label:DELIVERY_LABELS[order.deliveryStatus],createdAt:order.createdAt,deliveredAt:order.deliveredAt||null,clockStoppedAt:order.clockStoppedAt||null,
 durationSeconds:terminal(order)?elapsedSeconds:null,elapsedSeconds,terminal:terminal(order),serverNow:now,
 lines:order.lines.map(x=>({name:x.name,qty:x.qty,unitPriceCents:x.unitPriceCents,note:x.note||""})),
 subtotalCents:order.subtotalCents,feeCents:order.feeCents,totalCents:order.totalCents,
 paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus,fulfillment:order.fulfillment,address:order.address||""};
}
export function receiptData(order,uid,now=Date.now()){
 const v=buyerOrderView(order,uid,now);
 return {...v,elapsedText:formatElapsed(v.elapsedSeconds),nonFiscal:true};
}
