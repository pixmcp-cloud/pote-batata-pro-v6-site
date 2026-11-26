// G5: initial store setup only in the synthetic project. Targets and delivery policy
// are provisioned by a trusted test operator; the client supplies selection only.
import {validateCatalogSelection} from "./v5_catalog_approval_lab.mjs";
import {buildV5CheckoutAuthority,checkoutEntitlement} from "./v5_checkout_authority_lab.mjs";
import {requireCheckoutAuthority} from "./v5_cutover_policy.mjs";
import {v5SequenceBaseline} from "./v5_checkout_sequence_lab.mjs";
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
const op=s=>id(s)&&s.length>=16;
const docKey=s=>typeof s==="string"&&/^[A-Za-z0-9_~:-]{1,700}$/.test(s);
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const content=({updatedAt,...rest})=>rest;
const put=(path,data,old=null)=>({path,data,precondition:old?{updateTime:old.updateTime}:{exists:false}});
export async function deriveInitialStockMap({tx,ownerUid,universe,selection,settings,recordKeyAllowed}={}){
 const chosen=validateCatalogSelection(selection);
 if(!id(ownerUid)||!id(universe)||!settings||typeof recordKeyAllowed!=="function"||typeof tx?.listCatalogRecords!=="function")fail("setup_not_ready");
 const collection="users/"+ownerUid+"/recordsV5";
 const groups={recipes:chosen.recipeIds,beverages:chosen.beverageIds,addons:chosen.addonIds,ingredients:[],...(chosen.comboIds.length?{combos:chosen.comboIds}:{})};
 async function read(select){
  const rows=await tx.listCatalogRecords({collection,universe,selection:select,limit:241});
  if(!Array.isArray(rows)||rows.length>240)fail("catalog_too_large");
  const map=new Map();
  for(const d of rows){const r=d?.data?.record,k=r?.group+":"+r?.id;
   if(!r||r.universe!==universe||!id(r.id)||!docKey(d.key)||r.item?.id!==r.id||!recordKeyAllowed(d.key,r)||map.has(k)||(r.group!=="expenses"&&!select[r.group]?.includes(r.id)))fail("catalog_record_invalid");
   map.set(k,{record:r,key:d.key});
  }
  return map;
 }
 const first=await read(groups),needed=new Set();
 function get(map,group,iid){const row=map.get(group+":"+iid);if(!row||row.record.item.archived||row.record.item.unavailable)fail("stock_mapping_missing");return row}
 for(const rid of chosen.recipeIds){const r=get(first,"recipes",rid).record.item;if(!Array.isArray(r.items)||!r.items.length)fail("recipe_not_supported");for(const x of r.items){if(!id(x?.id))fail("invalid_records");needed.add(x.id)}
  if(settings.usePackagingStock===true){const packaging=r.packagingIngredientIds??[];if(!Array.isArray(packaging)||packaging.some(x=>!id(x)))fail("invalid_packaging");for(const iid of packaging)needed.add(iid)}
 }
 for(const aid of chosen.addonIds){const a=get(first,"addons",aid).record.item;if(!id(a.ingredientId))fail("invalid_addon");needed.add(a.ingredientId)}
 for(const bid of chosen.beverageIds)get(first,"beverages",bid);
 for(const cid of chosen.comboIds){const c=get(first,"combos",cid).record.item;if(!chosen.recipeIds.includes(c.recipeId)||(c.beverageId&&!chosen.beverageIds.includes(c.beverageId))||!Array.isArray(c.addonIds??[])||(c.addonIds??[]).some(a=>!chosen.addonIds.includes(a)))fail("combo_not_supported")}
 if(needed.size+chosen.beverageIds.length>32)fail("invalid_catalog");
 const physical=await read({recipes:[],addons:[],ingredients:[...needed].sort(),beverages:chosen.beverageIds});
 const stockMap=[];
 for(const [group,ids] of [["ingredients",[...needed].sort()],["beverages",chosen.beverageIds]]){
  for(const itemId of ids){const row=get(physical,group,itemId),i=row.record.item;
   // Fixed precision per group; never infer scale from a changing balance.
   const scale=group==="ingredients"?1000:1,stockId=(group==="ingredients"?"i_":"b_")+itemId,raw=i.stock*scale;
   if(!id(stockId)||typeof i.stock!=="number"||!Number.isSafeInteger(Math.round(raw))||raw<0||raw>1e9||Math.abs(raw-Math.round(raw))>1e-6)fail("invalid_stock_precision");
   if(group==="ingredients"&&!["kg","L","g","ml","un","unidade"].includes(i.purchaseUnit))fail("unknown_ingredient_cost");
   stockMap.push({stockId,universe,group,itemId,recordKey:row.key,scale});
  }
 }
 if(!stockMap.length)fail("stock_mapping_missing");
 return stockMap;
}
export function createV5StoreSetupLab({projectId,repository,verifyToken,finance,recordKeyAllowed,target,clock=()=>Date.now()}={}){
 if(projectId!=="demo-nucleobit-checkout"||typeof repository?.transaction!=="function"||typeof verifyToken!=="function"||!target||![target.ownerUid,target.universe,target.online,target.counter].every(id)||target.online===target.counter||!op(target.epoch)||typeof target.deliveryEnabled!=="boolean"||!Number.isSafeInteger(target.deliveryFeeCents)||target.deliveryFeeCents<0||target.deliveryFeeCents>1e9||!target.deliveryEnabled&&target.deliveryFeeCents!==0)fail("setup_not_ready");
 const t=JSON.parse(JSON.stringify(target)),root="users/"+t.ownerUid,lock=root+"/checkoutSetup/"+t.universe,paths=[t.online,t.counter].map(s=>"checkoutLabStores/"+s);
 async function execute({kind,token,operationId,selection}={}){
  if(!["preview","approve"].includes(kind)||!op(operationId))fail("invalid_request");
  const actor=await verifyToken(token,projectId);
  if(!actor||actor.uid!==t.ownerUid||actor.emailVerified!==true||actor.provider!=="google.com")fail("forbidden");
  const tx=await repository.transaction();
  try{
   const profile=(await tx.get(root))?.data,meta=(await tx.get(root+"/appState/v5"))?.data;
   requireCheckoutAuthority(profile,t.epoch);checkoutEntitlement(profile,t.universe,clock());
   const data=meta?.state?.data,branch=data?.businessType===t.universe?data:data?.businessUniverses?.[t.universe];
   if(meta?.schemaVersion!==5||meta.migration?.status==="copying"||!branch?.settings)fail("setup_not_ready");
   // Shared kitchens need a cross-universe scale/alias reconciliation before initial provisioning.
   if(data.kitchenStock?.mode==="shared")fail("shared_kitchen_requires_reconciliation");
   const guard=(await tx.get(root+"/appState/v5InventoryGuard"))?.data,pulse=(await tx.get(root+"/appState/v5Pulse"))?.data;
   if(!Number.isSafeInteger(guard?.revision)||guard.revision<0||!docKey(pulse?.eventId))fail("setup_not_ready");
   const p=root+"/checkoutSetupDrafts/"+operationId,prior=await tx.get(p),claim=await tx.get(lock);
   const manifests=await Promise.all(paths.map(x=>tx.get(x))),sequences=await Promise.all(paths.map(x=>tx.get(x+"/meta/sequence")));
   if(kind==="approve"&&prior?.data.status==="approved"){
    if(selection!==undefined||claim?.data.operationId!==operationId||manifests.some((m,i)=>!m||!same(content(m.data),prior.data.manifests[i]))||sequences.some(s=>!s))fail("setup_conflict");
    return {online:t.online,counter:t.counter,revision:operationId,duplicate:true};
   }
   if(claim||manifests.some(Boolean)||sequences.some(Boolean)||typeof tx.listOwnerCheckoutStores!=="function")fail("setup_conflict");
   const existing=await tx.listOwnerCheckoutStores({ownerUid:t.ownerUid,universe:t.universe});
   if(!Array.isArray(existing)||existing.length)fail("setup_conflict");
   if(kind==="preview"&&prior)fail("idempotency_conflict");
   if(kind==="approve"&&(selection!==undefined||prior?.data.status!=="preview"||!same(prior.data.target,t)||clock()-prior.data.createdAt>300000||clock()<prior.data.createdAt))fail("setup_conflict");
   const chosen=validateCatalogSelection(kind==="preview"?selection:prior.data.selection);
   const stockMap=await deriveInitialStockMap({tx,ownerUid:t.ownerUid,universe:t.universe,selection:chosen,settings:branch.settings,recordKeyAllowed});
   const base={lab:true,enabled:true,catalogMode:"v5-authoritative",ownerUid:t.ownerUid,universe:t.universe,revision:operationId,cutoverEpoch:t.epoch,...chosen,stockMap,deliveryEnabled:t.deliveryEnabled,deliveryFeeCents:t.deliveryFeeCents,reservationMinutes:30};
   const built=await buildV5CheckoutAuthority({tx,manifest:base,meta,profile,finance,recordKeyAllowed,now:clock()});
   const prepared=[{...base,channel:"online",products:built.products},{...base,channel:"counter",deliveryEnabled:false,deliveryFeeCents:0,products:built.products}];
   const baseline=v5SequenceBaseline(meta,t.universe,0);
   if(kind==="preview"){await tx.commit([put(p,{status:"preview",target:t,selection:chosen,manifests:prepared,createdAt:clock(),baseline})]);return {revision:operationId,stockItems:stockMap.length,products:built.products.map(x=>({id:x.id,title:x.title,priceCents:x.priceCents})),baseline};}
   if(!same(prepared,prior.data.manifests)||baseline!==prior.data.baseline)fail("setup_stale");
   await tx.commit([...paths.flatMap((path,i)=>[put(path,prepared[i]),put(path+"/meta/sequence",{value:baseline})]),put(lock,{operationId,online:t.online,counter:t.counter}),put(p,{...prior.data,status:"approved",approvedAt:clock()},prior)]);
   return {online:t.online,counter:t.counter,revision:operationId,duplicate:false};
  }finally{await tx.rollback()}
 }
 return {execute};
}
