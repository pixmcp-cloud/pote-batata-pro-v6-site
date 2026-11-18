/* F02: constrained server-priced direct order creation; not enabled for clients.
 * Unsupported addons, combos, promotions and unset server price fail closed.
 * Stock is checked but NOT reserved; production rechecks inventory atomically.
 */
import {OperationalError,recordPath} from "./domain.mjs";
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
function costUnit(item){
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
 const cashPath=recordPath(uid,universe,"cashSessions",cashSessionId);
 const guardPath=root+"/appState/v2InventoryGuard",pulsePath=root+"/appState/v2Pulse";
 const eventPath=root+"/workerEvents/"+operationId;
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,recipe,session,existing,event]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(recipePath),tx.get(cashPath),
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
  if(!Array.isArray(r.items)||r.items.length<1||r.items.length>32||
    r.packagingIngredientIds?.length||r.costEstimateMode==="estimated")
   bad("recipe_review_required","Receita exige conferência do catálogo");
  // F02_ORDER_VALIDATE_INGREDIENTS_AND_COMMIT
 }finally{await tx.rollback()}
}
