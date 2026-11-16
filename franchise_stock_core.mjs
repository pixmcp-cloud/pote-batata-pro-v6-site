/* Estoque inicial de franquias e lista de compras — regras puras, sem Firebase.
 * Meta: insumos para cinco unidades DE CADA lanche oficial, dez de cada bebida.
 * Saldos iniciais são demonstrativos, não comprovam compras ou posse física. */
export const FRANCHISE_STARTER_VERSION=1;
export const STARTER_LANCHES=5;
export const STARTER_BEVERAGES=10;
const number=x=>{const n=Number(x);return Number.isFinite(n)?Math.max(0,n):0};
const round=x=>Math.ceil((number(x)-1e-7)*1000)/1000;
const active=x=>x&&!x.archived&&x.unavailable!==true;
function recipeRequirements(data,servings=STARTER_LANCHES){
 const targets=new Map();
 const recipes=(data?.recipes||[]).filter(r=>active(r)&&r.templateOrigin==="franchise"&&!r.franchiseLocked);
 const ingredients=new Map((data?.ingredients||[]).map(i=>[String(i.id),i]));
 for(const recipe of recipes){
  for(const row of recipe.items||[]){
   if(!row?.id||number(row.g)<=0)continue;
   const ingredient=ingredients.get(String(row.id));
   const yieldPct=Math.max(0.01,number(ingredient?.yield||100)/100);
   const required=number(row.g)*servings/yieldPct;
   targets.set(String(row.id),(targets.get(String(row.id))||0)+required);
  }
  if(data?.settings?.usePackagingStock){
   for(const id of recipe.packagingIngredientIds||[]){
    if(!id)continue;
    targets.set(String(id),(targets.get(String(id))||0)+servings);
   }
  }
 }
 return targets;
}
function reservations(data){
 const ingredient=new Map(),beverage=new Map();
 for(const order of data?.orders||[]){
  if(order.status!=="recebido"||order.stockDeducted===true)continue;
  const qty=number(order.qty)||1;
  for(const row of order.items||[]){
   if(!row.id)continue;
   const yieldPct=Math.max(.01,number(row.yieldPct||100)/100);
   ingredient.set(String(row.id),(ingredient.get(String(row.id))||0)+number(row.g)*qty/yieldPct);
  }
  for(const row of order.beverageItems||[]){
   if(!row.id)continue;
   beverage.set(String(row.id),(beverage.get(String(row.id))||0)+number(row.qty)*qty);
  }
 }
 return {ingredient,beverage};
}
export function shoppingNeeds(data){
 const targets=recipeRequirements(data),held=reservations(data),results=[];
 const ingredients=new Map((data?.ingredients||[]).filter(active).map(x=>[String(x.id),x]));
 // Produto registrado e consumido em ficha, mas excluído do cadastro, também aparece.
 for(const [id,value] of targets){
  const item=ingredients.get(id);
  const target=round(Math.max(value,number(item?.minimum)));
  const onHand=number(item?.stock);
  const reserved=number(held.ingredient.get(id));
  const available=Math.max(0,onHand-reserved);
  const missing=round(Math.max(0,target-available));
  if(missing>0.0001)results.push({
   kind:"ingredient",id,name:String(item?.name||"Ingrediente sem cadastro: "+id),
   unit:item?.measureUnit||"g",target,onHand,reserved,available,missing,
   missingRegistration:!item,level:available<=0?"missing":"low"
  });
 }
 // Insumos adicionais não presentes em fichas: respeitar seus mínimos manuais.
 for(const item of ingredients.values()){
  if(targets.has(String(item.id))||number(item.minimum)<=0)continue;
  const target=round(number(item.minimum)),onHand=number(item.stock),reserved=number(held.ingredient.get(String(item.id)));
  const available=Math.max(0,onHand-reserved),missing=round(Math.max(0,target-available));
  if(missing>0.0001)results.push({kind:"ingredient",id:String(item.id),
   name:String(item.name||item.id),unit:item.measureUnit||"g",target,onHand,reserved,available,missing,
   level:available<=0?"missing":"low"});
 }
 for(const item of data?.beverages||[]){
  if(!active(item))continue;
  const id=String(item.id),target=Math.max(STARTER_BEVERAGES,Math.ceil(number(item.minimum)));
  const onHand=number(item.stock),reserved=number(held.beverage.get(id));
  const available=Math.max(0,onHand-reserved),missing=Math.ceil(Math.max(0,target-available)-1e-7);
  if(missing>0)results.push({kind:"beverage",id,name:String(item.name||id)+" · "+String(item.size||""),
   unit:"un",target,onHand,reserved,available,missing,level:available<=0?"missing":"low"});
 }
 return results.sort((a,b)=>Number(b.level==="missing")-Number(a.level==="missing")||
  a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
}
export function initializeFranchiseStarterStock(state){
 const data=state?.data;
 if(!data||!Array.isArray(data.recipes)||!Array.isArray(data.ingredients))
  return {changed:false,reason:"invalid-data"};
 if(data.franchiseStarterStockVersion>=FRANCHISE_STARTER_VERSION)
  return {changed:false,reason:"already-initialized"};
 if(!data.recipes.some(r=>r.templateOrigin==="franchise"&&!r.franchiseLocked))
  return {changed:false,reason:"no-official-recipes"};
 const targets=recipeRequirements(data);
 let ingredientsUpdated=0,beveragesUpdated=0;
 const ingredientMap=new Map((data.ingredients||[]).map(i=>[String(i.id),i]));
 for(const [id,targetRaw] of targets){
  const item=ingredientMap.get(id);
  if(!item||item.archived)continue;
  const target=item.measureUnit==="un"?Math.ceil(targetRaw-1e-7):round(targetRaw);
  const previous=number(item.stock);
  if(previous+0.0001<target){
   item.stock=target;ingredientsUpdated++;
   item.source="Saldo inicial demonstrativo da franquia — confira o estoque físico";
  }
  if(number(item.minimum)<=0)
   item.minimum=item.measureUnit==="un"?Math.max(1,Math.ceil(target*0.4)):round(target*0.4);
 }
 for(const drink of data.beverages||[]){
  if(!active(drink))continue;
  if(number(drink.stock)<STARTER_BEVERAGES){
   drink.stock=STARTER_BEVERAGES;beveragesUpdated++;
   drink.stockOrigin="Saldo inicial demonstrativo da franquia — confira o estoque físico";
  }
  if(number(drink.minimum)<=0)drink.minimum=5;
 }
 data.franchiseStarterStockVersion=FRANCHISE_STARTER_VERSION;
 data.franchiseStarterStockAt=new Date().toISOString();
 return {changed:true,ingredientsUpdated,beveragesUpdated,recipes:data.recipes.filter(r=>r.templateOrigin==="franchise"&&!r.franchiseLocked).length};
}
export function formatStockQuantity(amount,unit){
 const n=number(amount);
 if(unit==="un")return Math.ceil(n-1e-7)+" un";
 if(unit==="g")return n>=1000?(n/1000).toLocaleString("pt-BR",{maximumFractionDigits:3})+" kg":n.toLocaleString("pt-BR",{maximumFractionDigits:1})+" g";
 if(unit==="ml")return n>=1000?(n/1000).toLocaleString("pt-BR",{maximumFractionDigits:3})+" L":n.toLocaleString("pt-BR",{maximumFractionDigits:1})+" ml";
 return n.toLocaleString("pt-BR",{maximumFractionDigits:3})+" "+unit;
}
