// B02-G1. One pending confirmed checkout per authenticated UID + store in
// the supplied session storage. No token, address, cart, or payment data persisted.
// No automatic resubmission: recovery first checks server, retry needs explicit consent.
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const op=x=>id(x)&&x.length>=16;
const fail=code=>{throw Object.assign(Error(code),{code})};
const valid=x=>x&&Object.keys(x).sort().join(",")==="expectedRevision,expectedTotalCents,operationId,quoteId,storeId"&&id(x.storeId)&&op(x.operationId)&&op(x.quoteId)&&id(x.expectedRevision)&&Number.isSafeInteger(x.expectedTotalCents)&&x.expectedTotalCents>0&&x.expectedTotalCents<=1000000000;
export function createCheckoutRecovery({storage,getUid,storeId,send,newOperationId}={}){
 if(!storage||typeof getUid!=="function"||typeof send!=="function"||typeof newOperationId!=="function"||!id(storeId))fail("invalid_config");
 let busy=false;
 const scope=()=>{const uid=getUid();if(!id(uid))fail("login_required");return {uid,key:"nucleobit:checkout:g1:"+uid.length+":"+uid+":"+storeId}};
 function read(s){let raw;try{raw=storage.getItem(s.key)}catch{fail("recovery_storage_unavailable")}if(raw===null)return null;let p;try{p=JSON.parse(raw)}catch{fail("recovery_record_invalid")}if(!valid(p)||p.storeId!==storeId)fail("recovery_record_invalid");return p}
 function write(s,p){try{storage.setItem(s.key,JSON.stringify(p));if(storage.getItem(s.key)!==JSON.stringify(p))fail("recovery_storage_unavailable")}catch{fail("recovery_storage_unavailable")}}
 function clear(s,p){if(JSON.stringify(read(s))!==JSON.stringify(p))fail("recovery_record_changed");try{storage.removeItem(s.key)}catch{fail("recovery_storage_unavailable")}}
 function check(s){if(getUid()!==s.uid)fail("session_changed")}
 const perform=async(fn)=>{if(busy)fail("operation_in_progress");busy=true;try{return await fn()}finally{busy=false}};
 const accepted=(o)=>o&&id(o.id)&&o.storeId===storeId;
 async function lookup(s,p){check(s);const res=await send("recoverSubmit",{storeId,operationId:p.operationId,quoteId:p.quoteId},s.uid);check(s);
  if(res?.state==="committed"&&accepted(res.order)){clear(s,p);return res}
  if(res?.state==="unconfirmed")return res;fail("operation_not_confirmed")
 }
 async function submit(s,p){check(s);const result=await send("submitSaved",p,s.uid);check(s);if(!accepted(result))fail("operation_not_confirmed");clear(s,p);return {state:"committed",order:result}}
 return {
  pending:()=>read(scope()),
  begin:quote=>perform(async()=>{const s=scope();if(read(s))fail("pending_checkout");const p={storeId,operationId:newOperationId(),quoteId:quote?.quoteId,expectedRevision:quote?.revision,expectedTotalCents:quote?.totalCents};if(!valid(p))fail("invalid_quote");write(s,p);return submit(s,p)}),
  recover:()=>perform(async()=>{const s=scope(),p=read(s);return p?lookup(s,p):{state:"none"}}),
  retry:()=>perform(async()=>{const s=scope(),p=read(s);if(!p)return {state:"none"};const result=await lookup(s,p);if(result.state==="committed")return result;return submit(s,p)})
 };
}
