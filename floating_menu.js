/* Menu flutuante permanente e perfil individual do Potê Batata Pro. */
(function(){
"use strict";
if(window.__poteFloatingMenuLoaded)return;
window.__poteFloatingMenuLoaded=true;
const safe=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nav=[["home","Início"],["business","Negócio"],["orders","Pedidos e produção"],["recipes","Receitas e fichas"],["builder","Criar receita"],["ingredients","Estoque e compras"],["clients","Clientes"],["suppliers","Fornecedores & Compras"],["motoboy","Motoboy"],["deliveryhub","Hub de Delivery"],["vitrine","Cardápio"],["pricing","Precificação"],["expenses","Gastos e despesas"],["reports","Gráficos e relatórios"],["creative","Criativos"],["gallery","Galeria · 42h"],["brand","Minha marca"],["settings","Configurações e backup"]];
const icon='<svg viewBox="0 0 24 24" aria-hidden="true" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const avatar='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2c0-5 16-5 16 0v2"/></svg>';
const closeIcon='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const wrap=document.createElement('div');
wrap.id='poteFloatingRoot';
wrap.innerHTML=`
<button id="poteFloatToggle" class="pote-ai-orb" type="button" aria-label="Abrir carteira IA COIN" aria-expanded="false" aria-controls="poteAiUniverse"><span>IA</span></button>
<div id="poteFloatBackdrop" hidden></div>
<aside id="poteFloatDrawer" aria-label="Menu de navegação" aria-hidden="true" inert>
 <div class="pote-float-head"><div><small id="poteFloatBrand">PDV NÚCLEOBIT</small><strong>Menu de Operações</strong></div><button id="poteFloatClose" type="button" aria-label="Fechar menu">${closeIcon}</button></div>
 <button id="poteFloatProfile" class="pote-float-account" type="button"><span id="poteFloatAvatar">${avatar}</span><span><strong id="poteFloatName">Meu perfil</strong><small id="poteFloatEmail">Configurar nome e foto</small></span><span class="pote-float-chevron">›</span></button>
 <nav id="poteFloatNavigation"></nav>
 <div class="pote-float-foot"><button type="button" id="poteFloatSettings">⚙ Configurações e perfil</button><small>As informações de perfil pertencem à sua conta.</small></div>
</aside>
<div id="poteProfileOverlay" hidden role="dialog" aria-modal="true" aria-label="Editar perfil">
  <form id="poteProfileForm" class="pote-profile-card">
   <div class="pote-profile-head"><div><small>CONFIGURAÇÕES</small><h2>Meu perfil</h2></div><button type="button" id="poteProfileClose" aria-label="Fechar">${closeIcon}</button></div>
   <label class="pote-photo-input"><span id="poteProfilePreview">${avatar}</span><span>Alterar foto de perfil<small>JPG, PNG ou WebP · até 5 MB</small></span><input id="poteProfilePhoto" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
   <label class="pote-profile-label" for="poteProfileName">Nome de exibição<input id="poteProfileName" type="text" maxlength="65" placeholder="Como deseja aparecer no aplicativo" autocomplete="nickname"></label>
   <p id="poteProfileNameProtection" hidden role="status" style="font-size:12px;color:#f7d599">Nome protegido pela administração. Você pode alterar sua foto, mas não o nome exibido.</p>
   <p id="poteProfileIdentity"></p>
   <section id="poteProfileLicense" class="pote-profile-license" data-state="free" aria-label="Licença da sua conta">
    <div class="pote-profile-license-top"><small>MEU PLANO</small><strong id="poteProfileLicenseType">FREE</strong></div>
    <span id="poteProfileCountdownLabel">Validade do acesso</span>
    <strong id="poteProfileCountdown" role="timer" aria-live="off">Sem vencimento</strong>
    <p id="poteProfileLicenseHint">Suas informações de licença serão carregadas após entrar com Google.</p>
   </section>
   <div class="pote-profile-actions"><button type="button" id="poteProfileCancel">Cancelar</button><button type="submit" id="poteProfileSave">Salvar perfil</button></div>
  </form>
</div>`;
document.body.appendChild(wrap);
const $=id=>document.getElementById(id);
let opened=false,pendingPhoto=null,pendingPhotoUid=null,savingProfile=false;
function profile(){
 const uid=window.POTE_AUTH?.uid;
 const p=window.POTE_ACCOUNT_PROFILE;
 // Never read user identity from the mutable business-state snapshot.
 return uid&&p?.uid===uid?{name:p.displayName||"",photoData:p.photoURL||"",locked:Boolean(p.nameLocked)}:{};
}
function refresh(){
 const p=profile(),email=window.POTE_AUTH?.email||'';
 $('poteFloatName').textContent=p.name||'Meu perfil';
 $('poteFloatEmail').textContent=email||'Personalizar sua conta';
 const photo=p.photoData;
 $('poteFloatAvatar').innerHTML=photo?'<img src="'+safe(photo)+'" alt="Foto de perfil">':avatar;
 document.querySelectorAll('#poteFloatNavigation button').forEach(b=>b.classList.toggle('selected',typeof state!=='undefined'&&b.dataset.tab===state.tab));
}
function refreshProfileLicense(status=window.POTE_LICENSE_STATUS){
 const box=$('poteProfileLicense');
 if(!box)return;
 if(!window.POTE_AUTH?.uid){
  box.dataset.state='free';
  $('poteProfileLicenseType').textContent='Não conectado';
  $('poteProfileCountdownLabel').textContent='STATUS DO ACESSO';
  $('poteProfileCountdown').textContent='—';
  $('poteProfileLicenseHint').textContent='Entre com Google para consultar sua licença.';
  return;
 }
 if(window.POTE_AUTH.role==='admin'){
  box.dataset.state='lifetime';
  $('poteProfileLicenseType').textContent='ADM · ACESSO MESTRE';
  $('poteProfileCountdownLabel').textContent='VALIDADE';
  $('poteProfileCountdown').textContent='Sem vencimento';
  $('poteProfileLicenseHint').textContent='Acesso administrativo verificado.';
  return;
 }
 if(window.POTE_AUTH.franchiseActive||status?.franchiseActive){
  box.dataset.state='lifetime';
  $('poteProfileLicenseType').textContent='FRANQUIA POTÊ BATATA';
  $('poteProfileCountdownLabel').textContent='CATÁLOGO OFICIAL';
  $('poteProfileCountdown').textContent='Sincronização ativa';
  $('poteProfileLicenseHint').textContent='A marca, as imagens e os sabores são atualizados pela matriz. Seus custos, vendas e estoque continuam exclusivos da sua unidade.';
  return;
 }
 const state=status?.state||'free';
 box.dataset.state=state;
 $('poteProfileLicenseType').textContent=state==='lifetime'?'PRO VITALÍCIA':state==='active'?(status?.label||'PRO'):state==='expired'?'FREE · VENCIDO':'FREE';
 $('poteProfileCountdownLabel').textContent=state==='active'?'TEMPO RESTANTE PARA VOLTAR AO FREE':'VALIDADE DO ACESSO';
 $('poteProfileCountdown').textContent=state==='active'?(status.formatted||'00a 00d 00h 00m 00s'):
    state==='expired'?'00a 00d 00h 00m 00s':'Sem vencimento';
 $('poteProfileLicenseHint').textContent=state==='active'?'Vencimento: '+(status?.expiresLabel||'consulte a administração'):
    state==='lifetime'?'Licença vitalícia: sem retorno automático ao FREE.':
    state==='expired'?'O prazo terminou e sua conta voltou ao FREE.':'O plano FREE não possui prazo de expiração.';
}
function setOpen(v){
 opened=!!v;
 $('poteFloatDrawer').classList.toggle('is-open',opened);
 $('poteFloatDrawer').inert=!opened;
 $('poteFloatDrawer').setAttribute('aria-hidden',String(!opened));
 $('poteFloatBackdrop').hidden=!opened;
 const left=$('poteHeadLogo');if(left)left.setAttribute('aria-expanded',String(opened));
 if(opened)refresh();
}
function showProfile(open){
 if(open&&(!window.POTE_AUTH?.uid||!window.POTE_APP_READY))return;
 $('poteProfileOverlay').hidden=!open;
 if(open){
  setOpen(false);pendingPhoto=null;pendingPhotoUid=window.POTE_AUTH.uid;
  const p=profile();
  $('poteProfileName').value=p.name||'';
  const locked=Boolean(p.locked)&&window.POTE_AUTH?.role!=='admin';
  $('poteProfileName').readOnly=locked;
  $('poteProfileName').setAttribute('aria-readonly',String(locked));
  $('poteProfileNameProtection').hidden=!locked;
  $('poteProfilePreview').innerHTML=p.photoData?'<img src="'+safe(p.photoData)+'" alt="Foto atual">':avatar;
  $('poteProfileIdentity').textContent='Conta: '+(window.POTE_AUTH?.email||'Faça login para salvar o perfil');
  $('poteProfilePhoto').value='';
  refreshProfileLicense();
  if(!locked)$('poteProfileName').focus();
 }
}
$('poteFloatNavigation').innerHTML=nav.map(([tab,title])=>'<button type="button" data-tab="'+tab+'"><span>'+safe(title)+'</span><span>›</span></button>').join('');
// Exactly two existing controls: left company image becomes menu; right button becomes IA COIN.
const logo=document.getElementById('poteHeadLogo'),orb=$('poteFloatToggle');
function syncAiOrb(){
 orb.setAttribute('aria-expanded',String(!!window.POTE_IA_UNIVERSE?.isOpen()));
}
function toggleOperationsMenu(event){
 if(event){event.preventDefault();event.stopImmediatePropagation();}
 setOpen(!opened);
}
if(logo){
 logo.dataset.headerMenu='true';
 logo.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#243449"/><path d="M10 12h20M10 20h20M10 28h20" fill="none" stroke="#ffdfa6" stroke-width="2.7" stroke-linecap="round"/></svg>');
 logo.alt='Menu de operações';
 logo.setAttribute('role','button');logo.tabIndex=0;logo.setAttribute('aria-label','Abrir menu de operações');logo.setAttribute('aria-controls','poteFloatDrawer');logo.setAttribute('aria-expanded','false');logo.title='Menu de operações';
 logo.addEventListener('click',toggleOperationsMenu,true);
 logo.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')toggleOperationsMenu(e)},true);
}
orb.addEventListener('click',event=>{
 event.preventDefault();event.stopImmediatePropagation();
 if(!window.POTE_APP_READY||!window.POTE_AUTH?.uid)return;
 setOpen(false);
 if(window.POTE_IA_UNIVERSE)window.POTE_IA_UNIVERSE.open();
 else if(typeof toast==='function')toast('Carteira IA COIN indisponível. Atualize a página.');
 syncAiOrb();
},true);
window.addEventListener('pote:ia-universe-ready',syncAiOrb);
window.addEventListener('pote:ia-universe-state',syncAiOrb);
syncAiOrb();
$('poteFloatClose').addEventListener('click',()=>setOpen(false));
$('poteFloatBackdrop').addEventListener('click',()=>setOpen(false));
$('poteFloatNavigation').addEventListener('click',e=>{
 const b=e.target.closest('button[data-tab]');
 if(!b)return;
 setOpen(false);
 if(b.dataset.tab==='business'){window.POTE_BUSINESS?.open();return}
 if(b.dataset.tab==='gallery'){window.POTE_GALLERY?.open();return}
 if(typeof go==='function')go(b.dataset.tab);
});
$('poteFloatProfile').addEventListener('click',()=>showProfile(true));
$('poteFloatSettings').addEventListener('click',()=>showProfile(true));
$('poteProfileClose').addEventListener('click',()=>showProfile(false));
$('poteProfileCancel').addEventListener('click',()=>showProfile(false));
$('poteProfileOverlay').addEventListener('click',e=>{if(e.target===$('poteProfileOverlay'))showProfile(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('poteProfileOverlay').hidden)showProfile(false);else if(opened)setOpen(false)}});
$('poteProfilePhoto').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 const uid=window.POTE_AUTH?.uid;
 if(!uid||!window.POTE_APP_READY)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024){alert('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.');return}
 try{
 const url=URL.createObjectURL(file);
 const img=new Image();
 try{
  img.src=url;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=176;canvas.height=176;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Editor de foto indisponível');
  const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
  ctx.drawImage(img,sx,sy,side,side,0,0,176,176);
  if(uid!==window.POTE_AUTH?.uid||!window.POTE_APP_READY)return;
  pendingPhoto=canvas.toDataURL('image/jpeg',0.7);
  pendingPhotoUid=uid;
  $('poteProfilePreview').innerHTML='<img src="'+safe(pendingPhoto)+'" alt="Prévia da foto">';
 }finally{URL.revokeObjectURL(url)}
 }catch(err){alert('Não foi possível ler essa imagem. Escolha outra foto.')}
});
$('poteProfileForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const uid=window.POTE_AUTH?.uid;
 if(savingProfile)return;
 if(!uid||!window.POTE_APP_READY||!window.POTE_PROFILE_API?.save){
  alert('Entre com sua conta Google para salvar seu perfil.');return;
 }
 const name=$('poteProfileName').value.trim();
 if(!name){$('poteProfileName').focus();return}
 const photo=pendingPhotoUid===uid?pendingPhoto:null;
 savingProfile=true;
 $('poteProfileSave').disabled=true;
 try{
  await window.POTE_PROFILE_API.save(photo?{name,photoData:photo}:{name});
  if(window.POTE_AUTH?.uid!==uid)return;
  refresh();showProfile(false);
  if(typeof toast==='function')toast('Perfil salvo na sua conta Google vinculada');
 }catch(err){
  if(window.POTE_AUTH?.uid===uid)alert('Não foi possível salvar o perfil: '+String(err?.message||err));
 }finally{
  savingProfile=false;
  $('poteProfileSave').disabled=false;
 }
});
window.addEventListener('pote:profile-updated',()=>{
 refresh();
 if(!$('poteProfileOverlay').hidden&&pendingPhotoUid!==window.POTE_AUTH?.uid)
  showProfile(false);
});
window.addEventListener('pote:user-logout',()=>{
 pendingPhoto=null;pendingPhotoUid=null;
 showProfile(false);setOpen(false);
 $('poteProfileNameProtection').hidden=true;
 $('poteProfileName').readOnly=false;
 $('poteProfileName').value='';
 $('poteProfilePreview').innerHTML=avatar;
 $('poteProfileIdentity').textContent='';
 refresh();refreshProfileLicense();
});
window.addEventListener('pote:user-ready',()=>{refresh();refreshProfileLicense()});
window.addEventListener('pote:license-updated',e=>refreshProfileLicense(e.detail));
const observer=new MutationObserver(()=>{if(!opened&&$('poteProfileOverlay').hidden)refresh()});
const page=document.getElementById('page');if(page)observer.observe(page,{childList:true});
refresh();
refreshProfileLicense();
})();
