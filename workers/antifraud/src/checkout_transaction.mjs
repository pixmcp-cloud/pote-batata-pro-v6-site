// Candidate transaction adapter. No public route; never call with browser-supplied quotes or UID.
import {uidOk,slugOk} from "./geo_core.mjs";
import {recordPath,quantities} from "./domain.mjs";
import {stockCostUnit} from "./stock_loss.mjs";
import {planPublicCheckout,CheckoutError} from "./public_checkout_core.mjs";
import {deliveryEntitlement} from "./delivery_policy.mjs";
import {buyerOrderView} from "./public_delivery_view.mjs";
const fail=code=>{throw new CheckoutError(code)};
const opOk=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{20,80}$/.test(x);
const uniOk=x=>typeof x==="string"&&/^[a-z0-9_-]{1,64}$/.test(x);
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const put=(path,data,prior)=>({path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,"0")).join("");
const monthInBrazil=now=>new Date(now-3*3600000).toISOString().slice(0,7);
const dateInBrazil=now=>new Date(now-3*3600000).toISOString().slice(0,10);
function inputFingerprint(r){
 return [r.slug,r.lines?.map(x=>[x.id,x.quantity,x.addonIds,x.note]),r.fulfillment,r.payment,r.customerName,r.customerPhone,r.quoteId??null,r.expectedTotalCents??null];
}
function records(rows,universe,group){
 const map=new Map();
 for(const r of rows){const x=r.data?.record;
  if(!x||x.universe!==universe||x.group!==group||typeof x.id!=="string"||x.id!==x.item?.id||map.has(x.id))fail("invalid_canonical_record");
  map.set(x.id,x.item);
 }
 return map;
}
function pdvOrder(plan,{id,stock,settings,now}){
 // A basket is ONE order in V5. qty=1 means one basket; each row is scaled
 // to the full quantity. The underlying inventory guard and F05 consume it once.
 const rows=[],bevs=[];
 for(const line of plan.lines){
  for(const x of line.items)rows.push({...x,g:x.g*line.qty});
  for(const x of line.beverageItems)bevs.push({...x,qty:x.qty*line.qty});
 }
 const provisional={id,qty:1,items:rows,beverageItems:bevs};
 const needs=quantities(provisional);
 const expected=new Map(plan.reservation.map(x=>[x.key,x.quantity]));
 if(needs.size!==expected.size||[...needs].some(([k,n])=>Math.abs(n-(expected.get(k)??Infinity))>0.00002))fail("reservation_mismatch");
 let cost=0;
 for(const [key,n] of needs){
  const pivot=key.indexOf(":"),group=key.slice(0,pivot),id=key.slice(pivot+1);
  const c=stockCostUnit(stock[group].get(id),group,settings);
  if(!c.known)fail("unknown_stock_cost");
  cost+=n*c.value;
 }
 if(!Number.isFinite(cost)||cost<0)fail("invalid_cost");
 const deliveryCost=plan.fulfillment==="entrega"?Number(settings.deliveryCostPerOrder||0):0;
 if(!Number.isFinite(deliveryCost)||deliveryCost<0)fail("invalid_delivery_cost");
 const price=plan.subtotalCents/100,firstRecipe=plan.lines.find(x=>!x.id.startsWith("bev-"));
 return {...provisional,publicCheckoutV6:true,publicCheckoutId:id.slice(4),fulfillment:plan.fulfillment,
  name:plan.lines.map(x=>x.qty+"x "+x.name).join(" + ").slice(0,180),
  recipeId:firstRecipe?.id||"",businessType:plan.businessType,orderNumber:plan.orderNumber,
  price,deliveryFee:plan.feeCents/100,deliveryCost,unitVariableCost:cost,unitContribution:price-cost,
  feePct:0,channel:"direto",clientId:"",clientName:plan.customerName,clientPhone:plan.customerPhone,clientAddress:plan.address,
  paymentMethod:{pix:"Pix",cartao:"Cartão",dinheiro:"Dinheiro"}[plan.paymentMethod],paymentStatus:"nao_pago",
  cashSessionId:null,status:"recebido",stockDeducted:false,createdAt:plan.createdAt,date:dateInBrazil(now),
  note:plan.lines.filter(x=>x.note).map(x=>x.name+": "+x.note).join(" | ").slice(0,220),
  publicLines:plan.lines.map(x=>({name:x.name,id:x.id,qty:x.qty,unitPriceCents:x.unitPriceCents,note:x.note})),
  addons:[],removedIngredients:[],customAddons:[],deliveryStatus:"recebido"};
}
export async function commitPublicCheckout({repository,buyerUid,request,quote=null,deliveryConfigVersion=null,loadQuote=null,limits,now=Date.now()}){
 if(!uidOk(buyerUid)||!slugOk(request?.slug)||!opOk(request.operationId)||!Array.isArray(request.lines)||request.lines.length<1||request.lines.length>30||!int(now,0,Number.MAX_SAFE_INTEGER))fail("invalid_checkout");
 const hash=await digest([buyerUid,request.slug,request.operationId]),fingerprint=await digest(inputFingerprint(request));
 const eventPath="publicCheckoutEvents/"+hash,receiptPath="publicOrderReceipts/"+hash;
 const tx=await repository.transaction();
 try{
  const existing=await tx.get(eventPath);
  if(existing){
   if(existing.data.fingerprint!==fingerprint||existing.data.buyerUid!==buyerUid)fail("idempotency_conflict");
   return {...existing.data.result,alreadyApplied:true};
  }
  const menuDoc=await tx.get("publicMenus/"+request.slug),menu=menuDoc?.data;
  if(!menu||menu.slug!==request.slug||menu.published!==true||!uidOk(menu.ownerUid)||!uniOk(menu.businessType))fail("store_unavailable");
  const uid=menu.ownerUid,universe=menu.businessType,root="users/"+uid;
  const metaPath=root+"/appState/v5",guardPath=root+"/appState/v5InventoryGuard",pulsePath=root+"/appState/v5Pulse";
  const [profile,meta,guard,pulse]=await Promise.all([tx.get(root),tx.get(metaPath),tx.get(guardPath),tx.get(pulsePath)]);
  // No real merchant is authorized by the client. Separate admin-side canary approval required.
  if(profile?.data?.accessPolicy?.workerAuthoritative!==true||profile?.data?.accessPolicy?.publicCheckout!==true)fail("merchant_not_approved");
  const state=meta?.data?.state?.data,settings=state?.settings||{};
  if(meta?.data?.schemaVersion!==5||state?.businessType!==universe||meta.data.migration?.status==="copying"||
     !int(guard?.data?.revision,0,Number.MAX_SAFE_INTEGER-1)||typeof pulse?.data?.eventId!=="string")fail("merchant_not_ready");
  // Only existing isolated active-universe layout is accepted in this candidate.
  if(state.sharedStock===true||settings.sharedStock===true||state.shareStock===true||settings.shareStock===true)fail("shared_stock_not_supported");
  const counterPath=root+"/deliveryUsageV6/"+monthInBrazil(now);
  const counter=request.fulfillment==="entrega"?await tx.get(counterPath):null;
  const used=counter?.data?.count??0;
  const entitlement=deliveryEntitlement({profile:profile.data,universe,used,limits,now});
  // FREE remains disabled for operational mutations until canonical FREE key policy is verified.
  if(entitlement.plan!=="pro")fail("plan_not_ready");
  if(request.fulfillment==="entrega"&&!entitlement.canStartDelivery)fail("monthly_delivery_limit");
  let redeemedPath=null;
  if(request.fulfillment==="entrega"){
   if(!opOk(request.quoteId))fail("delivery_quote_invalid");
   if(loadQuote){const trusted=await loadQuote({buyerUid,slug:request.slug,quoteId:request.quoteId});if(trusted?.ownerUid!==uid)fail("delivery_quote_invalid");quote=trusted?.quote;deliveryConfigVersion=trusted?.version;}
   if(quote?.id!==request.quoteId)fail("delivery_quote_invalid");
   redeemedPath="publicQuoteRedemptions/"+await digest([request.quoteId]);
   if(await tx.get(redeemedPath))fail("quote_already_used");
  }
  // Read only requested products/stock and currently reserved orders; no full history scan.
  const fetchIds=async(group,ids)=>{
   const unique=[...new Set(ids)];
   if(unique.length>128||unique.some(id=>typeof id!=="string"||!id||id.length>72))fail("invalid_record_ids");
   const rows=[];for(let i=0;i<unique.length;i+=30)rows.push(...await tx.listRecords(uid,universe,group,{ids:unique.slice(i,i+30),limit:unique.slice(i,i+30).length+2}));
   return records(rows,universe,group);
  };
  if(request.lines.some(x=>!x||typeof x.id!=="string"||x.id.length>72))fail("invalid_cart_line");
  const [pendingRows,sequenceRows,rankRows,recipes,beverages]=await Promise.all([
   tx.listRecords(uid,universe,"orders",{status:"recebido",limit:101}),
   tx.listRecords(uid,universe,"orders",{edge:"sequence"}),
   tx.listRecords(uid,universe,"orders",{edge:"rank"}),
   fetchIds("recipes",request.lines.filter(x=>!x.id.startsWith("bev-")).map(x=>x.id)),
   fetchIds("beverages",request.lines.filter(x=>x.id.startsWith("bev-")).map(x=>x.id.slice(4)))
  ]);
  const ingredientIds=[];
  for(const recipe of recipes.values()){
   if(!Array.isArray(recipe.items)||recipe.items.length>32)fail("invalid_recipe");
   ingredientIds.push(...recipe.items.map(x=>x.id));
   if(settings.usePackagingStock===true)ingredientIds.push(...(recipe.packagingIngredientIds||[]));
  }
  const ingredients=await fetchIds("ingredients",ingredientIds);
  const orders=records(pendingRows,universe,"orders");
  for(const [id,o] of records(sequenceRows,universe,"orders"))if(!orders.has(id))orders.set(id,o);

  const plan=planPublicCheckout({buyerUid,menu,request,recipes,ingredients,beverages,existingOrders:[...orders.values()],
   settings,lastSequence:state.orderSequenceLast??0,quote,deliveryConfigVersion,now});
  if(request.expectedTotalCents!==undefined&&(!int(request.expectedTotalCents,1,999999999)||request.expectedTotalCents!==plan.totalCents))fail("price_changed");
  const order=pdvOrder(plan,{id:"web-"+hash,stock:{ingredients,beverages},settings,now});
  const orderPath=recordPath(uid,universe,"orders",order.id),key=orderPath.split("/").at(-1);
  // Rank must precede existing rows, including legacy negative-rank writes.
  const ranks=rankRows.map(x=>x.data.record.rank);
  if(ranks.some(x=>!Number.isFinite(x)))fail("invalid_order_rank");
  const rank=Math.min(0,...ranks)-1000;
  if(!Number.isFinite(rank)||ranks.includes(rank))fail("invalid_order_rank");
  const nextMeta=structuredClone(meta.data);
  nextMeta.state.data.orderSequenceLast=plan.orderNumber;
  const result={ok:true,id:hash,orderId:order.id,code:plan.code,subtotalCents:plan.subtotalCents,feeCents:plan.feeCents,totalCents:plan.totalCents,paymentStatus:"pending",status:"recebido"};
  const privateReceipt={...plan,id:hash,pdvOrderId:order.id,deliveryRevision:0,...(plan.fulfillment==='entrega'?{destination:quote.destination}:{}),lines:plan.lines.map(({name,id,qty,unitPriceCents,note})=>({name,id,qty,unitPriceCents,note}))};
  delete privateReceipt.reservation;
  const writes=[
   put(orderPath,{record:{universe,group:"orders",id:order.id,item:order,rank}},null),
   put(metaPath,nextMeta,meta),
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"checkout-"+hash,previousEventId:pulse.data.eventId,origin:"cloudflare-checkout-v6",affected:2,changedKeys:[key],metaChanged:true,sensitive:true},pulse),
   put(eventPath,{buyerUid,fingerprint,result},null),
   put(receiptPath,privateReceipt,null),
   put("publicOrderViews/"+hash,{...buyerOrderView(privateReceipt,buyerUid,now),buyerUid},null)
  ];
  if(redeemedPath)writes.push(put(redeemedPath,{quoteId:request.quoteId,buyerUid,ownerUid:uid,orderId:order.id},null),
   put(counterPath,{count:used+1,month:monthInBrazil(now)},counter));
  await tx.commit(writes);
  return {...result,alreadyApplied:false};
 }finally{await tx.rollback()}
}
