// B02.2 laboratory transaction adapter for the existing Firestore REST repository interface.
// NEVER import in the live worker. Only synthetic project ID, explicit enablement and injected repo.
// Stock source is a server-administered manifest referencing actual V5 document keys (including
// model/free keys). The same physical document may be mapped by two stores sharing stock.
// The checkout inbox is NOT a native V5 orders record: old production code would debit twice.
import {createCheckoutQuote,submitCheckout,transitionCheckout,customerOrder} from "./checkout_domain.mjs";
import {planCheckoutCash,applyCheckoutReceipt,freezeCheckoutCashSession,planCheckoutRefund,applyCheckoutRefund,openCheckoutCash,planDrawerMovement} from "./checkout_cash_lab.mjs";
import {v5SequenceBaseline,advanceV5Sequence} from "./v5_checkout_sequence_lab.mjs";
import {planSharedKitchen,kitchenLink} from "./v5_shared_kitchen_lab.mjs";
import {requireCheckoutAuthority} from "./v5_cutover_policy.mjs";
const labProject="demo-nucleobit-checkout";
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const operation=x=>id(x)&&x.length>=16;
const docKey=x=>typeof x==="string"&&/^[A-Za-z0-9_~:-]{1,700}$/.test(x);
const int=(x,min=0,max=1000000000)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const err=code=>{throw Object.assign(Error(code),{code})};
const copy=x=>JSON.parse(JSON.stringify(x));
const put=(path,data,old)=>({path,data,precondition:old?{updateTime:old.updateTime}:{exists:false}});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const actorFor=(identity,role,storeId)=>({uid:identity.uid,provider:"google.com",verified:true,role,...(role==="merchant"?{storeId}:{})});
const projection=(o,now)=>customerOrder({id:o.storeId,orders:[o]},actorFor({uid:o.customerUid},"customer"),o.id,now);
function verifyIdentity(identity){
 if(!identity||identity.emailVerified!==true||identity.provider!=="google.com"||!id(identity.uid))err("login_required");
}
// Tokens are not accepted as identity objects from the browser. verifyToken is injected by server.
// The existing verifyFirebaseToken validates Google and verified email but returns uid/email only;
// wrap that verified function in a server-only adapter supplying the verified claims.
export function createCheckoutLabRepository({projectId,enabled=false,repository,verifyToken,verifyScheduler,listExpiredCandidates,loadAuthoritativeCatalog,clock=()=>Date.now()}={}){
 const active=enabled===true&&projectId===labProject&&typeof repository?.transaction==="function"&&typeof verifyToken==="function";
 async function executeInternal({token,storeId,kind,operationId,quoteId,orderId,input,expectedRevision,expectedTotalCents,action,paymentReference,reconciliation}={},service=null){
  if(!active)err("lab_disabled");
  if((!service&&(typeof token!=="string"||!token))||!id(storeId)||!["quote","submit","transition","status"].includes(kind))err("invalid_request");
  if(kind!=="status"&&!operation(operationId))err("invalid_operation");
  if(kind==="submit"&&!operation(quoteId)||["transition","status"].includes(kind)&&!id(orderId))err("invalid_request");
  const identity=service??await verifyToken(token,projectId);if(!service)verifyIdentity(identity);
  const tx=await repository.transaction();
  try{
   const root="checkoutLabStores/"+storeId,manifest=await tx.get(root);
   const m=manifest?.data;
   if(!m||m.lab!==true||m.enabled!==true||!id(m.ownerUid)||!id(m.revision)||!id(m.universe)||!Array.isArray(m.products)||m.products.length>60||!Array.isArray(m.stockMap)||m.stockMap.length>32||!m.stockMap.length)err("store_unavailable");
   const channel=m.channel??"online";
   if(!["online","counter"].includes(channel))err("store_unavailable");
   // Counter uses the same transaction engine and owner authorization, not legacy direct writes.
   if(channel==="counter"&&!service&&(identity.uid!==m.ownerUid))err("forbidden");
   if(channel==="counter"&&(!m.cutoverEpoch||m.catalogMode!=="v5-authoritative"))err("cutover_not_ready");
   const merchant=kind==="transition";
   if(service){if(kind!=="transition"||action!=="expire"||service.ownerUid!==m.ownerUid||service.storeId!==storeId)err("forbidden");}
   else if(merchant&&identity.uid!==m.ownerUid)err("forbidden");
   const actor=service?{uid:service.uid,role:"scheduler",verified:true,storeId}:actorFor(identity,merchant?"merchant":"customer",storeId),now=clock();
   if(!Number.isSafeInteger(now)||now<=0)err("invalid_time");
   const orderRoot=root+"/orders/",viewRoot=root+"/customerViews/";
   // Operation IDs are scoped to store and actor; prefix length encoding avoids separator collisions.
   const scopedOp=root+(service?"/schedulerOperations/":"/operations/")+identity.uid.length+"_"+identity.uid+"_"+operationId;
   const quotePath=root+"/quotes/"+quoteId;
   if(kind==="status"){
    const o=await tx.get(orderRoot+orderId);
    if(!o||o.data.customerUid!==identity.uid||o.data.storeId!==storeId)err("not_found");
    return projection(o.data,now);
   }
   const priorOp=await tx.get(scopedOp);
   const requestFingerprint=JSON.stringify([kind,quoteId??null,orderId??null,input??null,expectedRevision??null,expectedTotalCents??null,action??null,paymentReference??null,reconciliation??null]);
   if(priorOp){
    if(priorOp.data.fingerprint!==requestFingerprint||priorOp.data.actorUid!==identity.uid)err("idempotency_conflict");
    if(kind==="quote"){if(now>=priorOp.data.result.expiresAt)err("invalid_quote");return copy(priorOp.data.result)}
    const existing=await tx.get(orderRoot+priorOp.data.orderId);
    if(!existing||existing.data.storeId!==storeId||(kind==="submit"&&existing.data.customerUid!==identity.uid))err("not_found");
    return {...projection(existing.data,now),duplicate:true};
   }
   // Manifest is private and writable only by server. A real integration must derive it from
   // authoritative recipes, price rules and shared/separate stock settings; not public catalog.
   const uidRoot="users/"+m.ownerUid,meta=await tx.get(uidRoot+"/appState/v5"),guard=await tx.get(uidRoot+"/appState/v5InventoryGuard"),pulse=await tx.get(uidRoot+"/appState/v5Pulse");
   if(!meta||meta.data.schemaVersion!==5||meta.data.migration?.status==="copying"||!guard||!int(guard.data.revision)||!pulse||!docKey(pulse.data.eventId))err("not_ready");
   // Strict staging mode binds new operations to the same server-owned epoch.
   // Historical fixtures remain usable only in the synthetic demo project.
   const profile=m.cutoverEpoch!==undefined||m.catalogMode==="v5-authoritative"?await tx.get(uidRoot):null;
   if(m.cutoverEpoch!==undefined)requireCheckoutAuthority(profile?.data,m.cutoverEpoch);
   let products=m.products;
   if(["quote","submit"].includes(kind)&&m.catalogMode==="v5-authoritative"){
    if(typeof loadAuthoritativeCatalog!=="function")err("catalog_not_ready");
    const catalog=await loadAuthoritativeCatalog({tx,manifest:m,meta:meta.data,profile:profile?.data,now});
    if(catalog?.revision!==m.revision||!Array.isArray(catalog.products))err("catalog_not_ready");
    products=catalog.products;
   }else if(["quote","submit"].includes(kind)&&m.catalogMode!==undefined&&m.catalogMode!=="fixture")err("catalog_not_ready");
   const shared=meta.data.state?.data?.kitchenStock?.mode==="shared";
   if(shared&&(m.catalogMode!=="v5-authoritative"||m.sharedKitchenEnabled!==true||typeof tx.listKitchenRecords!=="function"))err("shared_kitchen_requires_reconciliation");
   const kitchenRecords=shared?await tx.listKitchenRecords({collection:uidRoot+"/recordsV5",limit:241}):[];
   if(shared&&(!Array.isArray(kitchenRecords)||kitchenRecords.length>240))err("shared_kitchen_not_ready");
   const maps=new Map(),physical=new Set(),inventory=[],links=new Set();
   for(const s of m.stockMap){
    if(!id(s?.stockId)||!id(s.universe)||!["ingredients","beverages"].includes(s.group)||!docKey(s.recordKey)||!id(s.itemId)||![1,10,100,1000,10000,100000].includes(s.scale)||maps.has(s.stockId)||physical.has(s.recordKey))err("invalid_stock_mapping");
    const path=uidRoot+"/recordsV5/"+s.recordKey,d=await tx.get(path),record=d?.data?.record;
    if(!record||record.universe!==s.universe||record.group!==s.group||record.id!==s.itemId||typeof record.item?.stock!=="number")err("invalid_stock_mapping");
    const raw=record.item.stock*s.scale,units=Math.round(raw);
    if(!int(units)||Math.abs(raw-units)>0.000001)err("invalid_stock_precision");
    const sharedLink=shared&&s.group==="ingredients"?kitchenLink(record.item):null;
    if(sharedLink&&(links.has(sharedLink)||!kitchenRecords.some(x=>x.key===s.recordKey&&x.ownerUid===m.ownerUid)))err("invalid_stock_mapping");
    if(sharedLink)links.add(sharedLink);
    maps.set(s.stockId,{...s,path,doc:d,units,sharedLink});physical.add(s.recordKey);inventory.push({id:s.stockId,availableUnits:units});
   }
   const sharedMaps=[...maps.values()].filter(x=>x.sharedLink);
   const verifiedKitchen=sharedMaps.length?planSharedKitchen({ownerUid:m.ownerUid,meta:meta.data,records:kitchenRecords,requests:sharedMaps.map(x=>({link:x.sharedLink,scale:x.scale,units:0})),listingComplete:true}):null;
   for(const s of sharedMaps){const balance=verifiedKitchen.balances.find(x=>x.link===s.sharedLink);if(!balance||balance.beforeUnits!==s.units||!balance.aliasKeys.includes(s.recordKey))err("shared_kitchen_divergent");s.aliasKeys=balance.aliasKeys;}
   const sequencePath=root+"/meta/sequence",sequence=await tx.get(sequencePath);
   if(!sequence||!int(sequence.data.value,0,9999998))err("not_ready");
   const sharedSequence=m.catalogMode==="v5-authoritative"&&kind==="submit";
   const initialSequence=sharedSequence?v5SequenceBaseline(meta.data,m.universe,sequence.data.value):sequence.data.value;
   const state={id:storeId,revision:m.revision,reservationMinutes:m.reservationMinutes??30,enabled:true,deliveryEnabled:m.deliveryEnabled===true,deliveryFeeCents:m.deliveryFeeCents,products,inventory,sequence:initialSequence,quotes:[],orders:[]};
   if(kind==="quote"){
    const qid=operationId;
    const qpath=root+"/quotes/"+qid;
    if(await tx.get(qpath))err("idempotency_conflict");
    const result=createCheckoutQuote(state,actor,input,qid,now);
    await tx.commit([put(qpath,result.state.quotes[0],null),put(scopedOp,{actorUid:identity.uid,fingerprint:requestFingerprint,result:result.quote},null)]);
    return result.quote;
   }
   let savedQuote=null,priorOrder=null,result;
   if(kind==="submit"){
    savedQuote=await tx.get(quotePath);
    if(!savedQuote)err("invalid_quote");state.quotes=[savedQuote.data];
    result=submitCheckout(state,actor,{operationId,quoteId,input,expectedRevision,expectedTotalCents},now);
   }else{
    priorOrder=await tx.get(orderRoot+orderId);
    if(!priorOrder||priorOrder.data.storeId!==storeId)err("not_found");
    state.orders=[priorOrder.data];
    result=transitionCheckout(state,actor,{orderId,operationId,action,paymentReference,reconciliation},now);
   }
   if(result.duplicate)err("inconsistent_operation");
   const o=result.order,orderPath=orderRoot+o.id,viewPath=viewRoot+o.id;
   const mapping=o.required.map(n=>{const s=maps.get(n.stockId);if(!s)err("stock_mapping_changed");return {stockId:n.stockId,ownerUid:m.ownerUid,recordKey:s.recordKey,universe:s.universe,group:s.group,itemId:s.itemId,scale:s.scale,...(s.sharedLink?{sharedLink:s.sharedLink,aliasKeys:s.aliasKeys}:{})}});
   if(kind==="submit"){o.reservedMapping=mapping;if(channel==="counter")o.channel="counter";}
   else if(!same(priorOrder.data.reservedMapping,mapping))err("stock_mapping_changed");
   const oldView=await tx.get(viewPath);
   if(kind==="submit"&&(await tx.get(orderPath)||oldView))err("order_collision");
   if(kind==="transition"&&(!oldView||oldView.data.customerUid!==o.customerUid))err("not_ready");
   const writes=[put(orderPath,o,priorOrder),put(viewPath,{customerUid:o.customerUid,storeId,status:projection(o,now),serverNowMs:now},oldView),put(scopedOp,{actorUid:identity.uid,fingerprint:requestFingerprint,orderId:o.id},null)];
   if(kind==="submit"){writes.push(put(quotePath,result.state.quotes[0],savedQuote),put(sequencePath,{value:result.state.sequence},sequence))}
   let nextMeta=sharedSequence?advanceV5Sequence(meta.data,m.universe,sequence.data.value,result.state.sequence):meta.data;
   let metaChanged=sharedSequence;
   // Optional synthetic cash integration: fail closed for payment when no open shift.
   if(kind==="transition"&&action==="confirm_payment"){
    const pointerPath="checkoutLabCash/"+m.ownerUid,ptr=await tx.get(pointerPath);
    if(!ptr||!id(ptr.data.activeSessionId))err("cash_not_open");
    const sessionPath=pointerPath+"/sessions/"+ptr.data.activeSessionId,session=await tx.get(sessionPath);
    const receiptPath=pointerPath+"/receipts/"+storeId.length+"_"+storeId+"_"+o.id,priorReceipt=await tx.get(receiptPath);
    const receipt=planCheckoutCash({ownerUid:m.ownerUid,storeId,order:o,session:session?.data,priorReceipt,now});
    if(o.channel==="counter")receipt.channel="counter";
    if(session.data.id!==ptr.data.activeSessionId)err("cash_not_open");
    // Update shift revision so closure and receipt cannot both win on a stale baseline.
    if(!int(session.data.revision)||session.data.revision>=1000000000)err("invalid_session");
    writes.push(put(receiptPath,receipt,null),put(sessionPath,applyCheckoutReceipt(session.data,receipt),session));
   }
   if(kind==="transition"&&action==="reconcile_cancel"){
    const rootCash="checkoutLabCash/"+m.ownerUid;
    if(o.paymentStatus==="refunded"){
     const ptr=await tx.get(rootCash);if(!ptr||!id(ptr.data.activeSessionId))err("cash_not_open");
     const sessionPath=rootCash+"/sessions/"+ptr.data.activeSessionId,session=await tx.get(sessionPath);
     if(session?.data.id!==ptr.data.activeSessionId)err("cash_not_open");
     const receiptKey=storeId.length+"_"+storeId+"_"+o.id,receipt=await tx.get(rootCash+"/receipts/"+receiptKey),refundPath=rootCash+"/refunds/"+receiptKey,priorRefund=await tx.get(refundPath);
     const refund=planCheckoutRefund({ownerUid:m.ownerUid,storeId,order:o,receipt:receipt?.data,priorRefund,session:session.data,now,reference:reconciliation.refundReference});
     writes.push(put(refundPath,refund,null),put(sessionPath,applyCheckoutRefund(session.data,refund),session));
    }
    if(o.stockState==="lost"){
     const lossPath=root+"/losses/"+o.id;
     if(await tx.get(lossPath))err("loss_exists");
     writes.push(put(lossPath,{...o.loss,orderId:o.id,storeId,ownerUid:m.ownerUid,reservedMapping:o.reservedMapping,actorUid:identity.uid},null));
    }
   }
   const changed=[],kitchenDeltas=[];
   for(const after of result.state.inventory){
    const before=maps.get(after.id);if(before.units===after.availableUnits)continue;
    const record=copy(before.doc.data.record);record.item.stock=after.availableUnits/before.scale;
    if(before.sharedLink)kitchenDeltas.push({link:before.sharedLink,scale:before.scale,units:before.units-after.availableUnits});
    else {writes.push(put(before.path,{...before.doc.data,record},before.doc));changed.push(before.recordKey);}
    // Dedicated reservation ledger; not old production stockMovements until semantics reconciled.
    const ledger=root+"/stockLedger/"+(service?"svc_":"usr_")+identity.uid.length+"_"+identity.uid+"_"+operationId+"_"+after.id;
    if(await tx.get(ledger))err("ledger_collision");
    writes.push(put(ledger,{orderId:o.id,operationId,stockId:after.id,physicalKey:before.recordKey,...(before.sharedLink?{sharedLink:before.sharedLink}:{}),scale:before.scale,deltaUnits:after.availableUnits-before.units,beforeUnits:before.units,afterUnits:after.availableUnits,at:now},null));
   }
   if(kitchenDeltas.length){
    const plan=planSharedKitchen({ownerUid:m.ownerUid,meta:nextMeta,records:kitchenRecords,requests:kitchenDeltas,listingComplete:true});
    nextMeta=plan.meta;metaChanged=true;
    for(const u of plan.updates){if(!docKey(u.key)||!u.updateTime||changed.includes(u.key))err("invalid_stock_mapping");writes.push(put(uidRoot+"/recordsV5/"+u.key,u.data,u));changed.push(u.key);}
   }
   if(metaChanged)writes.push(put(uidRoot+"/appState/v5",nextMeta,meta));
   if(changed.length){
    if(guard.data.revision>=1000000000)err("limit");
    writes.push(put(uidRoot+"/appState/v5InventoryGuard",{...guard.data,revision:guard.data.revision+1},guard),put(uidRoot+"/appState/v5Pulse",{eventId:"checkout-"+storeId.length+"-"+storeId+"-"+identity.uid.length+"-"+identity.uid+"-"+operationId,previousEventId:pulse.data.eventId,origin:service?"checkout-lab-scheduler":"checkout-lab",affected:changed.length,changedKeys:changed,metaChanged,sensitive:true},pulse));
   }
   if(writes.length>90)err("limit");
   await tx.commit(writes);
   return {...projection(o,now),duplicate:false};
  }finally{await tx.rollback()}
 }
 // New cash operations require explicit server-only epoch and trusted owner.
 async function cashIdentity(token,epoch){
  if(!active)err("lab_disabled");if(typeof token!=="string"||!token||!operation(epoch))err("invalid_request");
  const identity=await verifyToken(token,projectId);verifyIdentity(identity);return identity;
 }
 async function openCash({token,sessionId,operationId,openingCashCents,epoch}={}){
  const identity=await cashIdentity(token,epoch);
  if(!id(sessionId)||!operation(operationId)||!int(openingCashCents))err("invalid_request");
  const root="checkoutLabCash/"+identity.uid,tx=await repository.transaction();
  try{
   const profile=await tx.get("users/"+identity.uid);requireCheckoutAuthority(profile?.data,epoch);
   const ptr=await tx.get(root),path=root+"/sessions/"+sessionId,prior=await tx.get(path),eventPath=root+"/cashOperations/"+operationId,event=await tx.get(eventPath);
   const fingerprint=JSON.stringify(["open",sessionId,openingCashCents,epoch]);
   if(event){if(event.data.fingerprint!==fingerprint||!prior)err("idempotency_conflict");return {...copy(event.data.result),duplicate:true}}
   if(ptr?.data.activeSessionId)err("cash_already_open");if(prior)err("session_exists");
   const session=openCheckoutCash({ownerUid:identity.uid,sessionId,openingCashCents,operationId,now:clock(),epoch});
   await tx.commit([put(path,session,null),put(root,{...(ptr?.data??{}),activeSessionId:sessionId},ptr),put(eventPath,{fingerprint,result:session},null)]);
   return {...copy(session),duplicate:false};
  }finally{await tx.rollback()}
 }
 async function moveCash({token,sessionId,operationId,epoch,kind,amountCents,reason}={}){
  const identity=await cashIdentity(token,epoch);
  if(!id(sessionId)||!operation(operationId))err("invalid_request");
  const root="checkoutLabCash/"+identity.uid,tx=await repository.transaction();
  try{
   const profile=await tx.get("users/"+identity.uid);requireCheckoutAuthority(profile?.data,epoch);
   const ptr=await tx.get(root),path=root+"/sessions/"+sessionId,session=await tx.get(path),eventPath=root+"/cashOperations/"+operationId,event=await tx.get(eventPath);
   const fingerprint=JSON.stringify(["move",sessionId,epoch,kind,amountCents,reason]);
   if(event){if(event.data.fingerprint!==fingerprint)err("idempotency_conflict");return {...copy(event.data.result),duplicate:true}}
   if(!session||session.data.ownerUid!==identity.uid||session.data.cutoverEpoch!==epoch||ptr?.data.activeSessionId!==sessionId)err("cash_not_open");
   const plan=planDrawerMovement({session:session.data,kind,amountCents,reason,operationId,now:clock()}),movementPath=root+"/movements/"+operationId;
   if(await tx.get(movementPath))err("idempotency_conflict");
   await tx.commit([put(path,plan.session,session),put(movementPath,plan.movement,null),put(eventPath,{fingerprint,result:plan.movement},null)]);
   return {...copy(plan.movement),duplicate:false};
  }finally{await tx.rollback()}
 }
 async function closeCash({token,sessionId,operationId,countedCashCents,epoch}={}){
  if(!active)err("lab_disabled");if(typeof token!=="string"||!token||!id(sessionId)||!operation(operationId))err("invalid_request");
  const identity=await verifyToken(token,projectId);verifyIdentity(identity);
  const root="checkoutLabCash/"+identity.uid,tx=await repository.transaction();
  try{
   const ptr=await tx.get(root),path=root+"/sessions/"+sessionId,session=await tx.get(path);
   if(!session||session.data.ownerUid!==identity.uid||session.data.id!==sessionId)err("not_found");
   if(session.data.cutoverEpoch!==undefined){const profile=await tx.get("users/"+identity.uid);requireCheckoutAuthority(profile?.data,epoch);if(session.data.cutoverEpoch!==epoch||!int(countedCashCents))err("invalid_request");}
   if(session.data.status==="closed"){if(session.data.closeOperationId!==operationId)err("cash_already_closed");if(session.data.closedSummary.countedCashCents!==countedCashCents)err("idempotency_conflict");return copy(session.data.closedSummary)}
   if(ptr?.data.activeSessionId!==sessionId)err("cash_not_open");
   const closed=freezeCheckoutCashSession(session.data,clock(),operationId,countedCashCents);
   await tx.commit([put(path,closed,session),put(root,{...ptr.data,activeSessionId:null},ptr)]);
   return copy(closed.closedSummary);
  }finally{await tx.rollback()}
 }
 async function configureReservation({token,storeId,minutes}={}){
  if(!active)err("lab_disabled");
  if(typeof token!=="string"||!token||!id(storeId)||!int(minutes,5,120))err("invalid_request");
  const identity=await verifyToken(token,projectId);verifyIdentity(identity);
  const tx=await repository.transaction();
  try{
   const path="checkoutLabStores/"+storeId,m=await tx.get(path);
   if(!m||m.data.lab!==true||m.data.ownerUid!==identity.uid)err("forbidden");
   if((m.data.reservationMinutes??30)===minutes)return {minutes};
   await tx.commit([put(path,{...m.data,reservationMinutes:minutes},m)]);return {minutes};
  }finally{await tx.rollback()}
 }
 // Private scheduler interface, never exposed through the customer HTTP dispatcher.
 // listExpiredCandidates MUST filter received/pending/reserved and expiry <= before,
 // use a server-side bounded query, no full collection scan.
 async function sweepExpired({serviceToken,storeId,limit=20}={}){
  if(!active||typeof verifyScheduler!=="function"||typeof listExpiredCandidates!=="function")err("scheduler_disabled");
  if(typeof serviceToken!=="string"||!serviceToken||!id(storeId)||!int(limit,1,20))err("invalid_request");
  const verified=await verifyScheduler(serviceToken,projectId);
  if(!verified||verified.schedulerVerified!==true||verified.storeId!==storeId||!id(verified.ownerUid)||!id(verified.uid))err("forbidden");
  const service={...verified,uid:"scheduler_"+verified.uid};
  if(!id(service.uid))err("forbidden");
  const now=clock();const candidates=await listExpiredCandidates({storeId,ownerUid:service.ownerUid,before:now,limit});
  if(!Array.isArray(candidates)||candidates.length>limit)err("invalid_candidates");
  const result={scanned:0,released:0,duplicates:0,skipped:0,retry:0};
  for(const orderId of new Set(candidates)){
   if(!/^P[0-9]{7}$/.test(orderId)){result.skipped++;continue;}
   result.scanned++;
   try{const x=await executeInternal({storeId,kind:"transition",action:"expire",orderId,operationId:"auto_expire_"+orderId},service);if(x.duplicate)result.duplicates++;else result.released++}
   catch(e){if(["not_found","reservation_not_expired","manual_reconciliation_required","forbidden"].includes(e?.code))result.skipped++;else result.retry++}
  }
  return result;
 }
 return {execute:args=>executeInternal(args),closeCash,openCash,moveCash,configureReservation,sweepExpired};
}
