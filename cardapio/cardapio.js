import { money, makeLine, addLine, normalizeCart, itemUnitCents, cartTotals, demoSummary } from "./cardapio-core.mjs";
import { sanitizeReadMenu, validSlug, menuHeroSequence, groupDrinkProducts } from "../public_menu_core.mjs?lojas=8";

// Catálogo de apresentação, isolado do banco e do estoque operacional.
// Fotos oficiais locais da Potê Batata quando disponíveis; preços e horários da prévia são demonstrativos.
const DEMO_INGREDIENTS = {
  "estrogonofe": [
    "Batata inglesa",
    "Leite integral",
    "Manteiga",
    "Sal e temperos secos",
    "Frango desfiado cozido",
    "Creme de leite",
    "Molho de tomate",
    "Champignon",
    "Muçarela",
    "Batata palha"
  ],
  "pizza": [
    "Batata inglesa",
    "Leite integral",
    "Manteiga",
    "Sal e temperos secos",
    "Presunto",
    "Muçarela",
    "Molho de tomate",
    "Cebola refogada",
    "Orégano",
    "Azeitona fatiada"
  ],
  "hotdog": [
    "Batata inglesa",
    "Leite integral",
    "Manteiga",
    "Sal e temperos secos",
    "Salsicha",
    "Molho de tomate",
    "Cebola refogada",
    "Milho verde",
    "Muçarela",
    "Batata palha"
  ],
  "ninho": [
    "Batata-doce",
    "Leite condensado",
    "Creme de leite",
    "Leite em pó",
    "Creme de avelã (tipo Nutella)"
  ],
  "brigadeiro": [
    "Batata-doce",
    "Leite condensado",
    "Creme de leite",
    "Cacau em pó",
    "Granulado de chocolate"
  ],
  "chocolate-morango": [
    "Batata-doce",
    "Chocolate meio amargo",
    "Creme de leite",
    "Morango fresco"
  ],
  "chocolate-morango-branco": [
    "Batata-doce",
    "Chocolate branco",
    "Creme de leite",
    "Morango fresco"
  ],
  "carne-cheddar": [
    "Batata",
    "Carne desfiada",
    "Cheddar"
  ],
  "agua": [
    "Água mineral"
  ]
};
const IMG = "../assets/generic/business-batataria.svg";
let catalogue = [
  { id:"carne-cheddar",title:"Carne com Cheddar",category:"Salgados",description:"Uma combinação irresistível de carne suculenta, queijo cremoso e muito sabor.",priceCents:3850,tag:"Mais pedido",image:"../assets/recipes/carne-cheddar.webp",addons:["cheddar","bacon","requeijao"] },
  { id:"estrogonofe",title:"Estrogonofe de Frango",category:"Salgados",description:"Frango envolvido em molho cremoso, com aquele toque especial que conquista.",priceCents:3490,tag:"Queridinho",image:"../assets/recipes/r05.webp",addons:["cheddar","bacon"] },
  { id:"pizza",title:"Sabor Pizza",category:"Salgados",description:"O clássico sabor de pizza em uma combinação surpreendente e generosa.",priceCents:3490,tag:"Imperdível",image:"../assets/recipes/r22.webp",addons:["cheddar","requeijao"] },
  { id:"hotdog",title:"Cachorro-quente",category:"Salgados",description:"Um sabor cheio de memória afetiva, com recheio caprichado.",priceCents:3290,tag:"Clássico",image:"../assets/recipes/r21.webp",addons:["cheddar","bacon"] },
  { id:"ninho",title:"Ninho com Nutella",category:"Doces",description:"Creme suave com uma camada generosa de creme de avelã.",priceCents:2290,tag:"Doce favorito",image:"../assets/recipes/ninho-nutella.webp",addons:["avela"] },
  { id:"brigadeiro",title:"Brigadeiro Cremoso",category:"Doces",description:"Chocolate intenso em uma sobremesa cremosa, feita para adoçar seu dia.",priceCents:1990,tag:"Doce momento",image:"../assets/recipes/brigadeiro.webp",addons:["avela"] },
  { id:"chocolate-morango",title:"Chocolate Preto com Morango",category:"Doces",description:"Chocolate e morango em camadas de pura felicidade.",priceCents:2290,tag:"Especial",image:"../assets/recipes/morango-preto.webp",addons:["avela"] },
  { id:"chocolate-morango-branco",title:"Chocolate Branco com Morango",category:"Doces",description:"Chocolate branco e morango em camadas cremosas.",priceCents:2290,tag:"Especial",image:"../assets/recipes/morango-branco.webp",addons:["avela"] },
  { id:"refrigerante",title:"Refrigerante Lata",category:"Bebidas",size:"Lata 350 ml",flavors:["Cola","Guaraná","Laranja","Soda"],drinkVariants:["Cola","Guaraná","Laranja","Soda"].map(flavor=>({id:"refrigerante",flavor,type:"Normal",available:true,priceCents:700})),description:"Bebida gelada para acompanhar seu sabor favorito.",priceCents:700,tag:"Acompanhamento",image:"../assets/recipes/refrigerante-lata.webp",addons:[] },
  ...["Cola","Guaraná","Laranja","Soda"].flatMap((flavor,index)=>["Normal","Zero"].filter(type=>type==="Normal"||flavor!=="Soda").map(type=>({id:"refri600-"+index+"-"+type.toLowerCase(),title:"Refrigerante "+flavor+(type==="Zero"?" Zero Açúcar":""),category:"Bebidas",size:"600 ml",description:"Refrigerante 600 ml.",priceCents:type==="Zero"?1000:900,available:true,tag:"Para refrescar",image:"../assets/recipes/refrigerante-600.webp",addons:[]}))),
  { id:"agua",title:"Água Mineral sem gás",category:"Bebidas",size:"Garrafa 500 ml",description:"Água mineral sem gás, 500 ml.",priceCents:400,available:true,tag:"Para refrescar",image:"../assets/recipes/agua-mineral.webp",addons:[] },
  { id:"agua-gas",title:"Água Mineral com gás",category:"Bebidas",size:"Garrafa 500 ml",description:"Água mineral com gás, 500 ml.",priceCents:500,available:true,tag:"Para refrescar",image:"../assets/recipes/agua-mineral.webp",addons:[] }
].map(product => ({ ...product, ingredientNames:DEMO_INGREDIENTS[product.id]||[], addons:product.addons.map(id => ({
  cheddar:{id:"cheddar",label:"Cheddar extra",priceCents:490},
  bacon:{id:"bacon",label:"Bacon crocante",priceCents:590},
  requeijao:{id:"requeijao",label:"Requeijão cremoso",priceCents:450},
  avela:{id:"avela",label:"Creme de avelã extra",priceCents:650}
}[id])) }));
const byId = new Map(catalogue.map(product => [product.id,product]));
const requestedSlug = new URLSearchParams(location.search).get("loja");
if(requestedSlug!==null){catalogue=[];byId.clear();}
const STORAGE_KEY = requestedSlug===null ? "pote-cardapio-premium-preview-cart-v1" : "pote-public-menu-cart:"+requestedSlug;
const $ = id => document.getElementById(id);
const catTabs = $("categoryTabs"), grid = $("menuGrid"), productDialog = $("productDialog"), cartDialog = $("cartDialog");
let cart = restoreCart(), category = "Todos", search = "", selected = null, quantity = 1;
const chosenExtras = new Set();
let pendingProduct=[];let pendingDirty=false;

function restoreCart(){
  try { return normalizeCart(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"),catalogue); }
  catch { return []; }
}
function saveCart(){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(cart)); } catch {}
}
function el(tag, className, text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}
function productImage(product, className){
  const img=el("img",className);
  img.src=product.image || IMG;
  img.alt=product.title;
  img.loading="lazy";
  img.decoding="async";
  img.addEventListener("error",()=>{
    if(!img.src.endsWith("/business-batataria.svg"))img.src=IMG;
  },{once:true});
  return img;
}
// Cada foto é precedida pela abertura, inclusive ao reiniciar a sequência.
export function heroSequence(products){return menuHeroSequence(products,{demo:requestedSlug===null});}
let heroTimer=null,heroIndex=0,heroSlides=[],heroPaused=false,heroVisible=true,heroHover=false,heroFocused=false;
const heroMotion=matchMedia("(prefers-reduced-motion: reduce)");
function heroStop(){clearTimeout(heroTimer);heroTimer=null;}
function heroSchedule(){
  heroStop();
  if(heroSlides.length<2||heroPaused||heroMotion.matches||document.hidden||!heroVisible||heroHover||heroFocused)return;
  heroTimer=setTimeout(()=>heroShow(heroIndex+1),heroSlides[heroIndex]?.dataset.kind==="title"?2400:4200);
}
function heroShow(index){
  if(!heroSlides.length)return;
  heroIndex=(index+heroSlides.length)%heroSlides.length;
  heroSlides.forEach((slide,i)=>{
    slide.classList.toggle("is-active",i===heroIndex);
    slide.setAttribute("aria-hidden",String(i!==heroIndex));
  });
  $("heroCounter").textContent=(heroIndex+1)+" / "+heroSlides.length;
  $("menuHero").classList.toggle("is-food",heroSlides[heroIndex].dataset.kind==="food");
  heroSchedule();
}
function heroSlide(p){
  const slide=el("div","menu-hero-slide "+(p?"menu-hero-food":"menu-hero-title"));
  slide.dataset.kind=p?"food":"title";slide.setAttribute("aria-hidden","true");
  const image=el("img",p?"menu-hero-product":"");
  image.src=p?p.image:"./cardapio-dourado.webp?v=4";
  image.alt=p?p.title:"CARDÁPIO";image.decoding="async";
  if(p){
    image.addEventListener("error",()=>{image.hidden=true;slide.classList.add("hero-photo-unavailable");},{once:true});
    slide.append(image);
    slide.append(el("div","menu-hero-name",p.title));
  }else slide.append(image);
  return slide;
}
function renderHero(){
  heroStop();
  const stage=$("menuHeroStage"),sequence=heroSequence(catalogue);
  heroSlides=(sequence.length?sequence:[null]).map(heroSlide);
  stage.replaceChildren(...heroSlides);
  const controls=$("menuHero").querySelector(".menu-hero-controls");
  controls.hidden=heroSlides.length<2;
  heroShow(0);
}
function initHero(){
  const root=$("menuHero");
  $("heroPrev").addEventListener("click",()=>heroShow(heroIndex-1));
  $("heroNext").addEventListener("click",()=>heroShow(heroIndex+1));
  $("heroPause").addEventListener("click",()=>{
    heroPaused=!heroPaused;
    $("heroPause").textContent=heroPaused?"▶":"Ⅱ";
    $("heroPause").setAttribute("aria-label",heroPaused?"Reproduzir carrossel":"Pausar carrossel");
    $("heroPause").setAttribute("aria-pressed",String(heroPaused));
    root.classList.toggle("is-paused",heroPaused);
    heroSchedule();
  });
  root.addEventListener("mouseenter",()=>{heroHover=true;heroSchedule()});
  root.addEventListener("mouseleave",()=>{heroHover=false;heroSchedule()});
  root.addEventListener("focusin",()=>{heroFocused=true;heroSchedule()});
  root.addEventListener("focusout",e=>{if(!root.contains(e.relatedTarget)){heroFocused=false;heroSchedule()}});
  document.addEventListener("visibilitychange",heroSchedule);
  heroMotion.addEventListener("change",heroSchedule);
  if("IntersectionObserver" in window)new IntersectionObserver(entries=>{
    heroVisible=entries[0].isIntersecting;
    root.classList.toggle("is-offscreen",!heroVisible);heroSchedule();
  },{threshold:.1}).observe(root);
  renderHero();
}
function toast(message){
  const node=$("toast"); node.textContent=message;node.hidden=false;
  clearTimeout(toast.timeout);
  toast.timeout=setTimeout(()=>{node.hidden=true},3500);
}
function categories(){
  const all=["Todos",...new Set(catalogue.map(p=>p.category))];
  catTabs.replaceChildren();
  for(const cat of all){
    const button=el("button","category-button",cat);
    button.type="button";button.setAttribute("aria-pressed",String(cat===category));
    button.addEventListener("click",()=>{category=cat;categories();renderMenu()});
    catTabs.append(button);
  }
}
function renderMenu(){
  grid.replaceChildren();
  const found=groupDrinkProducts(catalogue).filter(p=>(category==="Todos"||p.category===category) &&
    (p.title+" "+p.description).toLocaleLowerCase("pt-BR").includes(search));
  $("emptyState").hidden=found.length>0;
  for(const p of found){
    const card=el("article","product-card");
    const media=el("div","product-media");
    media.append(productImage(p));
    if(p.tag)media.append(el("span","product-tag",p.tag));
    const body=el("div","product-content");
    body.append(el("h3","",p.title),el("p","",p.description));
    const bottom=el("div","product-card-bottom");
    const price=el("div","price-block");
    price.append(el("small","", "a partir de"),el("strong","",money(p.priceCents)));
    const button=el("button","add-button","+");
    button.type="button";button.setAttribute("aria-label","Escolher "+p.title);
    button.addEventListener("click",()=>openProduct(p));
    bottom.append(price,button);body.append(bottom);card.append(media,body);
    media.addEventListener("click",()=>openProduct(p));
    media.style.cursor="pointer";
    grid.append(card);
  }
}
function safeShow(dialog){
  if(!dialog.open)dialog.showModal();
}
function openProduct(p){
  selected=p; quantity=1;chosenExtras.clear();pendingProduct=[];pendingDirty=false;updatePendingStatus();
  $("productImage").src=p.image || IMG;
  $("productImage").alt=p.title;
  $("productImage").onerror=()=>{ $("productImage").onerror=null; $("productImage").src=IMG; };
  $("productTitle").textContent=p.title;
  $("productCategory").textContent=p.category.toUpperCase();
  $("productDescription").textContent=p.description;
  $("productFactCategory").textContent=p.category;
  $("productFactFormat").textContent=({
    Salgados:"Pote salgado — referência de 500 g",
    Doces:"Pote doce — referência de 250 g",
    Bebidas:"Embalagem e volume a confirmar"
  })[p.category] || "A confirmar pela loja";
  const isDrink=p.category==="Bebidas";
  const flavors=isDrink&&Array.isArray(p.flavors)?p.flavors:[];
  const hasFlavors=flavors.length>0;
  const variants=Array.isArray(p.drinkVariants)?p.drinkVariants:[];
  const waters=Array.isArray(p.waterVariants)?p.waterVariants:[];
  $("waterTypeGroup").hidden=!waters.length;
  const waterInputs=[...$("waterTypeGroup").querySelectorAll("input")];
  for(const input of waterInputs){input.checked=false;input.disabled=!waters.some(v=>v.type===input.value&&v.available);}
  const firstWater=waterInputs.find(e=>!e.disabled);if(firstWater)firstWater.checked=true;
  $("drinkTypeGroup").hidden=true;
  $("drinkTypeGroup").querySelectorAll("input").forEach(e=>{e.checked=false;e.disabled=true;});
  $("productFactFormat").textContent=isDrink?(p.size||"Embalagem e volume a confirmar"):$("productFactFormat").textContent;
  $("productIngredientHeading").textContent=waters.length?"Água mineral":isDrink?"Sabores":"Ingredientes";
  $("productIngredients").hidden=isDrink;
  $("productFlavors").hidden=!hasFlavors;
  $("productFlavors").replaceChildren();
  for(const flavor of flavors){const label=el("label","drink-option");const radio=el("input");radio.type="radio";radio.name="drinkFlavor";radio.value=flavor;radio.disabled=variants.length>0&&!variants.some(v=>v.flavor===flavor&&v.available);radio.addEventListener("change",syncDrinkType);label.append(radio,el("span","",flavor));$("productFlavors").append(label);}
  if(variants.length)$("drinkTypeGroup").hidden=false;
  $("productFlavorHint").hidden=!hasFlavors;
  $("productTemperature").hidden=!isDrink;
  $("drinkTemperature").value="Gelado";
  $("productNote").placeholder=isDrink?"Ex.: gelado ou fora do gelo":"Ex.: sem cebola";
  const names=Array.isArray(p.ingredientNames)?p.ingredientNames:[];
  const list=$("productIngredients");
  list.replaceChildren();
  for(const name of names)list.append(el("li","",name));
  $("productIngredientsEmpty").hidden=isDrink?(hasFlavors||waters.length>0):names.length>0;
  $("productIngredientsEmpty").textContent=isDrink?(p.id==="agua"?"Água mineral sem gás.":"Consulte a loja sobre os sabores disponíveis."):"Ingredientes ainda não informados. Consulte a loja.";
  $("productIngredientNote").textContent=requestedSlug===null
    ?(p.id==="carne-cheddar"?"Ingredientes principais; ficha completa ainda precisa ser revisada pela loja.":"Ingredientes da receita de referência; confirmar composição final com a loja.")
    :"Ingredientes informados pelo estabelecimento. Confirme composição e alergênicos antes de consumir.";
  if(isDrink)$("productIngredientNote").textContent="Confira a composição e os alergênicos no rótulo da bebida.";
  $("productFacts").open=false;
  if(isDrink)$("productFacts").open=true;
  $("productNote").value="";
  $("addonList").replaceChildren();
  $("addonFieldset").hidden=!p.addons.length;
  for(const addon of p.addons){
    const label=el("label","addon-option");
    const checkbox=el("input");checkbox.type="checkbox";checkbox.value=addon.id;
    checkbox.addEventListener("change",()=>{
      checkbox.checked?chosenExtras.add(addon.id):chosenExtras.delete(addon.id); updateProductTotal();
    });
    label.append(checkbox,el("span","",addon.label),el("strong","", "+ "+money(addon.priceCents)));
    $("addonList").append(label);
  }
  updateProductTotal();
  safeShow(productDialog);
  productDialog.querySelector(".dialog-scroll").scrollTop=0;
}
function chosenDrinkVariant(){
  if(selected?.waterVariants?.length){const type=document.querySelector('input[name="waterType"]:checked')?.value;return selected.waterVariants.find(v=>v.type===type&&v.available); }
  const flavor=document.querySelector('input[name="drinkFlavor"]:checked')?.value;
  const type=document.querySelector('input[name="drinkType"]:checked')?.value;
  return selected?.drinkVariants?.find(v=>v.flavor===flavor&&v.type===type&&v.available);
}
function syncDrinkType(){
  const flavor=document.querySelector('input[name="drinkFlavor"]:checked')?.value;
  const types=[...$("drinkTypeGroup").querySelectorAll("input")];
  for(const input of types){input.disabled=!selected?.drinkVariants?.some(v=>v.flavor===flavor&&v.type===input.value&&v.available);if(input.disabled)input.checked=false;}
  if(!types.some(e=>e.checked&&!e.disabled)){const first=types.find(e=>!e.disabled);if(first)first.checked=true;}
  updateProductTotal();
}
$("drinkTypeGroup").addEventListener("change",updateProductTotal);
$("waterTypeGroup").addEventListener("change",updateProductTotal);
function updateProductTotal(){
  if(!selected)return;
  $("productQty").textContent=String(quantity);
  $("qtyMinus").disabled=quantity===1;
  $("qtyPlus").disabled=quantity===99;
  const variant=chosenDrinkVariant();
  $("addPrice").textContent=money((variant?variant.priceCents:itemUnitCents(selected,[...chosenExtras]))*quantity);
}
function currentProductLine(){
  if(!selected)return null;
  const isDrink=selected.category==="Bebidas";
  const flavor=document.querySelector('input[name="drinkFlavor"]:checked')?.value||"";
  const variant=chosenDrinkVariant();
  if(isDrink&&selected.flavors?.length&&(!selected.flavors.includes(flavor)||(selected.drinkVariants?.length&&!variant))){
    $("productFacts").open=true;
    $("productFlavors").querySelector("input:not(:disabled)")?.focus();
    toast("Escolha o sabor do refrigerante.");return;
  }
  if(selected.waterVariants?.length&&!variant){$("productFacts").open=true;toast("Escolha um tipo de água disponível.");return null;}
  const temperature=isDrink?$("drinkTemperature").value:"";
  const note=[flavor?"Sabor: "+flavor:"",variant?(selected.waterVariants?.length?"Tipo: ":"Versão: ")+variant.type:"",temperature?"Temperatura: "+temperature:"",$("productNote").value.trim()].filter(Boolean).join(" • ");
  const actual=variant?byId.get(variant.id):selected;
  if(!actual||actual.available===false){toast("Bebida indisponível.");return;}
  return makeLine(actual,quantity,[...chosenExtras],note);
}
function updatePendingStatus(){
 const totals=cartTotals(pendingProduct,catalogue);
 $("pendingProductStatus").hidden=!totals.count;
 $("pendingProductStatus").textContent=totals.count+" item(ns) aguardando confirmação · "+money(totals.subtotalCents);
}
function addCurrentProduct(){
 const line=currentProductLine();if(!line)return;
 pendingProduct=addLine(pendingProduct,line,catalogue);pendingDirty=false;updatePendingStatus();
 toast("Item preparado. Confirme para incluir na sacola.");
}
function confirmProduct(){
 // If no staged item, confirm the current selection. If edited after adding,
 // explicitly stage the new selection with Adicionar instead of silently duplicating.
 if(!pendingProduct.length){const line=currentProductLine();if(!line)return;pendingProduct=addLine([],line,catalogue);}
 for(const line of pendingProduct)cart=addLine(cart,line,catalogue);
 saveCart();renderCart();pendingProduct=[];updatePendingStatus();productDialog.close();toast("Confirmado na sacola.");

}
function renderCart(){
  cart=normalizeCart(cart,catalogue);
  const totals=cartTotals(cart,catalogue);
  $("cartCount").textContent=String(totals.count);
  $("cartCount").hidden=totals.count===0;
  $("floatingCart").hidden=totals.count===0;
  $("floatingQty").textContent=totals.count+" "+(totals.count===1?"item":"itens");
  $("floatingTotal").textContent=money(totals.subtotalCents);
  $("subtotal").textContent=money(totals.subtotalCents);
  $("total").textContent=money(totals.subtotalCents);
  $("copyOrder").disabled=totals.count===0;
  const holder=$("cartItems");
  holder.replaceChildren();
  if(!cart.length){
    holder.append(el("p","cart-empty","Sua sacola está vazia. Escolha um sabor para começar."));
    return;
  }
  cart.forEach((line,index)=>{
    const product=byId.get(line.id);
    const row=el("article","cart-item");
    const info=el("div","cart-item-main");
    info.append(el("strong","",line.quantity+"x "+product.title));
    const extras=line.addonIds.map(id=>product.addons.find(a=>a.id===id)?.label).filter(Boolean);
    if(extras.length)info.append(el("small","",extras.join(", ")));
    if(line.note)info.append(el("small","", "Obs.: "+line.note));
    const controls=el("div","cart-item-controls");
    controls.append(el("b","",money(itemUnitCents(product,line.addonIds)*line.quantity)));
    const remove=el("button","cart-remove","🗑 Remover");
    remove.type="button";remove.setAttribute("aria-label","Remover "+product.title);
    remove.addEventListener("click",()=>{cart.splice(index,1);saveCart();renderCart();toast("Item removido da sacola.");});
    controls.append(remove);row.append(info,controls);holder.append(row);
  });
}
function fulfill(){
  const value=document.querySelector('input[name="fulfillment"]:checked')?.value || "retirada";
  const delivery=value==="entrega";
  $("addressLabel").hidden=!delivery;
  $("deliveryFee").textContent=delivery?"A definir pela loja":"Não se aplica";
  return value;
}
async function copyText(text){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return true;}catch{}
  }
  const box=el("textarea");box.value=text;box.style.position="fixed";box.style.left="-9999px";
  document.body.append(box);box.select();
  const ok=document.execCommand("copy");box.remove();return ok;
}
async function copyOrder(){
  if(!cart.length){toast("Escolha um produto primeiro.");return;}
  const summary=demoSummary({
    cart,products:catalogue,fulfillment:fulfill(),payment:$("paymentMethod").value,
    customerName:$("customerName").value,customerPhone:$("customerPhone").value,
    address:$("customerAddress").value
  });
  try{
    if(await copyText(summary))toast("Resumo demonstrativo copiado. Nenhum pedido foi enviado.");
    else toast("Não foi possível copiar automaticamente.");
  }catch{toast("Não foi possível copiar automaticamente.");}
}
async function share(){
  const url=location.href.split("#")[0];
  if(navigator.share){
    try{await navigator.share({title:document.title,url});return;}catch{}
  }
  try{
    if(await copyText(url))toast("Link do cardápio copiado.");
    else toast("Não foi possível copiar o link.");
  }catch{toast("Não foi possível copiar o link.");}
}
$("searchInput").addEventListener("input",event=>{search=event.target.value.trim().toLocaleLowerCase("pt-BR");renderMenu();});
$("qtyMinus").addEventListener("click",()=>{quantity=Math.max(1,quantity-1);updateProductTotal();});
$("qtyPlus").addEventListener("click",()=>{quantity=Math.min(99,quantity+1);updateProductTotal();});
$("addToCart").addEventListener("click",addCurrentProduct);
$("confirmProduct").addEventListener("click",confirmProduct);
productDialog.addEventListener("close",()=>{pendingProduct=[];selected=null;updatePendingStatus();});
$("closeProduct").addEventListener("click",()=>productDialog.close());
$("closeCart").addEventListener("click",()=>cartDialog.close());
$("cartTopBtn").addEventListener("click",()=>{renderCart();safeShow(cartDialog);cartDialog.querySelector(".cart-scroll").scrollTop=0;});
$("floatingCart").addEventListener("click",()=>{renderCart();safeShow(cartDialog);cartDialog.querySelector(".cart-scroll").scrollTop=0;});
$("keepShopping").addEventListener("click",()=>cartDialog.close());
$("copyOrder").addEventListener("click",copyOrder);
$("shareBtn").addEventListener("click",share);
document.querySelectorAll('input[name="fulfillment"]').forEach(input=>input.addEventListener("change",fulfill));
for(const dialog of [productDialog,cartDialog]){
  dialog.addEventListener("click",event=>{
    if(event.target===dialog)dialog.close();
  });
}
window.addEventListener("storage",event=>{
  if(event.key===STORAGE_KEY){cart=restoreCart();renderCart();}
});
async function loadPublicMenu(slug){
  if(!validSlug(slug)){
    $("emptyState").textContent="Endereço de loja inválido.";
    $("emptyState").hidden=false;
    return;
  }
  $("emptyState").textContent="Carregando o cardápio da loja...";
  $("emptyState").hidden=false;
  try{
    // Exclusivamente documentos comerciais; nenhum acesso a usuários, receitas,
    // estoque ou registros privados. Regras Firestore devem estar homologadas.
    const [{app},{getFirestore,doc,getDoc}]=await Promise.all([
      import("../firebase_app.mjs"),
      import("https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js")
    ]);
    const snap=await getDoc(doc(getFirestore(app),"publicMenus",slug));
    const menu=snap.exists()?sanitizeReadMenu(snap.data(),slug):null;
    if(!menu)throw Error("Loja indisponível");
    catalogue=menu.items;
    cart=restoreCart();
    byId.clear();for(const p of catalogue)byId.set(p.id,p);
    category="Todos";search="";$("searchInput").value="";
    document.title=menu.title+" • Cardápio Digital";
    const brand=document.querySelector(".brand-text strong");
    if(brand)brand.textContent=menu.title;
    const footer=document.querySelector(".site-footer strong");
    if(footer)footer.textContent=menu.title;
    const storeStatus=document.querySelector(".store-status");
    if(storeStatus)storeStatus.textContent="Catálogo publicado • pedidos em breve";
    const subtitle=document.querySelector(".brand-text small");
    if(subtitle)subtitle.textContent=menu.subtitle||"CARDÁPIO DIGITAL";
    renderHero();
    const footerCaption=document.querySelector(".site-footer small");
    if(footerCaption)footerCaption.textContent="Catálogo público • checkout ainda não habilitado";
    const logo=document.querySelector(".brand-mark img");
    if(logo)logo.hidden=true;
    const reminder=document.querySelector(".demo-warning");
    if(reminder)reminder.textContent="Catálogo público da loja. Esta versão permite somente montar uma simulação: não envia pedidos, não reserva estoque nem processa pagamentos.";
    const strip=document.querySelector(".preview-strip");
    if(strip)strip.textContent="CATÁLOGO PUBLICADO • PEDIDOS E PAGAMENTOS AINDA NÃO HABILITADOS";
    categories();renderMenu();renderCart();
  }catch(error){
    console.warn("Cardápio público indisponível",error.code||error.message||error);
    $("emptyState").textContent="Este cardápio não está disponível no momento. Solicite o endereço atualizado à loja.";
    $("emptyState").hidden=false;
  }
}
initHero();categories();renderMenu();renderCart();fulfill();
if(requestedSlug!==null)loadPublicMenu(requestedSlug);
