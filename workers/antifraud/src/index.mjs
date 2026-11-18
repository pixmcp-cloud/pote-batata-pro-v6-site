/* Potê Batata authoritative inventory MVP — OFF by default.
 * Production is unchanged until authenticated Cloudflare deployment,
 * real emulator validation and explicit Firestore-rule cutover.
 */
import {verifyFirebaseToken} from "./auth.mjs";
import {createFirestoreRepository,FirestoreError} from "./firestore.mjs";
import {OperationalError,quantities,planOperation,recordPath} from "./domain.mjs";
import {adjustInventory} from "./stock_adjust.mjs";
import {confirmOperatorReceipt} from "./receipt.mjs";
import {openCashSession,closeCashSession} from "./cash_session.mjs";
import {createSimpleOrder} from "./order_create.mjs";
import {finishSale} from "./finish_sale.mjs";
import {ingestAsaasWebhook} from "./asaas_webhook.mjs";
const json=(payload,status=200,headers={})=>new Response(JSON.stringify(payload),{
 status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff",...headers}
});
const originHeaders=(origin,allowed)=>allowed&&origin?{
 "Access-Control-Allow-Origin":origin,"Vary":"Origin",
 "Access-Control-Allow-Headers":"Authorization, Content-Type",
 "Access-Control-Allow-Methods":"GET, POST, OPTIONS"
}:{};
const valueOk=(input,pattern)=>typeof input==="string"&&pattern.test(input);
function hasAccess(profile,claims,universe){
 const policy=profile?.accessPolicy||{};
 if(policy.blockedUniverses?.includes(universe)||
    policy.blockedServices?.includes(universe+":stock")||
    policy.blockedServices?.includes(universe+":orders"))return false;
 if(claims.isAdmin)return true;
 const franchise=profile?.franchise;
 if(franchise?.status==="active"&&franchise.brandId==="potebatata")return true;
 const license=profile?.license;
 if(license?.status!=="active")return false;
 if(license.kind==="lifetime"&&license.term==="lifetime")return true;
 return ["trial","pro"].includes(license.kind)&&
  Date.parse(license.expiresAt||"")>Date.now();
}
const put=(path,data,prior)=>({
 path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}
});
const persisted=(group,id,item,universe,prior,rank)=>({
 universe,group,id,item,rank:prior?.data?.record?.rank??rank
});
export function createWorkerApp({
 verify=verifyFirebaseToken,repository=createFirestoreRepository,
 clock=()=>new Date()
}={}){
 async function perform(req,env,headers){
  const route=new URL(req.url).pathname;
  const action=route==="/v1/orders/produce"?"produce":
   route==="/v1/orders/cancel"?"cancel":
   route==="/v1/inventory/adjust"?"adjust":
   route==="/v1/orders/receipt"?"receipt":
   route==="/v1/cash/open"?"cash_open":
   route==="/v1/cash/close"?"cash_close":
   route==="/v1/orders/create"?"order_create":
   route==="/v1/orders/finish"?"finish_sale":null;
  if(!action)return json({error:"not_found"},404,headers);
  // Safe-by-default switch. Never expose service-account access by deploying
  // this source alone; the UI keeps using the current Firebase flow.
  // Two independent release gates: enabling writes does not authorize a real
  // Firebase project until a separate, auditable cutover is approved.
  const demoProject=/^demo-[a-z0-9-]+$/.test(String(env.FIREBASE_PROJECT_ID||""));
  if(env.ENABLE_WRITES!=="true"||(!demoProject&&env.PRODUCTION_CUTOVER_APPROVED!=="true"))
   return json({error:"not_activated",message:"Cloudflare Worker em homologação"},423,headers);
  const authorization=req.headers.get("Authorization")||"";
  if(!/^Bearer [^\s]+$/.test(authorization))
   return json({error:"authentication_required"},401,headers);
  let user;
  try{user=await verify(authorization.slice(7),env.FIREBASE_PROJECT_ID)}
  catch{return json({error:"invalid_firebase_token"},401,headers)}
  if(!user?.uid||!valueOk(user.uid,/^[a-zA-Z0-9:_-]{1,128}$/))
   return json({error:"invalid_identity"},401,headers);
  let body;
  try{
   const text=await req.text();
   if(text.length>4096)throw Error("oversize");
   body=JSON.parse(text);
  }catch{return json({error:"invalid_json"},400,headers)}
  if(action==="finish_sale"){
   const result=await finishSale(body,{user,env,repository,clock,hasAccess});
   return json(result,200,headers);
  }
  if(action==="order_create"){
   const result=await createSimpleOrder(body,{user,env,repository,clock,hasAccess});
   return json(result,200,headers);
  }
  if(action==="cash_close"){
   const result=await closeCashSession(body,{user,env,repository,clock,hasAccess});
   return json(result,200,headers);
  }
  if(action==="cash_open"){
   const result=await openCashSession(body,{user,env,repository,clock,hasAccess});
   return json(result,200,headers);
  }
  if(action==="receipt"){
   const result=await confirmOperatorReceipt(body,{user,env,repository,clock,hasAccess});
   return json(result,200,headers);
  }
  if(action==="adjust"){
   const adjusted=await adjustInventory(body,{user,env,repository,clock,hasAccess});
   return json(adjusted,200,headers);
  }
  if(!body||typeof body!=="object"||Array.isArray(body)||
    !valueOk(body.universe,/^[a-z0-9_-]{1,64}$/)||
    !valueOk(body.orderId,/^[a-zA-Z0-9_.:-]{1,180}$/)||
    !valueOk(body.operationId,/^[a-zA-Z0-9_-]{20,80}$/)||
    Object.keys(body).some(k=>!["universe","orderId","operationId","decision"].includes(k))||
    (action==="cancel"&&!["return","loss"].includes(body.decision))||
    (action==="produce"&&body.decision!==undefined))
   return json({error:"invalid_operation_request"},400,headers);
  const {uid}=user,{universe,orderId,operationId,decision}=body;
  const orderPath=recordPath(uid,universe,"orders",orderId);
  const eventPath="users/"+uid+"/workerEvents/"+operationId;
  const profilePath="users/"+uid,metaPath="users/"+uid+"/appState/v2";
  const guardPath="users/"+uid+"/appState/v2InventoryGuard";
  const pulsePath="users/"+uid+"/appState/v2Pulse";
  const store=repository(env);
  const tx=await store.transaction();
  try{
   const event=await tx.get(eventPath);
   if(event){
    const prev=event.data;
    if(prev?.action!==action||prev?.universe!==universe||
       prev?.orderId!==orderId||prev?.decision!==(decision||null))
     throw new OperationalError("Identificador usado por outra operação",409,"idempotency_conflict");
    return json({ok:true,alreadyApplied:true,orderId,operationId,
     status:prev.resultStatus},200,headers);
   }
   const profile=await tx.get(profilePath);
   if(!profile||!hasAccess(profile.data,user,universe))
    throw new OperationalError("Operação não autorizada para esta unidade",403,"not_allowed");
   const [meta,guard,pulse,ordered]=await Promise.all([
    tx.get(metaPath),tx.get(guardPath),tx.get(pulsePath),tx.get(orderPath)
   ]);
   if(!meta||meta.data?.schemaVersion!==2||
      meta.data?.migration?.status==="copying"||!guard||!pulse||
      !Number.isInteger(guard.data?.revision)||!pulse.data?.eventId)
    throw new OperationalError("Sincronização V2 não está pronta",409,"not_ready");
   if(!ordered||ordered.data?.record?.group!=="orders"||
      ordered.data.record.id!==orderId||ordered.data.record.universe!==universe)
    throw new OperationalError("Pedido não encontrado nesta unidade",404,"order_missing");
   const original=ordered.data.record;
   const counts=action==="cancel"&&original.item.stockDeducted!==true?
    new Map():quantities(original.item);
   // Don't trust any item or quantity supplied by the browser.
   const stock=new Map(),references=new Map();
   const load=[];
   const needInventory=action==="produce"||(action==="cancel"&&
    original.item.stockDeducted===true&&decision==="return");
   if(needInventory){
    for(const key of counts.keys()){
     const pivot=key.indexOf(":"),group=key.slice(0,pivot),id=key.slice(pivot+1);
     const path=recordPath(uid,universe,group,id);
     load.push({key,path,group,id});
    }
    const docs=await Promise.all(load.map(x=>tx.get(x.path)));
    for(let i=0;i<load.length;i++){
     const item=load[i],doc=docs[i];
     if(!doc||doc.data?.record?.group!==item.group||
        doc.data?.record?.id!==item.id||
        doc.data?.record?.universe!==universe)
      throw new OperationalError("Cadastro de estoque inexistente: "+item.id,409,"missing_stock");
     references.set(item.key,doc);
     stock.set(item.key,doc.data.record.item);
    }
   }
   const at=clock().toISOString();
   const planned=planOperation({
    action,decision,order:original.item,stock,universe,operationId,at
   });
   const changed=[orderPath.split("/").at(-1)],writes=[];
   writes.push(put(orderPath,{
    record:persisted("orders",orderId,planned.order,universe,ordered)
   },ordered));
   for(const stockItem of planned.stockUpdates){
    const key=stockItem.group+":"+stockItem.id,previous=references.get(key);
    const path=recordPath(uid,universe,stockItem.group,stockItem.id);
    writes.push(put(path,{
     record:persisted(stockItem.group,stockItem.id,stockItem.item,universe,previous)
    },previous));
    changed.push(path.split("/").at(-1));
   }
   let sequence=0;
   for(const [group,items] of [["stockMovements",planned.movements],["losses",planned.losses]]){
    for(const item of items){
     const path=recordPath(uid,universe,group,item.id);
     writes.push(put(path,{record:persisted(group,item.id,item,universe,null,
      -Date.now()-(sequence++/1000))},null));
     changed.push(path.split("/").at(-1));
    }
   }
   // The Firestore V2 listeners depend on guard revision and pulse changes.
   // These must be committed with the operational documents, never later.
   const oldGuard=guard.data.revision,previousPulse=pulse.data.eventId;
   writes.push(put(guardPath,{revision:oldGuard+1},guard));
   writes.push(put(pulsePath,{
    eventId:"cf-"+operationId,previousEventId:previousPulse,
    origin:"cloudflare-worker",affected:changed.length,
    changedKeys:changed,
    metaChanged:false,sensitive:true
   },pulse));
   writes.push(put(eventPath,{
    action,decision:decision||null,universe,orderId,operationId,
    resultStatus:planned.order.status,countedMovements:planned.movements.length,
    actorUid:uid
   },null));
   if(writes.length>100)
    throw new OperationalError("Pedido exige processamento manual",409,"too_many_items");
   await tx.commit(writes);
   return json({ok:true,alreadyApplied:false,orderId,operationId,
    status:planned.order.status,stockMovements:planned.movements.length},200,headers);
  }finally{await tx.rollback()}
 }
 return {
  async fetch(req,env){
   const origin=req.headers.get("Origin");
   const origins=String(env.ALLOWED_ORIGINS||"").split(",").map(s=>s.trim()).filter(Boolean);
   const allowed=!origin||origins.includes(origin);
   if(!allowed)return json({error:"origin_not_allowed"},403);
   const headers=originHeaders(origin,allowed);
   if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
   const route=new URL(req.url).pathname;
   if(req.method==="GET"&&route==="/health")
    return json({status:"ok",project:"pote-batata-pro",
     writesEnabled:env.ENABLE_WRITES==="true"&&(/^demo-[a-z0-9-]+$/.test(String(env.FIREBASE_PROJECT_ID||""))||env.PRODUCTION_CUTOVER_APPROVED==="true")},200,headers);
   if(req.method!=="POST")return json({error:"not_found"},404,headers);
   try{
    if(route==="/v1/asaas/webhook"){
     const result=await ingestAsaasWebhook(req,{env,repository,clock});
     return json(result,200,headers);
    }
    return await perform(req,env,headers);
   }
   catch(e){
    if(e instanceof OperationalError)
     return json({error:e.code,message:e.message},e.status,headers);
    if(e instanceof FirestoreError){
     if([409,412].includes(e.status))
      return json({error:"transaction_conflict",
       message:"Outra sessão alterou o pedido; recarregue os dados."},409,headers);
     return json({error:"database_unavailable"},503,headers);
    }
    // Do not disclose Google OAuth details, Firestore paths, or credentials.
    return json({error:"server_unavailable"},503,headers);
   }
  }
 };
}
export default createWorkerApp();
