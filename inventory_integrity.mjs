/* F02: auditoria local do delta antes da transação V2.
 * Não substitui validação autoritativa, mas bloqueia baixas físicas sem
 * movimento de estoque correspondente na mesma confirmação. */
const numeric=value=>typeof value==="number"&&Number.isFinite(value)?value:NaN;
const precise=value=>Math.round(value*100000)/100000;
export function validateInventoryJournalDiff(diff){
 if(!diff?.changes)return {checked:0};
 const records=diff.changes.filter(ch=>ch.kind==="record");
 const movement=new Map();
 for(const change of records){
  if(change.before!==null||change.after?.group!=="stockMovements")continue;
  const m=change.after.item;
  const qty=numeric(m?.quantity);
  if(!Number.isFinite(qty)||qty>=0)continue;
  const id=String(m.ingredientId||"");
  if(!id)continue;
  const key=change.after.universe+"\u0000"+id;
  if(!movement.has(key))movement.set(key,[]);
  movement.get(key).push(m);
 }
 let checked=0;
 for(const change of records){
  const before=change.before,after=change.after;
  if(!before||!after||before.group!==after.group||
     !["ingredients","beverages"].includes(after.group))continue;
  const oldStock=numeric(before.item?.stock),newStock=numeric(after.item?.stock);
  if(!Number.isFinite(oldStock)||!Number.isFinite(newStock))continue;
  if(newStock>=oldStock-0.00001)continue;
  const itemId=(after.group==="beverages"?"bev:":"")+String(after.id);
  const key=after.universe+"\u0000"+itemId;
  const entries=movement.get(key)||[];
  const delta=precise(newStock-oldStock);
  const booked=precise(entries.reduce((total,m)=>total+m.quantity,0));
  if(!entries.length||Math.abs(booked-delta)>0.00002){
   const e=Error("Baixa de estoque sem movimentação equivalente: "+
     (after.item?.name||after.id)+". Confira produção, perdas e estornos antes de salvar.");
   e.code="inventory/mismatch";throw e;
  }
  for(const m of entries){
   const previous=numeric(m.previousStock),next=numeric(m.afterStock);
   if(Number.isFinite(previous)&&Number.isFinite(next)&&
      Math.abs(precise(previous+m.quantity-next))>0.00002){
    const e=Error("Movimento com saldos incompatíveis: "+(after.item?.name||after.id));
    e.code="inventory/mismatch";throw e;
   }
  }
  checked++;
 }
 return {checked};
}
