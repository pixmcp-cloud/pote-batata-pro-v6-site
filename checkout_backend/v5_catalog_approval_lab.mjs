// G3: server-owned catalog approval, only synthetic lab. No browser stock map.
import {buildV5CheckoutAuthority,loadV5CheckoutAuthority} from "./v5_checkout_authority_lab.mjs";
import {requireCheckoutAuthority} from "./v5_cutover_policy.mjs";
import {publicCatalog} from "./checkout_access_lab.mjs";
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const op=x=>id(x)&&x.length>=16;
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
// REST commit adds updatedAt at the document root. It is not catalog content.
const manifestContent=({updatedAt,...rest})=>rest;
const put=(path,data,old)=>({path,data,precondition:old?{updateTime:old.updateTime}:{exists:false}});
export function createV5CatalogApprovalLab({projectId,repository,verifyToken,finance,recordKeyAllowed,clock=()=>Date.now()}={}){
 if(projectId!=="demo-nucleobit-checkout"||typeof repository?.transaction!=="function"||typeof verifyToken!=="function")fail("lab_disabled");
 async function execute({kind,token,storeId,epoch,operationId,revision}={}){
  if(!id(storeId)||!["preview","approve","catalog"].includes(kind))fail("invalid_request");
  const identity=kind==="catalog"?null:await verifyToken(token,projectId);
  if(kind!=="catalog"&&(!identity||identity.emailVerified!==true||identity.provider!=="google.com"||!id(identity.uid)||!op(epoch)||!op(operationId)||revision!==operationId))fail("forbidden");
  const tx=await repository.transaction();
  try{
   const root="checkoutLabStores/"+storeId,doc=await tx.get(root),m=doc?.data?manifestContent(doc.data):null;
   if(!m||m.lab!==true||m.enabled!==true||m.channel!=="online"||m.catalogMode!=="v5-authoritative"||!id(m.ownerUid))fail("store_unavailable");
   if(identity&&identity.uid!==m.ownerUid)fail("forbidden");
   const owner="users/"+m.ownerUid,profile=(await tx.get(owner))?.data,meta=(await tx.get(owner+"/appState/v5"))?.data;
   if(meta?.schemaVersion!==5||meta.migration?.status==="copying")fail("catalog_not_ready");
   if(identity){requireCheckoutAuthority(profile,epoch);if(m.cutoverEpoch!==epoch)fail("cutover_not_ready")}
   else requireCheckoutAuthority(profile,m.cutoverEpoch);
   const args={tx,manifest:m,meta,profile,finance,recordKeyAllowed,now:clock()};
   const decorate=(built,manifest)=>publicCatalog({...manifest,storeId,products:built.products.map(p=>({...p,extras:p.extras.map(e=>({...e,title:built.addonTitles[e.id]}))}))});
   if(kind==="catalog"){const built=await loadV5CheckoutAuthority(args);return decorate(built,m)}
   // Reuse only already approved selection/map; no client supplied prices, IDs or mappings.
   const path=root+"/catalogApprovals/"+operationId,previous=await tx.get(path);
   if(kind==="preview"){
    if(previous)fail("idempotency_conflict");
    if(revision===m.revision)fail("revision_conflict");
    const candidate={...m,revision},built=await buildV5CheckoutAuthority({...args,manifest:candidate});
    const basis={...candidate,products:built.products};
    await tx.commit([put(path,{ownerUid:identity.uid,epoch,baseRevision:m.revision,baseManifest:m,revision,basis,addonTitles:built.addonTitles,createdAt:args.now,status:"preview"},null)]);
    return decorate(built,basis);
   }
   const saved=previous?.data;
   if(!saved||saved.ownerUid!==identity.uid||saved.epoch!==epoch||saved.revision!==revision)fail("not_found");
   if(saved.status==="approved"){if(m.revision!==revision||!same(m,saved.basis))fail("revision_conflict");return {revision,duplicate:true}}
   if(saved.status!=="preview"||args.now-saved.createdAt>300000||args.now<saved.createdAt||!same(m,saved.baseManifest))fail("revision_conflict");
   const candidate={...m,revision},built=await buildV5CheckoutAuthority({...args,manifest:candidate}),basis={...candidate,products:built.products};
   if(!same(basis,saved.basis)||!same(built.addonTitles,saved.addonTitles))fail("catalog_stale");
   await tx.commit([put(root,basis,doc),put(path,{...saved,status:"approved",approvedAt:args.now},previous)]);
   return {revision,duplicate:false};
  }finally{await tx.rollback()}
 }
 return {execute};
}
