/* Menu flutuante permanente e perfil individual do Potê Batata Pro. */
(function(){
"use strict";
if(window.__poteFloatingMenuLoaded)return;
window.__poteFloatingMenuLoaded=true;
const safe=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nav=[["home","Início"],["business","Negócio"],["orders","Pedidos e produção"],["recipes","Receitas e fichas"],["builder","Criar receita"],["ingredients","Estoque e compras"],["clients","Clientes"],["suppliers","Fornecedores"],["pricing","Precificação"],["expenses","Gastos e despesas"],["reports","Gráficos e relatórios"],["creative","Criativos"],["gallery","Galeria · 42h"],["brand","Minha marca"],["settings","Configurações e backup"]];
const icon='<svg viewBox="0 0 24 24" aria-hidden="true" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const avatar='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2c0-5 16-5 16 0v2"/></svg>';
const closeIcon='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const wrap=document.createElement('div');
wrap.id='poteFloatingRoot';
wrap.innerHTML=`
<button id="poteFloatToggle" type="button" aria-label="Abrir menu de opções" aria-expanded="false" aria-controls="poteFloatDrawer">${icon}</button>
<div id="poteFloatBackdrop" hidden></div>
<aside id="poteFloatDrawer" aria-label="Menu de navegação" aria-hidden="true" inert>
 <div class="pote-float-head"><div><small id="poteFloatBrand">GESTÃO PRO</small><strong>Menu de Operações</strong></div><button id="poteFloatClose" type="button" aria-label="Fechar menu">${closeIcon}</button></div>
 <button id="poteFloatProfile" class="pote-float-account" type="button"><span id="poteFloatAvatar">${avatar}</span><span><strong id="poteFloatName">Meu perfil</strong><small id="poteFloatEmail">Configurar nome e foto</small></span><span class="pote-float-chevron">›</span></button>
 <nav id="poteFloatNavigation"></nav>
 <div class="pote-float-foot"><button type="button" id="poteFloatSettings">⚙ Configurações e perfil</button><small>As informações de perfil pertencem à sua conta.</small></div>
</aside>
<div id="poteProfileOverlay" hidden role="dialog" aria-modal="true" aria-label="Editar perfil">
  <form id="poteProfileForm" class="pote-profile-card">
   <div class="pote-profile-head"><div><small>CONFIGURAÇÕES</small><h2>Meu perfil</h2></div><button type="button" id="poteProfileClose" aria-label="Fechar">${closeIcon}</button></div>
   <label class="pote-photo-input"><span id="poteProfilePreview">${avatar}</span><span>Alterar foto de perfil<small>JPG, PNG ou WebP · até 5 MB</small></span><input id="poteProfilePhoto" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
   <label class="pote-profile-label" for="poteProfileName">Nome de exibição<input id="poteProfileName" type="text" maxlength="65" placeholder="Como deseja aparecer no aplicativo" autocomplete="nickname"></label>
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
let opened=false,pendingPhoto=null;
function profile(){return (typeof state!=="undefined"&&state.data?.profile)||{}}
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
 $('poteFloatToggle').setAttribute('aria-expanded',String(opened));
 $('poteFloatToggle').setAttribute('aria-label',opened?'Fechar menu':'Abrir menu de opções');
 $('poteFloatToggle').innerHTML=opened?closeIcon:icon;
 if(opened)refresh();
}
function showProfile(open){
 $('poteProfileOverlay').hidden=!open;
 if(open){
  setOpen(false);pendingPhoto=null;const p=profile();
  $('poteProfileName').value=p.name||'';
  $('poteProfilePreview').innerHTML=p.photoData?'<img src="'+safe(p.photoData)+'" alt="Foto atual">':avatar;
  $('poteProfileIdentity').textContent='Conta: '+(window.POTE_AUTH?.email||'Faça login para salvar o perfil');
  $('poteProfilePhoto').value='';
  refreshProfileLicense();
  $('poteProfileName').focus();
 }
}
$('poteFloatNavigation').innerHTML=nav.map(([tab,title])=>'<button type="button" data-tab="'+tab+'"><span>'+safe(title)+'</span><span>›</span></button>').join('');
$('poteFloatToggle').addEventListener('click',()=>setOpen(!opened));
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
  pendingPhoto=canvas.toDataURL('image/jpeg',0.7);
  $('poteProfilePreview').innerHTML='<img src="'+pendingPhoto+'" alt="Prévia da foto">';
 }finally{URL.revokeObjectURL(url)}
 }catch(err){alert('Não foi possível ler essa imagem. Escolha outra foto.')}
});
$('poteProfileForm').addEventListener('submit',e=>{
 e.preventDefault();
 if(!window.POTE_AUTH?.uid){alert('Entre com sua conta Google para salvar seu perfil.');return}
 const name=$('poteProfileName').value.trim();
 if(!name){$('poteProfileName').focus();return}
 const current=profile();
 state.data.profile={...current,name,photoData:pendingPhoto||current.photoData||''};
 if(typeof persist==='function')persist();
 window.dispatchEvent(new Event('pote:changed'));
 refresh();showProfile(false);
 if(typeof toast==='function')toast('Perfil atualizado na sua conta');
});
window.addEventListener('pote:changed',refresh);
window.addEventListener('pote:license-updated',e=>refreshProfileLicense(e.detail));
const observer=new MutationObserver(()=>{if(!opened&&$('poteProfileOverlay').hidden)refresh()});
const page=document.getElementById('page');if(page)observer.observe(page,{childList:true});
refresh();
refreshProfileLicense();
})();
