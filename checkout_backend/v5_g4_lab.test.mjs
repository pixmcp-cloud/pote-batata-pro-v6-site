import {validateCatalogSelection} from "./v5_catalog_approval_lab.mjs";
import {createV5QueueReadLab} from "./v5_queue_read_lab.mjs";
async function run(validate,create,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=async(fn,code)=>{let e;try{await fn()}catch(x){e=x}eq(e?.code??e?.message,code)};
 const s={recipeIds:["z","a"],beverageIds:[],addonIds:[],comboIds:[]};
 eq(validate(s),{...s,recipeIds:["a","z"]});
 for(const bad of [null,{...s,price:1},{...s,recipeIds:[]},{...s,recipeIds:["a","a"]},{...s,recipeIds:["../bad"]},{...s,addonIds:Array.from({length:21},(_,i)=>"a"+i)},{...s,recipeIds:Array.from({length:60},(_,i)=>"r"+i),beverageIds:["b"]}])await reject(()=>validate(bad),"invalid_selection");
 const now=1700000000000,storeId="shop1",owner="owner1",orders=Array.from({length:25},(_,i)=>{const id="P"+String(25-i).padStart(7,"0");return {key:id,data:{id,storeId,status:"received",paymentStatus:"pending",stockState:"reserved",paymentMethod:"pix",createdAt:now-1000,totalCents:1450,fulfillment:"pickup",lines:[{title:"Batata",quantity:1,totalCents:1450}],customerUid:"private"}}});
 let queries=0;const read=create({projectId:"demo-nucleobit-checkout",clock:()=>now,verifyToken:async uid=>({uid,emailVerified:true,provider:"google.com"}),repository:{transaction:async()=>({get:async p=>p==="checkoutLabStores/"+storeId?{data:{lab:true,ownerUid:owner,channel:"online"}}:null,listCheckoutOrders:async({cursor,limit})=>{queries++;eq(limit,21);return orders.slice(cursor?orders.findIndex(x=>x.key===cursor.id)+1:0).slice(0,limit)},rollback:async()=>{}})}});
 const args={token:owner,storeIds:[storeId]};
 const first=await read(args);eq(first.orders.length,20);eq(first.orders[0].id,"P0000025");eq(first.nextCursors[storeId],{createdAt:now-1000,id:"P0000006"});
 const second=await read({...args,cursors:first.nextCursors});eq(second.orders.length,5);eq(second.nextCursors,{});eq(new Set([...first.orders,...second.orders].map(x=>x.id)).size,25);eq(Object.hasOwn(first.orders[0],"customerUid"),false);
 await reject(()=>read({...args,token:"other"}),"forbidden");await reject(()=>read({...args,storeIds:[storeId,"foreign"]}),"forbidden");eq(queries,2);
 await reject(()=>read({...args,cursors:{foreign:{createdAt:now,id:"P0000001"}}}),"invalid_request");await reject(()=>read({...args,cursors:{shop1:{createdAt:0,id:"P0000001"}}}),"invalid_request");
 log("PASS G4 selection and queue",n,"assertivas");
}
await run(validateCatalogSelection,createV5QueueReadLab,console.log);
