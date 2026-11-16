/* Universos isolados no mesmo perfil Google.
   O estado ativo permanece na estrutura antiga por compatibilidade.
   Os demais ramos ficam arquivados em data.businessUniverses, sem exclusão. */
(function(){
"use strict";
if(window.POTE_UNIVERSES)return;
const VALID=["batataria","pizzaria","hamburgueria","hotdog","lancheria","pastelaria"];
const LISTS=["recipes","ingredients","orders","clients","suppliers","expenses",
 "recipeVersions","recipeTrash","purchases","stockMovements","beverages","addons",
 "combos","prepBatches","checklist","losses","cashSessions","cashMovements","garimpoOffers"];
const UNIVERSE_VERSION=3;
const copy=v=>JSON.parse(JSON.stringify(v));
function snapshot(state){
 const data=state.data,result={};
 for(const k of LISTS)result[k]=copy(Array.isArray(data[k])?data[k]:[]);
 result.settings=copy(data.settings||{});
 result.brand=copy(data.brand||{});
 result.businessTemplates=copy(data.businessTemplates||{});
 result.unlocked=state.unlocked??null;
 result.freeCreativeRecipeId=state.freeCreativeRecipeId??null;
 result.creatives=copy(Array.isArray(state.creatives)?state.creatives:[]);
 return result;
}
function empty(state,type){
 const branch=snapshot(state);
 for(const k of LISTS)branch[k]=[];
 branch.businessTemplates={};
 branch.unlocked=null;branch.freeCreativeRecipeId=null;branch.creatives=[];
 branch.settings={...branch.settings,estimatedMonthlyUnits:0,
  portion:{batataria:500,pizzaria:700,hamburgueria:320,hotdog:260,lancheria:300,pastelaria:260}[type]};
 const name={batataria:"Minha Batataria",pizzaria:"Minha Pizzaria",
  hamburgueria:"Minha Hamburgueria",hotdog:"Meu Hot Dog",lancheria:"Minha Lancheria",pastelaria:"Minha Pastelaria"}[type];
 branch.brand={...branch.brand,name,subtitle:type.toUpperCase(),
  logoUrl:"./assets/generic/business-"+type+".svg"};
 return branch;
}
function restore(state,branch){
 if(!branch)return false;
 for(const k of LISTS)state.data[k]=copy(Array.isArray(branch[k])?branch[k]:[]);
 state.data.settings=copy(branch.settings||{});
 state.data.brand=copy(branch.brand||{});
 state.data.businessTemplates=copy(branch.businessTemplates||{});
 state.unlocked=branch.unlocked??null;
 state.freeCreativeRecipeId=branch.freeCreativeRecipeId??null;
 state.creatives=copy(branch.creatives||[]);
 return true;
}
function hasAnyRecords(state){
 return LISTS.some(k=>Array.isArray(state.data[k])&&state.data[k].length>0);
}
function prepare(state,seed){
 const data=state.data;if(!data)throw Error("Estado inválido");
 if(data.businessUniverses&&data.universeDataVersion>=UNIVERSE_VERSION)return false;
 if(!data.businessUniverses)data.businessUniverses={};
 const prior=VALID.includes(data.businessType)?data.businessType:"";
 if(prior && !data.businessUniverses[prior]){
  const saved=snapshot(state);
  // Corrigir a versão antiga que deixava as 26 fichas da Batataria visíveis em Pizzaria.
  if(prior!=="batataria"){
   const importedB=saved.recipes.filter(r=>r.templateOrigin==="batataria");
   if(importedB.length){
    saved.recipes=saved.recipes.filter(r=>r.templateOrigin!=="batataria");
    const batataIds=new Set((seed?.ingredients||[]).map(x=>x.id));
    const usedByOther=new Set(saved.recipes.flatMap(r=>(r.items||[]).map(i=>i.id)));
    const copyB=empty(state,"batataria");
    copyB.recipes=importedB;
    copyB.ingredients=saved.ingredients.filter(i=>batataIds.has(i.id));
    copyB.businessTemplates={batataria:{version:1,migratedFrom:prior}};
    data.businessUniverses.batataria=copyB;
    saved.ingredients=saved.ingredients.filter(i=>!batataIds.has(i.id)||usedByOther.has(i.id));
    if(saved.unlocked&&importedB.some(x=>x.id===saved.unlocked))saved.unlocked=null;
    // Movimentações antigas ficam na conta sem apagamento, até conferência da operação.
   }
  }
  data.businessUniverses[prior]=saved;
  restore(state,saved);
 }
 // Se o usuário não escolheu ramo, registros prévios não são apagados: ficam guardados.
 if(!prior&&hasAnyRecords(state)){
  data.businessUniverses.legacyUnassigned??=snapshot(state);
 }
 data.universeDataVersion=UNIVERSE_VERSION;
 return true;
}
function importModels(state,type,seed){
 const data=state.data,existing=data.businessTemplates||{};
 if(existing[type])return {already:true,recipesAdded:0,ingredientsAdded:0};
 let recipes=[],ingredients=[];
 if(type==="batataria"){
  recipes=copy(seed?.recipes||[]);
  ingredients=copy(seed?.ingredients||[]);
  recipes.forEach(r=>{r.imageUrl="./assets/generic/recipe-"+r.id+".svg";
   r.templateOrigin="batataria";r.businessUniverse="batataria";r.featured=false});
  ingredients.forEach(i=>{i.stock=0;i.minimum=0;i.imageUrl="";
   i.source="Preço de referência: confira seu fornecedor";i.templateOrigin="batataria"});
 }else{
  const set=window.POTE_UNIVERSE_TEMPLATES?.[type];
  if(!set)throw Error("Catálogo de "+type+" indisponível");
  recipes=copy(set.recipes||[]);ingredients=copy(set.ingredients||[]);
 }
 const recipeIds=new Set(data.recipes.map(r=>r.id));
 const ingredientIds=new Set(data.ingredients.map(i=>i.id));
 let recipesAdded=0,ingredientsAdded=0;
 for(const i of ingredients)if(!ingredientIds.has(i.id)){data.ingredients.push(i);ingredientsAdded++}
 for(const r of recipes)if(!recipeIds.has(r.id)){data.recipes.push(r);recipesAdded++}
 if(!state.unlocked&&recipes.length)state.unlocked=recipes[0].id;
 data.businessTemplates={...existing,[type]:{version:1,importedAt:new Date().toISOString(),
  recipesAdded,ingredientsAdded}};
 return {already:false,recipesAdded,ingredientsAdded};
}
function switchTo(state,type,seed,{skipTemplates=false}={}){
 if(!VALID.includes(type))throw Error("Negócio inválido");
 const data=state.data;
 window.POTE_KITCHEN?.capture?.(state);
 const prepared=prepare(state,seed);
 const previous=VALID.includes(data.businessType)?data.businessType:"";
 if(previous && previous!==type){
  data.businessUniverses[previous]=snapshot(state);
 }
 if(previous!==type){
  const saved=data.businessUniverses[type]||empty(state,type);
  restore(state,saved);
  data.businessType=type;
 }
 let imported={already:true,recipesAdded:0,ingredientsAdded:0};
 if(!skipTemplates)imported=importModels(state,type,seed);
 window.POTE_KITCHEN?.project?.(state);
 data.businessUniverses[type]=snapshot(state);
 data.universeDataVersion=UNIVERSE_VERSION;
 return {...imported,previous,current:type,changed:prepared||previous!==type||!imported.already};
}
function saveActive(state){
 const type=state?.data?.businessType;
 if(!VALID.includes(type)||!state.data.businessUniverses)return;
 state.data.businessUniverses[type]=snapshot(state);
}
window.POTE_UNIVERSES={types:VALID,fields:LISTS,prepare,switchTo,saveActive,snapshot,importModels};
})();