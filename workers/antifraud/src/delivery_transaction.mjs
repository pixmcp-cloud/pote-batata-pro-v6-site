// V6 delivery state and inventory transaction candidate. No public deployment.
import {uidOk} from "./geo_core.mjs";
import {recordPath,planOperation,quantities} from "./domain.mjs";
import {CheckoutError,transitionDelivery} from "./public_checkout_core.mjs";
import {buyerOrderView} from "./public_delivery_view.mjs";
const fail=c=>{throw new CheckoutError(c)};
const idOk=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const opOk=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{20,80}$/.test(x);
const put=(path,data,prior)=>({path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,"0")).join("");
const terminal=o=>["entregue","cancelado"].includes(o.deliveryStatus);
const paid=o=>Boolean(o.paymentConfirmedAt)||["pago","confirmado","pago em dinheiro"].includes(String(o.paymentStatus||"").toLowerCase());
const clone=o=>structuredClone(o);
// Unbiased random 4-digit code; private receipt only, never in PDV or event logs.
function newDeliveryCode(){const n=new Uint16Array(1);do{crypto.getRandomValues(n)}while(n[0]>=60000);return String(n[0]%10000).padStart(4,"0");}
export function canonical(receipt,doc){
 const r=doc?.data?.record;
 if(!r||r.group!=="orders"||r.universe!==receipt.businessType||r.id!==receipt.pdvOrderId||r.item?.publicCheckoutV6!==true||r.item?.publicCheckoutId!==receipt.id)fail("order_inconsistent");
 if(r.item.deliveryStatus!==receipt.deliveryStatus||r.item.status!==receipt.status)fail("order_out_of_sync");
 return r;
}
export async function readDeliveryOrder({repository,actorUid,id,now=Date.now()}){
 if(!uidOk(actorUid)||!idOk(id))fail("invalid_order");
 const tx=await repository.transaction();
 try{
  const receipt=(await tx.get("publicOrderReceipts/"+id))?.data;
  if(!receipt||receipt.id!==id)fail("order_unavailable");
  const buyer=receipt.buyerUid===actorUid,owner=receipt.ownerUid===actorUid,courier=receipt.courierUid===actorUid&&receipt.fulfillment==="entrega"&&!terminal(receipt);
  if(!buyer&&!owner&&!courier)fail("order_unavailable");
  if(buyer)return {...buyerOrderView(receipt,actorUid,now),...(receipt.deliveryStatus==="saiu_entrega"&&/^\d{4}$/.test(receipt.deliveryProof?.code||"")?{deliveryCode:receipt.deliveryProof.code}:{})};
  if(owner)return {...buyerOrderView(receipt,receipt.buyerUid,now),pdvOrderId:receipt.pdvOrderId,customerName:receipt.customerName,customerPhone:receipt.customerPhone,courierAssigned:uidOk(receipt.courierUid),role:"merchant"};
  // Only the assigned courier gets destination and address during an active route.
  if(receipt.deliveryStatus!=="saiu_entrega")return {id,code:receipt.code,status:receipt.deliveryStatus,role:"courier"};
  return {id,code:receipt.code,status:receipt.deliveryStatus,role:"courier",address:receipt.address,destination:receipt.destination,trackingAllowed:true};
 }finally{await tx.rollback()}
}
export async function mutateDeliveryOrder({repository,actorUid,id,operationId,action,next,courierUid,decision,reference,deliveryCode,beforeClose=null,now=Date.now()}){
 if(!uidOk(actorUid)||!idOk(id)||!opOk(operationId)||!["assign","transition","confirm_payment"].includes(action)||
    !Number.isSafeInteger(now)||now<0)fail("invalid_operation");
 const opHash=await digest([actorUid,operationId]),fingerprint=await digest([id,action,next??null,courierUid??null,decision??null,reference??null]);
 const receiptPath="publicOrderReceipts/"+id,eventPath="publicDeliveryEvents/"+opHash;
 const tx=await repository.transaction();
 try{
  const prior=await tx.get(eventPath);
  if(prior){if(prior.data.fingerprint!==fingerprint)fail("idempotency_conflict");return {...prior.data.result,alreadyApplied:true};}
  const [receiptDoc,viewDoc]=await Promise.all([tx.get(receiptPath),tx.get("publicOrderViews/"+id)]),receipt=receiptDoc?.data;
  if(!receipt||receipt.id!==id||!uidOk(receipt.ownerUid)||viewDoc?.data?.buyerUid!==receipt.buyerUid)fail("order_unavailable");
  const owner=actorUid===receipt.ownerUid,courier=receipt.fulfillment==="entrega"&&actorUid===receipt.courierUid;
  if(!owner&&!courier)fail("order_unavailable");
  if(!owner&&action!=="transition")fail("forbidden_operation");
  const root="users/"+receipt.ownerUid,u=receipt.businessType;
  if(!/^[a-z0-9_-]{1,64}$/.test(u||""))fail("order_inconsistent");
  const orderPath=recordPath(receipt.ownerUid,u,"orders",receipt.pdvOrderId),guardPath=root+"/appState/v5InventoryGuard",pulsePath=root+"/appState/v5Pulse";
  const [profile,ordered,guard,pulse]=await Promise.all([tx.get(root),tx.get(orderPath),tx.get(guardPath),tx.get(pulsePath)]);
  if(profile?.data?.accessPolicy?.workerAuthoritative!==true||profile?.data?.accessPolicy?.publicCheckout!==true||
    profile.data.accessPolicy.blockedUniverses?.includes(u)||profile.data.accessPolicy.blockedServices?.some(x=>[u+":orders",u+":stock"].includes(x)))fail("merchant_not_approved");
  if(!Number.isSafeInteger(guard?.data?.revision)||guard.data.revision<0||guard.data.revision>=Number.MAX_SAFE_INTEGER||!pulse?.data?.eventId)fail("merchant_not_ready");
  if(!Number.isSafeInteger(receipt.deliveryRevision)||receipt.deliveryRevision<0)fail("order_inconsistent");
  const record=canonical(receipt,ordered);let o=clone(record.item),r=clone(receipt);
  const at=new Date(now).toISOString(),writes=[],changed=[orderPath.split("/").at(-1)];
  if(action==="assign"){
   if(!owner||receipt.fulfillment!=="entrega"||terminal(receipt)||receipt.deliveryStatus==="saiu_entrega"||!uidOk(courierUid)||courierUid===receipt.buyerUid)fail("invalid_assignment");
   const linked=await tx.get(root+"/deliveryCouriersV6/"+courierUid);
   if(linked?.data?.uid!==courierUid||linked.data.active!==true||linked.data.accepted!==true)fail("courier_not_verified");
   r.courierUid=courierUid;o.deliveryCourierUid=courierUid;delete r.deliveryInvite;
  }else if(action==="confirm_payment"){
   if(!owner||receipt.deliveryStatus==="cancelado"||paid(o)||typeof reference!=="string"||!reference.trim()||reference.length>120)fail("payment_confirmation_invalid");
   // Existing open shift only; never auto-open a shift or create a bank charge.
   const cash=await tx.listRecords(receipt.ownerUid,u,"cashSessions",{status:"open",limit:3});
   const open=cash.filter(x=>x.data?.record?.item?.status==="open");
   if(open.length!==1||!open[0].data.record.item.id)fail("cash_session_required");
   o.cashSessionId=open[0].data.record.item.id;o.paymentStatus="pago";o.paymentConfirmedAt=at;o.paymentConfirmationReference=reference.trim();
   r.paymentStatus="confirmed";r.paymentConfirmedAt=at;
  }else{
   r=transitionDelivery(receipt,next,{actorUid,now});
   if(receipt.fulfillment==="entrega"&&next==="saiu_entrega"){r.deliveryProof={code:newDeliveryCode(),attempts:0,lockedUntil:0};delete r.deliveryInvite;}
   if(receipt.fulfillment==="entrega"&&next==="entregue"){
    const proof=receipt.deliveryProof;
    if(!proof||!/^\d{4}$/.test(proof.code||""))fail("delivery_code_unavailable");
    if(!/^\d{4}$/.test(typeof deliveryCode==="string"?deliveryCode:""))fail("delivery_code_required");
    if(!Number.isSafeInteger(proof.attempts)||proof.attempts<0||proof.attempts>5||!Number.isSafeInteger(proof.lockedUntil))fail("delivery_code_unavailable");
    if(proof.lockedUntil>now)fail("delivery_code_locked");
    if(deliveryCode!==proof.code){
     const attempts=(proof.lockedUntil?0:proof.attempts)+1;
     await tx.commit([put(receiptPath,{...receipt,deliveryProof:{...proof,attempts,lockedUntil:attempts>=5?now+900000:0}},receiptDoc)]);
     fail(attempts>=5?"delivery_code_locked":"delivery_code_incorrect");
    }
    r.deliveryVerifiedAt=at;o.deliveryVerifiedAt=at;
   }
   if(next==="em_producao"||next==="cancelado"){
    if(next==="cancelado"&&paid(o))fail("paid_order_requires_refund");
    if(next==="cancelado"&&!["return","loss"].includes(decision))fail("cancel_decision_required");
    const action=next==="em_producao"?"produce":"cancel";
    const stock=new Map(),stockDocs=new Map();
    if(action==="produce"||o.stockDeducted===true&&decision==="return"){
     const needed=quantities(o);
     for(const group of ["ingredients","beverages"]){
      if(![...needed.keys()].some(k=>k.startsWith(group+":")))continue;
      const ids=[...needed.keys()].filter(k=>k.startsWith(group+":")).map(k=>k.slice(group.length+1));
      const docs=[];for(let i=0;i<ids.length;i+=30)docs.push(...await tx.listRecords(receipt.ownerUid,u,group,{ids:ids.slice(i,i+30),limit:ids.slice(i,i+30).length+2}));
      for(const d of docs){const x=d.data?.record;if(x?.universe!==u||x.group!==group||x.id!==x.item?.id)fail("invalid_stock_record");
       const key=group+":"+x.id;if(needed.has(key)){if(stock.has(key))fail("duplicate_stock");stock.set(key,x.item);stockDocs.set(key,d);}}
     }
    }
    const plan=planOperation({action,decision,order:o,stock,universe:u,operationId:opHash,at});o=plan.order;
    for(const item of plan.stockUpdates){
     const d=stockDocs.get(item.group+":"+item.id);
     if(!d?.path)fail("stock_record_missing");
     writes.push(put(d.path,{record:{...d.data.record,item:item.item}},d));changed.push(d.path.split("/").at(-1));
    }
    let n=0;
    for(const [g,items] of [["stockMovements",plan.movements],["losses",plan.losses]]){
     for(const item of items){const path=recordPath(receipt.ownerUid,u,g,item.id);
      writes.push(put(path,{record:{universe:u,group:g,id:item.id,item,rank:-now-(n++/1000)}},null));changed.push(path.split("/").at(-1));}
    }
   }
   if(next==="entregue"){if(o.status!=="em_producao"||o.stockDeducted!==true)fail("production_not_confirmed");o.status="entregue";o.finishedAt=at;o.deliveredAt=at;o.durationSeconds=r.durationSeconds;}
   if(next==="cancelado")o.clockStoppedAt=at;
   if(next==="entregue")o.clockStoppedAt=at;
   o.deliveryStatus=next;o.deliveryUpdatedAt=at;r.status=o.status;
   if(terminal(r)){delete r.destination;delete r.deliveryProof;delete r.deliveryInvite;} // exact coordinates no longer needed
  }
  r.deliveryRevision=receipt.deliveryRevision+1;o.deliveryRevision=r.deliveryRevision;
  if(!Number.isSafeInteger(r.deliveryRevision))fail("revision_overflow");
  if(writes.length>90)fail("too_many_items");
  const result={ok:true,id,status:r.deliveryStatus,revision:r.deliveryRevision,paymentStatus:r.paymentStatus,durationSeconds:r.durationSeconds??null};
  writes.push(put(orderPath,{record:{...record,item:o}},ordered),put(receiptPath,r,receiptDoc),
   put("publicOrderViews/"+id,{...buyerOrderView(r,r.buyerUid,now),buyerUid:r.buyerUid},viewDoc),
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"delivery-"+opHash,previousEventId:pulse.data.eventId,origin:"cloudflare-delivery-v6",affected:changed.length,changedKeys:changed,metaChanged:false,sensitive:true},pulse),
   put(eventPath,{fingerprint,result,actorUid,id,action},null));
  if(terminal(r)&&!terminal(receipt)&&receipt.fulfillment==="entrega"&&beforeClose)await beforeClose({id,revision:r.deliveryRevision});
  await tx.commit(writes);return {...result,alreadyApplied:false};
 }finally{await tx.rollback()}
}
