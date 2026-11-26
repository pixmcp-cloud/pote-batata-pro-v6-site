import {createCheckoutRecovery} from "./checkout_recovery_lab.mjs";
async function run(create,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=async(fn,code)=>{let e;try{await fn()}catch(x){e=x}eq(e?.code??e?.message,code)};
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 let uid="buyer1",seq=0,committed=null,lose=true,calls=[];
 const opts={storage,getUid:()=>uid,storeId:"shop1",newOperationId:()=>"checkout_operation_"+String(++seq).padStart(4,"0"),send:async(kind,body,actor)=>{calls.push({kind,body,actor});if(kind==="recoverSubmit")return committed?{state:"committed",order:committed}:{state:"unconfirmed"};committed={id:"P0000001",storeId:"shop1"};if(lose)throw Error("reply_lost");return committed}};
 const quote={quoteId:"checkout_quote_001",revision:"rev1",totalCents:1450,address:"private",token:"never",lines:[]};
 let a=create(opts);eq(await a.recover(),{state:"none"});await reject(()=>a.begin(quote),"reply_lost");eq(a.pending().operationId,"checkout_operation_0001");
 eq(Object.keys(a.pending()).sort(),["expectedRevision","expectedTotalCents","operationId","quoteId","storeId"]);eq([...memory.values()].join("").includes("private"),false);
 await reject(()=>a.begin(quote),"pending_checkout");a=create(opts);eq((await a.recover()).order.id,"P0000001");eq(a.pending(),null);eq(calls.filter(x=>x.kind==="submitSaved").length,1);
 committed=null;lose=true;await reject(()=>a.begin(quote),"reply_lost");committed=null;a=create(opts);eq(await a.recover(),{state:"unconfirmed"});eq(a.pending().operationId,"checkout_operation_0002");eq(calls.filter(x=>x.kind==="submitSaved").length,2);
 uid="buyer2";eq(await a.recover(),{state:"none"});eq(a.pending(),null);uid="buyer1";lose=false;eq((await a.retry()).state,"committed");eq(calls.at(-1).body.operationId,"checkout_operation_0002");eq(a.pending(),null);
 const broken=create({...opts,storage:{...storage,setItem:()=>{throw Error("quota")}}});const before=calls.length;await reject(()=>broken.begin(quote),"recovery_storage_unavailable");eq(calls.length,before);
 const switched=create({...opts,send:async()=>{uid="buyer2";return {id:"P0000002",storeId:"shop1"}}});await reject(()=>switched.begin(quote),"session_changed");eq(switched.pending(),null);uid="buyer1";eq(switched.pending().operationId,"checkout_operation_0004");
 const other=create({...opts,storeId:"shop2"});eq(other.pending(),null);uid=null;await reject(()=>a.recover(),"login_required");
 uid="buyer1";const k=[...memory.keys()][0];memory.set(k,"bad json");await reject(()=>a.recover(),"recovery_record_invalid");eq(memory.get(k),"bad json");
 log("PASS B02-G1 recovery",n,"assertivas");
}
await run(createCheckoutRecovery,console.log);
