/* Android back navigation + unsaved drafts for same-page PDV screens.
 * Data is session-scoped, account-namespaced and never sent to Firestore. */
(function(){
"use strict";
if(window.POTE_EXIT)return;
const DRAFT_VERSION="v3",MAX_AGE=36*60*60*1000,MAX_FIELDS=120;
let armed=false,leaving=false,dialog=null,activeRoute=null,restoring=false;
let returnRoute=null,pendingIngredientId=null,skipCaptureKey=null,timer=null;
const logged=()=>!!window.POTE_AUTH?.uid;
const bridge=()=>window.POTE_ROUTE_BRIDGE||null;
const route=()=>bridge()?.current?.()||{tab:"home",expansion:null};
const normalize=r=>({tab:String(r?.tab||"home"),expansion:r?.expansion||null});
const same=(a,b)=>!!a&&!!b&&a.tab===b.tab&&a.expansion===b.expansion;
const routeKey=r=>r.tab+(r.tab==="builder"?(String(r.expansion||"").startsWith("edit:")?":"+r.expansion:":new"):"");
const storageKey=r=>"pote-draft-"+DRAFT_VERSION+"-"+String(window.POTE_AUTH?.uid||"anonymous")+"-"+routeKey(r);
const page=()=>document.getElementById("page");
const fields=()=>Array.from(page()?.querySelectorAll?.("input,textarea,select")||[]);
function readSaved(r){
 try{
  const raw=sessionStorage.getItem(storageKey(r));
  if(!raw)return null;
  const data=JSON.parse(raw);
  if(!data||!data.at||Date.now()-data.at>MAX_AGE){sessionStorage.removeItem(storageKey(r));return null}
  return data;
 }catch{return null}
}
function capture(r=activeRoute){
 if(!r||!logged()||!page())return;
 const current=normalize(r),entries={};
 for(const e of fields()){
  if(!e.id||e.disabled||e.readOnly||["password","file","submit","button"].includes(e.type)||(e.type==="hidden"&&e.id!=="builderPhotoData")||/password|token|secret|cardnumber|cpf|cvv/i.test(e.id))continue;
  if(Object.keys(entries).length>=MAX_FIELDS)break;
  if(e.type==="radio"&&!e.checked)continue;
  entries[e.id]={v:e.type==="checkbox"?!!e.checked:String(e.value??"").slice(0,e.id==="builderPhotoData"?110000:6000),type:e.type};
 }
 const previous=readSaved(current);
 const list=current.tab==="builder"?bridge()?.getDraftItems?.():null;
 const data={at:Date.now(),fields:entries,items:Array.isArray(list)?list:previous?.items||[]};
 try{sessionStorage.setItem(storageKey(current),JSON.stringify(data))}catch{}
}
function restore(r){
 if(!logged())return;
 const saved=readSaved(r);
 if(saved?.items&&r.tab==="builder")bridge()?.restoreDraftItems?.(saved.items);
 if(saved?.fields){
  for(const [id,p] of Object.entries(saved.fields)){
   const e=document.getElementById(id);
   if(!e||e.disabled||e.readOnly||!page()?.contains?.(e))continue;
   const f=p||{};
   if(e.type==="checkbox")e.checked=!!f.v;
   else if(e.type==="radio")e.checked=e.value===f.v;
   else if(e.tagName==="SELECT"){
    if(Array.from(e.options||[]).some(o=>o.value===f.v))e.value=f.v;
   }else if(e.type!=="file")e.value=String(f.v??"");
  }
 }
 if(r.tab==="builder")window.POTE_RECIPE_PHOTO?.sync?.();
 if(r.tab==="builder"&&pendingIngredientId){
  const select=document.getElementById("builderIng");
  if(select&&Array.from(select.options||[]).some(o=>o.value===pendingIngredientId)){
   select.value=pendingIngredientId;
   const qty=document.getElementById("builderQty");if(qty&&!qty.value)qty.focus();
  }
  pendingIngredientId=null;returnRoute=null;
 }
}
function clearDraft(tab="builder"){
 const r=route();
 const key=storageKey(normalize({...r,tab}));
 try{sessionStorage.removeItem(key)}catch{}
 if(activeRoute&&routeKey(activeRoute)===routeKey(normalize({...r,tab})))skipCaptureKey=routeKey(activeRoute);
}
function ensure(){
 if(dialog)return dialog;
 dialog=document.createElement("div");dialog.id="poteExitConfirm";dialog.hidden=true;
 dialog.innerHTML='<section class="pote-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="poteExitTitle">'+
  '<small>CONFIRMAÇÃO DE SAÍDA</small><h2 id="poteExitTitle">Deseja sair da Gestão Pro?</h2>'+
  '<p>Você está na tela inicial. Confira a sincronização antes de sair para não perder alterações recentes.</p>'+
  '<div class="pote-exit-actions"><button id="poteExitStay" type="button" class="btn">Permanecer no aplicativo</button>'+
  '<button id="poteExitLeave" type="button" class="btn line">Sair desta página</button></div></section>';
 document.body.appendChild(dialog);
 document.getElementById("poteExitStay").addEventListener("click",()=>{dialog.hidden=true});
 document.getElementById("poteExitLeave").addEventListener("click",()=>{
  capture(activeRoute);dialog.hidden=true;leaving=true;history.go(-2);
 });
 return dialog;
}
function arm(){
 if(!logged()||armed)return;
 armed=true;leaving=false;activeRoute=normalize(route());
 try{
  history.replaceState({...history.state,poteExitBase:true},"",location.href);
  history.pushState({poteRoute:activeRoute},"",location.href);
 }catch(e){console.warn("Histórico interno indisponível",e)}
}
function disarm(){
 capture(activeRoute);
 armed=false;leaving=true;activeRoute=null;returnRoute=null;pendingIngredientId=null;
 if(timer)clearTimeout(timer);timer=null;
 if(dialog)dialog.hidden=true;
}
function beforeRender(){
 if(!armed||!logged())return;
 if(activeRoute){
  if(skipCaptureKey===routeKey(activeRoute))skipCaptureKey=null;
  else capture(activeRoute);
 }
}
function afterRender(){
 if(!logged()||!armed)return;
 const next=normalize(route());
 if(!same(next,activeRoute)){
  if(!restoring){
   try{history.pushState({poteRoute:next},"",location.href)}catch(e){console.warn("Navegação não registrada",e)}
  }
  activeRoute=next;
 }
 restore(next);
}
window.addEventListener("popstate",event=>{
 if(!logged()||!armed||leaving)return;
 if(event.state?.poteRoute){
  const next=normalize(event.state.poteRoute);
  if(same(next,activeRoute))return;
  capture(activeRoute);
  restoring=true;
  try{bridge()?.navigate?.(next)}finally{restoring=false}
  return;
 }
 capture(activeRoute);
 try{history.pushState({poteRoute:normalize(activeRoute||route())},"",location.href)}catch(e){}
 ensure().hidden=false;
});
window.addEventListener("beforeunload",event=>{
 if(!logged()||leaving)return;
 capture(activeRoute);
 event.preventDefault();event.returnValue="";
});
document.addEventListener("input",event=>{
 if(!logged()||!armed||!page()?.contains(event.target))return;
 if(timer)clearTimeout(timer);
 timer=setTimeout(()=>capture(activeRoute),180);
},true);
document.addEventListener("change",event=>{
 if(!logged()||!armed||!page()?.contains(event.target))return;
 capture(activeRoute);
},true);
window.addEventListener("pote:user-ready",arm);
window.addEventListener("pote:user-logout",disarm);
function beginIngredient(){
 if(route().tab!=="builder")return;
 capture(normalize(route()));returnRoute=normalize(route());
}
function returnToRecipe(){
 if(!returnRoute)return;
 const expected=returnRoute;
 if(history.state?.poteRoute?.tab==="ingredients"){
  history.back();
 }else{
  bridge()?.navigate?.(expected);
 }
}
function completeIngredient(id){
 if(!returnRoute)return false;
 pendingIngredientId=String(id);
 returnToRecipe();return true;
}
function returnBanner(){
 if(!returnRoute||route().tab!=="ingredients")return "";
 return '<div class="notice green" id="poteResumeRecipe" style="margin:0 0 12px;padding:14px;border:1px solid #67b67c"><strong>Receita em andamento</strong><p>Cadastre o insumo normalmente. Ao salvar, você retornará à receita sem perder os campos preenchidos.</p><button class="btn" onclick="window.POTE_EXIT?.returnToRecipe()">← Voltar à receita em andamento</button></div>';
}
window.POTE_EXIT={
 arm,disarm,isArmed:()=>armed,beforeRender,afterRender,captureNow:()=>capture(activeRoute),
 clearDraft,hasBuilderDraft:()=>!!readSaved({tab:"builder",expansion:null}),
 beginIngredient,returnToRecipe,completeIngredient,returnBanner,
 confirmLogout:()=>!logged()||window.confirm("Sair da sua conta? Confira a sincronização antes de confirmar."),
 getActiveRoute:()=>activeRoute
};
if(logged())arm();
})();