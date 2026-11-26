// B02.10 laboratory planner for signed stock deltas. Legacy kitchen capture
// projects data.kitchenStock.inventory into each branch, so a single-record debit
// can be overwritten. Require explicit linkage and a complete authoritative listing.
const fail=code=>{throw Object.assign(Error(code),{code})};
const copy=x=>JSON.parse(JSON.stringify(x));
const id=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export const kitchenLink=i=>i.kitchenLink||norm(i.name)+"|"+String(i.measureUnit||"g").toLowerCase();
const fields=["purchasePrice","price","purchaseQuantity","purchaseUnit","yield","minimum"];
const valid=n=>Number.isFinite(n)&&n>=0&&n<=1e9;
export function planSharedKitchen({ownerUid,meta,records,requests,listingComplete=false}={}){
 if(!id(ownerUid)||!listingComplete||!Array.isArray(records)||records.length>240||!Array.isArray(requests)||!requests.length||requests.length>32)fail("shared_kitchen_not_ready");
 const next=copy(meta),k=next?.state?.data?.kitchenStock;
 if(k?.mode!=="shared"||!k.inventory||typeof k.inventory!=="object"||Array.isArray(k.inventory))fail("shared_kitchen_not_ready");
 const needed=new Map(),groups=new Map(),seen=new Set();
 for(const req of requests){
  if(typeof req?.link!=="string"||!req.link||req.link.length>220||!Number.isSafeInteger(req.units)||Math.abs(req.units)>1e9||![1,10,100,1000,10000,100000].includes(req.scale))fail("invalid_stock_mapping");
  const previous=needed.get(req.link);if(previous&&previous.scale!==req.scale)fail("invalid_stock_precision");
  const units=(previous?.units??0)+req.units;if(!Number.isSafeInteger(units)||Math.abs(units)>1e9)fail("invalid_stock_precision");
  needed.set(req.link,{units,scale:req.scale});
 }
 for(const d of records){
  const rec=d?.data?.record,i=rec?.item;
  if(!rec||rec.group!=="ingredients"||d.ownerUid!==ownerUid||!id(rec.universe)||!id(rec.id)||i?.id!==rec.id||typeof d.key!=="string"||!d.key||seen.has(d.key))fail("invalid_stock_mapping");
  seen.add(d.key);if(i.archived)continue;
  const key=kitchenLink(i);if(!needed.has(key))continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(d);
 }
 const updates=[],balances=[];
 for(const [key,req] of needed){
  if(!Object.hasOwn(k.inventory,key))fail("shared_kitchen_not_ready");
  const source=k.inventory[key],aliases=groups.get(key);
  if(!source||!valid(source.stock)||!aliases?.length)fail("shared_kitchen_not_ready");
  const perUniverse=new Set(),measure=String(aliases[0].data.record.item.measureUnit||"g").toLowerCase();
  for(const d of aliases){
   const rec=d.data.record,i=rec.item;
   if(perUniverse.has(rec.universe)||String(i.measureUnit||"g").toLowerCase()!==measure||!valid(i.stock)||i.stock!==source.stock||fields.some(f=>(i[f]??null)!==(source[f]??null)))fail("shared_kitchen_divergent");
   perUniverse.add(rec.universe);
  }
  const raw=source.stock*req.scale,units=Math.round(raw);
  if(!Number.isSafeInteger(units)||Math.abs(raw-units)>1e-6)fail("invalid_stock_precision");
  if(units<req.units)fail("insufficient_stock");
  const after=units-req.units;if(!Number.isSafeInteger(after)||after>1e9)fail("invalid_stock_precision");
  const stock=after/req.scale;source.stock=stock;
  balances.push({link:key,scale:req.scale,beforeUnits:units,afterUnits:after,aliasKeys:aliases.map(d=>d.key).sort()});
  if(req.units===0)continue;
  for(const d of aliases){const data=copy(d.data);data.record.item.stock=stock;updates.push({key:d.key,data,updateTime:d.updateTime})}
 }
 return {meta:next,updates,balances};
}
