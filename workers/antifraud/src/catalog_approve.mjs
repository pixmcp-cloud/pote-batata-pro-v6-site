/* F02 - approve a tenant's simple-recipe selling price server-side.
 * No live writes unless independent Worker cutover gates are enabled.
 * The user chooses the price; the server verifies cost and approved margin
 * and atomically writes the recipe, immutable journal and private approval.
 * Does not approve addons/combos, estimates or unknown ingredient costs.
 */
import {OperationalError,recordPath} from "./domain.mjs";
import {serverPricePath,assertSimpleRecipeScope} from "./server_price.mjs";
import {authoritativeComponentCost,minimumApprovedPriceCents} from "./component_cost.mjs";
const fail=(code,message,status=409)=>{throw new OperationalError(message,status,code)};
const put=(path,data,previous)=>({path,data,precondition:previous?
 {updateTime:previous.updateTime}:{exists:false}});
const validId=x=>typeof x==="string"&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(x);
const validOp=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{20,80}$/.test(x);
function validate(body){
 if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).some(k=>!["universe","operationId","recipeId",
    "salePriceCents"].includes(k))||
   typeof body.universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(body.universe)||
   !validId(body.recipeId)||!validOp(body.operationId)||
   !Number.isSafeInteger(body.salePriceCents)||body.salePriceCents<1||
   body.salePriceCents>10000000)
  fail("invalid_price_request","Preço e identificação inválidos",400);
 return body;
}
export async function approveRecipePrice(body,{user,env,repository,clock,hasAccess}){
 const {universe,operationId,recipeId,salePriceCents}=validate(body);
 const uid=user.uid,root="users/"+uid;
 const recipePath=recordPath(uid,universe,"recipes",recipeId);
 const approvalPath=serverPricePath(uid,universe,recipeId);
 const eventPath=root+"/workerEvents/"+operationId;
 const guardPath=root+"/appState/v2InventoryGuard",pulsePath=root+"/appState/v2Pulse";
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,recipe,previous,event]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(recipePath),tx.get(approvalPath),tx.get(eventPath)
  ]);
  if(!profile||!hasAccess(profile.data,user,universe))
   fail("not_allowed","Acesso à precificação não autorizado",403);
  if(event){
   const v=event.data;
   if(v.action!=="catalog_approve_price"||v.universe!==universe||
      v.recipeId!==recipeId||v.salePriceCents!==salePriceCents)
    fail("idempotency_conflict","Operação de preço já utilizada");
   return {ok:true,alreadyApplied:true,recipeId,operationId,
    salePriceCents,revision:v.revision};
  }
  if(!meta||meta.data?.schemaVersion!==2||
    meta.data?.migration?.status==="copying"||
    !guard||!Number.isSafeInteger(guard.data?.revision)||
    !pulse?.data?.eventId)
   fail("not_ready","Sincronização V2 não está pronta");
  const rec=recipe?.data?.record,r=rec?.item;
  if(!rec||rec.group!=="recipes"||rec.id!==recipeId||
    rec.universe!==universe||!r||r.unavailable||r.archived)
   fail("recipe_missing","Receita não encontrada",404);
  assertSimpleRecipeScope(r);
  if(!Array.isArray(r.items)||r.items.length<1||r.items.length>32||
    r.packagingIngredientIds?.length||r.costEstimateMode==="estimated")
   fail("recipe_review_required","Receita não é elegível para preço automático");
  const minimum=Number(r.targetGainPct??r.serverMinimumGainPct??100);
  if(!Number.isFinite(minimum)||minimum<0||minimum>500)
   fail("price_review_required","Percentual de ganho inválido");
  const rows=r.items.map(item=>{
   if(!validId(item?.id)||typeof item.g!=="number"||
      !Number.isFinite(item.g)||item.g<=0||item.g>1e6)
    fail("recipe_review_required","Ingredientes ou quantidades inválidos");
   return {id:item.id,g:item.g,path:recordPath(uid,universe,"ingredients",item.id)};
  });
  const docList=await Promise.all(rows.map(row=>tx.get(row.path)));
  const resolved=new Map();
  for(let i=0;i<rows.length;i++){
   const record=docList[i]?.data?.record;
   if(!record||record.group!=="ingredients"||record.universe!==universe||
      record.id!==rows[i].id||record.item?.archived)
    fail("cost_review_required","Ingrediente sem ficha de custos");
   resolved.set(rows[i].id,{id:record.id,kind:"ingredient",
    item:record.item,archived:record.item?.archived,
    costEstimateMode:record.item?.costEstimateMode,
    hasUnknownCosts:record.item?.hasUnknownCosts});
  }
  // No browser-provided cost is trusted. All component documents were read
  // within this transaction, so concurrent cost changes invalidate the commit.
  const cost=authoritativeComponentCost(rows.map(row=>({
   kind:"ingredient",id:row.id,quantity:row.g,unit:"g"
  })),(kind,id)=>kind==="ingredient"?resolved.get(id):undefined);
  const requiredPrice=minimumApprovedPriceCents(cost.materialCostCents,minimum);
  if(salePriceCents<requiredPrice)
   fail("price_below_cost","Valor abaixo do custo e ganho mínimo");
  if(previous&&(previous.data?.universe!==universe||
    previous.data?.recipeId!==recipeId||
    !Number.isSafeInteger(previous.data.revision)||
    previous.data.revision<1))
   fail("catalog_inconsistent","Aprovação de catálogo incompatível");
  const revision=(previous?.data?.revision??0)+1;
  if(!Number.isSafeInteger(revision)||revision>1000000)
   fail("catalog_inconsistent","Limite de revisões do catálogo");
  const at=clock().toISOString();
  const cleanItems=rows.map(({id,g})=>({id,g}));
  const approval={
   version:1,universe,recipeId,salePriceCents,
   minimumGainPct:minimum,revision,items:cleanItems,
   approvedByUid:uid,approvedAt:at,
   materialCostCents:cost.materialCostCents
  };
  const updatedRecipe={...r,serverPriceVersion:1,
   serverSalePriceCents:salePriceCents,
   serverMinimumGainPct:minimum,serverPriceRevision:revision};
  const recordId=recipePath.split("/").at(-1);
  await tx.commit([
   put(recipePath,{record:{...rec,item:updatedRecipe}},recipe),
   put(approvalPath,approval,previous),
   put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"cf-"+operationId,
    previousEventId:pulse.data.eventId,origin:"cloudflare-worker",
    affected:1,changedKeys:[recordId],metaChanged:false,sensitive:true},pulse),
   put(eventPath,{action:"catalog_approve_price",universe,recipeId,
    salePriceCents,revision,operationId,actorUid:uid},null)
  ]);
  return {ok:true,alreadyApplied:false,recipeId,operationId,
   salePriceCents,revision};
 }finally{await tx.rollback()}
}
