/* F02: constrained server-priced direct order creation; not enabled for clients.
 * Unsupported addons, combos, promotions and unset server price fail closed.
 * Stock is reserved atomically with order creation; no double consumption in production.
 */
import {OperationalError,recordPath} from "./domain.mjs";
import {serverPricePath,verifyServerPrice} from "./server_price.mjs";
import {complexRecipeComponentLines,minimumApprovedPriceCents} from "./component_cost.mjs";
const bad=(code,message,status=409)=>{throw new OperationalError(message,status,code)};
const put=(path,data,prior)=>({path,data,precondition:prior?
 {updateTime:prior.updateTime}:{exists:false}});
const validId=x=>typeof x==="string"&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(x);
const validOp=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{20,80}$/.test(x);
function validate(b){
 if(!b||typeof b!=="object"||Array.isArray(b)||
  Object.keys(b).some(k=>!["universe","operationId","orderId","recipeId",
   "qty","cashSessionId","paymentMethod"].includes(k))||
  typeof b.universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(b.universe)||
  !validOp(b.operationId)||!validId(b.orderId)||!validId(b.recipeId)||
  !validId(b.cashSessionId)||!Number.isSafeInteger(b.qty)||
  b.qty<1||b.qty>1000||!["pix","cash","card","delivery"].includes(b.paymentMethod))
  bad("invalid_order_request","Dados de pedido inválidos",400);
 return b;
}
export function costUnit(item){
 if(item.averageCostKnown===true){
  const x=Number(item.averageUnitCost);
  if(Number.isFinite(x)&&x>0)return x;
 }
 const price=Number(item.purchasePrice??item.price);
 const qty=Number(item.purchaseQuantity),unit=item.purchaseUnit;
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(qty)||qty<=0)
  bad("cost_review_required","Preço de compra do ingrediente incompleto");
 if(!["kg","g","L","ml","un"].includes(unit))
  bad("cost_review_required","Unidade da compra não reconhecida");
 const base=item.measureUnit==="ml"?"ml":item.measureUnit==="un"?"un":"g";
 if((base==="g"&&!["kg","g"].includes(unit))||
    (base==="ml"&&!["L","ml"].includes(unit))||
    (base==="un"&&unit!=="un"))
  bad("cost_review_required","Unidade de ingrediente incompatível");
 return price/(qty*((unit==="kg"||unit==="L")?1000:1));
}
export async function createSimpleOrder(body,{user,env,repository,clock,hasAccess}){
 const input=validate(body);
 const {universe,operationId,orderId,recipeId,qty,cashSessionId,paymentMethod}=input;
 const uid=user.uid,root="users/"+uid;
 const orderPath=recordPath(uid,universe,"orders",orderId);
 const recipePath=recordPath(uid,universe,"recipes",recipeId);
 const approvalPath=serverPricePath(uid,universe,recipeId);
 const cashPath=recordPath(uid,universe,"cashSessions",cashSessionId);
 const guardPath=root+"/appState/v2InventoryGuard",pulsePath=root+"/appState/v2Pulse";
 const eventPath=root+"/workerEvents/"+operationId;
 const sequencePath=root+"/appState/v2OrderSequence__"+universe;
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,recipe,approval,session,existing,event,sequenceControl]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(recipePath),tx.get(approvalPath),tx.get(cashPath),
   tx.get(orderPath),tx.get(eventPath),tx.get(sequencePath)
  ]);
  if(!profile||!hasAccess(profile.data,user,universe))
   bad("not_allowed","Conta sem permissão",403);
  if(event){
   const v=event.data;
   if(v.action!=="order_create"||v.universe!==universe||
      v.orderId!==orderId||v.recipeId!==recipeId||v.qty!==qty||
      v.cashSessionId!==cashSessionId||v.paymentMethod!==paymentMethod)
    bad("idempotency_conflict","Identificador de operação reutilizado");
   return {ok:true,alreadyApplied:true,orderId,operationId,
    orderNumber:v.orderNumber,priceCents:v.priceCents};
  }
  if(!meta||meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying"||
    !guard||!Number.isInteger(guard.data?.revision)||!pulse?.data?.eventId)
   bad("not_ready","Sincronização V2 não está pronta");
  if(existing)bad("order_exists","Pedido já cadastrado");
  // The sequence control is created by a verified migration for real tenants.
  // Demo-only tests can bootstrap from the V2 metadata, never from client input.
  const state=meta.data?.state?.data;
  const legacyBranch=state?.businessType===universe?state:state?.businessUniverses?.[universe];
  const oldNumber=legacyBranch?.orderSequenceLast??0;
  if(!Number.isSafeInteger(oldNumber)||oldNumber<0)
   bad("order_sequence_invalid","Contador antigo de pedidos inválido");
  if(!sequenceControl&&!/^demo-[a-z0-9-]+$/.test(String(env.FIREBASE_PROJECT_ID||"")))
   bad("order_sequence_migration_required","Contador precisa de conferência antes de migrar para pedidos autoritativos");
  if(sequenceControl&&(sequenceControl.data?.version!==1||sequenceControl.data?.universe!==universe||
      !Number.isSafeInteger(sequenceControl.data?.last)||sequenceControl.data.last<oldNumber))
   bad("order_sequence_invalid","Sequência do servidor não corresponde ao histórico V2");
  const lastNumber=sequenceControl?.data?.last??oldNumber;
  if(lastNumber>=Number.MAX_SAFE_INTEGER)
   bad("order_sequence_exhausted","Sequência de pedidos excedeu limite seguro");
  const orderNumber=lastNumber+1;
  // Keep the V2 metadata counter in the same transaction as the server
  // control and order record: clients loading/recovering the UI must never
  // fall behind or reissue a public number after a rollback to the web UI.
  // Production cutover additionally requires a verified migrated counter.
  const envelope=meta.data?.state,activeState=envelope?.data;
  const activeUniverse=activeState?.businessType===universe;
  const archived=activeState?.businessUniverses?.[universe];
  if(!activeUniverse&&!archived&&!/^demo-[a-z0-9-]+$/.test(String(env.FIREBASE_PROJECT_ID||"")))
   bad("order_sequence_migration_required","Universo comercial não existe no estado V2");
  const nextData=activeUniverse?{...activeState,orderSequenceLast:orderNumber}:
   archived?{...activeState,businessUniverses:{...activeState.businessUniverses,
    [universe]:{...archived,orderSequenceLast:orderNumber}}}:null;
  const nextMeta=nextData?{...meta.data,state:{...envelope,data:nextData}}:null;
  if(session?.data?.record?.group!=="cashSessions"||
     session.data.record.id!==cashSessionId||
     session.data.record.universe!==universe||
     session.data.record.item?.status!=="open")
   bad("cash_session_required","Caixa aberto obrigatório");
  const rec=recipe?.data?.record,r=rec?.item;
  if(!rec||rec.group!=="recipes"||rec.id!==recipeId||
     rec.universe!==universe||!r||r.unavailable||r.archived)
   bad("recipe_missing","Receita indisponível",404);
  if(![1,2].includes(r.serverPriceVersion)||!Number.isSafeInteger(r.serverSalePriceCents)||
     r.serverSalePriceCents<1||r.serverSalePriceCents>10000000)
   bad("price_review_required","Preço do servidor não homologado");
  const priceApproval=verifyServerPrice(approval,r,universe,recipeId);
  if(!Array.isArray(r.items)||r.items.length<1||r.items.length>32||
    r.packagingIngredientIds?.length||r.costEstimateMode==="estimated")
   bad("recipe_review_required","Receita exige conferência do catálogo");
    const rows=[],source=[];
  const complex=r.serverPriceVersion===2;
  const allLines=complex?complexRecipeComponentLines(r):null;
  const ingredientLines=complex?allLines.filter(line=>line.kind==="ingredient"):
   r.items.map(item=>({id:item.id,quantity:item.g,unit:"g"}));
  for(const row of ingredientLines){
   if(!validId(row?.id)||typeof row.quantity!=="number"||row.unit!=="g"||
     !Number.isFinite(row.quantity)||row.quantity<=0||row.quantity>1000000)
    bad("recipe_review_required","Ingrediente da ficha inválido");
   source.push({id:row.id,g:row.quantity,
    path:recordPath(uid,universe,"ingredients",row.id)});
  }
  const extraLines=complex?allLines.filter(line=>line.kind!=="ingredient"):[];
  const groupFor={packaging:"packaging",addon:"addons",beverage:"beverages"};
  const extraSource=extraLines.map(line=>({...line,
   path:recordPath(uid,universe,groupFor[line.kind],line.id)}));
  const ingDocs=await Promise.all(source.map(entry=>tx.get(entry.path)));
  const extraDocs=await Promise.all(extraSource.map(entry=>tx.get(entry.path)));
  // Legacy V2 packaging is an ingredient with category "Embalagem".
  // Never synthesize a second packaging inventory balance or overwrite it.
  const legacyPackaging=await Promise.all(extraSource.map((part,i)=>
   part.kind==="packaging"&&!extraDocs[i]?
    tx.get(recordPath(uid,universe,"ingredients",part.id)):Promise.resolve(null)));
  let materialCost=0;
  const reserveByIngredient=new Map();
  for(let i=0;i<source.length;i++){
   const part=source[i],stock=ingDocs[i]?.data?.record,item=stock?.item;
   if(!stock||stock.group!=="ingredients"||stock.universe!==universe||
      stock.id!==part.id||!item||item.archived)
    bad("missing_stock","Ingrediente sem cadastro",409);
   const yieldPct=Number(item.yield??100),onHand=Number(item.stock);
   if(!Number.isFinite(yieldPct)||yieldPct<1||yieldPct>1000||
      !Number.isFinite(onHand)||onHand<0)
    bad("invalid_stock","Estoque ou rendimento inválido");
   const need=part.g*qty/(yieldPct/100);
   if(!Number.isFinite(need)||need>1e9||onHand+0.00002<need)
    bad("insufficient_stock","Saldo físico insuficiente");
   materialCost+=part.g*costUnit(item)/(yieldPct/100);
   const prior=reserveByIngredient.get(part.id);
   if(prior)prior.needed+=need;
   else reserveByIngredient.set(part.id,{path:part.path,prior:ingDocs[i],item,onHand,needed:need});
   rows.push({id:part.id,g:part.g,yieldPct,ingredientName:
    String(item.name||part.id).slice(0,150),
    measureUnit:item.measureUnit||"g"});
  }
  const extraReservations=new Map();
  const extraRows={packaging:[],addon:[],beverage:[]};
  for(let i=0;i<extraSource.length;i++){
   const part=extraSource[i],dedicated=extraDocs[i]?.data?.record;
   const legacy=!dedicated&&part.kind==="packaging"?
    legacyPackaging[i]?.data?.record:null;
   const useLegacy=legacy?.group==="ingredients"&&legacy?.id===part.id&&
    legacy.universe===universe&&legacy.item?.category==="Embalagem"&&
    legacy.item?.measureUnit==="un";
   const physicalGroup=useLegacy?"ingredients":groupFor[part.kind];
   const prior=useLegacy?legacyPackaging[i]:extraDocs[i];
   const recExtra=prior?.data?.record,item=recExtra?.item;
   if(!recExtra||recExtra.group!==physicalGroup||recExtra.id!==part.id||
      recExtra.universe!==universe||!item||item.archived||item.measureUnit!==part.unit)
    bad("missing_stock","Componente sem estoque ou unidade incompatível");
   if(useLegacy&&source.some(row=>row.id===part.id))
    bad("recipe_review_required","Embalagem também presente como ingrediente da ficha");
   const yieldPct=Number(item.yield??100),onHand=Number(item.stock);
   if(!Number.isFinite(yieldPct)||yieldPct<=0||yieldPct>100||
      !Number.isFinite(onHand)||onHand<0)bad("invalid_stock","Estoque ou rendimento inválido");
   if(part.kind==="beverage"&&yieldPct!==100)
    bad("recipe_review_required","Bebida fracionada exige contrato de estoque");
   const needed=part.quantity*qty/(yieldPct/100);
   const path=useLegacy?recordPath(uid,universe,"ingredients",part.id):part.path;
   const key=physicalGroup+":"+part.id;
   const previous=extraReservations.get(key);
   if(previous)previous.needed+=needed;
   else extraReservations.set(key,{kind:useLegacy?"ingredient":part.kind,
    id:part.id,path,prior,item,onHand,needed});
   materialCost+=part.quantity*costUnit(item)/(yieldPct/100);
   if(useLegacy)rows.push({id:part.id,g:part.quantity,yieldPct,
    measureUnit:"un",ingredientName:String(item.name||part.id).slice(0,150),
    isPkg:true,stockGroup:"ingredients"});
   else extraRows[part.kind].push({id:part.id,quantity:part.quantity,
    yieldPct,measureUnit:part.unit});
  }
  const reservations=[];
  for(const [ingredientId,snapshot] of reserveByIngredient){
   const needed=Math.round(snapshot.needed*1e5)/1e5;
   if(!Number.isFinite(needed)||needed<=0||needed>1e9||
      snapshot.onHand+0.00002<needed)
    bad("insufficient_stock","Estoque insuficiente para reservar pedido");
   const after=Math.round((snapshot.onHand-needed)*1e5)/1e5;
   if(after<0)bad("insufficient_stock","Saldo negativo bloqueado");
   reservations.push({ingredientId,...snapshot,needed,after});
  }
  for(const entry of extraReservations.values()){
   const needed=Math.round(entry.needed*1e5)/1e5;
   if(!Number.isFinite(needed)||needed<=0||needed>1e9||
      entry.onHand+0.00002<needed)bad("insufficient_stock","Estoque insuficiente");
   const after=Math.round((entry.onHand-needed)*1e5)/1e5;
   if(after<0)bad("insufficient_stock","Saldo negativo bloqueado");
   reservations.push({ingredientId:entry.id,...entry,needed,after});
  }
  if(!Number.isFinite(materialCost)||materialCost<=0)
   bad("cost_review_required","Custo da receita não está disponível");
  const minimum=priceApproval.minimumGainPct;
  if(priceApproval.salePriceCents<minimumApprovedPriceCents(Math.ceil(materialCost*100-1e-9),minimum))
   bad("price_below_cost","Preço abaixo da margem mínima aprovada");
  const at=clock().toISOString(),price=priceApproval.salePriceCents/100;
  const method={pix:"Pix",cash:"Dinheiro",card:"Cartão",
   delivery:"Na entrega"}[paymentMethod];
  const order={id:orderId,orderNumber,recipeId,name:String(r.name||recipeId).slice(0,180),
   qty,price,deliveryFee:0,cashSessionId,paymentMethod:method,
   paymentStatus:"pendente",status:"recebido",stockDeducted:true,
   createdAt:at,date:at.slice(0,10),channel:"direto",
   items:rows,packagingItems:extraRows.packaging,
   addonItems:extraRows.addon,
   beverageItems:extraRows.beverage.map(x=>({id:x.id,qty:x.quantity})),unitVariableCost:
    Math.round(materialCost*100)/100,
   costSnapshot:{version:1,costKnown:true,estimated:false,
    totalMaterialCost:Math.round(materialCost*qty*100)/100,missingCosts:[]},
   priceSource:"server_recipe_snapshot",
   serverPriceVersion:r.serverPriceVersion,serverPriceRevision:priceApproval.revision,
   stockReservationStatus:"reserved",bankReconciled:false};
  const movements=reservations.map((entry,index)=>{
   const id="cf-reserve-"+operationId+"-"+index;
   return {path:recordPath(uid,universe,"stockMovements",id),id,
    item:{id,at,stockGroup:entry.kind==="packaging"?"packaging":entry.kind==="addon"?"addons":entry.kind==="beverage"?"beverages":"ingredients",ingredientId:entry.ingredientId,
     ingredientName:String(entry.item.name||entry.ingredientId).slice(0,180),
     quantity:-entry.needed,reason:"Reserva de pedido",
     referenceId:orderId,previousStock:entry.onHand,afterStock:entry.after,
     stockMovement:true}};
  });
  const changed=[orderPath.split("/").at(-1),
   ...reservations.map(entry=>entry.path.split("/").at(-1)),
   ...movements.map(entry=>entry.path.split("/").at(-1))];
  const writes=[
   put(orderPath,{record:{universe,group:"orders",id:orderId,
    rank:-clock().getTime(),item:order}},null),
   put(sequencePath,{version:1,universe,last:orderNumber},sequenceControl),
   ...(nextMeta?[put(root+"/appState/v2",nextMeta,meta)]:[]),
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"cf-"+operationId,
    previousEventId:pulse.data.eventId,origin:"cloudflare-worker",
    affected:changed.length,changedKeys:changed,metaChanged:Boolean(nextMeta),sensitive:true},pulse),
   put(eventPath,{action:"order_create",universe,orderId,recipeId,
    qty,cashSessionId,paymentMethod,operationId,orderNumber,
    priceCents:priceApproval.salePriceCents,actorUid:uid,
    stockReservationStatus:"reserved"},null)
  ];
  for(const entry of reservations){
   writes.push(put(entry.path,{record:{...entry.prior.data.record,
    item:{...entry.item,stock:entry.after}}},entry.prior));
  }
  for(const movement of movements){
   writes.push(put(movement.path,{record:{
    universe,group:"stockMovements",id:movement.id,
    rank:-clock().getTime(),item:movement.item}},null));
  }
  if(writes.length>100)bad("too_many_items","Pedido excede limite da transação");
  await tx.commit(writes);
  return {ok:true,alreadyApplied:false,orderId,operationId,orderNumber,
   priceCents:priceApproval.salePriceCents,status:"recebido",
   reservationStatus:"reserved"};
 }finally{await tx.rollback()}
}
