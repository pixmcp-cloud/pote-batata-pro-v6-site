/* Potê Batata authoritative inventory MVP — OFF by default.
 * Production is unchanged until authenticated Cloudflare deployment,
 * real emulator validation and explicit Firestore-rule cutover.
 */
import {verifyFirebaseToken} from "./auth.mjs";
import {createFirestoreRepository,FirestoreError} from "./firestore.mjs";
import {OperationalError,quantities,planOperation,recordPath,resolveRecord} from "./domain.mjs";
import {planStockLoss,LOSS_REASONS} from "./stock_loss.mjs";
import {planStockPurchase} from "./stock_purchase.mjs";
import {planStockRecount} from "./stock_recount.mjs";
import {checkoutRequest,verifyCheckoutChallenge,submitCheckout} from "./checkout.mjs";
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
// Escritas Cloudflare somente após ativação E inclusão expressa da conta de
// homologação na lista privada do ambiente. Sem lista, mesmo ENABLE_WRITES=true
// continua sem mutação de Firestore. Não aceita curingas nem dados do navegador.
const canaryPermitted=(env,uid)=>{
 if(env.ENABLE_WRITES!=="true")return false;
 const list=String(env.CANARY_UIDS||"").split(",").map(x=>x.trim()).filter(Boolean);
 return list.length>0&&list.length<=20&&list.every(x=>/^[A-Za-z0-9:_-]{1,128}$/.test(x))&&list.includes(uid);
};
function hasAccess(profile,claims,universe){
 const policy=profile?.accessPolicy||{};
 // Segunda aprovação administrada no Firebase: o secret Cloudflare sozinho
 // não habilita uma conta. O titular não pode alterar accessPolicy nas Rules.
 if(policy.workerAuthoritative!==true)return false;
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
 clock=()=>new Date(),checkoutChallenge=verifyCheckoutChallenge
}={}){
 async function performStockAdjust(req,env,headers){
  if(env.ENABLE_WRITES!=="true")
   return json({error:"not_activated",message:"Cloudflare Worker em homologação"},423,headers);
  const authorization=req.headers.get("Authorization")||"";
  if(!/^Bearer [^\s]+$/.test(authorization))
   return json({error:"authentication_required"},401,headers);
  let user;
  try{user=await verify(authorization.slice(7),env.FIREBASE_PROJECT_ID)}
  catch{return json({error:"invalid_firebase_token"},401,headers)}
  if(!user?.uid||!valueOk(user.uid,/^[a-zA-Z0-9:_-]{1,128}$/))
   return json({error:"invalid_identity"},401,headers);
  if(!canaryPermitted(env,user.uid))
   return json({error:"canary_not_authorized",message:"Operação reservada à homologação segura"},423,headers);
  let body;
  try{
   const text=await req.text();
   if(text.length>4096)throw Error("oversize");
   body=JSON.parse(text);
  }catch{return json({error:"invalid_json"},400,headers)}
  const isPurchase=body?.reason==="purchase";
  const isLoss=body?.reason==="loss";
  const isRecount=body?.reason==="recount";
  const common=["universe","group","itemId","operationId","reason",
   ...(isRecount?[]:["delta"])];
  const extra=isPurchase?["paidTotal","enteredQuantity","enteredUnit","supplier"]:
   isRecount?["previousStock","countedStock","note"]:["lossReason","note"];
  if(!body||typeof body!=="object"||Array.isArray(body)||
   !isPurchase&&!isLoss&&!isRecount||
   !valueOk(body.universe,/^[a-z0-9_-]{1,64}$/)||
   !valueOk(body.group,/^(ingredients|beverages)$/)||
   !valueOk(body.itemId,/^[a-zA-Z0-9_.:-]{1,180}$/)||
   !valueOk(body.operationId,/^[a-zA-Z0-9_-]{20,80}$/)||
   (!isRecount&&(typeof body.delta!=="number"||!Number.isFinite(body.delta)||
    Math.abs(body.delta)>1000000||
    Math.abs(Math.round(body.delta*1e5)/1e5-body.delta)>1e-8))||
   (isRecount&&(typeof body.previousStock!=="number"||
    typeof body.countedStock!=="number"||
    !Number.isFinite(body.previousStock)||!Number.isFinite(body.countedStock)||
    body.previousStock<0||body.previousStock>1e9||
    body.countedStock<0||body.countedStock>1e9||
    typeof body.note!=="string"||!body.note.trim()||body.note.length>350))||
   (isLoss&&(body.delta>=0||!Object.hasOwn(LOSS_REASONS,String(body.lossReason))||
     typeof body.note!=="string"||body.note.length>350||
     body.lossReason==="outro"&&!body.note.trim()))||
   (isPurchase&&(body.delta<=0||
     typeof body.paidTotal!=="number"||!Number.isFinite(body.paidTotal)||
     body.paidTotal<=0||body.paidTotal>1e9||
     typeof body.enteredQuantity!=="number"||!Number.isFinite(body.enteredQuantity)||
     body.enteredQuantity<=0||body.enteredQuantity>1e6||
     typeof body.enteredUnit!=="string"||!["g","kg","ml","L","un"].includes(body.enteredUnit)||
     typeof body.supplier!=="string"||body.supplier.length>130))||
   Object.keys(body).some(k=>!common.includes(k)&&!extra.includes(k)))
   return json({error:isPurchase?"invalid_purchase":
    isRecount?"invalid_recount":"invalid_stock_adjustment"},400,headers);
  const {uid}=user;
  const {universe,group,itemId,operationId,delta,lossReason,note,
   paidTotal,enteredQuantity,enteredUnit,supplier,
   previousStock,countedStock}=body;
  const root="users/"+uid;
  const eventPath=root+"/workerEvents/"+operationId;
  let stockPath=recordPath(uid,universe,group,itemId);
  const metaPath=root+"/appState/v5",guardPath=root+"/appState/v5InventoryGuard";
  const pulsePath=root+"/appState/v5Pulse";
  const store=repository(env),tx=await store.transaction();
  try{
   const profile=await tx.get(root);
   if(!profile||!hasAccess(profile.data,user,universe))
    throw new OperationalError("Operação não autorizada para esta unidade",403,"not_allowed");
   const event=await tx.get(eventPath);
   if(event){
    const prior=event.data;
    const same=prior?.action===(isPurchase?"purchase":isRecount?"recount":"adjust")&&
      prior?.universe===universe&&prior?.group===group&&
      prior?.itemId===itemId&&
      (isRecount?prior?.previousStock===previousStock&&
       prior?.countedStock===countedStock&&prior?.note===note:
       prior?.delta===delta&&(isPurchase?
       prior?.paidTotal===paidTotal&&prior?.enteredQuantity===enteredQuantity&&
       prior?.enteredUnit===enteredUnit&&prior?.supplier===supplier:
       prior?.lossReason===lossReason&&prior?.note===note));
    if(!same)
     throw new OperationalError("Identificador usado por outra operação",409,"idempotency_conflict");
    return json({ok:true,alreadyApplied:true,operationId,group,itemId,
     afterStock:prior.afterStock,
     ...(isPurchase?{purchaseId:prior.purchaseId}:
      isRecount?{recountId:prior.recountId}:{lossId:prior.lossId})},200,headers);
   }
   const [meta,guard,pulse,resolved]=await Promise.all([
    tx.get(metaPath),tx.get(guardPath),tx.get(pulsePath),resolveRecord(tx,uid,universe,group,itemId)
   ]);
   const existing=resolved.doc;stockPath=resolved.path;
   const state=meta?.data?.state?.data;
   const active=state?.businessType===universe;
   const archived=state?.businessUniverses?.[universe];
   if(!meta||meta.data.schemaVersion!==5||!guard||!pulse||
    !Number.isSafeInteger(guard.data.revision)||guard.data.revision<0||
    !pulse.data?.eventId||(!active&&!archived))
    throw new OperationalError("Base V5 não está pronta",409,"not_ready");
   if(!existing||existing.data?.record?.group!==group||
     existing.data?.record?.id!==itemId||
     existing.data?.record?.universe!==universe)
    throw new OperationalError("Cadastro de estoque inexistente",404,"stock_item_missing");
   const at=clock().toISOString();
   const settings=(active?state:archived)?.settings||{};
   const plan=isPurchase?
    planStockPurchase({group,itemId,delta,paidTotal,enteredQuantity,enteredUnit,
     supplier,operationId,universe,stock:existing.data.record.item,at}):
    isRecount?planStockRecount({group,itemId,previousStock,countedStock,note,
     operationId,universe,stock:existing.data.record.item,at,settings}):
    planStockLoss({group,itemId,delta,lossReason,note,
     operationId,universe,stock:existing.data.record.item,at,settings});
   const ledger=isPurchase?plan.purchase:plan.loss;
   const ledgerGroup=isPurchase?"purchases":"losses";
   const ledgerPath=ledger?recordPath(uid,universe,ledgerGroup,ledger.id):null;
   const movePath=recordPath(uid,universe,"stockMovements",plan.movement.id);
   const keys=[stockPath,...(ledgerPath?[ledgerPath]:[]),movePath]
    .map(p=>p.split("/").at(-1));
   const writes=[
    put(stockPath,{record:persisted(group,itemId,plan.item,universe,existing)},existing),
    ...(ledgerPath?[put(ledgerPath,{record:persisted(ledgerGroup,ledger.id,ledger,
      universe,null,-Date.now())},null)]:[]),
    put(movePath,{record:persisted("stockMovements",plan.movement.id,plan.movement,
      universe,null,-Date.now()-1)},null),
    put(guardPath,{revision:guard.data.revision+1},guard),
    put(pulsePath,{eventId:"cf-"+operationId,
      previousEventId:pulse.data.eventId,origin:"cloudflare-worker",
      affected:keys.length,changedKeys:keys,metaChanged:false,sensitive:true},pulse),
    put(eventPath,{
      action:isPurchase?"purchase":isRecount?"recount":"adjust",universe,group,itemId,
      ...(isRecount?{previousStock,countedStock,note}:{delta}),
      ...(isPurchase?{paidTotal,enteredQuantity,enteredUnit,supplier}:
        isRecount?{}:{lossReason,note}),
      operationId,actorUid:uid,afterStock:plan.item.stock,
      ...(isPurchase?{purchaseId:ledger.id}:
        isRecount?{recountId:plan.recountId}:{lossId:ledger.id})
     },null)
   ];
   await tx.commit(writes);
   return json({ok:true,alreadyApplied:false,operationId,group,itemId,
    afterStock:plan.item.stock,
    ...(isPurchase?{purchaseId:ledger.id}:
      isRecount?{recountId:plan.recountId}:{lossId:ledger.id})},200,headers);
  }finally{await tx.rollback()}
 }
 async function perform(req,env,headers){
  const route=new URL(req.url).pathname;
  if(route==="/v1/inventory/adjust")return performStockAdjust(req,env,headers);
  const action=route==="/v1/orders/produce"?"produce":
   route==="/v1/orders/cancel"?"cancel":null;
  if(!action)return json({error:"not_found"},404,headers);
  // Safe-by-default switch. Never expose service-account access by deploying
  // this source alone; the UI keeps using the current Firebase flow.
  if(env.ENABLE_WRITES!=="true")
   return json({error:"not_activated",message:"Cloudflare Worker em homologação"},423,headers);
  const authorization=req.headers.get("Authorization")||"";
  if(!/^Bearer [^\s]+$/.test(authorization))
   return json({error:"authentication_required"},401,headers);
  let user;
  try{user=await verify(authorization.slice(7),env.FIREBASE_PROJECT_ID)}
  catch{return json({error:"invalid_firebase_token"},401,headers)}
  if(!user?.uid||!valueOk(user.uid,/^[a-zA-Z0-9:_-]{1,128}$/))
   return json({error:"invalid_identity"},401,headers);
  if(!canaryPermitted(env,user.uid))
   return json({error:"canary_not_authorized",message:"Operação reservada à homologação segura"},423,headers);
  let body;
  try{
   const text=await req.text();
   if(text.length>4096)throw Error("oversize");
   body=JSON.parse(text);
  }catch{return json({error:"invalid_json"},400,headers)}
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
  const profilePath="users/"+uid,metaPath="users/"+uid+"/appState/v5";
  const guardPath="users/"+uid+"/appState/v5InventoryGuard";
  const pulsePath="users/"+uid+"/appState/v5Pulse";
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
   if(!meta||meta.data?.schemaVersion!==5||
      meta.data?.migration?.status==="copying"||!guard||!pulse||
      !Number.isInteger(guard.data?.revision)||!pulse.data?.eventId)
    throw new OperationalError("Sincronização V5 não está pronta",409,"not_ready");
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
    const docs=await Promise.all(load.map(x=>resolveRecord(tx,uid,universe,x.group,x.id)));
    for(let i=0;i<load.length;i++){
     const item=load[i],{doc,path}=docs[i];
     if(!doc||doc.data?.record?.group!==item.group||
        doc.data?.record?.id!==item.id||
        doc.data?.record?.universe!==universe)
      throw new OperationalError("Cadastro de estoque inexistente: "+item.id,409,"missing_stock");
     references.set(item.key,{doc,path});
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
    const key=stockItem.group+":"+stockItem.id,{doc:previous,path}=references.get(key);
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
   // Firestore V5 listeners depend on guard revision and pulse changes.
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
     writesEnabled:env.ENABLE_WRITES==="true"},200,headers);
   if(req.method!=="POST")return json({error:"not_found"},404,headers);
   try{
    if(route==="/v1/checkout"){
     // Public ordering is separate from authenticated stock operations. Verify
     // anti-abuse token once, not on each transaction retry.
     if(env.ENABLE_WRITES!=="true"||env.ENABLE_PUBLIC_CHECKOUT!=="true")return json({error:"checkout_disabled"},423,headers);
     if(!origin||req.headers.get("Content-Type")?.split(";")[0]!=="application/json")return json({error:"invalid_checkout"},400,headers);
     const input=await checkoutRequest(req);
     if(!await checkoutChallenge(input.challenge,env,input.operationId))return json({error:"challenge_required"},403,headers);
     for(let attempt=0;attempt<4;attempt++){
      try{const result=await submitCheckout({input,env,repository,at:clock()});return json(result,result.alreadyApplied?200:201,headers)}
      catch(e){if(!(e instanceof FirestoreError)||![409,412].includes(e.status)||attempt===3)throw e;
       await new Promise(resolve=>setTimeout(resolve,60*(attempt+1)+Math.floor(Math.random()*160)));
      }
     }
    }
    // O SDK Firestore do navegador repete transações em conflito; o REST
    // não faz retry automático. Tentar com uma NOVA transação (mesmo UUID)
    // evita perder a venda em conflitos transitórios; o estoque segue
    // protegido por updateTime, guarda e idempotência.
    for(let attempt=0;attempt<4;attempt++){
     try{return await perform(req.clone(),env,headers)}
     catch(error){
      if(!(error instanceof FirestoreError)||
         ![409,412].includes(error.status)||attempt===3)throw error;
      await new Promise(resolve=>setTimeout(resolve,
       60*(attempt+1)+Math.floor(Math.random()*160)));
     }
    }
    throw Error("Tentativas de transação esgotadas");
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
