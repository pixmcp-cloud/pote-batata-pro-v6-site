// B02.2 laboratory transaction adapter for the existing Firestore REST repository interface.
// NEVER import in the live worker. Only synthetic project ID, explicit enablement and injected repo.
// Stock source is a server-administered manifest referencing actual V5 document keys (including
// model/free keys). The same physical document may be mapped by two stores sharing stock.
// The checkout inbox is NOT a native V5 orders record: old production code would debit twice.
import {createCheckoutQuote,submitCheckout,transitionCheckout,customerOrder} from "./checkout_domain.mjs";
import {planCheckoutCash} from "./checkout_cash_lab.mjs";
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
export function createCheckoutLabRepository({projectId,enabled=false,repository,verifyToken,clock=()=>Date.now()}={}){
 const active=enabled===true&&projectId===labProject&&typeof repository?.transaction==="function"&&typeof verifyToken==="function";
 async function execute({token,storeId,kind,operationId,quoteId,orderId,input,expectedRevision,expectedTotalCents,action,paymentReference}={}){
  if(!active)err("lab_disabled");
  if(typeof token!=="string"||!token||!id(storeId)||!["quote","submit","transition","status"].includes(kind))err("invalid_request");
  if(kind!=="status"&&!operation(operationId))err("invalid_operation");
  if(kind==="submit"&&!operation(quoteId)||["transition","status"].includes(kind)&&!id(orderId))err("invalid_request");
  const identity=await verifyToken(token,projectId);verifyIdentity(identity);
  const tx=await repository.transaction();
  try{
   const root="checkoutLabStores/"+storeId,manifest=await tx.get(root);
   const m=manifest?.data;
   if(!m||m.lab!==true||m.enabled!==true||!id(m.ownerUid)||!id(m.revision)||!id(m.universe)||!Array.isArray(m.products)||m.products.length>60||!Array.isArray(m.stockMap)||m.stockMap.length>32||!m.stockMap.length)err("store_unavailable");
   const merchant=kind==="transition";
   if(merchant&&identity.uid!==m.ownerUid)err("forbidden");
   const actor=actorFor(identity,merchant?"merchant":"customer",storeId),now=clock();
   if(!Number.isSafeInteger(now)||now<=0)err("invalid_time");
   const orderRoot=root+"/orders/",viewRoot=root+"/customerViews/";
   // Operation IDs are scoped to store and actor; prefix length encoding avoids separator collisions.
   const scopedOp=root+"/operations/"+identity.uid.length+"_"+identity.uid+"_"+operationId;
   const quotePath=root+"/quotes/"+quoteId;
   if(kind==="status"){
    const o=await tx.get(orderRoot+orderId);
    if(!o||o.data.customerUid!==identity.uid||o.data.storeId!==storeId)err("not_found");
    return projection(o.data,now);
   }
   const priorOp=await tx.get(scopedOp);
   const requestFingerprint=JSON.stringify([kind,quoteId??null,orderId??null,input??null,expectedRevision??null,expectedTotalCents??null,action??null,paymentReference??null]);
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
   const maps=new Map(),physical=new Set(),inventory=[];
   for(const s of m.stockMap){
    if(!id(s?.stockId)||!id(s.universe)||!["ingredients","beverages"].includes(s.group)||!docKey(s.recordKey)||!id(s.itemId)||![1,10,100,1000,10000,100000].includes(s.scale)||maps.has(s.stockId)||physical.has(s.recordKey))err("invalid_stock_mapping");
    const path=uidRoot+"/recordsV5/"+s.recordKey,d=await tx.get(path),record=d?.data?.record;
    if(!record||record.universe!==s.universe||record.group!==s.group||record.id!==s.itemId||typeof record.item?.stock!=="number")err("invalid_stock_mapping");
    const raw=record.item.stock*s.scale,units=Math.round(raw);
    if(!int(units)||Math.abs(raw-units)>0.000001)err("invalid_stock_precision");
    maps.set(s.stockId,{...s,path,doc:d,units});physical.add(s.recordKey);inventory.push({id:s.stockId,availableUnits:units});
   }
   const sequencePath=root+"/meta/sequence",sequence=await tx.get(sequencePath);
   if(!sequence||!int(sequence.data.value,0,9999998))err("not_ready");
   const state={id:storeId,revision:m.revision,enabled:true,deliveryEnabled:m.deliveryEnabled===true,deliveryFeeCents:m.deliveryFeeCents,products:m.products,inventory,sequence:sequence.data.value,quotes:[],orders:[]};
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
    result=transitionCheckout(state,actor,{orderId,operationId,action,paymentReference},now);
   }
   if(result.duplicate)err("inconsistent_operation");
   const o=result.order,orderPath=orderRoot+o.id,viewPath=viewRoot+o.id;
   const mapping=o.required.map(n=>{const s=maps.get(n.stockId);if(!s)err("stock_mapping_changed");return {stockId:n.stockId,ownerUid:m.ownerUid,recordKey:s.recordKey,universe:s.universe,group:s.group,itemId:s.itemId,scale:s.scale}});
   if(kind==="submit")o.reservedMapping=mapping;
   else if(!same(priorOrder.data.reservedMapping,mapping))err("stock_mapping_changed");
   const oldView=await tx.get(viewPath);
   if(kind==="submit"&&(await tx.get(orderPath)||oldView))err("order_collision");
   if(kind==="transition"&&(!oldView||oldView.data.customerUid!==o.customerUid))err("not_ready");
   const writes=[put(orderPath,o,priorOrder),put(viewPath,{customerUid:o.customerUid,storeId,status:projection(o,now),serverNowMs:now},oldView),put(scopedOp,{actorUid:identity.uid,fingerprint:requestFingerprint,orderId:o.id},null)];
   if(kind==="submit"){writes.push(put(quotePath,result.state.quotes[0],savedQuote),put(sequencePath,{value:result.state.sequence},sequence))}
   // Optional synthetic cash integration: fail closed for payment when no open shift.
   if(kind==="transition"&&action==="confirm_payment"){
    const pointerPath="checkoutLabCash/"+m.ownerUid,ptr=await tx.get(pointerPath);
    if(!ptr||!id(ptr.data.activeSessionId))err("cash_not_open");
    const sessionPath=pointerPath+"/sessions/"+ptr.data.activeSessionId,session=await tx.get(sessionPath);
    const receiptPath=pointerPath+"/receipts/"+storeId.length+"_"+storeId+"_"+o.id,priorReceipt=await tx.get(receiptPath);
    const receipt=planCheckoutCash({ownerUid:m.ownerUid,storeId,order:o,session:session?.data,priorReceipt,now});
    if(session.data.id!==ptr.data.activeSessionId)err("cash_not_open");
    // Update shift revision so closure and receipt cannot both win on a stale baseline.
    if(!int(session.data.revision)||session.data.revision>=1000000000)err("invalid_session");
    writes.push(put(receiptPath,receipt,null),put(sessionPath,{...session.data,revision:session.data.revision+1},session));
   }
   const changed=[];
   for(const after of result.state.inventory){
    const before=maps.get(after.id);if(before.units===after.availableUnits)continue;
    const record=copy(before.doc.data.record);record.item.stock=after.availableUnits/before.scale;
    writes.push(put(before.path,{...before.doc.data,record},before.doc));changed.push(before.recordKey);
    // Dedicated reservation ledger; not old production stockMovements until semantics reconciled.
    const ledger=root+"/stockLedger/"+identity.uid.length+"_"+identity.uid+"_"+operationId+"_"+after.id;
    if(await tx.get(ledger))err("ledger_collision");
    writes.push(put(ledger,{orderId:o.id,operationId,stockId:after.id,physicalKey:before.recordKey,scale:before.scale,deltaUnits:after.availableUnits-before.units,beforeUnits:before.units,afterUnits:after.availableUnits,at:now},null));
   }
   if(changed.length){
    if(guard.data.revision>=1000000000)err("limit");
    writes.push(put(uidRoot+"/appState/v5InventoryGuard",{...guard.data,revision:guard.data.revision+1},guard),put(uidRoot+"/appState/v5Pulse",{eventId:"checkout-"+storeId.length+"-"+storeId+"-"+identity.uid.length+"-"+identity.uid+"-"+operationId,previousEventId:pulse.data.eventId,origin:"checkout-lab",affected:changed.length,changedKeys:changed,metaChanged:false,sensitive:true},pulse));
   }
   if(writes.length>90)err("limit");
   await tx.commit(writes);
   return {...projection(o,now),duplicate:false};
  }finally{await tx.rollback()}
 }
 return {execute};
}
