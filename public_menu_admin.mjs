/* Publicador de catálogo de loja, carregado só no PDV autenticado.
   Um clique explícito é obrigatório. A sincronização privada V5 é independente. */
import {app} from "./firebase_app.mjs";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp,runTransaction} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {buildMenuCandidates,makePublicMenu,slugify,validSlug,isPublishedPhoto} from "./public_menu_core.mjs?lojas=8";

const auth=getAuth(app),db=getFirestore(app);
const node=(tag,cls,text)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;
  return el;
};
let dialog=null,initialized=false,candidates=[],published=null,selected=new Set(),busy=false,activeUid=null,activeType=null,generation=0;
const entry=new URLSearchParams(location.search);let deepLinkHandled=false;
const entrySlug=entry.get("gerenciar-cardapio"),entryOption=entry.get("opcao");
const $=id=>document.getElementById(id);
const owner=()=>window.POTE_APP_READY&&auth.currentUser?.uid===window.POTE_AUTH?.uid
  ?auth.currentUser.uid:null;
const businessType=()=>window.POTE_APP?.snapshot?.()?.data?.businessType||"batataria";
const legacyKey=uid=>"pote-public-menu-slug:"+uid;
const localKey=(uid,type=businessType())=>legacyKey(uid)+":"+type;
const defaultSlug=(uid,name)=> (slugify(name).slice(0,25)||"loja")+"-"+uid.slice(0,8).toLowerCase();
function rememberedSlugs(uid,type,name){try{return [...new Set([localStorage.getItem(localKey(uid,type)),localStorage.getItem(legacyKey(uid)),defaultSlug(uid,name)].filter(validSlug))];}catch{return [defaultSlug(uid,name)];}}
async function findOwnMenu(uid,type,name,epoch){for(const slug of rememberedSlugs(uid,type,name)){try{const menu=await loadExisting(slug,uid);if(!validSession(uid,epoch))return null;if(menu?.businessType===type){try{localStorage.setItem(localKey(uid,type),slug)}catch{}return menu;}}catch(error){if(!validSession(uid,epoch))return null;if(error.message!=="Endereço indisponível: usado por outra loja."&&error.code!=="permission-denied")throw error;}}return null;}
const visible=()=>{
  return Boolean(owner()&&$("poteCardapioManager"));
};
const liveLink=slug=>{
  const url=new URL("./cardapio/",location.href);
  url.searchParams.set("loja",slug);
  return url.href;
};
function buttonVisibility(){
  const uid=owner();
  const type=uid?businessType():null;
  if(uid!==activeUid||type!==activeType){
    generation++;activeUid=uid;activeType=type;busy=false;published=null;candidates=[];selected=new Set();
    if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null;}
  }
  if(dialog?.open&&!visible())dialog.close();
}
const validSession=(uid,epoch)=>owner()===uid&&generation===epoch&&businessType()===activeType;
function init(){
  if(initialized||!document.body)return;
  initialized=true;
  const css=node("link");css.rel="stylesheet";css.href="./public_menu_admin.css";
  document.head.append(css);
  const title=$("pageTitle");
  if(title)new MutationObserver(buttonVisibility).observe(title,{childList:true,subtree:true,characterData:true});
  window.addEventListener("pote:user-ready",()=>{buttonVisibility();void openFromMenu();});
  if(owner())void openFromMenu();
  window.addEventListener("pote:user-logout",buttonVisibility);
  window.addEventListener("pote:changed",buttonVisibility);
  buttonVisibility();
}
function addField(parent,label,id,value,options={}){
  const wrap=node("label","public-menu-field");
  const caption=node("span","",label);
  const input=node("input");
  input.id=id;input.value=value||"";
  input.type="text";input.maxLength=options.max||70;
  if(options.readonly)input.readOnly=true;
  wrap.append(caption,input);parent.append(wrap);
  return input;
}
function setMessage(message,error=false){
  const el=$("publicMenuMessage");
  if(!el)return;el.textContent=message;el.classList.toggle("bad",error);
}
function setBusy(value){
  busy=value;
  for(const id of ["publicMenuPublish","publicMenuUnpublish","publicMenuRefresh"]){const el=$(id);if(el)el.disabled=value;}
  updateLink();
}
function updateLink(){
  const link=$("publicMenuLink"),copy=$("publicMenuCopy");
  const available=Boolean(owner()&&published?.ownerUid===owner()&&published?.published===true&&!busy);
  if(link){link.hidden=!available;link.href=available?liveLink(published.slug):"#";link.textContent=available?liveLink(published.slug):"";}
  if(copy)copy.disabled=!available;
}
async function copyLink(){
  if(!owner()||published?.ownerUid!==owner()||!published?.published||busy)return;
  try{await navigator.clipboard.writeText(liveLink(published.slug));setMessage("Link copiado.");}
  catch{setMessage("Copie o endereço exibido acima manualmente.");}
}
function renderChoices(){
  const holder=$("publicMenuProducts");
  holder.replaceChildren();
  if(!candidates.length){
    holder.append(node("p","public-menu-hint","Nenhuma receita ou bebida vendável com preço válido. Confira os valores no PDV."));
  }
  const query=String($("publicMenuSearch")?.value||"").toLocaleLowerCase("pt-BR");
  for(const p of candidates.filter(p=>!query||(p.title+" "+p.category).toLocaleLowerCase("pt-BR").includes(query))){
    const row=node("label","public-menu-choice");
    const checkbox=node("input");checkbox.type="checkbox";checkbox.value=p.id;checkbox.checked=selected.has(p.id);
    const label=node("span");
    label.append(node("strong","",p.title),node("small","",p.category));
    if(p.ingredientNames?.length)label.append(node("small","","Ingredientes: "+p.ingredientNames.join(", ")));
    const price=node("b","",(p.priceCents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}));
    checkbox.addEventListener("change",()=>{
      checkbox.checked?selected.add(p.id):selected.delete(p.id);
      renderCount();
    });
    row.append(checkbox,label,price);holder.append(row);
  }
  renderCount();
}
function renderCount(){
  $("publicMenuCount").textContent=selected.size+" produto(s) selecionado(s)";
}
async function loadExisting(slug,uid){
  if(!validSlug(slug))return null;
  const snap=await getDoc(doc(db,"publicMenus",slug));
  if(!snap.exists())return null;
  const data=snap.data();
  if(data.ownerUid!==uid)throw Error("Endereço indisponível: usado por outra loja.");
  return data;
}
function priceFor(recipe){
  if(typeof window.sellPrice!=="function")return NaN;
  return window.sellPrice(recipe,"direto");
}
// Biblioteca oficial é específica da marca mestre, não de outras lojas.
function imageFor(recipe){
  if(!owner()||window.POTE_AUTH?.role!=="admin")return null;
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const brand=window.POTE_APP?.snapshot?.()?.data?.brand?.name;
  if(normalize(brand)!=="potebatata")return null;
  if(/água|agua/i.test(recipe.name||"")&&/500\s*ml/i.test(recipe.size||""))return "./assets/recipes/agua-mineral.webp";
  if(/refrigerante|soda/i.test(recipe.name||"")){if(/600\s*ml/i.test(recipe.size||""))return "./assets/recipes/refrigerante-600.webp";if(/350\s*ml|lata/i.test(recipe.size||""))return "./assets/recipes/refrigerante-lata.webp";}
  if(["carnecomcheddar","carneecheddar","carnecheddar"].includes(normalize(recipe.name)))return window.POTE_RECIPE_ALTERNATES?.["carne-cheddar"]||null;
  if(normalize(recipe.name)!==normalize(window.POTE_RECIPE_LABELS?.[recipe.id]))return null;
  const alt={r23:"ninho-nutella",r24:"brigadeiro",r25:"morango-preto",r26:"morango-branco"}[recipe.id];
  return (alt&&window.POTE_RECIPE_ALTERNATES?.[alt])||window.POTE_RECIPE_IMAGES?.[recipe.id]||null;
}
// Only owner-selected product images already stored in that account, never tokenized URLs.
async function compressPublicPhoto(source){
  if(typeof source!=="string"||source.length>12000000||!/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(source))return null;
  const img=new Image();img.src=source;
  try{await img.decode();}catch{return null;}
  if(!img.naturalWidth||!img.naturalHeight)return null;
  for(const size of [480,384,320,256,192]){
    const scale=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.68,.48,.30]){const data=canvas.toDataURL("image/webp",quality);if(isPublishedPhoto(data))return data;}
  }
  return null;
}
async function photosForPublication(state,ids,uid,epoch){
  const photos=new Map(),selectedIds=new Set(ids),data=state.data;
  let count=0;
  for(const [prefix,items] of [["",data.recipes||[]],["bev-",data.beverages||[]]]){
    for(const item of items){const id=prefix+item.id;if(!selectedIds.has(id))continue;
      const source=[item.imageUrl,item.photoUrl,item.photo,item.image].find(value=>typeof value==="string"&&/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value));
      if(!source)continue;
      const photo=await compressPublicPhoto(source);
      if(!validSession(uid,epoch))throw Error("Sessão alterada.");
      if(photo)photos.set(id,photo);else count++;
    }
  }
  return {photos,skipped:count};
}
function allowed(recipe){
  if(typeof window.allowed==="function")return Boolean(window.allowed(recipe));
  return !recipe.franchiseLocked;
}
function snapshot(){
  if(!owner()||window.POTE_SYNC_GUARD?.blocked)throw Error("Entre com Google e resolva qualquer conflito de sincronização.");
  const state=window.POTE_APP?.snapshot?.();
  if(!state?.data)throw Error("Aguarde o carregamento da conta.");
  return state;
}
function currentSelected(){
  return [...selected].filter(id=>candidates.some(p=>p.id===id));
}
async function refresh({load=true}={}){
  const uid=owner();
  if(!uid)return;
  const epoch=generation;
  setBusy(true);
  try{
    const current=snapshot();
    candidates=buildMenuCandidates(current,{priceFor,allowed,imageFor,includeIngredientNames:true});
    const name=current.data?.brand?.name||"meu-negocio";
    let slug=$("publicMenuSlug").value.trim().toLowerCase();
    if(!slug){const own=await findOwnMenu(uid,businessType(),name,epoch);if(!validSession(uid,epoch))return;slug=own?.slug||defaultSlug(uid,name);}
    $("publicMenuSlug").value=slug;
    if(load){
      const existing=await loadExisting(slug,uid);
      if(!validSession(uid,epoch))return;
      if(existing&&existing.businessType!==businessType())throw Error("Este link pertence a outro segmento da sua conta. Escolha um endereço diferente.");
      published=existing;
      selected=new Set(published?.items?.map(p=>p.id)||[]);
      $("publicMenuIncludeIngredients").checked=Boolean(published?.items?.some(p=>Array.isArray(p.ingredientNames)&&p.ingredientNames.length));
      $("publicMenuSlug").readOnly=false;
    }
    renderChoices();
    updateLink();
    setMessage(published?.published===true
      ?"Cardápio online. Se atualizar preços ou produtos, publique novamente."
      :published?"Cardápio retirado do ar. Você pode publicar novamente."
       :"Selecione apenas produtos revisados; a publicação será pública e não aceitará pedidos reais.");
  }catch(e){if(validSession(uid,epoch))setMessage(e.message||"Falha na consulta.",true);}
  finally{if(validSession(uid,epoch))setBusy(false);}
}
function createDialog(){
  dialog=node("dialog","public-menu-dialog");
  dialog.id="publicMenuDialog";
  const shell=node("section","public-menu-shell");
  const header=node("div","public-menu-header");
  const heading=node("div");heading.append(node("small","", "CARDÁPIO DIGITAL"),node("h2","", "Gerenciar minha loja"));
  const close=node("button","public-menu-close","×");close.type="button";close.setAttribute("aria-label","Fechar");
  close.addEventListener("click",()=>dialog.close());
  header.append(heading,close);shell.append(header);
  shell.append(node("p","public-menu-hint",
    "Compartilhe seus produtos e preços de venda. Custos, receitas de preparo, clientes, estoque e dados financeiros permanecem privados. O checkout real continua desativado."));
  addField(shell,"Endereço personalizado da loja","publicMenuSlug","",{max:40});
  shell.append(node("p","public-menu-hint","Use 4 a 40 letras minúsculas, números e hífens. Se mudar um endereço publicado, o antigo sairá do ar somente quando o novo for salvo com sucesso."));
  shell.append(node("p","public-menu-hint","Marque somente os produtos que deseja expor na internet. As fotos próprias cadastradas dos produtos escolhidos serão publicadas e usadas automaticamente no carrossel, intercaladas com a abertura CARDÁPIO. Fotos privadas por link não serão copiadas."));
  const search=addField(shell,"Buscar produtos para mostrar ou ocultar","publicMenuSearch","",{max:80});search.addEventListener("input",renderChoices);
  const products=node("div","public-menu-products");products.id="publicMenuProducts";
  shell.append(products);
  const bulk=node("div","public-menu-actions");for(const [label,enable] of [["Mostrar todos",true],["Ocultar todos",false]]){const btn=node("button","public-menu-btn secondary",label);btn.type="button";btn.addEventListener("click",()=>{if(busy)return;selected=new Set(enable?candidates.map(p=>p.id):[]);renderChoices();});bulk.append(btn);}shell.append(bulk);
  const ingredientOpt=node("label","public-menu-choice");const ingredientCheck=node("input");ingredientCheck.type="checkbox";ingredientCheck.id="publicMenuIncludeIngredients";ingredientOpt.append(ingredientCheck,node("span","","Publicar também os nomes dos ingredientes revisados acima (sem quantidades e custos)."));shell.append(ingredientOpt);
  const count=node("div","public-menu-count");count.id="publicMenuCount";shell.append(count);
  const msg=node("p","public-menu-message");msg.id="publicMenuMessage";msg.setAttribute("role","status");shell.append(msg);
  const link=node("a","public-menu-link");link.id="publicMenuLink";link.href="#";link.target="_blank";link.rel="noopener noreferrer";
  link.hidden=true;shell.append(link);
  const copy=node("button","public-menu-btn secondary","Copiar link da loja");copy.id="publicMenuCopy";copy.type="button";copy.disabled=true;copy.addEventListener("click",copyLink);shell.append(copy);
  const actions=node("div","public-menu-actions");
  const refreshBtn=node("button","public-menu-btn secondary","Atualizar lista");refreshBtn.id="publicMenuRefresh";
  const unpubBtn=node("button","public-menu-btn danger","Retirar do ar");unpubBtn.id="publicMenuUnpublish";
  const publishBtn=node("button","public-menu-btn primary","Publicar / atualizar");publishBtn.id="publicMenuPublish";
  for(const b of [refreshBtn,unpubBtn,publishBtn])b.type="button";
  refreshBtn.addEventListener("click",()=>refresh({load:false}));
  publishBtn.addEventListener("click",publish);
  unpubBtn.addEventListener("click",unpublish);
  actions.append(refreshBtn,unpubBtn,publishBtn);shell.append(actions);
  dialog.append(shell);document.body.append(dialog);
}
async function openFromMenu(){
 if(deepLinkHandled||entrySlug===null||!owner())return;
 deepLinkHandled=true;
 if(entrySlug){try{const data=await loadExisting(entrySlug,owner());if(!data)throw Error("Cardápio inexistente");}catch{alert("Este endereço não pertence à conta Google conectada ou está indisponível. Entre com a conta proprietária.");return;}}
 if(entryOption==="brand"){window.go?.("brand");return;}
 window.go?.("vitrine");
 if(!visible())return;
 if(!dialog)createDialog();if(entrySlug)$("publicMenuSlug").value=entrySlug;
 if(!dialog.open)dialog.showModal();await refresh();
 if(entryOption==="link")$("publicMenuSlug")?.focus();if(entryOption==="products")$("publicMenuSearch")?.focus();
}
async function open(){
  buttonVisibility();
  if(!visible())return;
  if(!dialog)createDialog();
  if(dialog.open)return;
  dialog.showModal();await refresh();
}
async function publish(){
  if(busy)return;
  const uid=owner();if(!uid)return;
  const epoch=generation;
  setBusy(true);
  try{
    const state=snapshot();
    const slug=$("publicMenuSlug").value.trim().toLowerCase();
    if(!validSlug(slug))throw Error("Endereço inválido: use letras minúsculas, números e hífen (4 a 40 caracteres).");
    const current=await loadExisting(slug,uid);
    if(!validSession(uid,epoch))return;
    const oldSlug=published?.slug&&published.slug!==slug?published.slug:null;
    if(current&&current.businessType!==businessType())throw Error("Este endereço pertence a outro segmento. Use um link diferente.");
    if(oldSlug&&current)throw Error("O novo endereço já existe. Escolha outro endereço livre.");
    const ids=currentSelected();
    const {photos,skipped}=await photosForPublication(state,ids,uid,epoch);
    if(!validSession(uid,epoch))return;
    const result=makePublicMenu(state,{slug,ownerUid:uid,selectedIds:ids,
      priceFor,allowed,imageFor,publishedPhotos:photos,includeIngredientNames:$("publicMenuIncludeIngredients").checked,previous:current});
    if(!confirm("Publicar "+result.items.length+" produto(s) de "+result.title+
      " com preços e fotos dos produtos selecionados"+($("publicMenuIncludeIngredients").checked?" e nomes dos ingredientes":"")+" visíveis a qualquer pessoa? Nenhum pedido real será aceito por esta página."))return;
    if(!validSession(uid,epoch))return;
    if(oldSlug){
      if(!confirm("Trocar o link de "+oldSlug+" para "+slug+"? O link antigo deixará de funcionar."))return;
      await runTransaction(db,async tx=>{
        const oldRef=doc(db,"publicMenus",oldSlug),newRef=doc(db,"publicMenus",slug);
        const old=await tx.get(oldRef),target=await tx.get(newRef);
        if(!validSession(uid,epoch)||!old.exists()||old.data().ownerUid!==uid||target.exists())throw Error("Não foi possível reservar o novo endereço. O anterior permanece intacto.");
        tx.set(newRef,{...result,updatedAt:serverTimestamp()});
        tx.set(oldRef,{...old.data(),published:false,updatedAt:serverTimestamp()});
      });
    }else await setDoc(doc(db,"publicMenus",slug),{...result,updatedAt:serverTimestamp()});
    if(!validSession(uid,epoch))return;
    const saved=await loadExisting(slug,uid);
    if(!validSession(uid,epoch))return;
    published=saved;
    if(!published?.published)throw Error("Servidor não confirmou a publicação.");
    try{localStorage.setItem(localKey(uid),slug)}catch{}
    $("publicMenuSlug").readOnly=false;
    updateLink();
    setMessage("Publicado. O carrossel usa as fotos publicadas da sua loja."+(skipped?" "+skipped+" foto(s) não puderam ser otimizadas; revise-as no cadastro.":"")+" Compartilhe o link; preços e estoque deverão ser revisados antes de habilitar pedidos.");
  }catch(e){if(validSession(uid,epoch))setMessage(e.message||"Falha ao publicar.",true);}
  finally{if(validSession(uid,epoch))setBusy(false);}
}
async function unpublish(){
  if(busy)return;
  const uid=owner();if(!uid)return;
  const epoch=generation;
  setBusy(true);
  try{
    const slug=published?.slug||$("publicMenuSlug").value.trim().toLowerCase();
    const current=await loadExisting(slug,uid);
    if(!validSession(uid,epoch))return;
    if(!current||current.businessType!==businessType())throw Error("Não há cardápio público deste segmento neste endereço.");
    if(!current.published){setMessage("Este cardápio já está fora do ar.");return;}
    if(!confirm("Retirar sua loja do ar? O endereço ficará indisponível para clientes."))return;
    if(!validSession(uid,epoch))return;
    await setDoc(doc(db,"publicMenus",slug),{...current,published:false,updatedAt:serverTimestamp()});
    if(!validSession(uid,epoch))return;
    const saved=await loadExisting(slug,uid);
    if(!validSession(uid,epoch))return;
    published=saved;
    if(published?.published!==false)throw Error("A retirada do ar não foi confirmada.");
    setMessage("Cardápio retirado do ar com sucesso.");
  }catch(e){if(validSession(uid,epoch))setMessage(e.message||"Falha ao retirar cardápio.",true);}
  finally{if(validSession(uid,epoch))setBusy(false);}
}
async function viewOwn(){
 buttonVisibility();const uid=owner();if(!uid||busy)return;const epoch=generation,type=businessType();
 try{const name=snapshot().data?.brand?.name||"meu-negocio";const menu=await findOwnMenu(uid,type,name,epoch);if(!validSession(uid,epoch))return;
 if(menu?.published===true){location.assign(liveLink(menu.slug));return;}
 alert("Seu cardápio deste segmento ainda não está publicado neste endereço. Publique ou informe o link personalizado em Gerenciar cardápio.");await open();
 }catch(error){if(validSession(uid,epoch))alert("Não foi possível consultar seu cardápio: "+(error.message||"verifique a conexão"));}
}
window.POTE_PUBLIC_MENU={open,viewOwn,getCurrentLink:()=>owner()&&published?.ownerUid===owner()&&published?.published===true&&!busy?liveLink(published.slug):null};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
