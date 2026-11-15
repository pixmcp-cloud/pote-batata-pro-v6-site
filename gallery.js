/* Potê Batata Pro — Galeria temporária 42h, imagens fora do appState/Firestore.
 * Modo econômico: IndexedDB local. Modo Firebase Storage preparado, DESATIVADO
 * até a confirmação do bucket e do plano de custos pelo proprietário. */
import {GALLERY_TTL_MS,GALLERY_LOCAL_LIMIT,GALLERY_MAX_IMAGE_BYTES,galleryExpiry,isGalleryExpired,galleryTimeRemaining,galleryFileLabel} from "./gallery_policy.mjs?v=gallery-42h";
import {GALLERY_CLOUD_ENABLED,GALLERY_BUCKET} from "./gallery_config.mjs?v=gallery-42h";

const DB_NAME="pote-gallery-temp-42h",DB_VERSION=1,STORE="images";
const $=id=>document.getElementById(id);
const safe=v=>String(v??"").replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>window.POTE_AUTH?.uid||null;
const shell=document.createElement("div");
shell.id="poteGalleryRoot";
shell.innerHTML=`
<div id="poteGalleryOverlay" hidden role="dialog" aria-modal="true" aria-label="Galeria temporária de imagens">
 <section class="pote-gallery-shell">
  <header class="pote-gallery-head"><div><small>IMAGENS GERADAS · ÁREA PESSOAL</small><h2>Galeria</h2><p>Seus criativos ficam disponíveis por 42 horas.</p></div>
  <button id="poteGalleryClose" type="button" aria-label="Fechar Galeria">✕</button></header>
  <div class="pote-gallery-info">
   <span><strong id="poteGalleryCount">0</strong> imagens temporárias</span>
   <span id="poteGalleryMode">Armazenamento local · não sincronizado com Floot</span>
  </div>
  <div id="poteGalleryFeedback" role="status" class="pote-gallery-feedback"></div>
  <div id="poteGalleryItems" class="pote-gallery-grid"></div>
  <footer class="pote-gallery-footer">
   <p>Após 42 horas, as imagens deixam de aparecer. O aplicativo remove os arquivos locais vencidos ao abrir ou durante o uso. Para manter uma cópia, baixe antes do prazo.</p>
   <button id="poteGalleryRefresh" type="button">Atualizar Galeria</button>
  </footer>
 </section>
</div>`;
document.body.appendChild(shell);
let dbPromise=null,cloudPromise=null,busy=false,open=false;
let all=[],previewUrls=[];
function feedback(msg,error=false){const el=$("poteGalleryFeedback");if(el){el.textContent=msg;el.classList.toggle("error",error)}}
function revokePreviews(){for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[]}
function openDB(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error("Armazenamento temporário não disponível neste navegador."));
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:"key"});store.createIndex("uid","uid",{unique:false});store.createIndex("expiresAtMs","expiresAtMs",{unique:false})}};
  req.onerror=()=>reject(req.error||Error("Falha ao abrir a Galeria"));
  req.onsuccess=()=>resolve(req.result);
 });
 dbPromise.catch(()=>{dbPromise=null});
 return dbPromise;
}
async function localTx(type,method,item){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,type),store=tx.objectStore(STORE);
  let request;
  if(method==="put")request=store.put(item);
  else if(method==="delete")request=store.delete(item);
  else if(method==="getAll")request=store.index("uid").getAll(item);
  else throw Error("Operação inválida");
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  tx.onerror=()=>reject(tx.error);
 });
}
async function cleanupLocal(){
 const db=await openDB();
 const items=await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).getAll();
  r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
 });
 const now=Date.now();
 for(const i of items.filter(x=>isGalleryExpired(x,now)))await localTx("readwrite","delete",i.key);
 // Limita o uso de armazenamento do aparelho; mantém as imagens mais novas.
 const me=uid();if(!me)return;
 const active=items.filter(x=>x.uid===me&&!isGalleryExpired(x,now)).sort((a,b)=>b.createdAtMs-a.createdAtMs);
 for(const i of active.slice(GALLERY_LOCAL_LIMIT))await localTx("readwrite","delete",i.key);
}
async function compress(blob){
 if(!(blob instanceof Blob)||blob.size===0)throw Error("A imagem gerada está vazia");
 const url=URL.createObjectURL(blob),img=new Image();
 try{
  img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw Error("Imagem inválida");
  const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*ratio)),h=Math.max(1,Math.round(img.naturalHeight*ratio));
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Não foi possível processar imagem");
  ctx.fillStyle="#11151d";ctx.fillRect(0,0,w,h);
  ctx.drawImage(img,0,0,w,h);
  const make=(type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  let output=await make("image/webp",0.78);
  if(!output||output.type!=="image/webp")output=await make("image/jpeg",0.78);
  if(!output)throw Error("Falha ao comprimir imagem");
  if(output.size>GALLERY_MAX_IMAGE_BYTES)throw Error("Imagem excede o limite da Galeria (3 MB)");
  return {blob:output,width:w,height:h};
 }finally{URL.revokeObjectURL(url)}
}
function uniqueId(){return crypto.randomUUID?crypto.randomUUID():"img-"+Date.now()+"-"+Math.random().toString(36).slice(2)}
function currentItems(){return all.filter(x=>!isGalleryExpired(x)&&x.uid===uid())}
async function cloud(){
 if(!GALLERY_CLOUD_ENABLED)return null;
 if(!cloudPromise)cloudPromise=(async()=>{
  // Nenhum upload é feito enquanto a integração paga de armazenamento estiver desativada.
  const [appMod,authMod,storeMod,fsMod]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/13.3.0/firebase-storage.js"),
   import("https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js")
  ]);
  const app=appMod.getApp(),auth=authMod.getAuth(app);
  const storage=storeMod.getStorage(app,"gs://"+GALLERY_BUCKET);
  const db=fsMod.getFirestore(app);
  return {auth,storage,db,...storeMod,...fsMod};
 })().catch(err=>{cloudPromise=null;throw err});
 return cloudPromise;
}
async function cloudSave(item){
 const sdk=await cloud();if(!sdk)return false;
 const user=sdk.auth.currentUser;
 if(!user||user.uid!==item.uid)throw Error("A conta Google mudou durante o envio");
 const path="gallery/"+item.uid+"/"+item.id+"."+ (item.blob.type==="image/webp"?"webp":"jpg");
 const ref=sdk.ref(sdk.storage,path);
 await sdk.uploadBytes(ref,item.blob,{contentType:item.blob.type,customMetadata:{origin:"pote-batata-pro",expiry:String(item.expiresAtMs)}});
 try{
  await sdk.setDoc(sdk.doc(sdk.db,"users",item.uid,"gallery",item.id),{
   title:item.title,createdAtMs:item.createdAtMs,expiresAtMs:item.expiresAtMs,
   width:item.width,height:item.height,storagePath:path,bytes:item.blob.size,
   contentType:item.blob.type,source:item.source,createdAt:sdk.serverTimestamp(),
   expiresAt:sdk.Timestamp.fromMillis(item.expiresAtMs)
  });
 }catch(e){await sdk.deleteObject(ref).catch(()=>{});throw e}
 return true;
}
async function cloudList(userId){
 const sdk=await cloud();if(!sdk)return [];
 if(sdk.auth.currentUser?.uid!==userId)return [];
 const snap=await sdk.getDocs(sdk.collection(sdk.db,"users",userId,"gallery"));
 const results=[];
 for(const d of snap.docs){
  const m=d.data();
  if(isGalleryExpired(m)){
   // Exclusão física oportunista: quando a conta abre a Galeria.
   try{if(m.storagePath)await sdk.deleteObject(sdk.ref(sdk.storage,m.storagePath))}catch(e){console.warn("Limpeza Storage pendente",e.code||e)}
   await sdk.deleteDoc(d.ref).catch(()=>{});
   continue;
  }
  results.push({id:d.id,uid:userId,key:userId+"/"+d.id,source:m.source||"Criativos",...m,cloud:true});
 }
 return results;
}
async function getCloudBlob(item){
 const sdk=await cloud();if(!sdk||sdk.auth.currentUser?.uid!==item.uid)throw Error("Entre na mesma conta Google");
 return await sdk.getBlob(sdk.ref(sdk.storage,item.storagePath));
}
async function deleteItem(item){
 if(item.cloud){
  const sdk=await cloud();if(sdk&&sdk.auth.currentUser?.uid===item.uid){
   await sdk.deleteObject(sdk.ref(sdk.storage,item.storagePath)).catch(e=>{if(e.code!=="storage/object-not-found")throw e});
   await sdk.deleteDoc(sdk.doc(sdk.db,"users",item.uid,"gallery",item.id));
  }
 }
 await localTx("readwrite","delete",item.key).catch(()=>{});
 all=all.filter(x=>x.key!==item.key);render();
}
async function saveImageBlob(sourceBlob,meta={}){
 const userId=uid();if(!userId){feedback("Entre com Google antes de gerar uma imagem.",true);return false}
 try{
  const prepared=await compress(sourceBlob),createdAtMs=Date.now(),id=meta.id||uniqueId();
  const item={id,uid:userId,key:userId+"/"+id,title:galleryFileLabel(meta.title),
   source:meta.source||"Criativos",createdAtMs,expiresAtMs:galleryExpiry(createdAtMs),
   width:prepared.width,height:prepared.height,blob:prepared.blob,cloud:false};
  await localTx("readwrite","put",item);
  await cleanupLocal();
  let savedCloud=false;
  if(GALLERY_CLOUD_ENABLED){
   try{savedCloud=await cloudSave(item)}
   catch(err){console.warn("Galeria cloud:",err);feedback("Imagem salva neste dispositivo. Sincronização pendente: "+(err.code||err.message),true)}
  }
  if(savedCloud)feedback("Imagem salva na Galeria e sincronizada no Firebase.");
  else if(!GALLERY_CLOUD_ENABLED)feedback("Imagem salva por 42h neste dispositivo. Nuvem ainda não habilitada.");
  if(open)await refresh();
  return true;
 }catch(err){console.error("Galeria:",err);feedback("Não foi possível salvar na Galeria: "+(err.message||err),true);return false}
}
function render(){
 revokePreviews();
 const items=currentItems();
 $("poteGalleryCount").textContent=String(items.length);
 $("poteGalleryMode").textContent=GALLERY_CLOUD_ENABLED?
  "Firebase Storage · sincronização por conta Google":
  "Somente neste dispositivo · não sincronizado com Floot";
 if(!items.length){$("poteGalleryItems").innerHTML='<div class="pote-gallery-empty"><span>▣</span><h3>Galeria vazia</h3><p>Gere uma arte em Criativos. A imagem será guardada aqui por 42 horas.</p></div>';return}
 $("poteGalleryItems").innerHTML=items.map((v,i)=>`
  <article class="pote-gallery-card">
   <div class="pote-gallery-photo"><img data-image-id="${safe(v.id)}" alt="${safe(v.title)}" loading="lazy"></div>
   <div class="pote-gallery-card-body"><strong>${safe(v.title)}</strong><small>Expira em <span data-gallery-clock="${safe(v.id)}">${galleryTimeRemaining(v)}</span></small>
    <div><button type="button" data-gallery-download="${safe(v.id)}">Baixar</button><button type="button" data-gallery-delete="${safe(v.id)}">Excluir</button></div>
   </div>
  </article>`).join("");
 items.forEach(async v=>{
  const img=$("poteGalleryItems").querySelector('[data-image-id="'+CSS.escape(v.id)+'"]');if(!img)return;
  try{
   const blob=v.blob||await getCloudBlob(v);
   if(!open || !img.isConnected)return;
   const url=URL.createObjectURL(blob);previewUrls.push(url);img.src=url;
  }catch(e){img.alt="Não foi possível carregar a imagem";console.warn("Galeria preview",e)}
 });
}
async function refresh(){
 if(busy)return;busy=true;
 try{
  const userId=uid();if(!userId){feedback("Entre com sua conta Google.",true);all=[];render();return}
  await cleanupLocal();
  const local=await localTx("readonly","getAll",userId);
  const merged=new Map(local.filter(x=>!isGalleryExpired(x)).map(x=>[x.id,x]));
  if(GALLERY_CLOUD_ENABLED){
   try{for(const remote of await cloudList(userId))merged.set(remote.id,{...merged.get(remote.id),...remote})}
   catch(e){feedback("Nuvem indisponível. Exibindo cópias deste dispositivo: "+(e.code||e.message),true)}
  }
  all=[...merged.values()].sort((a,b)=>b.createdAtMs-a.createdAtMs);
  render();
 }catch(err){feedback("Falha ao consultar a Galeria: "+(err.message||err),true);all=[];render()}
 finally{busy=false}
}
async function openGallery(){
 if(!uid()){alert("Entre com sua conta Google para acessar a Galeria.");return}
 open=true;$("poteGalleryOverlay").hidden=false;
 document.documentElement.classList.add("pote-gallery-open");
 feedback(GALLERY_CLOUD_ENABLED?"Carregando imagens da sua conta...":"Galeria temporária local. A integração com Floot ainda não está ativa.");
 await refresh();
}
function closeGallery(){
 open=false;$("poteGalleryOverlay").hidden=true;
 document.documentElement.classList.remove("pote-gallery-open");
 revokePreviews();
}
$("poteGalleryClose").addEventListener("click",closeGallery);
$("poteGalleryOverlay").addEventListener("click",e=>{if(e.target===$("poteGalleryOverlay"))closeGallery()});
$("poteGalleryRefresh").addEventListener("click",refresh);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&open)closeGallery()});
$("poteGalleryItems").addEventListener("click",async e=>{
 const target=e.target.closest("[data-gallery-download],[data-gallery-delete]");if(!target)return;
 const id=target.dataset.galleryDownload||target.dataset.galleryDelete;
 const item=currentItems().find(x=>x.id===id);if(!item)return;
 if(target.dataset.galleryDelete){
  if(!confirm("Excluir esta imagem da Galeria?"))return;
  try{await deleteItem(item);feedback("Imagem excluída.");}
  catch(err){feedback("Falha ao excluir: "+(err.message||err),true)}
  return;
 }
 try{
  const blob=item.blob||await getCloudBlob(item),url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="pote-"+item.title.replace(/[^a-z0-9À-ÿ_-]+/gi,"-").slice(0,45)+
    (blob.type==="image/webp"?".webp":".jpg");document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(err){feedback("Não foi possível baixar: "+(err.message||err),true)}
});
window.addEventListener("pote:changed",()=>{if(open)refresh()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&open)refresh()});
setInterval(()=>{if(open){const now=Date.now();if(all.some(x=>isGalleryExpired(x,now)))refresh();
 else document.querySelectorAll("[data-gallery-clock]").forEach(el=>{
   const item=all.find(i=>i.id===el.dataset.galleryClock);if(item)el.textContent=galleryTimeRemaining(item,now)
 });}},60000);
// Coleta oportunista: o navegador não executa limpeza garantida quando fechado.
cleanupLocal().catch(()=>{});
setInterval(()=>cleanupLocal().catch(()=>{}),60*60*1000);
window.addEventListener("focus",()=>cleanupLocal().catch(()=>{}));
window.POTE_GALLERY={open:openGallery,close:closeGallery,refresh,saveImageBlob};
