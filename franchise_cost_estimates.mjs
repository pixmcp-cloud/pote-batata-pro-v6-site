/* Simulação da franquia: custos faltantes equivalentes a 60% dos preços finais de referência.
   Preços de referência vêm exclusivamente da tabela demonstrativa SEED, nunca do custo privado da matriz. */
export const FRANCHISE_COST_ESTIMATE_VERSION=1;
export const COST_ESTIMATE_RATE=0.60;
const n=x=>{const v=Number(x);return Number.isFinite(v)&&v>0?v:0};
const money2=x=>Math.round((Number(x)||0)*100+1e-7)/100;
const normalizeUnit=i=>(i?.purchaseUnit==="kg"||i?.purchaseUnit==="L")?1000:1;
const fraction=i=>Math.max(0.01,n(i?.yield||100)/100);
const baseCost=i=>n(i?.purchasePrice??i?.price)/Math.max(0.000001,n(i?.purchaseQuantity)||1)/normalizeUnit(i);
export function matrixRecipeMaterialCost(recipe,ingredients){
 const byId=new Map((ingredients||[]).map(i=>[String(i.id),i]));
 return (recipe?.items||[]).reduce((sum,line)=>{
  const i=byId.get(String(line.id));
  return sum+(i?n(line.g)*baseCost(i)/fraction(i):0);
 },0);
}
function commercialRound(v){
 if(!(v>0))return 0;
 const cents=Math.ceil(v*100-1e-7),whole=Math.floor(cents/100),part=cents%100;
 return money2(whole+(part<=50?0.5:part<=90?0.9:1.5));
}
export function estimateReferenceSale(recipe,matrix){
 const settings=matrix?.settings||{},materials=matrixRecipeMaterialCost(recipe,matrix?.ingredients);
 const packaging=n(settings.packageCost);
 const expense=n(settings.otherCost);
 const fee=n(settings.fee)+n(settings.tax);
 const gain=n(recipe?.targetGainPct??100)||100;
 const proposed=(materials+packaging+expense)*(1+gain/100)/Math.max(.05,1-fee/100);
 return commercialRound(proposed);
}
export function currentCostIsEstimated(ingredient){
 return ingredient?.costSource==="franchise-estimate-60" &&
  money2(ingredient.purchasePrice)===money2(ingredient.costEstimateOriginalPrice);
}
export function initializeFranchiseEstimatedCosts(state,matrix){
 const data=state?.data;
 if(!data?.recipes?.length||!Array.isArray(data.ingredients))
  return {changed:false,reason:"no-franchise-recipes"};
 const source=new Map((matrix?.ingredients||[]).map(i=>["fr-"+String(i.id),i]));
 const matrixRecipes=new Map((matrix?.recipes||[]).map(r=>["fr-"+String(r.id),r]));
 const recipes=data.recipes.filter(r=>r?.templateOrigin==="franchise"&&!r.franchiseLocked);
 if(!recipes.length)return {changed:false,reason:"no-franchise-recipes"};
 const settings=matrix?.settings||{};
 let wanted=0,benchmark=0,recipesUpdated=0,ingredientsUpdated=0,beveragesUpdated=0;
 const references=new Map();
 for(const recipe of recipes){
  const sourceRecipe=matrixRecipes.get(String(recipe.id));
  const sale=n(recipe.estimatedSalePrice)||(
    sourceRecipe?estimateReferenceSale(sourceRecipe,matrix):0
  );
  if(sale>0){
   references.set(recipe.id,sale);
   wanted+=Math.max(0,money2(sale*COST_ESTIMATE_RATE)-n(settings.packageCost));
   if(sourceRecipe)benchmark+=matrixRecipeMaterialCost(sourceRecipe,matrix?.ingredients);
  }
 }
 const multiplier=benchmark>0?wanted/benchmark:1;
 for(const ingredient of data.ingredients){
  if(ingredient.templateOrigin!=="franchise")continue;
  if(n(ingredient.purchasePrice)>0||n(ingredient.price)>0)continue;
  const origin=source.get(String(ingredient.id));
  if(!origin||!n(origin.purchasePrice??origin.price))continue;
  const value=money2(n(origin.purchasePrice??origin.price)*multiplier);
  if(!(value>0))continue;
  ingredient.purchasePrice=value;
  ingredient.price=value;
  ingredient.purchaseQuantity=n(origin.purchaseQuantity)||1;
  ingredient.purchaseUnit=origin.purchaseUnit||"kg";
  ingredient.costSource="franchise-estimate-60";
  ingredient.costEstimateOriginalPrice=value;
  ingredient.source="Custo ESTIMADO — simulação de 60% do preço de venda; não é compra real";
  ingredientsUpdated++;
 }
 for(const recipe of recipes){
  const sale=references.get(recipe.id);
  if(!(sale>0)||recipe.costEstimateMode==="real"||recipe.costEstimateMode==="manual")continue;
  if(n(recipe.estimatedSalePrice)>0&&n(recipe.estimatedUnitCost)>0)continue;
  recipe.estimatedSalePrice=sale;
  recipe.estimatedUnitCost=money2(sale*COST_ESTIMATE_RATE);
  recipe.costEstimatePct=60;
  recipe.costEstimateMode="estimated";
  recipe.costSource="franchise-estimate-60";
  recipe.costEstimateDescription="Simulação: custo de 60% do preço final de referência, sem comprovantes de compra";
  recipesUpdated++;
 }
 for(const drink of data.beverages||[]){
  if(drink.archived||n(drink.purchasePrice)>0||!(n(drink.sellPrice)>0))continue;
  const price=money2(n(drink.sellPrice)*COST_ESTIMATE_RATE);
  drink.purchasePrice=price;
  drink.purchaseQuantity=1;
  drink.costSource="franchise-estimate-60";
  drink.costEstimateOriginalPrice=price;
  drink.source="Custo ESTIMADO: 60% do preço de venda; não é compra real";
  beveragesUpdated++;
 }
 const changed=recipesUpdated+ingredientsUpdated+beveragesUpdated>0;
 if(changed){
  data.franchiseCostEstimateVersion=FRANCHISE_COST_ESTIMATE_VERSION;
  data.franchiseCostEstimatePct=60;
 }
 return {changed,recipesUpdated,ingredientsUpdated,beveragesUpdated,
   reference:"matriz demonstrativa",rate:COST_ESTIMATE_RATE};
}
