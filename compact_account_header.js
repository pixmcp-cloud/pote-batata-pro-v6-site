/* Move the existing session controls to profile; preserve handlers and sync state. */
(function(){
 'use strict';
 if(window.__POTE_COMPACT_ACCOUNT_HEADER)return;
 window.__POTE_COMPACT_ACCOUNT_HEADER=true;
 const $=id=>document.getElementById(id);
 function mount(){
  const header=document.querySelector('.headin');
  const switchEl=header?.querySelector('.switch');
  const profile=$('poteProfileForm');
  const actions=profile?.querySelector('.pote-profile-actions');
  if(!switchEl||!profile||!actions)return false;
  if(switchEl.parentElement===profile)return true;
  const section=document.createElement('section');
  section.className='pote-profile-session';
  section.id='poteProfileSession';
  section.setAttribute('aria-label','Conta e sincronização');
  const label=document.createElement('h3');
  label.textContent='Conta, backup e sincronização';
  section.appendChild(label);
  switchEl.classList.add('pote-profile-switch');
  switchEl.setAttribute('aria-label','Controles da sua conta');
  switchEl.querySelectorAll('button').forEach(button=>button.type='button');
  section.appendChild(switchEl);
  profile.insertBefore(section,actions);
  /* Cloud backups are inserted dynamically by Firebase into this same live element. */
  const observer=new MutationObserver(()=>{
   switchEl.querySelectorAll('button').forEach(button=>{if(button.type!=='button')button.type='button'});
  });
  observer.observe(switchEl,{childList:true,subtree:true});
  document.documentElement.classList.add('pote-account-in-profile');
  return true;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
