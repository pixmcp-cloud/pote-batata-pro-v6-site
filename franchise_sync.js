import {getApp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp,onSnapshot} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {buildFranchiseCatalog,catalogFingerprint,mergeFranchiseCatalog,FRANCHISE_CATALOG_ID} from "./franchise_catalog.mjs?v=franchise-20261115";

const auth=getAuth(getApp()),db=getFirestore(getApp());
const catalogRef=doc(db,"franchiseCatalog",FRANCHISE_CATALOG_ID);
let offCatalog=null,connectedUid=null,lastPublished=null,lastPublishedServer=null;
let latestCatalog=null,publicationTimer=null,publishing=false,publishQueued=false,subscriptionToken=0;
function master(){return window.POTE_AUTH?.role==="admin"&&!!window.POTE_APP_READY}
function franchise(){return !!window.POTE_APP_READY&&!!window.POTE_AUTH?.franchiseActive&&!master()}
function userId(){return window.POTE_AUTH?.uid||null}
function notify(message,error=false){
 const session=document.getElementById("poteSyncStatus");
 if(session&&document.body&&!document.body.classList.contains("pote-auth-locked")){
  session.textContent=message;
  session.style.color=error?"#ffb5a5":"";
 }
}
function disconnect(){
 ++subscriptionToken;
 if(offCatalog){offCatalog();offCatalog=null}
 connectedUid=null;
 latestCatalog=null;
 if(publicationTimer){clearTimeout(publicationTimer);publicationTimer=null}
}
async function publish(){
 if(!master()||!window.POTE_APP?.snapshot)return;
 if(publishing){publishQueued=true;return}
 publishing=true;
 try{
  const catalog=buildFranchiseCatalog(window.POTE_APP.snapshot(),window.POTE_RECIPE_IMAGES||{});
  const fingerprint=catalogFingerprint(catalog);
  if(lastPublished===fingerprint)return;
  // Uma leitura na primeira publicação evita regravar o mesmo catálogo após recarregar.
  if(lastPublishedServer===null){
   const existing=await getDoc(catalogRef);
   lastPublishedServer=existing.exists()?existing.data().fingerprint||"":"";
  }
  if(lastPublishedServer===fingerprint){lastPublished=fingerprint;return}
  if(!master()||auth.currentUser?.uid!==userId())return;
  await setDoc(catalogRef,{
   ...catalog,fingerprint,publisherUid:auth.currentUser.uid,
   updatedAt:serverTimestamp()
  });
  lastPublished=fingerprint;lastPublishedServer=fingerprint;
  console.info("Catálogo oficial atualizado:",catalog.recipes.length,"sabores");
 }catch(err){
  console.warn("Falha ao atualizar catálogo da franquia",err.code||err.message);
  notify("Catálogo das franquias: falha ao publicar",true);
 }finally{
  publishing=false;
  if(publishQueued){publishQueued=false;schedulePublish()}
 }
}
function schedulePublish(){
 if(!master())return;
 if(publicationTimer)clearTimeout(publicationTimer);
 publicationTimer=setTimeout(()=>{publicationTimer=null;void publish()},1400);
}
function applyCatalog(catalog,active=true){
 if(!window.POTE_APP_READY||!window.POTE_APP?.snapshot||(!master()&&active&&!franchise()))return;
 const state=window.POTE_APP.snapshot();
 try{
  const result=mergeFranchiseCatalog(state,catalog,{active});
  if(!result.changed)return;
  window.POTE_APP.applyState(state);
  window.POTE_BUSINESS?.refresh?.();
  window.dispatchEvent(new Event("pote:changed"));
  if(active&&result.recipesAdded>0&&typeof window.toast==="function")
   window.toast(result.recipesAdded+" novo(s) sabor(es) oficial(is) da franquia atualizado(s)!");
  if(active)console.info("Franquia sincronizada",result);
 }catch(err){
  console.warn("Falha ao incorporar catálogo Potê",err.message||err);
  notify("Franquia: erro ao sincronizar as fichas",true);
 }
}
function subscribeFranchise(){
 if(!franchise())return;
 const uid=userId();
 if(connectedUid===uid&&offCatalog)return;
 disconnect();
 connectedUid=uid;
 const token=subscriptionToken;
 notify("Franquia: conectando catálogo oficial...");
 offCatalog=onSnapshot(catalogRef,snap=>{
  if(token!==subscriptionToken||!franchise()||auth.currentUser?.uid!==uid)return;
  if(!snap.exists()){
   notify("Franquia ativa: aguardando a primeira publicação dos sabores",true);
   return;
  }
  const catalog=snap.data();
  if(catalog.brandId!=="potebatata"){notify("Catálogo de franquia inválido",true);return}
  latestCatalog=catalog;
  applyCatalog(catalog,true);
  notify("Franquia Potê Batata · catálogo atualizado");
 },err=>{
  if(token!==subscriptionToken)return;
  notify("Franquia: catálogo indisponível ("+(err.code||"erro")+")",true);
  console.warn("Franquia onSnapshot",err);
 });
}
function checkMembership(){
 if(!window.POTE_APP_READY){disconnect();return}
 if(master()){
  if(offCatalog)disconnect();
  schedulePublish();
  return;
 }
 if(franchise()){
  subscribeFranchise();
  return;
 }
 disconnect();
 const own=window.POTE_APP?.snapshot?.();
 if(own?.data?.recipes?.some(r=>r.templateOrigin==="franchise"&&!r.franchiseLocked)||
    own?.data?.brand?.logoUrl==="./assets/pote-logo-original.jpg"){
  applyCatalog(null,false);
 }
}
window.addEventListener("pote:user-ready",checkMembership);
window.addEventListener("pote:franchise-updated",checkMembership);
window.addEventListener("pote:user-logout",()=>{disconnect();lastPublished=null;lastPublishedServer=null});
window.addEventListener("pote:changed",()=>{
 if(master())schedulePublish();
 else if(franchise()&&latestCatalog)applyCatalog(latestCatalog,true);
});
if(window.POTE_APP_READY)checkMembership();
window.POTE_FRANCHISE={refresh:checkMembership,showStatus:()=>({active:franchise(),catalogReady:!!latestCatalog})};
