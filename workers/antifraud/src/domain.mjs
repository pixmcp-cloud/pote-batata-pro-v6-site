/* Shared deterministic domain logic. Never trusts quantities or stock sent
 * by the browser: the Worker reads existing tenant records from Firestore. */
export class OperationalError extends Error {
 constructor(message,status=422,code="invalid_operation"){super(message);this.status=status;this.code=code}
}
export function keyFor(universe,group,id) {
 const json=JSON.stringify([universe,group,String(id)]);
 const utf8=new TextEncoder().encode(json);
 let raw="";for(const b of utf8)raw+=String.fromCharCode(b);
 return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
export const recordPath=(uid,universe,group,id)=>
 "users/"+uid+"/records/"+keyFor(universe,group,id);
export const nearly=(a,b)=>Math.abs(a-b)<=0.00002;
const round5=n=>Number(n.toFixed(5));
const finite=(v,label,{min=0,max=1e9}={})=>{
 const n=Number(v);
 if(!Number.isFinite(n)||n<min||n>max)
  throw new OperationalError(label+" fora dos limites");
 return n;
};
export function quantities(order){
 const qty=finite(order?.qty,"Quantidade do pedido",{min:0.000001,max:10000});
 if(order?.stockOverrideApproved)
  throw new OperationalError("Produção com divergência requer conferência manual",409,"manual_review");
 const out=new Map();
 const add=(group,id,count)=>{
  if(typeof id!=="string"||!id||id.length>220)
   throw new OperationalError("Item do pedido sem identificador válido");
  const k=group+":"+id;
  out.set(k,(out.get(k)||0)+finite(count,"Consumo",{max:1e8}));
 };
 for(const item of order.items||[]){
  const yieldPct=finite(item.yieldPct??100,"Rendimento",{min:1,max:1000});
  const grams=finite(item.g,"Peso de ingrediente",{max:1e8});
  add("ingredients",item.id,grams*qty/(yieldPct/100));
 }
 for(const item of order.beverageItems||[]){
  const count=finite(item.qty,"Quantidade de bebida",{max:10000});
  add("beverages",item.id,count*qty);
 }
 if(out.size<1||out.size>32)
  throw new OperationalError("Pedido sem insumos ou com muitos itens; use conferência manual",409,"manual_review");
 for(const [key,count] of out){
  if(!Number.isFinite(count)||count<0||count>1e9)
   throw new OperationalError("Consumo acumulado inválido");
  out.set(key,round5(count));
 }
 return out;
}
export function planOperation({action,decision,order,stock,universe,operationId,at}){
 if(!order||typeof order!=="object")
  throw new OperationalError("Pedido não encontrado",404,"order_missing");
 if(!["produce","cancel"].includes(action))
  throw new OperationalError("Operação desconhecida",400);
 const reservedProduce=action==="produce"&&order.status==="recebido"&&
   order.stockDeducted===true&&order.stockReservationStatus==="reserved";
 const qty=reservedProduce||
   (action==="cancel"&&order.stockDeducted!==true)?new Map():quantities(order);
 const nextOrder={...order};
 const movements=[],stockUpdates=[],losses=[];
 const isProduce=action==="produce";
 if(isProduce){
  if(order.status!=="recebido"||(order.stockDeducted===true&&!reservedProduce))
   throw new OperationalError("Pedido já produzido ou em estado incompatível",409,"order_state");
  nextOrder.status="em_producao";nextOrder.producedAt=at;nextOrder.stockDeducted=true;
  if(reservedProduce)nextOrder.stockReservationStatus="consumed";
 }else{
  if(order.status==="cancelado")
   throw new OperationalError("Pedido já cancelado",409,"order_state");
  if(!["recebido","em_producao","entregue"].includes(order.status))
   throw new OperationalError("Pedido não pode ser cancelado neste estado",409,"order_state");
  if(!["return","loss"].includes(decision))
   throw new OperationalError("Selecione devolver ou registrar perda",400);
  nextOrder.status="cancelado";nextOrder.canceledAt=at;
  const deducted=order.stockDeducted===true;
  if(order.stockRestored===true||order.stockReturnDeclined===true)
   throw new OperationalError("Pedido já regularizado",409,"order_state");
  nextOrder.cancelStockAction=!deducted?"sem-baixa":decision==="return"?"devolvido":"perda";
  if(deducted&&decision==="return"){
   nextOrder.stockRestored=true;nextOrder.stockRestoredAt=at;nextOrder.stockReturnDeclined=false;
  }else if(deducted){
   nextOrder.stockReturnDeclined=true;
   const lossId="cf-loss-"+operationId;
   nextOrder.lossEventId=lossId;
   const unit=Number(order.unitVariableCost),units=finite(order.qty,"Quantidade");
   const known=Number.isFinite(unit)&&unit>=0&&Number.isFinite(Number(order.deliveryCost||0));
   const cost=known?Math.round((unit*units+Math.max(0,Number(order.deliveryCost||0)))*100)/100:0;
   const paid=Boolean(order.paymentConfirmedAt)||
    ["pago","confirmado","pago em dinheiro"].includes(
     String(order.paymentStatus||"").toLowerCase());
   const sale=Math.max(0,units*Number(order.price||0)+Number(order.deliveryFee||0));
   losses.push({id:lossId,at,type:"order",reason:"cancelamento",
    description:"Cancelamento com perda física - operação no servidor",
    orderId:order.id,orderName:String(order.name||"").slice(0,180),
    quantity:units,costLost:cost,costKnown:known,
    costEstimated:known&&Boolean(order.costEstimatePct),
    missingCosts:known?[]:["Custo exige conferência"],
    uncollectedSale:!paid&&Number.isFinite(sale)?Math.round(sale*100)/100:0,
    stockAlreadyDeducted:true,stockMovement:false});
  }
 }
 const mutateStock=(isProduce&&!reservedProduce)||(action==="cancel"&&order.stockDeducted===true&&decision==="return");
 if(mutateStock){
  let n=0;
  for(const [kindId,needed] of qty){
   if(!(needed>0))continue;
   const index=kindId.indexOf(":"),group=kindId.slice(0,index),id=kindId.slice(index+1);
   const previous=stock.get(kindId);
   if(!previous)throw new OperationalError("Insumo/bebida não encontrado: "+id,409,"missing_stock");
   const current=finite(previous.stock,"Estoque de "+id);
   if(isProduce&&current+0.00002<needed)
    throw new OperationalError("Estoque insuficiente: "+String(previous.name||id),409,"insufficient_stock");
   const updated=round5(current+(isProduce?-needed:needed));
   if(updated<0||updated>1e9)
    throw new OperationalError("Saldo de estoque fora dos limites",409,"invalid_stock");
   stockUpdates.push({group,id,item:{...previous,stock:updated}});
   const movementId="cf-"+operationId+"-"+n++;
   movements.push({
    id:movementId,at,ingredientId:group==="beverages"?"bev:"+id:id,
    ingredientName:String(previous.name||id).slice(0,180),
    quantity:isProduce?-needed:needed,
    reason:isProduce?(group==="beverages"?"Bebida vendida":"Produção"):
       (group==="beverages"?"Estorno bebida por cancelamento":"Estorno de estoque por cancelamento"),
    referenceId:order.id,previousStock:current,afterStock:updated
   });
  }
 }
 return {order:nextOrder,stockUpdates,movements,losses,universe};
}
