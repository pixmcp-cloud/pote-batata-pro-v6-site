/* Stable top navigation: Home and Calc, profile-only admin actions. */
(function(){
 'use strict';
 if(window.__POTE_TOP_NAV_V1)return;
 window.__POTE_TOP_NAV_V1=true;
 function setup(){
  const header=document.querySelector('.headin');
  const home=document.getElementById('poteHomeShortcut');
  if(!header||!home)return false;
  let toolbar=document.getElementById('poteTopActions');
  if(!toolbar){
   toolbar=document.createElement('nav');
   toolbar.id='poteTopActions';
   toolbar.className='pote-top-actions';
   toolbar.setAttribute('aria-label','Acesso rápido');
   header.appendChild(toolbar);
  }
  if(home.parentElement!==toolbar)toolbar.appendChild(home);
  let calc=document.getElementById('poteHeroCalculator');
  if(!calc){
   calc=document.createElement('button');
   calc.type='button';
   calc.id='poteHeroCalculator';
   calc.className=home.className;
   calc.setAttribute('aria-label','Abrir calculadora');
   calc.innerHTML='<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.5"/><rect x="8" y="5" width="8" height="4"/><path d="M8.5 12h1M12 12h1M15.5 12h1M8.5 15.5h1M12 15.5h1M15.5 15.5h1"/></svg><span class="home-hero-label">Calculadora</span>';
   calc.addEventListener('click',()=>window.POTE_CALC?.open?.());
  }
  if(calc.parentElement!==toolbar)toolbar.appendChild(calc);
  /* Menu access to admin is removed from general navigation, but retained in
     profile behind the existing authenticated administrative permission check. */
  const hideAdminLinks=()=>{
   for(const id of ['navdesktop','navmobile','poteFloatNavigation']){
    document.getElementById(id)?.querySelectorAll('[data-tab="admin"]').forEach(el=>{
     el.hidden=true;
     el.setAttribute('aria-hidden','true');
     el.tabIndex=-1;
    });
   }
  };
  hideAdminLinks();
  for(const id of ['navdesktop','navmobile','poteFloatNavigation']){
   const root=document.getElementById(id);
   if(root&& !root.dataset.poteAdminHidden){
    root.dataset.poteAdminHidden='1';
    new MutationObserver(hideAdminLinks).observe(root,{childList:true});
   }
  }
  document.documentElement.classList.add('pote-top-nav-ready');
  return true;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
 window.addEventListener('pote:changed',setup);
})();
