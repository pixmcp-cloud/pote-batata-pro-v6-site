/* Navigation animation: only when the actual page changes, never on stock/order updates. */
(function(){
 'use strict';
 if(window.__POTE_PREMIUM_MOTION)return;
 window.__POTE_PREMIUM_MOTION=true;
 function mount(){
  const page=document.getElementById('page');
  const title=document.getElementById('pageTitle');
  if(!page||!title||typeof MutationObserver==='undefined')return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let lastTitle=title.textContent.trim(),scheduled=false;
  const observer=new MutationObserver(()=>{
   const now=title.textContent.trim();
   if(!now||now===lastTitle)return;
   lastTitle=now;
   if(reduced?.matches||scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{
    scheduled=false;
    page.classList.remove('pote-motion-enter');
    void page.offsetWidth;
    page.classList.add('pote-motion-enter');
   });
  });
  observer.observe(page,{childList:true});
  page.addEventListener('animationend',event=>{
   if(event.target===page&&event.animationName==='pote-page-in')page.classList.remove('pote-motion-enter');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
