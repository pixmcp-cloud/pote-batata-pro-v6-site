// B02.6 — server-only compiler from trusted V5 records, not public menu data.
// Only ordinary direct-sale recipes, drinks and explicit addons. Franchise estimates,
// combos, custom removals and ambiguous stock mappings fail closed until mapped.
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
const number=(v,min=0,max=1e9)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const cents=v=>{if(!number(v,0,1e7))fail("invalid_price");const n=Math.round(v*100);if(!Number.isSafeInteger(n)||Math.abs(v*100-n)>1e-6)fail("invalid_price");return n};
export function compileV5Catalog({finance,branch,stockMap,recipeIds,beverageIds=[],addonIds=[],comboIds=[],revision,universe}={}){
 if(!finance||!["unitCost","recipeMaterialCost","fees","suggest"].every(k=>typeof finance[k]==="function")||!branch||!id(revision)||!id(universe)||!Array.isArray(stockMap)||stockMap.length>32||!Array.isArray(recipeIds)||!Array.isArray(beverageIds)||!Array.isArray(addonIds)||!Array.isArray(comboIds)||recipeIds.length+beverageIds.length+comboIds.length>60||addonIds.length>20)fail("invalid_catalog");
 const s=branch.settings??{};
 if(!["replacement","average",undefined].includes(s.costBasis)||!number(s.fee,0,95)||!number(s.tax,0,95)||s.fee+s.tax>=95||!number(s.packageCost)||!number(s.otherCost)||!number(s.estimatedMonthlyUnits,1)||!number(s.margin,0,95)||!Array.isArray(branch.expenses))fail("invalid_cost_settings");
 const maps=new Map(),physical=new Set();
 for(const m of stockMap){const k=m.group+":"+m.itemId;if(!id(m.stockId)||!id(m.itemId)||!id(m.universe)||!["ingredients","beverages"].includes(m.group)||typeof m.recordKey!=="string"||!/^[A-Za-z0-9_~:-]{1,700}$/.test(m.recordKey)||![1,10,100,1000,10000,100000].includes(m.scale)||maps.has(k)||physical.has(m.recordKey)||[...maps.values()].some(x=>x.stockId===m.stockId))fail("ambiguous_stock_mapping");maps.set(k,m);physical.add(m.recordKey)}
 const rows=(group)=>{const list=branch[group];if(!Array.isArray(list))fail("invalid_records");const map=new Map();for(const item of list){if(!id(item?.id)||map.has(item.id))fail("invalid_records");map.set(item.id,item)}return map};
 const ingredients=rows("ingredients"),recipes=rows("recipes"),beverages=rows("beverages"),addons=rows("addons");
 const lookup=(group,iid,quantity)=>{const m=maps.get(group+":"+iid);if(!m||!number(quantity,1e-9))fail("stock_mapping_missing");const units=Math.ceil(quantity*m.scale-1e-9);if(!Number.isSafeInteger(units)||units<1||units>1e9)fail("invalid_stock_precision");return {stockId:m.stockId,units}};
 const ingredient=(iid,qty)=>{const i=ingredients.get(iid);if(!i||i.archived||!number(i.yield,1,100)||!number(i.purchasePrice??i.price,0.000001)||!number(i.purchaseQuantity,0.000001)||!["kg","L","g","ml","un","unidade"].includes(i.purchaseUnit)||!number(qty,1e-9))fail("unknown_ingredient_cost");return {i,need:lookup("ingredients",iid,qty/(i.yield/100))}};
 let fixed=0,variable=0;
 for(const e of branch.expenses){if(!e.enabled)continue;if(!["mensal","unidade"].includes(e.mode)||!number(e.amount)||!number(e.repeat??1,1))fail("invalid_expense");const value=e.amount*(e.repeat??1);if(e.mode==="mensal")fixed+=value/s.estimatedMonthlyUnits;else variable+=value}
 const extra=addonIds.map(aid=>{const a=addons.get(aid);if(!a||a.archived||a.unavailable||!number(a.sellPrice,0.01))fail("invalid_addon");const x=ingredient(a.ingredientId,a.quantity);return {id:aid,available:true,priceCents:cents(a.sellPrice),recipe:[x.need]}});
 const products=[],seen=new Set(),costs=new Map();
 const fee=finance.fees(s,"direto");
 const minMargin=s.checkoutMinMarginPct??0;if(!number(minMargin,0,95)||fee+minMargin>=100)fail("invalid_margin");
 const safePrice=(price,cost)=>{if(!number(cost,0.000001)||price*(1-(fee+minMargin)/100)+1e-8<cost)fail("margin_floor")};
 const extraCosts=new Map(extra.map(a=>{const original=addons.get(a.id),i=ingredients.get(original.ingredientId);const cost=finance.unitCost(i,s.costBasis)*original.quantity/(i.yield/100);safePrice(a.priceCents/100,cost);return [a.id,cost]}));
 const push=p=>{if(!id(p.id)||seen.has(p.id)||!p.title||p.title.length>200||p.priceCents<1)fail("invalid_product");seen.add(p.id);products.push(p)};
 for(const rid of recipeIds){const r=recipes.get(rid);if(!r||r.archived||r.unavailable||r.franchiseLocked||r.costEstimateMode==="estimated"||r.templateOrigin==="franchise"||!Array.isArray(r.items)||!r.items.length||!["gain","margin",undefined].includes(r.pricingMode)||!number(r.targetGainPct??100))fail("recipe_not_supported");
  const needs=r.items.map(x=>ingredient(x.id,x.g).need);
  let pkg=s.packageCost;
  if(s.usePackagingStock===true){const ids=r.packagingIngredientIds??[];if(!Array.isArray(ids)||new Set(ids).size!==ids.length)fail("invalid_packaging");if(ids.length){pkg=0;for(const iid of ids){const x=ingredient(iid,1);if(x.i.category!=="Embalagem")fail("invalid_packaging");needs.push(x.need);pkg+=finance.unitCost(x.i,s.costBasis)}}}
  const cost=finance.recipeMaterialCost(r,[...ingredients.values()],s.costBasis)+pkg+s.otherCost+fixed+variable;
  if(!number(cost,0.000001))fail("unknown_recipe_cost");
  const fee=finance.fees(s,"direto");if(!number(fee,0,95)||fee>=95||((r.pricingMode??"margin")==="margin"&&fee+s.margin>=95))fail("invalid_margin");
  const price=finance.suggest({cost,feePct:fee,mode:r.pricingMode||"margin",gainPct:r.targetGainPct??100,marginPct:s.margin});
  safePrice(price,cost);costs.set(rid,cost);
  push({id:rid,title:r.name,available:true,priceCents:cents(price),recipe:needs,extras:extra,rounding:"commercial"});
 }
 for(const bid of beverageIds){const v=beverages.get(bid);if(!v||v.archived||v.unavailable||!number(v.sellPrice,.01))fail("invalid_beverage");if(typeof finance.beverageCost!=="function"||!number(v.purchasePrice??v.price,0.000001)||!number(v.purchaseQuantity,0.000001))fail("unknown_beverage_cost");safePrice(v.sellPrice,finance.beverageCost(v));push({id:bid,title:v.name,available:true,priceCents:cents(v.sellPrice),recipe:[lookup("beverages",bid,1)],extras:[]})}
 // Combos are explicitly approved server-side; component IDs must be in this
 // approved catalog. Starter preset is bound to an actual recipe and beverage.
 if(comboIds.length){
  if(typeof finance.roundPrice!=="function"||typeof finance.beverageCost!=="function")fail("invalid_catalog");
  const combos=rows("combos");
  for(const cid of comboIds){
   const combo=combos.get(cid),r=products.find(p=>p.id===combo?.recipeId&&costs.has(p.id));
   const v=combo?.beverageId?beverages.get(combo.beverageId):null,bp=v&&products.find(p=>p.id===v.id&&beverageIds.includes(p.id));
   if(!combo||!r||combo.archived||combo.unavailable||(combo.beverageId&&!bp)||!Array.isArray(combo.addonIds??[])||(combo.addonIds??[]).length>20||new Set(combo.addonIds??[]).size!==(combo.addonIds??[]).length||!["percent","fixed"].includes(combo.discountType)||!number(combo.discountValue,0,combo.discountType==="percent"?100:1e7))fail("combo_not_supported");
   const starter=combo.catalogPreset==="starter-potato-soda";
   if(combo.catalogPreset&&!starter)fail("combo_not_supported");
   if(starter&&(!bp||combo.discountType!=="percent"||combo.discountValue!==5))fail("combo_not_supported");
   const adds=(combo.addonIds??[]).map(aid=>extra.find(a=>a.id===aid));if(adds.some(a=>!a))fail("combo_not_supported");
   if(v&&(!number(v.purchasePrice??v.price,0.000001)||!number(v.purchaseQuantity,0.000001)))fail("unknown_beverage_cost");
   const subtotal=(r.priceCents+(bp?.priceCents??0)+adds.reduce((n,a)=>n+a.priceCents,0))/100;
   const discount=combo.discountType==="percent"?subtotal*combo.discountValue/100:combo.discountValue;
   const raw=Math.max(0,subtotal-discount),price=starter?Math.round(raw*100)/100:finance.roundPrice(raw);
   const cost=costs.get(r.id)+(v?finance.beverageCost(v):0)+adds.reduce((n,a)=>n+extraCosts.get(a.id),0);
   safePrice(price,cost);
   push({id:cid,title:combo.name,available:true,priceCents:cents(price),recipe:[...r.recipe,...(bp?.recipe??[]),...adds.flatMap(a=>a.recipe)],extras:extra,rounding:starter?"starter-combo":"commercial",combo:{recipeId:r.id,beverageId:bp?.id??null,addonIds:combo.addonIds??[],discountCents:Math.max(0,cents(subtotal)-cents(price))}});
  }
 }
 return {revision,universe,products,stockMap:JSON.parse(JSON.stringify(stockMap))};
}
