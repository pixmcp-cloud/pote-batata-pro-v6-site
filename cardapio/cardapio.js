import { money, makeLine, addLine, normalizeCart, itemUnitCents, cartTotals, demoSummary } from "./cardapio-core.mjs";
import { sanitizeReadMenu, validSlug } from "../public_menu_core.mjs";

// Catálogo de apresentação, isolado do banco e do estoque operacional.
// Fotos oficiais locais da Potê Batata quando disponíveis; preços e horários da prévia são demonstrativos.
const IMG = "../assets/generic/business-batataria.svg";
let catalogue = [
  { id:"carne-cheddar",title:"Carne com Cheddar",category:"Salgados",description:"Uma combinação irresistível de carne suculenta, queijo cremoso e muito sabor.",priceCents:3850,tag:"Mais pedido",image:IMG,addons:["cheddar","bacon","requeijao"] },
  { id:"estrogonofe",title:"Estrogonofe de Frango",category:"Salgados",description:"Frango envolvido em molho cremoso, com aquele toque especial que conquista.",priceCents:3490,tag:"Queridinho",image:"../assets/recipes/r05.webp",addons:["cheddar","bacon"] },
  { id:"pizza",title:"Sabor Pizza",category:"Salgados",description:"O clássico sabor de pizza em uma combinação surpreendente e generosa.",priceCents:3490,tag:"Imperdível",image:"../assets/generic/recipe-r22.svg",addons:["cheddar","requeijao"] },
  { id:"hotdog",title:"Cachorro-quente",category:"Salgados",description:"Um sabor cheio de memória afetiva, com recheio caprichado.",priceCents:3290,tag:"Clássico",image:"../assets/generic/recipe-r21.svg",addons:["cheddar","bacon"] },
  { id:"ninho",title:"Ninho com Nutella",category:"Doces",description:"Creme suave com uma camada generosa de creme de avelã.",priceCents:2290,tag:"Doce favorito",image:"../assets/recipes/ninho-nutella.webp",addons:["avela"] },
  { id:"brigadeiro",title:"Brigadeiro Cremoso",category:"Doces",description:"Chocolate intenso em uma sobremesa cremosa, feita para adoçar seu dia.",priceCents:1990,tag:"Doce momento",image:"../assets/recipes/brigadeiro.webp",addons:["avela"] },
  { id:"chocolate-morango",title:"Chocolate Preto com Morango",category:"Doces",description:"Chocolate e morango em camadas de pura felicidade.",priceCents:2290,tag:"Especial",image:"../assets/recipes/morango-preto.webp",addons:["avela"] },
  { id:"chocolate-morango-branco",title:"Chocolate Branco com Morango",category:"Doces",description:"Chocolate branco e morango em camadas cremosas.",priceCents:2290,tag:"Especial",image:"../assets/recipes/morango-branco.webp",addons:["avela"] },
  { id:"refrigerante",title:"Refrigerante Lata",category:"Bebidas",description:"Bebida gelada para acompanhar seu sabor favorito.",priceCents:700,tag:"Acompanhamento",image:"https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=78",addons:[] },
  { id:"agua",title:"Água Mineral",category:"Bebidas",description:"Água mineral sem gás, 500 ml.",priceCents:400,tag:"Para refrescar",image:"https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=78",addons:[] },
  { id:"combo",title:"Combo do Sabor",category:"Combos",description:"Uma opção de demonstração com um salgado e uma bebida. Personalizações reais serão configuradas no PDV.",priceCents:4090,tag:"Combo",image:IMG,addons:[] }
].map(product => ({ ...product, addons:product.addons.map(id => ({
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
  const found=catalogue.filter(p=>(category==="Todos"||p.category===category) &&
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
  selected=p; quantity=1;chosenExtras.clear();
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
    Bebidas:"Embalagem e volume a confirmar",
    Combos:"Composição sujeita à configuração da loja"
  })[p.category] || "A confirmar pela loja";
  $("productFacts").open=false;
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
}
function updateProductTotal(){
  if(!selected)return;
  $("productQty").textContent=String(quantity);
  $("qtyMinus").disabled=quantity===1;
  $("qtyPlus").disabled=quantity===99;
  $("addPrice").textContent=money(itemUnitCents(selected,[...chosenExtras])*quantity);
}
function addCurrentProduct(){
  if(!selected)return;
  cart=addLine(cart,makeLine(selected,quantity,[...chosenExtras],$("productNote").value),catalogue);
  saveCart();renderCart();productDialog.close();toast("Adicionado à sacola.");
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
    const remove=el("button","","Remover");
    remove.type="button";remove.setAttribute("aria-label","Remover "+product.title);
    remove.addEventListener("click",()=>{cart.splice(index,1);saveCart();renderCart();});
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
$("closeProduct").addEventListener("click",()=>productDialog.close());
$("closeCart").addEventListener("click",()=>cartDialog.close());
$("cartTopBtn").addEventListener("click",()=>{renderCart();safeShow(cartDialog);});
$("floatingCart").addEventListener("click",()=>{renderCart();safeShow(cartDialog);});
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
    const hero=document.getElementById("heroTitle");
    if(hero)hero.textContent="Seu sabor, seu momento.";
    const heroP=document.querySelector(".hero-content p");
    if(heroP)heroP.textContent="Conheça os produtos e preços publicados por "+menu.title+".";
    const heroTag=document.querySelector(".hero .eyebrow");
    if(heroTag)heroTag.textContent="CARDÁPIO DA LOJA";
    const footerCaption=document.querySelector(".site-footer small");
    if(footerCaption)footerCaption.textContent="Catálogo público • checkout ainda não habilitado";
    const logo=document.querySelector(".brand-mark img");
    if(logo)logo.hidden=true;
    const heroPic=document.querySelector(".hero-plate");
    if(heroPic)heroPic.alt="Imagem ilustrativa da categoria gastronômica";
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
categories();renderMenu();renderCart();fulfill();
if(requestedSlug!==null)loadPublicMenu(requestedSlug);
