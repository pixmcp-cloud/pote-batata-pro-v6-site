/* Negócio — escolha inicial neutra e catálogo-modelo de Batataria.
   Os dados privados da conta mestre não são substituídos. */
(function(){
"use strict";
if(window.POTE_BUSINESS)return;
const TYPES=[
 {id:"batataria",label:"Batataria",name:"Minha Batataria",desc:"Receitas-modelo de batatas recheadas, com ingredientes para conferir.",photo:"./assets/generic/business-batataria.svg"},
 {id:"pizzaria",label:"Pizzaria",name:"Minha Pizzaria",desc:"Estruture sabores, massas, adicionais e seus próprios preços.",photo:"./assets/generic/business-pizzaria.svg"},
 {id:"hamburgueria",label:"Hamburgueria",name:"Minha Hamburgueria",desc:"Cadastre hambúrgueres, ingredientes, combos e custos reais.",photo:"./assets/generic/business-hamburgueria.svg"},
 {id:"lancheria",label:"Lancheria",name:"Minha Lancheria",desc:"Organize lanches, bebidas, pedidos, estoque e produção.",photo:"./assets/generic/business-lancheria.svg"}
];
const GENERIC_LOGO="./assets/generic/business-neutral.svg";
const templateImage=id=>"./assets/generic/recipe-"+id+".svg";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let opened=false;
function master(){return window.POTE_AUTH?.role==="admin"}
function current(){return (typeof state!=="undefined"&&state.data?.businessType) || (master()?"batataria":"")}
function currentItem(){return TYPES.find(t=>t.id===current())||null}
function neutralBrand(){
 return {name:"Meu Negócio",subtitle:"GESTÃO DE ALIMENTAÇÃO",slogan:"Organize vendas, estoque e receitas",phone:"",instagram:"",primary:"#233449",accent:"#e4b974",logoUrl:GENERIC_LOGO};
}
function isBrandTemplate(brand){
 if(!brand)return true;
 const name=String(brand.name||"").trim().toLowerCase();
 const subtitle=String(brand.subtitle||"").trim().toLowerCase();
 const oldName=name==="potê batata"||name==="pote batata";
 const oldSubtitle=subtitle==="batata recheada no pote";
 return oldName&&oldSubtitle;
}
function normalizeAccountBrand(){
 if(master()||window.POTE_AUTH?.franchiseActive||typeof state==="undefined"||!state.data)return false;
 const brand=state.data.brand||{};
 let changed=false;
 if(isBrandTemplate(brand)&&(!brand.logoUrl||brand.logoUrl==="./assets/pote-logo-original.jpg"||
      String(brand.logoUrl).startsWith("data:image/svg+xml"))){
  const neutral=neutralBrand();
  // Preservar contatos, cores e outras preferências comerciais customizadas.
  state.data.brand={...brand,name:neutral.name,subtitle:neutral.subtitle,
    slogan:brand.slogan===SEED.brand.slogan?neutral.slogan:brand.slogan,
    instagram:brand.instagram===SEED.brand.instagram?"":brand.instagram,
    logoUrl:GENERIC_LOGO};
  changed=true;
 }else if(!brand.logoUrl||brand.logoUrl==="./assets/pote-logo-original.jpg"){
  brand.logoUrl=GENERIC_LOGO;changed=true;
 }
 return changed;
}
function normalizePageCopy(){
 if(master()||current()==="batataria")return;
 const page=$("page");
 if(!page||!document.createTreeWalker||!window.NodeFilter)return;
 const category=currentItem()?.label||"seu negócio";
 const terms=[
  ["Cardápio de Batatas no Pote","Cardápio de "+category],
  ["Batata recheada","Produto principal"],
  ["Meta mensal (potes para rateio fixo)","Meta mensal (unidades para rateio fixo)"],
  ["Lucro líquido / pote","Lucro líquido / unidade"],
  ["Outros custos por pote","Outros custos por unidade"],
  ["Adicionais por pote","Adicionais por unidade"],
  ["Por pote vendido","Por unidade vendida"],
  ["Por pote","Por unidade"],
  ["por pote","por unidade"],
  ["cada pote produzido","cada unidade produzida"],
  ["cozinhar batatas ou desfiar frango","preparar massas, molhos ou recheios"],
  ["potes necessários","unidades necessárias"]
 ];
 const scoped=page.querySelectorAll(".box h2,.box h3,.box .help,.field label,.kpi small,.receipt small,.vitrine-bar strong,.vitrine-bar .muted");
 for(const element of scoped){
  const tree=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];
  while(tree.nextNode())nodes.push(tree.currentNode);
  for(const node of nodes){
   let value=node.nodeValue||"";
   for(const [a,b] of terms)value=value.replaceAll(a,b);
   if(value!==node.nodeValue)node.nodeValue=value;
  }
 }
}
function refreshIdentity(){
 const on=master();
 const isBranded=on||window.POTE_AUTH?.franchiseActive;
 const brand=(typeof state!=="undefined"&&state.data?.brand)||neutralBrand();
 const topLogo=$("poteHeadLogo"),topName=$("poteHeadName"),topSub=$("poteHeadSubtitle");
 if(topLogo)topLogo.src=isBranded?"./assets/pote-logo-original.jpg":(brand.logoUrl||GENERIC_LOGO);
 const favicon=document.querySelector('link[rel="icon"]');
 if(favicon)favicon.href=isBranded?"./assets/pote-logo-original.jpg":GENERIC_LOGO;
 if(topName)topName.textContent=isBranded?"POTÊ BATATA PRO":"GESTÃO PRO";
 if(topSub)topSub.textContent=isBranded?(on?"GESTÃO ONLINE":"FRANQUIA OFICIAL"):(currentItem()?.label?.toUpperCase()||"ESCOLHA SEU NEGÓCIO");
 const floatTitle=$("poteFloatBrand");
 if(floatTitle)floatTitle.textContent=isBranded?"POTÊ BATATA PRO":"GESTÃO PRO";
 const footer=document.querySelector(".foot");
 if(footer?.firstChild?.nodeType===Node.TEXT_NODE){
  const newText=isBranded?"Potê Batata Pro · Gestão Online. ":"Gestão Pro · Plataforma para negócios de alimentação. ";
  if(footer.firstChild.textContent!==newText)footer.firstChild.textContent=newText;
 }
 const businessDesc=$("poteBusinessCurrent");
 if(businessDesc)businessDesc.textContent=currentItem()?.label||"Escolher tipo de negócio";
 const businessHero=$("poteBusinessHeroHint");
 if(businessHero)businessHero.textContent=on?"Batataria · Conta mestre preservada":window.POTE_AUTH?.franchiseActive?"Batataria · Franquia oficial":"Ramo: "+(currentItem()?.label||"Escolha seu negócio");
 const businessImage=$("poteBusinessImage");
 if(businessImage)businessImage.src=currentItem()?.photo||"./assets/generic/business-neutral.svg";
 normalizePageCopy();
}
function importBatatariaTemplates(){
 const data=state.data,started=data.businessTemplates||{};
 if(started.batataria)return {recipes:0,ingredients:0,already:true};
 const seed=typeof SEED!=="undefined"?SEED:null;
 if(!seed||!Array.isArray(seed.recipes)||!Array.isArray(seed.ingredients))throw Error("Catálogo de Batataria indisponível");
 const existingRecipes=new Set((data.recipes||[]).map(x=>x.id));
 const existingIngredients=new Set((data.ingredients||[]).map(x=>x.id));
 let recipes=0,ingredients=0;
 data.ingredients??=[];data.recipes??=[];
 for(const i of seed.ingredients){
  if(existingIngredients.has(i.id))continue;
  const item=JSON.parse(JSON.stringify(i));
  item.stock=0;
  item.minimum=0;
  item.imageUrl="";
  item.source="Preço de referência — atualize com a sua compra";
  item.templateOrigin="batataria";
  data.ingredients.push(item);ingredients++;
 }
 for(const r of seed.recipes){
  if(existingRecipes.has(r.id))continue;
  const item=JSON.parse(JSON.stringify(r));
  item.imageUrl=templateImage(item.id);
  item.templateOrigin="batataria";
  item.featured=false;
  data.recipes.push(item);recipes++;
 }
 if(!state.unlocked&&!master()&&seed.recipes.length)state.unlocked=seed.recipes[0].id;
 data.businessTemplates={...started,batataria:{version:1,importedAt:new Date().toISOString()}};
 return {recipes,ingredients,already:false};
}
const root=document.createElement("div");root.id="poteBusinessRoot";
root.innerHTML=`<div id="poteBusinessOverlay" role="dialog" aria-modal="true" aria-labelledby="poteBusinessTitle" hidden>
 <section class="pote-business-shell">
  <div class="pote-business-head">
   <div><small>PERSONALIZAÇÃO DO SEU APLICATIVO</small><h2 id="poteBusinessTitle">Qual é o seu negócio?</h2>
   <p>Escolha o segmento para iniciar com um ambiente adequado à sua operação.</p></div>
   <button id="poteBusinessClose" type="button" aria-label="Fechar">✕</button>
  </div>
  <div class="pote-business-meta"><strong>Negócio atual</strong><span id="poteBusinessCurrent">Nenhum selecionado</span></div>
  <div class="pote-business-options">${TYPES.map(t=>`<button type="button" data-business-type="${t.id}"><img src="${t.photo}" alt="" loading="lazy">
   <strong>${t.label}</strong><small>${t.desc}</small><span class="pote-business-choose">Selecionar</span></button>`).join("")}</div>
  <div class="pote-business-note">
   <strong>Seus dados estão protegidos.</strong> Mudar o ramo não apaga cadastros, vendas ou receitas existentes.
   Na primeira seleção de Batataria, serão adicionadas 26 fichas e um catálogo de ingredientes com estoque zero.
   Fotos e logotipo da sua empresa serão genéricos e poderão ser personalizados.
  </div>
  <p id="poteBusinessMessage" aria-live="polite"></p>
 </section>
</div>`;
document.body.appendChild(root);
function show(open){
 opened=!!open;
 $("poteBusinessOverlay").hidden=!opened;
 document.documentElement.classList.toggle("pote-business-open",opened);
 if(opened){
  refreshIdentity();
  document.querySelectorAll("[data-business-type]").forEach(button=>button.classList.toggle("selected",button.dataset.businessType===current()));
 }
}
function select(type){
 if(!window.POTE_AUTH?.uid){alert("Entre com Google antes de escolher seu negócio.");return}
 if(window.POTE_AUTH.franchiseActive){if(type!=="batataria"){alert("Franquia oficial Potê Batata: o ramo Batataria é obrigatório enquanto a franquia estiver ativa.");return}
   state.data.businessType="batataria";persist();render();show(false);return}
 const choice=TYPES.find(x=>x.id===type);if(!choice)return;
 if(master()){
  // A identidade e os registros próprios da conta mestre nunca são substituídos.
  state.data.businessType=type;
  persist();render();show(false);
  if(typeof toast==="function")toast("Ramo escolhido. Marca e registros da conta mestre preservados.");
  return;
 }
 const previous=current(),existing=(state.data.recipes?.length||0)+(state.data.orders?.length||0)+(state.data.ingredients?.length||0);
 if(previous!==type && existing>0 &&
   !confirm("Mudar de "+(TYPES.find(x=>x.id===previous)?.label||"outro ramo")+" para "+choice.label+"? Seus cadastros e vendas atuais serão preservados e NÃO serão apagados."))return;
 const first=!previous;
 const summary=type==="batataria"?" Inclui receitas-modelo e ingredientes com estoque zerado.":" Suas receitas começam vazias se você ainda não cadastrou nenhuma.";
 if(!confirm("Selecionar "+choice.label+"?"+summary+" Os dados e custos serão próprios da sua conta."))return;
 const data=state.data;
 data.businessType=type;
 const brand=data.brand||neutralBrand();
 if(first||isBrandTemplate(brand)||["Meu Negócio","Minha Batataria","Minha Pizzaria","Minha Hamburgueria","Minha Lancheria"].includes(brand.name)){
  data.brand={...brand,name:choice.name,subtitle:choice.label.toUpperCase(),logoUrl:choice.photo};
 }
 let imported={recipes:0,ingredients:0};
 if(type==="batataria")imported=importBatatariaTemplates();
 // Nenhum outro ramo recebe imagens ou receitas da Batataria.
 persist();
 render();
 refreshIdentity();
 show(false);
 if(typeof toast==="function"){
  toast(type==="batataria"?
   "Batataria pronta: "+(imported.already?"modelo já carregado":imported.recipes+" receitas e "+imported.ingredients+" ingredientes (estoque zero)"):
   choice.label+" selecionada. Cadastre suas receitas e produtos.");
 }
}
$("poteBusinessClose").addEventListener("click",()=>show(false));
$("poteBusinessOverlay").addEventListener("click",e=>{if(e.target===$("poteBusinessOverlay"))show(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&opened)show(false)});
$("poteBusinessOverlay").addEventListener("click",e=>{
 const button=e.target.closest("[data-business-type]");if(button)select(button.dataset.businessType)
});
window.POTE_BUSINESS={open:()=>show(true),close:()=>show(false),choose:select,refresh:refreshIdentity,normalizeAccountBrand,
 neutralBrand,importBatatariaTemplates,current,types:TYPES};
refreshIdentity();
})();