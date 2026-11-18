/* Potê Calc Quantum PRO: independent UI integration. Does not touch orders, stock or Firestore. */
(function(){
'use strict';
if(window.__POTE_CALC_LAUNCHER_V1)return;
window.__POTE_CALC_LAUNCHER_V1=true;
const ICON='<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="3"/><path d="M8 6h8v4H8zM8 14h1M12 14h1M16 14h1M8 18h1M12 18h1M16 18h1"/></svg>';
const LINK_ID='poteCalcOverlay';
let overlay=null,frame=null,open=false,previousFocus=null,previousOverflow='',inited=false;
const isAuthenticated=()=>!!window.POTE_AUTH?.uid && (document.getElementById('poteAuthGate')?.hidden!==false);
function createOverlay(){
 if(overlay)return;
 overlay=document.createElement('div');overlay.id=LINK_ID;overlay.hidden=true;
 overlay.innerHTML='<div class="pote-calc-backdrop" data-calc-dismiss="1"></div><div class="pote-calc-modal" role="dialog" aria-modal="true" aria-label="Potê Calc Quantum PRO"><iframe id="poteCalcFrame" title="Potê Calc Quantum PRO: calculadora 3D científica" allow="fullscreen; clipboard-write" allowfullscreen referrerpolicy="same-origin"></iframe><button type="button" class="pote-calc-exit" aria-label="Fechar calculadora" title="Fechar a calculadora">×</button></div>';
 document.body.appendChild(overlay);
 frame=overlay.querySelector('#poteCalcFrame');
 overlay.querySelector('[data-calc-dismiss]').addEventListener('click',closeCalc);
 overlay.querySelector('.pote-calc-exit').addEventListener('click',closeCalc);
}
function openCalc(){
 if(!isAuthenticated()){window.alert('Entre com a sua conta Google para abrir a calculadora.');return false;}
 createOverlay();
 if(open)return true;
 if(!frame.getAttribute('src'))frame.src='./pote_calc_quantum_99_fullscreen.html?v=live-result-20261118';
 const drawer=document.getElementById('poteFloatDrawer');
 if(drawer?.classList.contains('is-open'))document.getElementById('poteFloatClose')?.click();
 previousFocus=document.activeElement;
 previousOverflow=document.body.style.overflow;
 overlay.hidden=false;document.body.style.overflow='hidden';
 open=true;
 overlay.querySelector('.pote-calc-exit').focus({preventScroll:true});
 document.dispatchEvent(new CustomEvent('pote-calc:opened'));
 return true;
}
function closeCalc(){
 if(!open)return;
 if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 try{frame?.contentWindow?.postMessage({type:'pote-calc:close-request'},location.origin==='null'?'*':location.origin)}catch(e){}
 overlay.classList.remove('pote-calc-expanded');
 overlay.hidden=true;document.body.style.overflow=previousOverflow;
 open=false;
 try{previousFocus?.focus?.({preventScroll:true})}catch(e){}
 document.dispatchEvent(new CustomEvent('pote-calc:closed'));
}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin || e.source!==frame?.contentWindow || !e.data || typeof e.data.type!=='string')return;
 if(e.data.type==='pote-calc:close')closeCalc();
 if(e.data.type==='pote-calc:fullscreen')overlay?.classList.toggle('pote-calc-expanded',!!e.data.expanded);
});
document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'&&!document.fullscreenElement){e.preventDefault();closeCalc();}});
function launcherButton(kind){
 const b=document.createElement('button');
 b.type='button';b.dataset.poteCalcLauncher='1';
 b.className=kind==='float'?'pote-calc-float-nav':'navbtn pote-calc-nav';
 b.innerHTML=kind==='float'?'<span>'+ICON+'</span><strong>Calculadora</strong><span aria-hidden="true">›</span>':'<span class="pote-calc-icon">'+ICON+'</span> Calculadora';
 b.title='Abrir Potê Calc Quantum PRO';
 b.setAttribute('aria-label','Calculadora — abrir Potê Calc Quantum PRO');
 b.addEventListener('click',openCalc);
 return b;
}
function ensureInNav(id){
 const el=document.getElementById(id);
 if(!el||el.querySelector('[data-pote-calc-launcher]'))return;
 const buttons=Array.from(el.querySelectorAll('button'));
 const home=buttons.find(b=>b.dataset.tab==='home'||/go\(['"]home['"]\)/.test(b.getAttribute('onclick')||'')||/^(?:\s|[\u2302-\u23FF])*Home\s*$/i.test(b.textContent.trim()));
 if(!home)return;
 home.insertAdjacentElement('afterend',launcherButton(id==='poteFloatNavigation'?'float':'standard'));
}
function init(){
 if(inited)return;
 inited=true;
 createOverlay();
 for(const id of ['navdesktop','navmobile','poteFloatNavigation']){
  const element=document.getElementById(id);
  if(!element)continue;
  ensureInNav(id);
  const observer=new MutationObserver(()=>ensureInNav(id));
  observer.observe(element,{childList:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.POTE_CALC={open:openCalc,close:closeCalc};
})();
