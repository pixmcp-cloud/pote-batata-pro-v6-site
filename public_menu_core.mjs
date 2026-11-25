/* Cardápio Público V2 — adaptador de publicação (sem custos internos, sem dados de clientes).
   Não executa transações; normaliza somente campos autorizados para divulgação. */
export const MENU_SCHEMA = 1;
export const MENU_MAX_ITEMS = 60;
const text = (x,limit=120) => String(x??"").trim().slice(0,limit);
export const slugify = value => text(value,120).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
export const validSlug = value => typeof value==="string" && /^[a-z0-9](?:[a-z0-9-]{2,38})[a-z0-9]$/.test(value);
export const cents = value => {
  const n=Number(value);
  return Number.isFinite(n)&&n>0&&n<=99999?Math.round(n*100):0;
};
export const publicImage = (image,fallback="../assets/generic/business-batataria.svg") => {
  const src=text(image,800);
  if(/^https:\/\/[^\s<>"']{1,760}$/i.test(src))return src;
  if(/^(?:\.\.?\/|\/)?assets\/(?:generic|recipes)\/[A-Za-z0-9_\-.]+\.(?:svg|webp|png|jpg|jpeg)$/i.test(src))
    return "../"+src.replace(/^(?:\.\.?\/|\/)?/,"");
  return fallback;
};
const safeCategory = c=>text(c||"Cardápio",40);
const isComboCategory = c=>/^combos?$/i.test(String(c??"").trim());
export function safeIngredientNames(raw){
  return [...new Set((Array.isArray(raw)?raw:[]).filter(x=>typeof x==="string").map(x=>text(x,90)).filter(Boolean))].slice(0,40);
}
export function recipeIngredientNames(recipe,data){
  const names=new Map((Array.isArray(data?.ingredients)?data.ingredients:[]).filter(i=>i?.id&&typeof i.name==="string"&&!/embalagem|descartável|descartavel/i.test(String(i.category||""))).map(i=>[i.id,i.name]));
  return safeIngredientNames((Array.isArray(recipe?.items)?recipe.items:[]).map(i=>names.get(i?.id)));
}
export function buildMenuCandidates(snapshot,{priceFor,allowed,imageFor,includeIngredientNames=false}={}){
  const data=snapshot?.data||{},items=[];
  const business=text(data.businessType||"batataria",32);
  const defaultImage=publicImage("./assets/generic/business-"+business+".svg");
// Fotos privadas e URLs com tokens nunca são copiadas automaticamente.
// O upload público de fotos exigirá consentimento e armazenamento autorizado.
const ownImage=(src)=>{
  const value=text(src,800);
  return /^\.?\/?assets\/(?:generic|recipes)\/[A-Za-z0-9_\-.]+\.(?:svg|webp|png|jpg|jpeg)$/i.test(value)
    ? publicImage(value,defaultImage):defaultImage;
};
  const isAllowed=typeof allowed==="function"?allowed:()=>true;
  const calc=typeof priceFor==="function"?priceFor:()=>NaN;
  for(const r of Array.isArray(data.recipes)?data.recipes:[]){
    if(!r?.id||!r?.name||isComboCategory(r.category)||r.franchiseLocked===true||r.unavailable===true||r.suspended===true||!isAllowed(r))continue;
    const id=text(r.id,72),price=cents(calc(r));
    if(!price||!id||items.some(p=>p.id===id))continue;
    items.push({id,title:text(r.name,90),description:text(r.tagline||r.description,240),
      category:safeCategory(r.category),priceCents:price,...(includeIngredientNames?{ingredientNames:recipeIngredientNames(r,data)}:{}),image:ownImage((typeof imageFor==="function"?imageFor(r):null)||r.imageUrl||r.photoUrl||r.photo||r.image),addons:[]});
  }
  for(const b of Array.isArray(data.beverages)?data.beverages:[]){
    if(!b?.id||!b?.name||b.unavailable===true||b.suspended===true)continue;
    const id="bev-"+text(b.id,68),price=cents(b.sellPrice);
    if(!price||items.some(p=>p.id===id))continue;
    items.push({id,title:text(b.name,80),description:text(b.size,60),
      category:"Bebidas",priceCents:price,image:defaultImage,size:text(b.size,60),flavors:safeIngredientNames(b.flavors).slice(0,12),addons:[]});
  }
  return items.slice(0, MENU_MAX_ITEMS);
}
export function makePublicMenu(snapshot,{slug,ownerUid,selectedIds,priceFor,allowed,imageFor,includeIngredientNames=false,previous}={}){
  if(!validSlug(slug))throw Error("Endereço inválido: use 4 a 40 caracteres, letras, números e hífen.");
  if(typeof ownerUid!=="string"||!ownerUid||ownerUid.length>128)throw Error("Usuário não autenticado.");
  if(previous && previous.ownerUid!==ownerUid)throw Error("Este endereço já pertence a outro estabelecimento.");
  const data=snapshot?.data||{},brand=data.brand||{};
  const selected=new Set(Array.isArray(selectedIds)?selectedIds:[]);
  const items=buildMenuCandidates(snapshot,{priceFor,allowed,imageFor,includeIngredientNames}).filter(p=>selected.has(p.id));
  if(!items.length)throw Error("Selecione ao menos um produto com preço positivo.");
  const title=text(brand.name||"Meu Negócio",70);
  const subtitle=text(brand.subtitle||"",110);
  return {schemaVersion:MENU_SCHEMA,ownerUid,slug,published:true,title,subtitle,
    businessType:text(data.businessType||"batataria",32),
    color:"#e7b968",items};
}
export function sanitizeReadMenu(raw,slug){
  if(!raw||raw.schemaVersion!==MENU_SCHEMA||raw.published!==true||raw.slug!==slug||!validSlug(slug)||
     typeof raw.title!=="string"||!Array.isArray(raw.items)||raw.items.length>MENU_MAX_ITEMS)return null;
  const items=raw.items.filter(p=>p&&!isComboCategory(p.category)&&typeof p.id==="string"&&p.id.length<=72&&
    typeof p.title==="string"&&p.title.length>0&&p.title.length<=90&&
    Number.isSafeInteger(p.priceCents)&&p.priceCents>0&&p.priceCents<=9999999&&Array.isArray(p.addons))
    .slice(0,MENU_MAX_ITEMS).map(p=>({id:text(p.id,72),title:text(p.title,90),
      description:text(p.description,240),category:safeCategory(p.category),
      priceCents:p.priceCents,image:publicImage(p.image),ingredientNames:safeIngredientNames(p.ingredientNames),...(safeCategory(p.category)==="Bebidas"?{size:text(p.size||p.description,60),flavors:safeIngredientNames(p.flavors).slice(0,12)}:{}),addons:[]}));
  if(!items.length)return null;
  return {title:text(raw.title,70),subtitle:text(raw.subtitle,110),items,slug};
}
