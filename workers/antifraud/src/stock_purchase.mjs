/* F05 V5: compra e reposição auditadas pelo servidor, nunca um saldo
 * absoluto confiado ao navegador. Não solicita nem registra pagamento bancário.
 * Única fonte de estoque/custo prévio: documento atual no Firestore.
 */
import {OperationalError,nearly} from "./domain.mjs";
import {stockUnit} from "./stock_loss.mjs";
const round5=v=>Math.round(v*1e5)/1e5;
const round8=v=>Math.round(v*1e8)/1e8;
const finite=(n,min,max)=>typeof n==="number"&&Number.isFinite(n)&&n>=min&&n<=max;
const inputError=(code="invalid_purchase")=>new OperationalError(
 "Compra inválida. Confira quantidade, unidade e valor total pago.",422,code);
export function planStockPurchase({
 group,itemId,delta,paidTotal,enteredQuantity,enteredUnit,
 supplier="",operationId,universe,stock,at
}){
 if(!["ingredients","beverages"].includes(group)||typeof itemId!=="string"||!itemId||
  typeof operationId!=="string"||!operationId||typeof universe!=="string"||!universe||
  !finite(delta,0.00001,1e6)||!finite(paidTotal,0.01,1e9)||
  !finite(enteredQuantity,0.00001,1e6)||typeof supplier!=="string"||
  supplier.length>130||typeof enteredUnit!=="string")
  throw inputError();
 if(!stock||stock.archived===true)
  throw new OperationalError("Item da compra não está cadastrado",404,"stock_item_missing");
 const base=stockUnit(stock,group);
 const conversion={
  g:{"g":1,"kg":1000},
  ml:{"ml":1,"L":1000},
  un:{"un":1}
 };
 const factor=conversion[base]?.[enteredUnit];
 if(!factor||!nearly(round5(enteredQuantity*factor),delta)||
  !nearly(round5(delta),delta)||base==="un"&&!Number.isInteger(enteredQuantity))
  throw inputError("invalid_purchase_unit");
 const before=stock.stock;
 if(!finite(before,0,1e9)||before+delta>1e9)
  throw new OperationalError("Estoque inválido ou acima do limite físico",409,"invalid_stock");
 const after=round5(before+delta);
 if(!finite(after,0,1e9)||!nearly(after-before,delta))
  throw new OperationalError("Saldo não representável com precisão",409,"invalid_stock");
 const priorQty=Number(stock.purchaseQuantity);
 const oldFactor=stock.purchaseUnit==="kg"||stock.purchaseUnit==="L"?1000:1;
 const priorCost=stock.averageCostKnown===true&&finite(stock.averageUnitCost,0.00000001,1e9)?
  stock.averageUnitCost:
  finite(priorQty,0.00000001,1e9)&&finite(stock.purchasePrice??stock.price,0.00000001,1e9)?
   (stock.purchasePrice??stock.price)/(priorQty*oldFactor):NaN;
 const demoOpening=/^franchise-estimate-/i.test(String(stock.costSource||""))||
  /saldo inicial demonstrativo/i.test(String(stock.source||""));
 const priorKnown=before===0||(!demoOpening&&Number.isFinite(priorCost)&&priorCost>0&&
  stock.averageCostKnown!==false);
 const unitCost=paidTotal/delta;
 const average=priorKnown&&before>0?(priorCost*before+unitCost*delta)/after:unitCost;
 const avg=round8(average);
 const purchaseId="cf-purchase-"+operationId,movementId="cf-move-"+operationId;
 const name=String(stock.name||itemId).slice(0,180);
 const receipt={id:purchaseId,at,ingredientId:itemId,name,added:delta,
  enteredQuantity,enteredUnit,previousStock:before,afterStock:after,
  totalPaid:paidTotal,pricePaid:paidTotal,
  unitPrice:round8(paidTotal/enteredQuantity),
  averageUnitCost:avg,averageCostKnown:priorKnown,
  supplier:supplier.trim(),origin:"purchase-real",
  ...(group==="beverages"?{itemKind:"beverage"}:{})};
 const item={...stock,stock:after,averageUnitCost:avg,
  averageCostKnown:priorKnown,requiresPhysicalRecount:!priorKnown,
  purchaseQuantity:enteredQuantity,purchaseUnit:enteredUnit,
  purchasePrice:paidTotal,price:paidTotal,costSource:"real-purchase",
  source:"Compra real registrada em "+at.slice(0,10),
  ...(group==="beverages"?{catalogPurchaseAt:at}:{})};
 const movement={id:movementId,at,
  ingredientId:group==="beverages"?"bev:"+itemId:itemId,
  ingredientName:name,quantity:delta,reason:group==="beverages"?"Compra de bebida":"Compra de insumo",
  referenceId:purchaseId,previousStock:before,afterStock:after,
  totalPaid:paidTotal,...(group==="beverages"?{itemKind:"beverage"}:{})};
 return {item,purchase:receipt,movement};
}
