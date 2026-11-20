/* F02/F05: server-authoritative physical stock adjustment.
 * Values are entered by an authenticated owner, but stock balance, cost
 * basis, authorization and inventory journal are read from Firestore.
 * This is NOT an invoice or payment confirmation endpoint.
 */
import {OperationalError,recordPath} from "./domain.mjs";

const isId=x=>typeof x==="string"&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(x);
const isUuid=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{20,80}$/.test(x);
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const round5=n=>Math.round((n+Number.EPSILON)*1e5)/1e5;
const change=(path,data,prior)=>({
 path,data,precondition:prior?{updateTime:prior.updateTime}:{exists:false}
});
function refuse(message,status=400,code="invalid_stock_adjustment"){
 throw new OperationalError(message,status,code);
}
export function validateStockAdjustment(body){
 if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).some(k=>!["universe","operationId","group","itemId","delta","reason","note"].includes(k)))
  refuse("Campos de ajuste inválidos");
 const {universe,operationId,group,itemId,delta,reason}=body;
 if(typeof universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(universe)||
    !isUuid(operationId)||!isId(itemId)||
    !["ingredients","beverages","packaging","addons"].includes(group)||
    !["purchase","loss","correction"].includes(reason))
  refuse("Identificação ou motivo de ajuste inválidos");
 if(typeof delta!=="number"||!Number.isFinite(delta)||delta===0||
    Math.abs(delta)>1000000||Math.abs(round5(delta)-delta)>1e-8)
  refuse("Quantidade inválida: informe até cinco casas decimais");
 if((reason==="purchase"&&delta<=0)||(reason==="loss"&&delta>=0))
  refuse("Compra deve aumentar e perda deve reduzir o estoque");
 const note=body.note===undefined?"":body.note;
 if(typeof note!=="string"||note.length>350||
    (reason==="correction"&&note.trim().length<3))
  refuse("Informe um motivo válido de até 350 caracteres");
 return {universe,operationId,group,itemId,delta,reason,note:note.trim()};
}
function estimateLoss(item,qty){
 const average=Number(item.averageUnitCost);
 if(item.averageCostKnown===true&&Number.isFinite(average)&&average>=0)
  return {costKnown:true,costLost:Math.round(qty*average*100)/100};
 return {costKnown:false,costLost:0};
}
export async function adjustInventory(body,{user,env,repository,clock,hasAccess}){
 const input=validateStockAdjustment(body);
 const {universe,operationId,group,itemId,delta,reason,note}=input;
 const uid=user.uid;
 const root="users/"+uid;
 const record=recordPath(uid,universe,group,itemId);
 const movementId="cf-adjust-"+operationId;
 const movementPath=recordPath(uid,universe,"stockMovements",movementId);
 const lossId="cf-loss-"+operationId;
 const lossPath=recordPath(uid,universe,"losses",lossId);
 const journal=root+"/workerEvents/"+operationId;
 const guardPath=root+"/appState/v2InventoryGuard";
 const pulsePath=root+"/appState/v2Pulse";
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,stockDoc,event]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(record),tx.get(journal)
  ]);
  if(!profile||!hasAccess(profile.data,user,universe))
   refuse("Operação não autorizada para esta unidade",403,"not_allowed");
  if(event){
   const prev=event.data;
   if(prev.action!=="adjust"||prev.universe!==universe||
      prev.group!==group||prev.itemId!==itemId||
      prev.delta!==delta||prev.reason!==reason||prev.note!==note)
    refuse("Identificador usado por outra operação",409,"idempotency_conflict");
   return {ok:true,alreadyApplied:true,group,itemId,operationId,
    stock:prev.resultingStock};
  }
  if(!meta||meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying"||
     !guard||!Number.isInteger(guard.data?.revision)||!pulse?.data?.eventId)
   refuse("Sincronização V2 não está pronta",409,"not_ready");
  const rec=stockDoc?.data?.record;
  if(!rec||rec.group!==group||rec.id!==itemId||rec.universe!==universe||
     !rec.item||typeof rec.item!=="object"||rec.item.archived===true)
   refuse("Insumo ou bebida não encontrado",404,"stock_item_missing");
  const current=Number(rec.item.stock);
  if(!Number.isFinite(current)||current<0||current>1e9)
   refuse("Saldo físico inválido",409,"invalid_stock");
  if(group!=="beverages"&&!["g","ml","un"].includes(rec.item.measureUnit))
   refuse("Unidade física não cadastrada; ajuste bloqueado",409,"invalid_stock_unit");
  if((group==="beverages"||rec.item.measureUnit==="un")&&!Number.isInteger(delta))
   refuse("Produtos em unidades exigem quantidades inteiras");
  const next=round5(current+delta);
  if(next<0||next>1e9)
   refuse("Saldo insuficiente ou acima do limite",409,"insufficient_stock");
  const at=clock().toISOString(),rank=-clock().getTime();
  const affected=[record.split("/").at(-1),movementPath.split("/").at(-1)];
  const movement={
   id:movementId,at,stockGroup:group,ingredientId:group==="beverages"?"bev:"+itemId:itemId,
   ingredientName:String(rec.item.name||itemId).slice(0,180),
   itemKind:group==="beverages"?"beverage":group==="packaging"?"packaging":group==="addons"?"addon":"ingredient",
   quantity:delta,reason:reason==="purchase"?"Entrada física por compra":
    reason==="loss"?"Perda de estoque":"Conferência manual de estoque",
   referenceId:operationId,previousStock:current,afterStock:next,note
  };
  const writes=[
   change(record,{record:{...rec,item:{...rec.item,stock:next}}},stockDoc),
   change(movementPath,{record:{universe,group:"stockMovements",
    id:movementId,rank,item:movement}},null)
  ];
  if(reason==="loss"){
   const qty=-delta,cost=estimateLoss(rec.item,qty);
   const unit=group==="beverages"?"un":rec.item.measureUnit;
   const loss={id:lossId,at,type:"stock",reason:"outro",
    description:note||"Perda física registrada no servidor",
    itemId,stockGroup:group,itemName:String(rec.item.name||itemId).slice(0,180),
    itemKind:group==="beverages"?"beverage":group==="packaging"?"packaging":group==="addons"?"addon":"ingredient",
    measureUnit:unit,quantityBase:qty,enteredQuantity:qty,enteredUnit:unit,
    ...cost,uncollectedSale:0,previousStock:current,afterStock:next};
   writes.push(change(lossPath,{record:{universe,group:"losses",
    id:lossId,rank:rank-1,item:loss}},null));
   affected.push(lossPath.split("/").at(-1));
  }
  writes.push(change(guardPath,{revision:guard.data.revision+1},guard));
  writes.push(change(pulsePath,{
   eventId:"cf-"+operationId,previousEventId:pulse.data.eventId,
   origin:"cloudflare-worker",affected:affected.length,
   changedKeys:affected,metaChanged:false,sensitive:true
  },pulse));
  writes.push(change(journal,{
   action:"adjust",universe,operationId,group,itemId,delta,reason,note,
   actorUid:uid,resultingStock:next
  },null));
  await tx.commit(writes);
  return {ok:true,alreadyApplied:false,group,itemId,operationId,
   stock:next,stockMovements:1,losses:reason==="loss"?1:0};
 }finally{
  await tx.rollback();
 }
}
