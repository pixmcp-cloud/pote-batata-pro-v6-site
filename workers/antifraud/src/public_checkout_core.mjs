// Deterministic checkout preparation; no writes. The future transaction adapter
// must load all canonical inputs in the SAME Firestore transaction, including
// pending orders, guard/pulse, eligibility, quote redemption and idempotency.
import {validQuote,slugOk,uidOk} from "./geo_core.mjs";
export class CheckoutError extends Error{constructor(code){super(code);this.code=code}}
const fail=code=>{throw new CheckoutError(code)};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const str=(v,max)=>typeof v==="string"&&v.trim().length>0&&v.length<=max;
const idOk=v=>str(v,72)&&/^[A-Za-z0-9_.:-]+$/.test(v);
const num=(v,min,max)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const add=(map,key,value)=>{
 if(!num(value,0,1e9))fail("invalid_recipe");
 const next=Math.round(((map.get(key)||0)+value)*100000)/100000;
 if(!num(next,0,1e9))fail("invalid_recipe");map.set(key,next);
};
function addOrderNeeds(map,order){
 if(!int(order.qty,1,10000))fail("invalid_existing_order");
 for(const row of order.items||[]){
  if(!idOk(row.id)||!num(row.g,0,1e8)||!num(row.yieldPct??100,1,1000))fail("invalid_existing_order");
  add(map,"ingredients:"+row.id,row.g*order.qty/((row.yieldPct??100)/100));
 }
 for(const row of order.beverageItems||[]){
  if(!idOk(row.id)||!num(row.qty,0,10000))fail("invalid_existing_order");
  add(map,"beverages:"+row.id,row.qty*order.qty);
 }
}
export function planPublicCheckout({buyerUid,menu,request,recipes,ingredients,beverages,existingOrders,
 settings={},lastSequence,quote,deliveryConfigVersion,now=Date.now()}){
 if(!uidOk(buyerUid)||!uidOk(menu?.ownerUid)||!slugOk(menu?.slug)||menu.published!==true||!str(menu.businessType,32))fail("store_unavailable");
 if(!request||request.slug!==menu.slug||!Array.isArray(request.lines)||request.lines.length<1||request.lines.length>30||
 !["retirada","entrega"].includes(request.fulfillment)||!["pix","cartao","dinheiro"].includes(request.payment)||
 !str(request.customerName,80)||typeof request.customerPhone!=="string"||!/^(?:\+?55)?\d{10,11}$/.test(request.customerPhone.replace(/[\s()-]/g,""))||
 !/^[A-Za-z0-9_-]{20,80}$/.test(request.operationId||""))fail("invalid_checkout");
 if(!Array.isArray(menu.items)||!Array.isArray(existingOrders)||!(recipes instanceof Map)||!(ingredients instanceof Map)||!(beverages instanceof Map)||!int(lastSequence,0,Number.MAX_SAFE_INTEGER-1))fail("data_not_ready");
 const catalog=new Map();for(const p of menu.items){if(!idOk(p.id)||catalog.has(p.id))fail("invalid_catalogue");catalog.set(p.id,p)}
 const lines=[],needs=new Map(),seen=new Set();let count=0,subtotalCents=0;
 for(const raw of request.lines){
  if(!idOk(raw?.id)||!int(raw.quantity,1,99)||!Array.isArray(raw.addonIds)||raw.addonIds.length||
   typeof raw.note!=="string"||raw.note.length>220)fail("invalid_cart_line");
  const key=JSON.stringify([raw.id,raw.note.trim()]);if(seen.has(key))fail("duplicate_cart_line");seen.add(key);
  const p=catalog.get(raw.id);
  if(!p||p.available===false||!int(p.priceCents,1,9999999)||!str(p.title,90))fail("product_unavailable");
  count+=raw.quantity;subtotalCents+=p.priceCents*raw.quantity;if(count>99||subtotalCents>99999999)fail("cart_limit");
  const item={id:p.id,name:p.title,qty:raw.quantity,unitPriceCents:p.priceCents,note:raw.note.trim(),items:[],beverageItems:[]};
  if(p.id.startsWith("bev-")){
   const id=p.id.slice(4),b=beverages.get(id);
   if(!b||b.archived||b.suspended||b.unavailable)fail("product_unavailable");
   item.beverageItems.push({id,name:b.name,qty:1});add(needs,"beverages:"+id,raw.quantity);
  }else{
   const r=recipes.get(p.id);
   if(!r||r.unavailable||r.suspended||r.archived||r.franchiseLocked||!Array.isArray(r.items)||!r.items.length||r.items.length>32)fail("product_unavailable");
   const rows=[...r.items];
   if(settings.usePackagingStock===true){
    for(const pkgId of new Set(r.packagingIngredientIds||[])){
     const pkg=ingredients.get(pkgId);if(!pkg||pkg.category!=="Embalagem"||pkg.archived)fail("invalid_packaging");
     rows.push({id:pkgId,g:1,isPkg:true});
    }
   }
   for(const x of rows){
    const ing=ingredients.get(x.id),yieldPct=ing?.yield??100;
    if(!idOk(x.id)||!ing||ing.archived||!num(x.g,0,1e8)||!num(yieldPct,1,1000))fail("invalid_recipe");
    item.items.push({id:x.id,g:x.g,yieldPct,ingredientName:String(ing.name||x.id).slice(0,180),measureUnit:String(ing.measureUnit||"g").slice(0,16),...(x.isPkg?{isPkg:true}:{})});
    add(needs,"ingredients:"+x.id,x.g*raw.quantity/(yieldPct/100));
   }
  }
  lines.push(item);
 }
 if(!needs.size||needs.size>64||![...needs.values()].some(v=>v>0))fail("cart_limit");
 const reserved=new Map();let highest=lastSequence;
 for(const o of existingOrders){
  if(o?.businessType&&o.businessType!==menu.businessType)fail("invalid_existing_order_scope");
  if(!int(o?.orderNumber??0,0,Number.MAX_SAFE_INTEGER-1))fail("invalid_sequence");
  highest=Math.max(highest,o.orderNumber||0);
  if(o.status==="recebido"&&o.stockDeducted!==true)addOrderNeeds(reserved,o);
 }
 for(const [key,need] of needs){
  const i=key.indexOf(":"),group=key.slice(0,i),id=key.slice(i+1);
  const record=(group==="ingredients"?ingredients:beverages).get(id);
  if(!record||!num(record.stock,0,1e9)||record.stock-(reserved.get(key)||0)+.000001<need)fail("insufficient_stock");
 }
 let feeCents=0,address="",quoteId=null;
 if(request.fulfillment==="entrega"){
  if(!str(request.quoteId,80)||quote?.id!==request.quoteId||!validQuote(quote,{uid:buyerUid,slug:menu.slug,version:deliveryConfigVersion,now}))fail("delivery_quote_invalid");
  feeCents=quote.feeCents;address=quote.address;quoteId=quote.id;
 }
 const orderNumber=highest+1;
 if(!int(orderNumber,1,Number.MAX_SAFE_INTEGER-1))fail("invalid_sequence");
 return {operationId:request.operationId,buyerUid,ownerUid:menu.ownerUid,slug:menu.slug,businessType:menu.businessType,
 orderNumber,code:"#P"+String(orderNumber).padStart(7,"0"),lines,subtotalCents,feeCents,totalCents:subtotalCents+feeCents,
 fulfillment:request.fulfillment,address,quoteId,customerName:request.customerName.trim(),customerPhone:request.customerPhone.replace(/\D/g,""),
 paymentMethod:request.payment,paymentStatus:"pending",status:"recebido",deliveryStatus:"recebido",
 createdAt:new Date(now).toISOString(),reservation:[...needs].map(([key,quantity])=>({key,quantity}))};
}
const NEXT={recebido:["em_producao","cancelado"],em_producao:["finalizado","cancelado"],finalizado:["saiu_entrega","entregue","cancelado"],saiu_entrega:["entregue","cancelado"],entregue:[],cancelado:[]};
export const DELIVERY_LABELS={recebido:"Pedido recebido",em_producao:"Em preparo",finalizado:"Pedido finalizado",saiu_entrega:"Saiu para entrega",entregue:"Seu pedido foi entregue",cancelado:"Pedido cancelado"};
export function transitionDelivery(order,next,{actorUid,now=Date.now()}={}){
 if(!order||!uidOk(actorUid)||!Object.hasOwn(NEXT,order.deliveryStatus)||!NEXT[order.deliveryStatus].includes(next))fail("invalid_transition");
 const owner=actorUid===order.ownerUid,courier=order.fulfillment==="entrega"&&actorUid===order.courierUid;
 if(!owner&&!(courier&&["saiu_entrega","entregue"].includes(next)))fail("forbidden_transition");
 if(order.fulfillment==="entrega"&&order.deliveryStatus==="finalizado"&&next==="entregue")fail("dispatch_required");
 if(order.fulfillment==="retirada"&&next==="saiu_entrega")fail("invalid_transition");
 if(next==="saiu_entrega"&&!uidOk(order.courierUid))fail("courier_required");
 const start=Date.parse(order.createdAt),previous=Date.parse(order.deliveryUpdatedAt||order.createdAt);
 if(!Number.isFinite(start)||!Number.isFinite(previous)||!Number.isSafeInteger(now)||now<previous||now<start)fail("invalid_clock");
 const at=new Date(now).toISOString(),terminal=["entregue","cancelado"].includes(next);
 return {...order,deliveryStatus:next,deliveryUpdatedAt:at,...(next==="entregue"?{deliveredAt:at,durationSeconds:Math.floor((now-start)/1000)}:{}),...(next==="cancelado"?{cancelledAt:at}:{}),
 deliveryEvents:[...(Array.isArray(order.deliveryEvents)?order.deliveryEvents:[]),{status:next,at,actorUid}],
 ...(terminal?{clockStoppedAt:at}:{})};
}
export function deliveryElapsed(order,now=Date.now()){
 const start=Date.parse(order?.createdAt),end=order?.clockStoppedAt?Date.parse(order.clockStoppedAt):now;
 return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.floor((end-start)/1000):null;
}
export function formatElapsed(seconds){
 if(!int(seconds,0,Number.MAX_SAFE_INTEGER))return null;
 return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,"0")).join(":");
}
