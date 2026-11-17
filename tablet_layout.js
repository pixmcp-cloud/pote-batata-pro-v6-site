/* Correcoes visuais: recolher lateral, atalho de calculadora junto a Home. */
(function(){
 'use strict';
 if(window.__POTE_TABLET_LAYOUT_V1)return;
 window.__POTE_TABLET_LAYOUT_V1=true;
 const SIDEBAR_KEY='pote-sidebar-collapsed-v1';
 function calcLauncher(){
  const hero=document.querySelector('.hero');
  const home=document.getElementById('poteHomeShortcut');
  if(!hero||!home||hero.querySelector('#poteHeroCalculator'))return;
  let group=hero.querySelector('.pote-hero-actions');
  if(!group){
   group=document.createElement('div');group.className='pote-hero-actions';
   home.parentNode.insertBefore(group,home);group.appendChild(home);
  }
  const calc=home.cloneNode(true);
  calc.id='poteHeroCalculator';
  calc.setAttribute('aria-label','Abrir Potê Calc Quantum PRO');
  calc.setAttribute('title','Calculadora');
  calc.removeAttribute('onclick');
  calc.innerHTML='<svg width="43" height="43" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#f2c88a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5"/><rect x="8" y="5" width="8" height="4" rx=".6"/><path d="M8.5 12h1M12 12h1M15.5 12h1M8.5 15.5h1M12 15.5h1M15.5 15.5h1M8.5 19h1M12 19h4"/></svg><span class="home-hero-label">Calculadora</span>';
  calc.addEventListener('click',()=>{
   if(window.POTE_CALC?.open)window.POTE_CALC.open();
   else window.location.href='./pote_calc_quantum_99_fullscreen.html';
  });
  group.appendChild(calc);
 }
 function sidebarToggle(){
  const sidebar=document.querySelector('.layout>.sidebar');
  if(!sidebar||document.getElementById('poteSidebarToggle'))return;
  const button=document.createElement('button');button.id='poteSidebarToggle';
  button.type='button';button.className='pote-sidebar-toggle';
  button.setAttribute('aria-controls','navdesktop');
  button.setAttribute('title','Recolher ou expandir menu lateral');
  const read=()=>{try{return sessionStorage.getItem(SIDEBAR_KEY)==='1'}catch(e){return false}};
  function apply(closed){
   document.body.classList.toggle('pote-sidebar-collapsed',closed);
   button.setAttribute('aria-expanded',String(!closed));
   button.setAttribute('aria-label',closed?'Expandir menu lateral':'Recolher menu lateral');
   button.textContent=closed?'☰':'❮';
   try{sessionStorage.setItem(SIDEBAR_KEY,closed?'1':'0')}catch(e){}
  }
  button.addEventListener('click',()=>apply(!document.body.classList.contains('pote-sidebar-collapsed')));
  document.body.appendChild(button);apply(read());
 }
 function mount(){calcLauncher();sidebarToggle()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 document.addEventListener('pote-calc:closed',mount);
})();
