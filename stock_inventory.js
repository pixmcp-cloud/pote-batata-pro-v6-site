/* Itens duplicados: bloqueio preventivo e mesclagem assistida, com rastro auditável. */
(function(){
"use strict";
if(window.POTE_INVENTORY)return;
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const key=i=>normalize(i?.category||"Insumo")+"|"+normalize(i?.name)+"|"+String(i?.measureUnit||"g");
function duplicate(data,{name,category,measureUnit,excludeId}){
 const target=key({name,category,measureUnit});
 return (data?.ingredients||[]).find(i=>!i.archived&&i.id!==excludeId&&key(i)===target)||null;
}
function duplicates(items){
 const byKey=new Map();
 for(const item of items||[]){
  if(item.archived)continue;
  if(!byKey.has(key(item)))byKey.set(key(item),[]);
  byKey.get(key(item)).push(item);
 }
 return [...byKey.values()].filter(items=>items.length>1);
}
function combineIngredients(records,dupes){
 let changed=0;
 for(const old of dupes){
  const before=new Map();
  const replace=rows=>{
   if(!Array.isArray(rows))return;
   for(const row of rows){
    if(row.id!==old.id)continue;
    row.id=records.id;
    changed++;
   }
  };
  for(const r of state.data.recipes||[]){
   replace(r.items);
   if(Array.isArray(r.packagingIngredientIds))
    r.packagingIngredientIds=[...new Set(r.packagingIngredientIds.map(id=>id===old.id?records.id:id))];
   if(Array.isArray(r.items)){
    const totals=new Map();
    for(const item of r.items){
     if(!totals.has(item.id))totals.set(item.id,{...item,g:0});
     totals.get(item.id).g+=Number(item.g)||0;
    }
    r.items=[...totals.values()];
   }
  }
  for(const o of state.data.orders||[]){
   replace(o.items);
  }
  for(const a of state.data.addons||[])if(a.ingredientId===old.id){a.ingredientId=records.id;changed++}
  records.stock=(Number(records.stock)||0)+(Number(old.stock)||0);
  records.minimum=Math.max(Number(records.minimum)||0,Number(old.minimum)||0);
  if((Number(records.purchasePrice)||0)<=0&&(Number(old.purchasePrice)||0)>0){
   records.purchasePrice=old.purchasePrice;
   records.purchaseQuantity=old.purchaseQuantity;
   records.purchaseUnit=old.purchaseUnit;
   records.price=old.price??old.purchasePrice;
  }
  state.data.ingredients=state.data.ingredients.filter(i=>i.id!==old.id);
  (state.data.stockMovements??=[]).unshift({
   id:"merge-"+Date.now()+"-"+old.id,at:new Date().toISOString(),
   ingredientId:records.id,ingredientName:records.name,
   quantity:Number(old.stock)||0,reason:"Mesclagem de estoque duplicado",
   oldIngredientId:old.id,oldIngredientName:old.name,referenceId:old.id,
   afterStock:records.stock
  });
 }
 return changed;
}
function mergePair(group){
 const canonical=group[0],dupes=group.slice(1);
 if(!canonical||!dupes.length)return;
 if(!window.confirm("MESCLAR ITENS DUPLICADOS?\n"+group.map(i=>i.name+
  " · saldo "+(Number(i.stock)||0)+" "+(i.measureUnit||"g")).join("\n")+
  "\n\nOs saldos serão somados. Referências futuras usarão o primeiro cadastro. Histórico de compras e movimentos será preservado. Deseja continuar?"))return;
 const changed=combineIngredients(canonical,dupes);
 persist();render();toast("Itens duplicados mesclados. Novo saldo: "+canonical.stock+
  " "+(canonical.measureUnit||"g")+". "+changed+" referências atualizadas.");
}
function merge(id){
 const group=duplicates(state.data.ingredients).find(g=>g.some(i=>i.id===id));
 if(group)mergePair(group);
}
function list(){
 return duplicates(state?.data?.ingredients||[]);
}
window.POTE_INVENTORY={normalize,key,duplicate,duplicates,list,merge,combineIngredients};
})();
