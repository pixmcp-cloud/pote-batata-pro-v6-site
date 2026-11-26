// G3: owner-only read adapter. Orders stay in checkout namespace, not V5 legacy orders.
import {queueRow} from "./pdv_checkout_queue.mjs";
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
export function createV5QueueReadLab({projectId,repository,verifyToken,clock=()=>Date.now()}={}){
 if(projectId!=="demo-nucleobit-checkout"||typeof repository?.transaction!=="function"||typeof verifyToken!=="function")fail("lab_disabled");
 return async ({token,storeIds}={})=>{
  const identity=await verifyToken(token,projectId);
  if(!identity||identity.emailVerified!==true||identity.provider!=="google.com"||!id(identity.uid))fail("login_required");
  if(!Array.isArray(storeIds)||!storeIds.length||storeIds.length>2||new Set(storeIds).size!==storeIds.length||storeIds.some(s=>!id(s)))fail("invalid_request");
  const tx=await repository.transaction();
  try{
   if(typeof tx.listCheckoutOrders!=="function")fail("not_ready");
   // Authorize ALL requested stores before reading any order.
   for(const storeId of storeIds){const m=(await tx.get("checkoutLabStores/"+storeId))?.data;if(!m||m.lab!==true||m.ownerUid!==identity.uid||!["online","counter"].includes(m.channel))fail("forbidden")}
   const now=clock(),orders=[];
   for(const storeId of storeIds){const docs=await tx.listCheckoutOrders({storeId,limit:61});if(!Array.isArray(docs)||docs.length>60)fail("queue_limit");
    const seen=new Set();for(const d of docs){const o=d.data;if(!o||o.storeId!==storeId||d.key!==o.id||seen.has(o.id))fail("invalid_order");seen.add(o.id);
     const row=queueRow(o,now);
     orders.push({id:o.id,storeId,channel:o.channel==="counter"?"counter":"online",status:row.status,paymentStatus:row.paymentStatus,paymentMethod:row.paymentMethod,stockState:row.stockState,createdAt:o.createdAt,deliveredAt:o.deliveredAt??null,reservationExpiresAt:o.reservationExpiresAt??null,events:o.status==="cancelled"?[{at:o.events.at(-1).at}]:[],totalCents:o.totalCents,fulfillment:o.fulfillment,lines:row.lines.map(l=>({title:l.title,quantity:l.quantity,totalCents:l.totalCents}))});
    }
   }
   return {now,orders:orders.sort((a,b)=>b.createdAt-a.createdAt||a.storeId.localeCompare(b.storeId)||a.id.localeCompare(b.id))};
  }finally{await tx.rollback()}
 };
}
