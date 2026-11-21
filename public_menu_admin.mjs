/* Publicador de catálogo de loja, carregado só no PDV autenticado.
   Um clique explícito é obrigatório. A sincronização privada V5 é independente. */
import {app} from "./firebase_app.mjs";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {buildMenuCandidates,makePublicMenu,slugify,validSlug} from "./public_menu_core.mjs";

const auth=getAuth(app),db=getFirestore(app);
const node=(tag,cls,text)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;
  return el;
};
let dialog=null,launcher=null,candidates=[],published=null,selected=new Set(),busy=false;
const $=id=>document.getElementById(id);
const owner=()=>window.POTE_APP_READY&&auth.currentUser?.uid===window.POTE_AUTH?.uid
  ?auth.currentUser.uid:null;
const localKey=uid=>"pote-public-menu-slug:"+uid;
const visible=()=>{
  try {return Boolean(owner()&&window.POTE_APP?.snapshot?.().tab==="vitrine");}
  catch{return false;}
};
const liveLink=slug=>{
  const url=new URL("./cardapio/",location.href);
  url.searchParams.set("loja",slug);
  return url.href;
};
function buttonVisibility(){
  if(launcher)launcher.hidden=!visible();
  if(dialog?.open&&!owner())dialog.close();
}
function init(){
  if(launcher||!document.body)return;
  const css=node("link");css.rel="stylesheet";css.href="./public_menu_admin.css";
  document.head.append(css);
  launcher=node("button","public-menu-launch","🌐 Publicar cardápio online");
  launcher.type="button";launcher.hidden=true;
  launcher.addEventListener("click",open);
  document.body.append(launcher);
  const title=$("pageTitle");
  if(title)new MutationObserver(buttonVisibility).observe(title,{childList:true,subtree:true,characterData:true});
  window.addEventListener("pote:user-ready",buttonVisibility);
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
}
function renderChoices(){
  const holder=$("publicMenuProducts");
  holder.replaceChildren();
  if(!candidates.length){
    holder.append(node("p","public-menu-hint","Nenhuma receita ou bebida vendável com preço válido. Confira os valores no PDV."));
  }
  for(const p of candidates){
    const row=node("label","public-menu-choice");
    const checkbox=node("input");checkbox.type="checkbox";checkbox.value=p.id;checkbox.checked=selected.has(p.id);
    const label=node("span");
    label.append(node("strong","",p.title),node("small","",p.category));
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
  setBusy(true);
  try{
    const current=snapshot();
    candidates=buildMenuCandidates(current,{priceFor,allowed});
    const name=current.data?.brand?.name||"meu-negocio";
    let slug=$("publicMenuSlug").value.trim().toLowerCase();
    if(!slug){
      try{slug=localStorage.getItem(localKey(uid))||"";}catch{}
    }
    if(!slug)slug=(slugify(name).slice(0,25)||"loja")+"-"+uid.slice(0,8).toLowerCase();
    $("publicMenuSlug").value=slug;
    if(load){
      published=await loadExisting(slug,uid);
      selected=new Set(published?.items?.map(p=>p.id)||[]);
      $("publicMenuSlug").readOnly=Boolean(published);
    }
    renderChoices();
    $("publicMenuLink").href=liveLink(slug);
    $("publicMenuLink").textContent=liveLink(slug);
    setMessage(published?.published===true
      ?"Cardápio online. Se atualizar preços ou produtos, publique novamente."
      :published?"Cardápio retirado do ar. Você pode publicar novamente."
       :"Selecione apenas produtos revisados; a publicação será pública e não aceitará pedidos reais.");
  }catch(e){setMessage(e.message||"Falha na consulta.",true);}
  finally{setBusy(false);}
}
function createDialog(){
  dialog=node("dialog","public-menu-dialog");
  dialog.id="publicMenuDialog";
  const shell=node("section","public-menu-shell");
  const header=node("div","public-menu-header");
  const heading=node("div");heading.append(node("small","", "CARDÁPIO DIGITAL V2"),node("h2","", "Publicar minha vitrine"));
  const close=node("button","public-menu-close","×");close.type="button";close.setAttribute("aria-label","Fechar");
  close.addEventListener("click",()=>dialog.close());
  header.append(heading,close);shell.append(header);
  shell.append(node("p","public-menu-hint",
    "Compartilhe seus produtos e preços de venda. Custos, receitas de preparo, clientes, estoque e dados financeiros permanecem privados. O checkout real continua desativado."));
  addField(shell,"Endereço da loja (não altere após publicar)","publicMenuSlug","",{max:40});
  shell.append(node("p","public-menu-hint","Marque somente os produtos que deseja expor na internet."));
  const products=node("div","public-menu-products");products.id="publicMenuProducts";
  shell.append(products);
  const count=node("div","public-menu-count");count.id="publicMenuCount";shell.append(count);
  const msg=node("p","public-menu-message");msg.id="publicMenuMessage";msg.setAttribute("role","status");shell.append(msg);
  const link=node("a","public-menu-link");link.id="publicMenuLink";link.href="#";link.target="_blank";link.rel="noopener noreferrer";
  shell.append(link);
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
async function open(){
  if(!visible())return;
  if(!dialog)createDialog();
  if(dialog.open)return;
  dialog.showModal();await refresh();
}
async function publish(){
  if(busy)return;
  const uid=owner();if(!uid)return;
  setBusy(true);
  try{
    const state=snapshot();
    const slug=$("publicMenuSlug").value.trim().toLowerCase();
    if(!validSlug(slug))throw Error("Endereço inválido: use letras minúsculas, números e hífen (4 a 40 caracteres).");
    const current=await loadExisting(slug,uid);
    if(published&&published.slug!==slug)throw Error("Para trocar endereço, retire o cardápio antigo do ar primeiro.");
    const result=makePublicMenu(state,{slug,ownerUid:uid,selectedIds:currentSelected(),
      priceFor,allowed,previous:current});
    if(!confirm("Publicar "+result.items.length+" produto(s) de "+result.title+
      " com preços visíveis a qualquer pessoa? Nenhum pedido real será aceito por esta página."))return;
    await setDoc(doc(db,"publicMenus",slug),{...result,updatedAt:serverTimestamp()});
    published=await loadExisting(slug,uid);
    if(!published?.published)throw Error("Servidor não confirmou a publicação.");
    try{localStorage.setItem(localKey(uid),slug)}catch{}
    $("publicMenuSlug").readOnly=true;
    $("publicMenuLink").href=liveLink(slug);
    $("publicMenuLink").textContent=liveLink(slug);
    setMessage("Publicado. Compartilhe o link; preços e estoque deverão ser revisados antes de habilitar pedidos.");
  }catch(e){setMessage(e.message||"Falha ao publicar.",true);}
  finally{setBusy(false);}
}
async function unpublish(){
  if(busy)return;
  const uid=owner();if(!uid)return;
  setBusy(true);
  try{
    const slug=$("publicMenuSlug").value.trim().toLowerCase();
    const current=await loadExisting(slug,uid);
    if(!current)throw Error("Não há cardápio público neste endereço.");
    if(!current.published){setMessage("Este cardápio já está fora do ar.");return;}
    if(!confirm("Retirar sua loja do ar? O endereço ficará indisponível para clientes."))return;
    await setDoc(doc(db,"publicMenus",slug),{...current,published:false,updatedAt:serverTimestamp()});
    published=await loadExisting(slug,uid);
    if(published?.published!==false)throw Error("A retirada do ar não foi confirmada.");
    setMessage("Cardápio retirado do ar com sucesso.");
  }catch(e){setMessage(e.message||"Falha ao retirar cardápio.",true);}
  finally{setBusy(false);}
}
window.POTE_PUBLIC_MENU={open,getCurrentLink:()=>owner()&&published?liveLink(published.slug):null};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
