/* F05 V5: conferência física autoritativa e auditável.
 * O navegador informa o saldo que contou E o saldo que viu. O servidor
 * verifica o estoque real, calcula a diferença e grava um único movimento.
 * Toda diferença negativa ainda é lançada como perda física.
 */
import {OperationalError,nearly} from "./domain.mjs";
import {stockUnit,stockCostUnit} from "./stock_loss.mjs";
const round5=n=>Math.round(n*100000)/100000;
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1e9;
export function planStockRecount({
 group,itemId,previousStock,countedStock,note,
 operationId,universe,stock,at,settings={}
}){
 if(!["ingredients","beverages"].includes(group)||!itemId||!operationId||!universe||
  typeof note!=="string"||!note.trim()||note.length>350||
  !valid(previousStock)||!valid(countedStock)||
  Math.abs(round5(previousStock)-previousStock)>1e-8||
  Math.abs(round5(countedStock)-countedStock)>1e-8)
  throw new OperationalError("Contagem física inválida",400,"invalid_recount");
 if(!stock||stock.archived===true)
  throw new OperationalError("Item de estoque inexistente",404,"stock_item_missing");
 const before=stock.stock;
 if(!valid(before))
  throw new OperationalError("Saldo atual inválido",409,"invalid_stock");
 if(Math.abs(before-previousStock)>1e-8)
  throw new OperationalError("Estoque mudou em outro dispositivo. Atualize a tela.",409,
   "stock_conflict");
 const unit=stockUnit(stock,group);
 if(unit==="un"&&!Number.isInteger(countedStock))
  throw new OperationalError("Itens em unidades exigem contagem inteira",422,
   "invalid_stock_unit");
 const after=round5(countedStock),delta=round5(after-before);
 if(!nearly(after-before,delta))
  throw new OperationalError("Saldo não representável",409,"invalid_stock");
 if(delta===0)
  throw new OperationalError("Contagem sem diferença: nenhum lançamento necessário",409,
   "stock_unchanged");
 const refId="cf-recount-"+operationId,movementId="cf-move-"+operationId;
 const itemName=String(stock.name||itemId).slice(0,180);
 const kind=group==="beverages"?"beverage":"ingredient";
 const movement={id:movementId,at,
  stockGroup:group,ingredientId:kind==="beverage"?"bev:"+itemId:itemId,
  ingredientName:itemName,quantity:delta,
  reason:"Conferência física: "+note.trim().slice(0,120),
  referenceId:refId,previousStock:before,afterStock:after,itemKind:kind};
 let loss=null;
 if(delta<0){
  const rate=stockCostUnit(stock,group,settings);
  loss={id:refId,at,type:"stock",reason:"conferencia",
   description:note.trim(),itemId,stockGroup:group,itemName,
   itemKind:kind==="ingredient"&&stock.category==="Embalagem"?"packaging":kind,
   measureUnit:unit,quantityBase:-delta,enteredQuantity:-delta,enteredUnit:unit,
   costLost:rate.known?round2(-delta*rate.value):0,
   costKnown:rate.known,uncollectedSale:0,previousStock:before,afterStock:after
  };
 }
 return {item:{...stock,stock:after},movement,loss,recountId:refId};
}
