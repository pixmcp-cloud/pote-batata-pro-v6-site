/* F05 V5 — perda física planejada inteiramente no servidor.
 * Insumos, bebidas e preços sempre vêm do Firestore; cliente informa só
 * identificador, motivo e a quantidade negativa na unidade-base.
 */
import {OperationalError,nearly} from "./domain.mjs";

export const LOSS_REASONS=Object.freeze({
 vencimento:"Vencimento ou apodrecimento",queda:"Queda no chão",
 higiene:"Descarte por higiene",preparo:"Erro de preparo",
 deterioracao:"Deterioração / refrigeração",avaria:"Avaria / embalagem danificada",
 outro:"Outros motivos"
});
const money=v=>Math.round((v+Number.EPSILON)*100)/100;
const round5=v=>Math.round(v*1e5)/1e5;
export const stockUnit=(item,group)=>
 group==="beverages"?"un":item?.measureUnit==="ml"?"ml":
 item?.measureUnit==="un"?"un":"g";

function finitePositive(v){
 return typeof v==="number"&&Number.isFinite(v)&&v>0;
}
export function stockCostUnit(item,group,settings={}){
 if(settings.costBasis==="average"&&item?.averageCostKnown===true&&
    finitePositive(item.averageUnitCost))
  return {known:true,value:item.averageUnitCost};
 const price=item?.purchasePrice??item?.price;
 const quantity=item?.purchaseQuantity;
 if(!finitePositive(price)||!finitePositive(quantity))
  return {known:false,value:0};
 const unit=stockUnit(item,group),buy=item.purchaseUnit;
 const matching=unit==="g"?["kg","g"].includes(buy):
  unit==="ml"?["L","ml"].includes(buy):buy==="un";
 if(!matching)return {known:false,value:0};
 const divisor=(buy==="kg"||buy==="L")?1000:1;
 return {known:true,value:price/(quantity*divisor)};
}
export function planStockLoss({group,itemId,delta,lossReason,note="",
 operationId,universe,stock,at,settings={}}){
 if(!["ingredients","beverages"].includes(group)||
  typeof itemId!=="string"||!itemId||
  typeof operationId!=="string"||!operationId||
  typeof universe!=="string"||!universe||
  !(lossReason in LOSS_REASONS)||typeof note!=="string"||note.length>350||
  (lossReason==="outro"&&!note.trim())||
  !Number.isFinite(delta)||delta>=0||delta< -1000000||
  Math.abs(round5(delta)-delta)>1e-8)
  throw new OperationalError("Dados de perda inválidos",400,"invalid_stock_adjustment");
 if(!stock||stock.archived===true)
  throw new OperationalError("Cadastro de estoque não localizado",404,"stock_item_missing");
 const unit=stockUnit(stock,group),used=-delta;
 if((unit==="un"&&!Number.isInteger(used))||!finitePositive(used))
  throw new OperationalError("Unidades indivisíveis exigem número inteiro",422,"invalid_stock_unit");
 const before=stock.stock;
 if(typeof before!=="number"||!Number.isFinite(before)||before<0||before>1e9)
  throw new OperationalError("Saldo do estoque inválido",409,"invalid_stock");
 if(before+0.00002<used)
  throw new OperationalError("Estoque insuficiente para descarte",409,"insufficient_stock");
 const after=round5(before-used);
 if(after<0||after>1e9||!nearly(after+used,before))
  throw new OperationalError("Saldo do estoque inválido",409,"invalid_stock");
 const cost=stockCostUnit(stock,group,settings);
 const lossId="cf-loss-"+operationId,movementId="cf-move-"+operationId;
 const displayName=String(stock.name||itemId).slice(0,180);
 const kind=group==="beverages"?"beverage":"ingredient";
 const event={id:lossId,at,type:"stock",reason:lossReason,
  description:note,itemId,stockGroup:group,itemName:displayName,
  itemKind:kind==="ingredient"&&stock.category==="Embalagem"?"packaging":kind,
  measureUnit:unit,quantityBase:used,enteredQuantity:used,enteredUnit:unit,
  costLost:cost.known?money(used*cost.value):0,
  costKnown:cost.known,uncollectedSale:0,
  previousStock:before,afterStock:after};
 const movement={id:movementId,at,stockGroup:group,
  ingredientId:group==="beverages"?"bev:"+itemId:itemId,
  ingredientName:displayName,quantity:-used,
  reason:"Perda: "+LOSS_REASONS[lossReason],
  referenceId:lossId,previousStock:before,afterStock:after,
  itemKind:kind};
 return {item:{...stock,stock:after},loss:event,movement};
}
