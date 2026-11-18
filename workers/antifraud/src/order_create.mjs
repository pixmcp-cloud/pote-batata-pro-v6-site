/* F02: constrained server-priced direct order creation; not enabled for clients.
 * Unsupported addons, combos, promotions and unset server price fail closed.
 * Stock is reserved atomically with order creation; no double consumption in production.
 */
import {OperationalError,recordPath} from "./domain.mjs";
import {serverPricePath,verifyServerPrice} from "./server_price.mjs";
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
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,recipe,approval,session,existing,event]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(recipePath),tx.get(approvalPath),tx.get(cashPath),
   tx.get(orderPath),tx.get(eventPath)
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
    priceCents:v.priceCents};
  }
  if(!meta||meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying"||
    !guard||!Number.isInteger(guard.data?.revision)||!pulse?.data?.eventId)
   bad("not_ready","Sincronização V2 não está pronta");
  if(existing)bad("order_exists","Pedido já cadastrado");
  if(session?.data?.record?.group!=="cashSessions"||
     session.data.record.id!==cashSessionId||
     session.data.record.universe!==universe||
     session.data.record.item?.status!=="open")
   bad("cash_session_required","Caixa aberto obrigatório");
  const rec=recipe?.data?.record,r=rec?.item;
  if(!rec||rec.group!=="recipes"||rec.id!==recipeId||
     rec.universe!==universe||!r||r.unavailable||r.archived)
   bad("recipe_missing","Receita indisponível",404);
  if(r.serverPriceVersion!==1||!Number.isSafeInteger(r.serverSalePriceCents)||
     r.serverSalePriceCents<1||r.serverSalePriceCents>10000000)
   bad("price_review_required","Preço do servidor não homologado");
  const priceApproval=verifyServerPrice(approval,r,universe,recipeId);
  if(!Array.isArray(r.items)||r.items.length<1||r.items.length>32||
    r.packagingIngredientIds?.length||r.costEstimateMode==="estimated")
   bad("recipe_review_required","Receita exige conferência do catálogo");
    const rows=[],source=[];
  for(const row of r.items){
   if(!validId(row?.id)||typeof row.g!=="number"||
     !Number.isFinite(row.g)||row.g<=0||row.g>1000000)
    bad("recipe_review_required","Ingrediente da ficha inválido");
   source.push({id:row.id,g:row.g,
    path:recordPath(uid,universe,"ingredients",row.id)});
  }
  const ingDocs=await Promise.all(source.map(entry=>tx.get(entry.path)));
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
  if(!Number.isFinite(materialCost)||materialCost<=0)
   bad("cost_review_required","Custo da receita não está disponível");
  const minimum=priceApproval.minimumGainPct;
  if(priceApproval.salePriceCents+0.00001<materialCost*(1+minimum/100)*100)
   bad("price_below_cost","Preço abaixo da margem mínima aprovada");
  const at=clock().toISOString(),price=priceApproval.salePriceCents/100;
  const method={pix:"Pix",cash:"Dinheiro",card:"Cartão",
   delivery:"Na entrega"}[paymentMethod];
  const order={id:orderId,recipeId,name:String(r.name||recipeId).slice(0,180),
   qty,price,deliveryFee:0,cashSessionId,paymentMethod:method,
   paymentStatus:"pendente",status:"recebido",stockDeducted:true,
   createdAt:at,date:at.slice(0,10),channel:"direto",
   items:rows,beverageItems:[],unitVariableCost:
    Math.round(materialCost*100)/100,
   costSnapshot:{version:1,costKnown:true,estimated:false,
    totalMaterialCost:Math.round(materialCost*qty*100)/100,missingCosts:[]},
   priceSource:"server_recipe_snapshot",
   serverPriceVersion:1,serverPriceRevision:priceApproval.revision,
   stockReservationStatus:"reserved",bankReconciled:false};
  const movements=reservations.map((entry,index)=>{
   const id="cf-reserve-"+operationId+"-"+index;
   return {path:recordPath(uid,universe,"stockMovements",id),id,
    item:{id,at,ingredientId:entry.ingredientId,
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
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"cf-"+operationId,
    previousEventId:pulse.data.eventId,origin:"cloudflare-worker",
    affected:changed.length,changedKeys:changed,metaChanged:false,sensitive:true},pulse),
   put(eventPath,{action:"order_create",universe,orderId,recipeId,
    qty,cashSessionId,paymentMethod,operationId,
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
  return {ok:true,alreadyApplied:false,orderId,operationId,
   priceCents:priceApproval.salePriceCents,status:"recebido",
   reservationStatus:"reserved"};
 }finally{await tx.rollback()}
}
