// Catálogo oficial Potê Batata: só fichas e fotos, nunca dados operacionais da matriz.
export const FRANCHISE_BRAND_ID="potebatata";
export const FRANCHISE_CATALOG_ID="potebatata";
export const FRANCHISE_RECIPE_PREFIX="fr-";
export const FRANCHISE_LOGO="./assets/pote-logo-original.jpg";
const value=(v,max=600)=>String(v??"").slice(0,max);
const cleanId=v=>/^[A-Za-z0-9_-]{1,64}$/.test(String(v))?String(v):null;
export function franchiseActive(profile){
 return profile?.franchise?.status==="active"&&profile.franchise.brandId===FRANCHISE_BRAND_ID;
}
function safeImage(src,recipeId,imageMap={}){
 const candidate=String(src||imageMap[recipeId]||"");
 // Não disponibilizar base64, URLs locais ou caminhos privados em documentos públicos de catálogo.
 if(candidate.startsWith("./assets/recipes/")&&/^[.][/](?:assets[/]recipes[/])[A-Za-z0-9_-]+[.]webp$/.test(candidate))return candidate;
 if(candidate.startsWith("https://")&&candidate.length<700)return candidate;
 return "./assets/generic/recipe-"+recipeId+".svg";
}
export function buildFranchiseCatalog(state,imageMap={}){
 const data=state?.data||{};
 const list=Array.isArray(data.recipes)?data.recipes:[];
 const recipes=list.filter(r=>cleanId(r?.id)&&r?.templateOrigin!=="franchise").slice(0,150).map(r=>({
  id:cleanId(r.id),name:value(r.name,120),category:value(r.category,45),tagline:value(r.tagline,220),
  difficulty:value(r.difficulty,30),time:Number.isFinite(Number(r.time))?Math.max(0,Math.min(720,Number(r.time))):0,
  imageUrl:safeImage(r.imageUrl,r.id,imageMap),featured:!!r.featured,
  items:(Array.isArray(r.items)?r.items:[]).slice(0,45).filter(x=>cleanId(x?.id)).map(x=>({
   id:cleanId(x.id),g:Number.isFinite(Number(x.g))?Math.max(0,Math.min(100000,Number(x.g))):0
  })),
  steps:(Array.isArray(r.steps)?r.steps:[]).slice(0,22).map(s=>value(s,1150))
 }));
 const inUse=new Set(recipes.flatMap(r=>r.items.map(i=>i.id)));
 const ingredients=(Array.isArray(data.ingredients)?data.ingredients:[])
  .filter(i=>inUse.has(i?.id)&&cleanId(i?.id)).slice(0,250)
  .map(i=>({id:cleanId(i.id),name:value(i.name,120),
    category:value(i.category,45),measureUnit:value(i.measureUnit||"g",12),
    yield:Number.isFinite(Number(i.yield))?Math.max(1,Math.min(100,Number(i.yield))):100}));
 const branding={
  name:"POTÊ BATATA",subtitle:"BATATA RECHEADA NO POTE",
  slogan:value(data.brand?.slogan||"Especialidades em batatas recheadas",140),
  logoUrl:FRANCHISE_LOGO
 };
 return {brandId:FRANCHISE_BRAND_ID,version:1,branding,recipes,ingredients};
}

/** Protect the official menu from an accidentally empty or partial publish. */
export function canPublishFranchiseCatalog(catalog){
 if(catalog?.brandId!==FRANCHISE_BRAND_ID||!Array.isArray(catalog?.recipes)||!Array.isArray(catalog?.ingredients))
  return {ok:false,reason:"estrutura inválida"};
 if(!catalog.recipes.length||!catalog.ingredients.length)
  return {ok:false,reason:"cardápio vazio ou sem ingredientes"};
 const ingredients=new Set(catalog.ingredients.map(i=>String(i.id)));
 for(const recipe of catalog.recipes){
  if(!recipe.id||!Array.isArray(recipe.items)||!recipe.items.length)
   return {ok:false,reason:"ficha incompleta: "+String(recipe.id||"sem ID")};
  if(recipe.items.some(i=>!ingredients.has(String(i.id))))
   return {ok:false,reason:"ingrediente ausente: "+String(recipe.id)};
 }
 return {ok:true,recipes:catalog.recipes.length,ingredients:catalog.ingredients.length};
}

export function catalogFingerprint(catalog){
 const str=JSON.stringify(catalog);
 let hash=2166136261;
 for(let i=0;i<str.length;i++)hash=Math.imul(hash^str.charCodeAt(i),16777619);
 return (hash>>>0).toString(16).padStart(8,"0")+"-"+str.length;
}
export function mergeFranchiseCatalog(state,catalog,{active=true}={}){
 const data=state?.data;
 if(!data||!Array.isArray(data.recipes)||!Array.isArray(data.ingredients))throw Error("Estado da conta inválido");
 const official=data.recipes.filter(r=>r.templateOrigin==="franchise");
 if(!active){
  let changed=false;
  for(const r of official){if(r.franchiseLocked!==true){r.franchiseLocked=true;changed=true}}
  if(data.franchiseCatalogFingerprint){delete data.franchiseCatalogFingerprint;changed=true}
  if(data.brand?.logoUrl===FRANCHISE_LOGO){
    data.brand={...data.brand,name:"Meu Negócio",subtitle:"GESTÃO DE ALIMENTAÇÃO",logoUrl:"./assets/generic/business-neutral.svg"};
    changed=true;
  }
  return {changed,recipesAdded:0,ingredientsAdded:0,recipesUpdated:0,recipesLocked:official.length};
 }
 if(catalog?.brandId!==FRANCHISE_BRAND_ID||!Array.isArray(catalog.recipes)||!Array.isArray(catalog.ingredients))
  throw Error("Catálogo oficial inválido");
 const fingerprint=catalogFingerprint(catalog);
 let changed=false,recipesAdded=0,ingredientsAdded=0,recipesUpdated=0;
 const localIngredients=new Map(data.ingredients.map(i=>[i.id,i]));
 for(const incoming of catalog.ingredients){
  const sourceId=cleanId(incoming.id);if(!sourceId)continue;
  const id=FRANCHISE_RECIPE_PREFIX+sourceId,existing=localIngredients.get(id);
  if(existing&&existing.templateOrigin!=="franchise")continue;
  if(!existing){
   const next={id,name:value(incoming.name,120),category:value(incoming.category,45),
    measureUnit:value(incoming.measureUnit||"g",12),price:0,purchasePrice:0,stock:0,minimum:0,
    yield:Number.isFinite(Number(incoming.yield))?Math.max(1,Math.min(100,Number(incoming.yield))):100,
    source:"Atualize os custos da sua unidade",imageUrl:"",templateOrigin:"franchise"};
   data.ingredients.push(next);localIngredients.set(id,next);ingredientsAdded++;changed=true;
  }else{
   const updated={...existing,name:value(incoming.name,120),category:value(incoming.category,45)};
   // Contas antigas com rendimento padrão recebem o rendimento técnico publicado.
   if(Number(existing.yield||100)===100&&Number(incoming.yield)>0)
    updated.yield=Math.max(1,Math.min(100,Number(incoming.yield)));
   if(JSON.stringify(existing)!==JSON.stringify(updated)){Object.assign(existing,updated);changed=true}
  }
 }
 const original=new Map(data.recipes.map(r=>[r.id,r]));
 const received=new Set();
 for(const incoming of catalog.recipes){
  const sourceId=cleanId(incoming.id);if(!sourceId)continue;
  const id=FRANCHISE_RECIPE_PREFIX+sourceId;
  received.add(id);
  const existing=original.get(id);
  if(existing&&existing.templateOrigin!=="franchise")continue;
  const recipe={
   id,name:value(incoming.name,120),category:value(incoming.category,45),tagline:value(incoming.tagline,220),
   difficulty:value(incoming.difficulty,30),time:Number(incoming.time)||0,
   items:(incoming.items||[]).filter(x=>cleanId(x.id)).map(x=>({id:FRANCHISE_RECIPE_PREFIX+x.id,g:Number(x.g)||0})),
   steps:(incoming.steps||[]).map(x=>value(x,1150)),
   imageUrl:safeImage(incoming.imageUrl,sourceId,{}),featured:!!incoming.featured,
   templateOrigin:"franchise",franchiseLocked:false
  };
  if(existing){
   // Cada unidade conserva suas decisões de preço e disponibilidade.
   const next={...existing,...recipe,pricingMode:existing.pricingMode||"gain",
    targetGainPct:existing.targetGainPct??100};
   if(JSON.stringify(existing)!==JSON.stringify(next)){Object.assign(existing,next);recipesUpdated++;changed=true}
  }else{
   data.recipes.push({...recipe,pricingMode:"gain",targetGainPct:100});recipesAdded++;changed=true;
  }
 }
 for(const old of official){
  if(!received.has(old.id)&&!old.franchiseLocked){old.franchiseLocked=true;changed=true}
 }
 if(data.businessType!=="batataria"){data.businessType="batataria";changed=true}
 const before=data.brand||{};
 const brand={...before,name:"POTÊ BATATA",subtitle:"BATATA RECHEADA NO POTE",
   slogan:catalog.branding?.slogan||"Batata recheada no pote",logoUrl:FRANCHISE_LOGO};
 if(JSON.stringify(before)!==JSON.stringify(brand)){data.brand=brand;changed=true}
 if(data.franchiseCatalogFingerprint!==fingerprint){data.franchiseCatalogFingerprint=fingerprint;changed=true}
 return {changed,recipesAdded,ingredientsAdded,recipesUpdated,recipesLocked:0};
}
