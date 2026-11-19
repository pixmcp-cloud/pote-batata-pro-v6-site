/* F02: server-owned catalog approvals, separate from tenant-editable recipes.
 * Never accept an unapproved recipe price simply because its browser-facing
 * record contains serverSalePriceCents.
 * Firestore Rules deny browser writes to /users/{uid}/serverPrices/{id}.
 */
import {OperationalError,keyFor} from "./domain.mjs";
const fail=(message,code="price_review_required")=>{
 throw new OperationalError(message,409,code);
};
export function serverPricePath(uid,universe,recipeId){
 return "users/"+uid+"/serverPrices/"+keyFor(universe,"recipes",recipeId);
}
export function assertSimpleRecipeScope(recipe){
 const unsupported=[
  "packagingIngredientIds","addonIds","extraIds","beverageIds",
  "comboIds","includedAddonIds","selectedAddons","extras","addons",
  "beverages","comboItems","packagingItems"
 ];
 for(const field of unsupported){
  const value=recipe?.[field];
  if(value===undefined||value===null)continue;
  if(Array.isArray(value)&&value.length===0)continue;
  throw new OperationalError(
   "Receita possui adicionais, bebidas ou embalagens sem custo homologado",
   409,"recipe_review_required");
 }
 if(recipe?.costEstimateMode==="estimated"||recipe?.priceIncludesExtras===true||
    recipe?.hasUnknownCosts===true)
  throw new OperationalError("Custos adicionais exigem revisao",409,
   "recipe_review_required");
}
export function verifyServerPrice(approvalDoc,recipe,universe,recipeId){
 assertSimpleRecipeScope(recipe);
 const a=approvalDoc?.data;
 if(!a||a.version!==1||a.universe!==universe||a.recipeId!==recipeId||
   !Number.isSafeInteger(a.salePriceCents)||a.salePriceCents<1||
   a.salePriceCents>10000000||
   !Number.isSafeInteger(a.revision)||a.revision<1||
   !Number.isFinite(a.minimumGainPct)||a.minimumGainPct<0||
   a.minimumGainPct>500)
  fail("Preço não aprovado no servidor");
 if(recipe?.serverPriceVersion!==1||
   recipe?.serverSalePriceCents!==a.salePriceCents||
   (recipe.serverPriceRevision!==undefined&&recipe.serverPriceRevision!==a.revision))
  fail("Preço da ficha diverge da aprovação do servidor");
 if(!Array.isArray(recipe?.items)||!Array.isArray(a.items)||
   recipe.items.length===0||recipe.items.length!==a.items.length||
   recipe.items.some((r,i)=>r?.id!==a.items[i]?.id||
    r?.g!==a.items[i]?.g))
  fail("Ingredientes da receita alterados após aprovação","recipe_review_required");
 if(recipe?.serverMinimumGainPct!==undefined&&
   recipe.serverMinimumGainPct!==a.minimumGainPct)
  fail("Margem alterada após aprovação");
 return Object.freeze({salePriceCents:a.salePriceCents,
  minimumGainPct:a.minimumGainPct,revision:a.revision});
}
