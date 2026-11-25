/* Negócio — escolha inicial neutra e catálogo-modelo de Batataria.
   Os dados privados da conta mestre não são substituídos. */
(function(){
"use strict";
if(window.POTE_BUSINESS)return;
const TYPES=[
 {id:"batataria",label:"Batataria",name:"Minha Batataria",desc:"Receitas-modelo de batatas recheadas, com ingredientes para conferir.",photo:"./assets/generic/business-batataria.svg"},
 {id:"pizzaria",label:"Pizzaria",name:"Minha Pizzaria",desc:"30 receitas-modelo de pizzas, com ingredientes e preparo completos.",photo:"./assets/generic/business-pizzaria.svg"},
 {id:"hamburgueria",label:"Hamburgueria",name:"Minha Hamburgueria",desc:"30 receitas-modelo de hambúrgueres, com opções clássicas e artesanais.",photo:"./assets/generic/business-hamburgueria.svg"},
 {id:"hotdog",label:"Hot Dog",name:"Meu Hot Dog",desc:"Receitas de cachorro-quente e combinações tradicionais e especiais.",photo:"./assets/generic/business-hotdog.svg"},
 {id:"lancheria",label:"Lancheria",name:"Minha Lancheria",desc:"Ambiente vazio, sem receitas prontas: monte seu próprio cardápio.",photo:"./assets/generic/business-lancheria.svg"},
 {id:"pastelaria",label:"Pastelaria",name:"Minha Pastelaria",desc:"50 receitas de pastéis: 40 salgados e 10 doces, com foto padrão e preparo.",photo:"./assets/recipes/pastelaria-cardapio.jpg"}
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
 if(current()==="batataria")return;
 const page=$("page");
 if(!page||!document.createTreeWalker||!window.NodeFilter)return;
 const category=currentItem()?.label||"seu negócio";
 const terms=[
  ["🥔 Cardápio de Batatas no Pote","Cardápio de "+category],
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
  ["potes necessários","unidades necessárias"],
  ["potes você precisa vender","unidades você precisa vender"],
  ["Quantidade de potes / combos","Quantidade de unidades / combos"],
  ["descontadas automaticamente a cada pote produzido","descontadas automaticamente a cada unidade produzida"],
  ["pote, tampa, talher, sacola","embalagem, tampa, talher, sacola"],
  ["Quantidade por pote","Quantidade por unidade"],
  ["pote produzido","unidade preparada"],
  ["por pote","por unidade"],
  ["/pote","/unidade"],
  ["potes","unidades"],
  ["Potes","Unidades"]
 ];
 const scoped=page.querySelectorAll(".box h2,.box h3,.box p,.box .help,.box .notice,.field label,.kpi small,.receipt small,.vitrine-bar strong,.vitrine-bar .muted,.box .bar,.box .receipt,.box .kpi");
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
function refreshUniverseBanner(){
 const page=$("page");
 if(!page||typeof page.querySelector!=="function"||typeof page.insertBefore!=="function")return;
 let banner=page.querySelector("#poteUniverseBanner");
 const type=currentItem();
 const visible=!!type&&typeof state!=="undefined"&&state.tab!=="home";
 if(!visible){if(banner)banner.remove();return}
 if(!banner){banner=document.createElement("div");banner.id="poteUniverseBanner";
   banner.className="pote-universe-banner";page.insertBefore(banner,page.firstChild)}
 const title=master()?(current()==="batataria"?"MATRIZ · BATATARIA":"ADM · "+type.label.toUpperCase()):window.POTE_AUTH?.franchiseActive?
  "FRANQUIA · BATATARIA":type.label.toUpperCase();
 const total=state.data?.recipes?.filter(r=>!r.franchiseLocked&&
  !(window.POTE_AUTH?.franchiseActive&&r.templateOrigin==="batataria")).length||0;
 banner.innerHTML='<img src="'+type.photo+'" alt="">'+
  '<div><small>UNIVERSO DE NEGÓCIO ATIVO</small><strong>'+title+'</strong>'+
  '<span>'+total+' fichas no catálogo · Vendas e estoque exclusivos deste ramo</span></div>';
}
function refreshIdentity(){
 const on=master();
 const isBranded=(on&&current()==="batataria")||!!window.POTE_AUTH?.franchiseActive;
 const brand=(typeof state!=="undefined"&&state.data?.brand)||neutralBrand();
 const topLogo=$("poteHeadLogo"),topName=$("poteHeadName"),topSub=$("poteHeadSubtitle");
 if(topLogo)topLogo.src=isBranded?"./assets/pote-logo-original.jpg":(brand.logoUrl||GENERIC_LOGO);
 const favicon=document.querySelector('link[rel="icon"]');
 if(favicon)favicon.href=isBranded?"./assets/pote-logo-original.jpg":GENERIC_LOGO;
 const registeredCompany=String(brand.name||"").trim();
 const companyName=isBranded&&(!registeredCompany||registeredCompany.toLowerCase()==="meu negócio")?"Potê Batata":registeredCompany||"Meu Negócio";
 if(topName)topName.textContent=companyName;
 if(topSub)topSub.textContent=isBranded?(on?"GESTÃO ONLINE":"FRANQUIA OFICIAL"):(on?"ADM · ":"")+(currentItem()?.label?.toUpperCase()||"ESCOLHA SEU NEGÓCIO");
 const floatTitle=$("poteFloatBrand");
 if(floatTitle)floatTitle.textContent=isBranded?"POTÊ BATATA PRO":on?"GESTÃO PRO · ADM":"GESTÃO PRO";
 const footer=document.querySelector(".foot");
 if(footer?.firstChild?.nodeType===Node.TEXT_NODE){
  const newText=isBranded?"Potê Batata Pro · Gestão Online. ":"Gestão Pro · Plataforma para negócios de alimentação. ";
  if(footer.firstChild.textContent!==newText)footer.firstChild.textContent=newText;
 }
 const businessDesc=$("poteBusinessCurrent");
 if(businessDesc)businessDesc.textContent=currentItem()?.label||"Escolher tipo de negócio";
 const businessHero=$("poteBusinessHeroHint");
 if(businessHero)businessHero.textContent=on?(current()==="batataria"?"Batataria · Conta mestre preservada":(currentItem()?.label||"Negócio")+" · Acesso ADM"):window.POTE_AUTH?.franchiseActive?"Batataria · Franquia oficial":"Ramo: "+(currentItem()?.label||"Escolha seu negócio");
 const businessImage=$("poteBusinessImage");
 if(businessImage)businessImage.src=currentItem()?.photo||"./assets/generic/business-neutral.svg";
 normalizePageCopy();
 refreshUniverseBanner();
}
function importBatatariaTemplates(){
 if(window.POTE_UNIVERSES)return window.POTE_UNIVERSES.importModels(state,"batataria",SEED);
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
   <strong>${t.label}</strong><small>${t.desc}</small><span class="pote-business-choose">Selecionar</span><span class="pote-business-access" data-business-access>🔓 FREE · 1 uso por função</span></button>`).join("")}</div>
  <div class="pote-business-note">
   <strong>Seus dados estão protegidos.</strong> Mudar o ramo não apaga cadastros, vendas ou receitas existentes.
   Cada universo mantém suas receitas, insumos, pedidos e estoque separados. Batataria inclui 26 fichas,
   Pizzaria 30, Hamburgueria 30, Hot Dog 20 e Pastelaria 50 (40 salgadas e 10 doces); Lancheria inicia vazia.
   Os custos e estoques são seus, não há vendas simuladas. As imagens e a logo são genéricas.
  </div>
  <p id="poteBusinessMessage" aria-live="polite"></p>
 </section>
</div>`;
document.body.appendChild(root);
function show(open){
 if(!open&&window.POTE_ACCESS?.requiresChoice?.())return;
 opened=!!open;
 $("poteBusinessOverlay").hidden=!opened;
 document.documentElement.classList.toggle("pote-business-open",opened);
 if(opened){
  refreshIdentity();
  $("poteBusinessClose").hidden=Boolean(window.POTE_ACCESS?.requiresChoice?.());
  $("poteBusinessMessage").textContent=window.POTE_AUTH?.proActive?"PRO: todos os segmentos.":"FREE: um segmento; outros segmentos e Lancheria são exclusivos do PRO.";
  document.querySelectorAll("[data-business-type]").forEach(button=>{
   button.classList.toggle("selected",button.dataset.businessType===current());
   const type=button.dataset.businessType,enabled=window.POTE_ACCESS?.allowsUniverse?.(type)!==false;
   button.classList.toggle("pote-business-disabled",!enabled);
   button.setAttribute("aria-disabled",String(!enabled));
   const badge=button.querySelector("[data-business-access]");
   if(badge)badge.textContent=enabled?(master()?"🔓 ADM · acesso total":window.POTE_AUTH?.proActive?"🔓 PRO · acesso total":"🔓 FREE · segmento único"):(window.POTE_AUTH?.proActive?"🔒 Bloqueado pelo ADM":"🔒 Exclusivo PRO");
  });
 }
}
function select(type){
 if(!window.POTE_AUTH?.uid){alert("Entre com Google antes de escolher seu negócio.");return}
 if(window.POTE_AUTH.franchiseActive){if(type!=="batataria"){alert("Franquia oficial Potê Batata: o ramo Batataria é obrigatório enquanto a franquia estiver ativa.");return}
   window.POTE_UNIVERSES?.switchTo(state,"batataria",SEED,{skipTemplates:true});
   persist();render();show(false);return}
 const choice=TYPES.find(x=>x.id===type);if(!choice)return;
 if(window.POTE_ACCESS?.allowsUniverse?.(type)===false){
  alert("🔒 Este segmento está bloqueado. No FREE você usa apenas um segmento; assine PRO para acessar os demais.");return;
 }
 // ADM pode gerir todos os universos. Reabrir a matriz já preenchida não
 // deve importar modelos demonstrativos sobre as receitas originais.
 if(master()&&type==="batataria"&&current()==="batataria"&&state.data.recipes?.length){
  state.data.businessType="batataria";persist();render();show(false);return;
 }
 const previous=current(),existing=(state.data.recipes?.length||0)+(state.data.orders?.length||0)+(state.data.ingredients?.length||0);
 if(previous!==type && existing>0 &&
   !confirm("Mudar de "+(TYPES.find(x=>x.id===previous)?.label||"outro ramo")+" para "+choice.label+"? Seus cadastros e vendas atuais serão preservados e NÃO serão apagados."))return;
 const first=!previous;
 const counts={batataria:26,pizzaria:30,hamburgueria:30,hotdog:20,lancheria:0,pastelaria:50};
 const summary=" Este universo tem "+counts[type]+" receitas-modelo. Os demais universos ficarão guardados separadamente, com seus próprios dados.";
 if(!confirm("Selecionar "+choice.label+"?"+summary+" Os dados e custos serão próprios da sua conta."+(!master()&&!window.POTE_AUTH?.proActive?" Sua escolha FREE ficará vinculada a este segmento.":"")))return;
 if(previous!==type&&typeof cart!=="undefined"&&cart.length){
   if(!confirm("A sacola atual tem produtos do ramo anterior. Trocar de universo vai limpar somente os itens não registrados da sacola, sem alterar pedidos já salvos. Continuar?"))return;
   cart=[];
 }
 const data=state.data;
 if(!window.POTE_UNIVERSES){alert("Catálogos indisponíveis. Atualize a página e tente novamente.");return}
 window.POTE_ACCESS?.rememberChoice?.(type);
 const imported=window.POTE_UNIVERSES.switchTo(state,type,SEED);
 // Cada universo tem seu próprio cadastro, pedidos e insumos arquivados separadamente.
 persist();
 render();
 refreshIdentity();
 show(false);
 if(typeof toast==="function"){
  toast(choice.label+" selecionado: "+state.data.recipes.length+" fichas no universo atual. Estoques e vendas anteriores estão preservados em seus respectivos ramos.");
 }
}
$("poteBusinessClose").addEventListener("click",()=>show(false));
$("poteBusinessOverlay").addEventListener("click",e=>{if(e.target===$("poteBusinessOverlay"))show(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&opened)show(false)});
$("poteBusinessOverlay").addEventListener("click",e=>{
 const button=e.target.closest("[data-business-type]");if(button)select(button.dataset.businessType)
});
window.POTE_BUSINESS={open:()=>show(true),close:()=>show(false),choose:select,refresh:refreshIdentity,normalizeAccountBrand,
 neutralBrand,importBatatariaTemplates,current,types:TYPES,refreshAccess:()=>{if(opened)show(true)}};
window.addEventListener?.("pote:changed",refreshIdentity);
window.addEventListener?.("pote:user-ready",()=>{refreshIdentity();const choice=window.POTE_ACCESS?.freeChoice?.();if(choice)window.POTE_ACCESS?.rememberChoice?.(choice);if(window.POTE_ACCESS?.requiresChoice?.())show(true);});
refreshIdentity();
})();