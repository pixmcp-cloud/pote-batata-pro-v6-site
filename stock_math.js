/* Controle de estoque: saldos físicos em g/ml/un, entradas contabilizadas por compra. */
(function(){
"use strict";
if(window.POTE_STOCK)return;
const number=v=>{
 if(typeof v==="number")return Number.isFinite(v)?v:NaN;
 let s=String(v??"").trim().replace(/\s/g,"").replace(/^R\$/i,"");
 if(!s)return NaN;
 if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
 else if(s.includes(","))s=s.replace(",",".");
 const x=Number(s);return Number.isFinite(x)?x:NaN;
};
const stockNumber=v=>typeof v==="number"?v:number(v);
function normalizeInventory(data){
 const changes=[],invalid=[];
 for(const type of ["ingredients","beverages"]){
  for(const item of data?.[type]||[]){
   if(typeof item.stock!=="string")continue;
   const previous=item.stock,parsed=number(previous);
   if(Number.isFinite(parsed)&&parsed>=0){
    item.stock=parsed;
    changes.push({type,id:item.id,name:item.name,previous,current:parsed});
   }else{
    invalid.push({type,id:item.id,name:item.name,previous});
   }
  }
 }
 return {changes,invalid};
}
const decimal=(v,max=3)=>Number(v).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:max});
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const measureUnit=i=>i?.measureUnit==="un"?"un":i?.measureUnit==="ml"?"ml":"g";
function validUnit(item,unit){
 const base=measureUnit(item);
 return base==="g"?(unit==="kg"||unit==="g"):
        base==="ml"?(unit==="L"||unit==="ml"):
        unit==="un";
}
function toBase(item,quantity,unit){
 const q=number(quantity);
 if(!Number.isFinite(q)||q<=0||q>10000000)throw Error("Informe a quantidade comprada maior que zero.");
 if(!validUnit(item,unit))throw Error("Unidade incompatível com este ingrediente.");
 const converted=q*((unit==="kg"||unit==="L")?1000:1);
 if(!Number.isFinite(converted)||converted>1000000000)throw Error("Quantidade excede o limite permitido.");
 return Number(converted.toFixed(5));
}
function defaultUnit(item){return measureUnit(item)==="g"?"kg":measureUnit(item)==="ml"?"L":"un"}
function formatStock(item,raw){
 const q=Math.max(0,Number(raw??item?.stock??0)),base=measureUnit(item);
 if(base==="g")return q>=1000||q===0?decimal(q/1000)+" kg":decimal(q)+" g";
 if(base==="ml")return q>=1000||q===0?decimal(q/1000)+" L":decimal(q)+" ml";
 return decimal(q)+" un";
}
function purchase({ingredient,quantity,unit,paidTotal,at,supplier,purchases,movements,makeId}){
 if(!ingredient)throw Error("Escolha o ingrediente da compra.");
 const add=toBase(ingredient,quantity,unit);
 const total=number(paidTotal);
 if(!Number.isFinite(total)||total<=0||total>1000000000)
  throw Error("Informe o valor total efetivamente pago em reais.");
 const previous=Math.max(0,Number(ingredient.stock)||0);
 const next=Number((previous+add).toFixed(5));
 if(!Number.isFinite(next))throw Error("Saldo de estoque inválido.");
 // Média ponderada considera o saldo anterior e o valor unitário conhecido.
 // Sem custo histórico confiável, mostrar referência da última compra sem inventar custo médio.
 const oldCount=number(ingredient.purchaseQuantity);
 const oldFactor=(ingredient.purchaseUnit==="kg"||ingredient.purchaseUnit==="L")?1000:1;
 const priorCost=number(ingredient.averageUnitCost)>0&&ingredient.averageCostKnown===true?
  number(ingredient.averageUnitCost):
  oldCount>0?number(ingredient.purchasePrice??ingredient.price)/(oldCount*oldFactor):NaN;
 const demoOpening=/^franchise-estimate-/i.test(String(ingredient.costSource||""))||
  /saldo inicial demonstrativo/i.test(String(ingredient.source||""));
 const priorKnown=previous===0||(!demoOpening&&Number.isFinite(priorCost)&&priorCost>0&&
  ingredient.averageCostKnown!==false);
 const newCost=total/add;
 const average=priorKnown&&previous>0?
  (priorCost*previous+newCost*add)/next:newCost;
 const count=number(quantity);
 const date=at||new Date().toISOString(),id=makeId();
 const receipt={id,at:date,ingredientId:ingredient.id,name:ingredient.name,added:add,
  enteredQuantity:count,enteredUnit:unit,previousStock:previous,afterStock:next,
  totalPaid:total,pricePaid:total,unitPrice:Number((total/count).toFixed(6)),
  averageUnitCost:Number(average.toFixed(8)),averageCostKnown:priorKnown,
  supplier:String(supplier||"").slice(0,130),origin:"purchase-real"};
 ingredient.stock=next;
 ingredient.averageUnitCost=Number(average.toFixed(8));
 ingredient.averageCostKnown=priorKnown;
 if(!priorKnown)ingredient.requiresPhysicalRecount=true;
 else ingredient.requiresPhysicalRecount=false;
 // Última compra, não saldo: referência de custo. A próxima compra atualizará este valor.
 ingredient.purchaseQuantity=count;
 ingredient.purchaseUnit=unit;
 ingredient.purchasePrice=total;
 ingredient.price=total;
 ingredient.costSource="real-purchase";
 ingredient.source="Compra real registrada em "+date.slice(0,10);
 purchases.unshift(receipt);
 movements.unshift({id:makeId(),at:date,ingredientId:ingredient.id,
  ingredientName:ingredient.name,quantity:add,reason:"Compra de insumo",
  referenceId:id,previousStock:previous,afterStock:next,totalPaid:total});
 return {previous,next,added:add,totalPaid:total,receipt};
}
function adjust({ingredient,quantity,unit,reason,movements,makeId}){
 if(!ingredient)throw Error("Insumo não encontrado.");
 const q=number(quantity);
 if(!Number.isFinite(q)||q<0)throw Error("Informe um saldo válido, igual ou maior que zero.");
 if(!validUnit(ingredient,unit))throw Error("Unidade incompatível com o ingrediente.");
 const next=Number((q*((unit==="kg"||unit==="L")?1000:1)).toFixed(5));
 if(next>1000000000)throw Error("Saldo acima do limite permitido.");
 const previous=Math.max(0,Number(ingredient.stock)||0);
 const delta=next-previous;
 ingredient.stock=next;
 movements.unshift({id:makeId(),at:new Date().toISOString(),
  ingredientId:ingredient.id,ingredientName:ingredient.name,
  quantity:delta,reason:"Ajuste manual: "+String(reason||"conferência").slice(0,100),
  previousStock:previous,afterStock:next});
 return {previous,next,delta};
}
window.POTE_STOCK={number,stockNumber,normalizeInventory,decimal,money,measureUnit,validUnit,toBase,defaultUnit,formatStock,purchase,adjust};
})();
