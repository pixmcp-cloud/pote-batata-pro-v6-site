// B02.7 laboratory catalog authority. Complete bounded record listing must be
// part of the same database transaction. Never use public menu prices or client roles.
import {compileV5Catalog} from "./v5_checkout_catalog_lab.mjs";
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(s);
const groups=["recipes","ingredients","beverages","addons","expenses"];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function checkoutEntitlement(profile,universe,now){
 if(!profile||!id(universe)||!Number.isSafeInteger(now))fail("license_required");
 const policy=profile.accessPolicy??{};
 if(typeof policy!=="object"||Array.isArray(policy)||["blockedUniverses","blockedServices"].some(k=>policy[k]!==undefined&&!Array.isArray(policy[k])))fail("access_blocked");
 if(policy.blockedUniverses?.includes(universe)||["orders","recipes","stock"].some(s=>policy.blockedServices?.includes(universe+":"+s)))fail("access_blocked");
 if(profile.franchise?.status==="active"&&profile.franchise.brandId==="potebatata")return "franchise";
 const l=profile.license;
 if(l?.status==="active"){
  if(l.kind==="lifetime"&&l.term==="lifetime")return "pro";
  const expires=typeof l.expiresAt==="string"?Date.parse(l.expiresAt):typeof l.expiresAt?.toMillis==="function"?l.expiresAt.toMillis():NaN;
  if(["trial","pro"].includes(l.kind)&&Number.isFinite(expires)&&expires>now)return l.kind;
 }
 // Temporary fail-closed commercial policy: no change to legacy FREE access.
 fail("license_required");
}
export async function loadV5CheckoutAuthority({tx,manifest,meta,profile,finance,recordKeyAllowed,now}={}){
 const m=manifest;if(!m||m.catalogMode!=="v5-authoritative"||!id(m.ownerUid)||!id(m.universe)||!id(m.revision)||!Array.isArray(m.recipeIds)||!Array.isArray(m.beverageIds)||!Array.isArray(m.addonIds)||(typeof tx?.listRecords!=="function"&&typeof tx?.listCatalogRecords!=="function")||typeof recordKeyAllowed!=="function")fail("catalog_not_ready");
 const tier=checkoutEntitlement(profile,m.universe,now);
 const comboIds=m.comboIds??[];if(!Array.isArray(comboIds)||comboIds.length>60||comboIds.some(x=>!id(x)))fail("catalog_not_ready");
 // Shared physical kitchen requires explicit cross-universe projection; do not guess.
 const data=meta?.state?.data;
 const branch=data?.businessType===m.universe?data:data?.businessUniverses?.[m.universe];
 if(data?.kitchenStock?.mode==="shared"&&(m.sharedKitchenEnabled!==true||typeof tx.listKitchenRecords!=="function"))fail("shared_kitchen_requires_reconciliation");
 if(!branch||!branch.settings||!Array.isArray(m.stockMap)||m.stockMap.some(s=>s.universe!==m.universe))fail("catalog_not_ready");
 const root="users/"+m.ownerUid+"/recordsV5";
 // Never cache across requests. Only select records capable of changing an
 // approved recipe; all expenses remain included (including newly added ones).
 const unique=xs=>[...new Set(xs)].sort();
 if(m.recipeIds.length+m.beverageIds.length+comboIds.length>60||m.addonIds.length>20||m.stockMap.length>32||
  [...m.recipeIds,...m.beverageIds,...m.addonIds,...m.stockMap.map(x=>x?.itemId)].some(x=>!id(x))||
  m.stockMap.some(x=>!["ingredients","beverages"].includes(x.group)))fail("catalog_not_ready");
 const selection={recipes:unique(m.recipeIds),ingredients:unique(m.stockMap.filter(s=>s.group==="ingredients").map(s=>s.itemId)),beverages:unique([...m.beverageIds,...m.stockMap.filter(s=>s.group==="beverages").map(s=>s.itemId)]),addons:unique(m.addonIds),...(comboIds.length?{combos:unique(comboIds)}:{})};
 const selective=typeof tx.listCatalogRecords==="function";
 if(comboIds.length&&!selective)fail("catalog_not_ready");
 const acceptedGroups=comboIds.length?[...groups,"combos"]:groups;
 const docs=selective?await tx.listCatalogRecords({collection:root,universe:m.universe,selection,limit:241}):await tx.listRecords({collection:root,universe:m.universe,groups,limit:241});
 if(!Array.isArray(docs)||docs.length>240)fail("catalog_too_large");
 const all=Object.fromEntries(acceptedGroups.map(g=>[g,[]])),keys=new Map(),seen=new Set();
 for(const d of docs){
  const rec=d?.data?.record;
  if(!rec||rec.universe!==m.universe||!acceptedGroups.includes(rec.group)||!id(rec.id)||rec.item?.id!==rec.id||!recordKeyAllowed(d.key,rec)||seen.has(rec.group+":"+rec.id)||(selective&&rec.group!=="expenses"&&!selection[rec.group]?.includes(rec.id)))fail("catalog_record_invalid");
  seen.add(rec.group+":"+rec.id);keys.set(rec.group+":"+rec.id,d.key);all[rec.group].push(rec.item);
 }
 for(const s of m.stockMap)if(keys.get(s.group+":"+s.itemId)!==s.recordKey)fail("catalog_stock_mismatch");
 const built=compileV5Catalog({finance,branch:{...all,settings:branch.settings},stockMap:m.stockMap,recipeIds:m.recipeIds,beverageIds:m.beverageIds,addonIds:m.addonIds,comboIds,revision:m.revision,universe:m.universe});
 // Price/composition must match the server-approved manifest; stock-only changes do
 // not invalidate the catalog. Any changed price or recipe requires reapproval.
 if(!same(built.products,m.products))fail("catalog_stale");
 return {products:built.products,tier,revision:built.revision};
}
