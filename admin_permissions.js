/* Controles por conta: universos acessíveis no FREE por padrão; bloqueio opcional do ADM.
   Nenhuma ação comercial/serviço pago é criada aqui. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {getAuth,getIdTokenResult} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,updateDoc,serverTimestamp,runTransaction} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
const auth=getAuth(app),db=getFirestore(app);
const types=[["batataria","Batataria"],["pizzaria","Pizzaria"],["hamburgueria","Hamburgueria"],
 ["hotdog","Hot Dog"],["lancheria","Lancheria"],["pastelaria","Pastelaria"]];
const services=[
 ["recipes","Receitas"],["ingredients","Ingredientes"],["orders","Vendas e pedidos"],
 ["clients","Clientes"],["suppliers","Fornecedores"],["expenses","Despesas"],
 ["stock","Compras e estoque"],["losses","Perdas"],["pricing","Precificação"],
 ["creatives","Criativos"],["reports","Relatórios"],["motoboy","Motoboy"],["deliveryhub","Hub de Delivery"]
];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const root=document.createElement("section");
root.id="poteAdmAccess";root.className="pote-adm-franchise pote-access-panel";
root.innerHTML='<h3>🔐 Permissões por universo e serviço</h3>'+
 '<p>FREE: todos os ramos abertos por padrão, mas somente um uso/cadastro por função. O ADM pode bloquear ramos ou serviços por conta sem apagar dados.</p>'+
 '<div class="pote-access-universes" id="poteAccessUniverses"></div>'+
 '<label class="pote-adm-label">Serviços do universo<select id="poteAccessType"></select></label>'+
 '<div class="pote-access-services" id="poteAccessServices"></div>'+
 '<h4>Locução IA premium · autorização independente</h4><p>FREE e teste gratuito não utilizam IA. PRO ativo, vitalício e franquia podem usar mediante créditos, salvo bloqueio individual pelo ADM. A licença comercial do provedor continua obrigatória.</p><button type="button" id="poteVoicePermission" class="pote-access-toggle is-locked" disabled>🔒 Locução IA bloqueada</button>'+
 '<section class="pote-adm-franchise"><h4>Carteira de créditos IA</h4><p>Saldo virtual não expira. Ajustes manuais registrados em histórico.</p><strong id="poteAiBalance">Selecione uma conta</strong><div class="pote-adm-label"><label>Quantidade<input id="poteAiAmount" type="number" min="1" max="1000000" step="1" inputmode="numeric"></label><label>Motivo<input id="poteAiReason" type="text" maxlength="180" placeholder="Ex.: cortesia autorizada"></label></div><div class="pote-adm-actions"><button type="button" id="poteAiAdd" disabled>Adicionar créditos</button><button type="button" id="poteAiRemove" disabled>Remover créditos</button></div><p id="poteAiStatus" role="status" aria-live="polite"></p></section>'+
 '<p id="poteAccessMessage" role="status" aria-live="polite">Selecione uma conta para alterar permissões.</p>';
const host=document.querySelector("#poteAdmOverlay .pote-adm-editor");
if(host)host.appendChild(root);
const universes=root.querySelector("#poteAccessUniverses"),serviceGrid=root.querySelector("#poteAccessServices"),
 selector=root.querySelector("#poteAccessType"),message=root.querySelector("#poteAccessMessage");
selector.innerHTML=types.map(([id,label])=>'<option value="'+id+'">'+esc(label)+'</option>').join("");
const voiceButton=root.querySelector('#poteVoicePermission');
let user=null,saving=false;
const voiceAllowed=u=>!!u&&u.accessPolicy?.voiceAiEnabled!==false;
const safeSet=v=>new Set(Array.isArray(v)?v.filter(x=>typeof x==="string"):[]);
function paint(){
 if(!universes||!serviceGrid)return;
 if(voiceButton){const granted=voiceAllowed(user);voiceButton.disabled=!user||saving;voiceButton.className='pote-access-toggle '+(granted?'is-open':'is-locked');voiceButton.textContent=granted?'🔓 IA sem bloqueio ADM — bloquear':'🔒 IA bloqueada pelo ADM — liberar';}
 if(!user){universes.innerHTML="";serviceGrid.innerHTML="";message.textContent="Selecione uma conta.";return}
 const self=user.uid===auth.currentUser?.uid,disabled=saving||self?"disabled":"";
 const policy=user.accessPolicy||{},blockedU=safeSet(policy.blockedUniverses),blockedS=safeSet(policy.blockedServices);
 universes.innerHTML=types.map(([type,label])=>{
  const blocked=blockedU.has(type),base=type==="batataria";
  return '<button type="button" data-universe-toggle="'+type+'" '+(base?"disabled":disabled)+
   ' class="pote-access-toggle '+(blocked?"is-locked":"is-open")+'">'+
   (blocked?"🔒 ":"🔓 ")+esc(label)+'<small>'+(base?"Ramo inicial sempre acessível":blocked?"Bloqueado":"Liberado · FREE limitado")+'</small></button>';
 }).join("");
 serviceGrid.innerHTML=services.map(([key,label])=>{
  const blocked=blockedS.has(selector.value+":"+key);
  return '<button type="button" data-service-toggle="'+key+'" '+disabled+
    ' class="pote-access-toggle '+(blocked?"is-locked":"is-open")+'">'+
    (blocked?"🔒 ":"🔓 ")+esc(label)+'<small>'+(blocked?"Bloqueado":"Liberado")+'</small></button>';
 }).join("");
 if(self)message.textContent="Conta ADM: a locução IA exige saldo e serviço comercial ativo.";
 else if(!saving)message.textContent="Selecione um cadeado para alterar o acesso desta conta.";
}
async function toggle(kind,key){
 if(saving||!user||user.uid===auth.currentUser?.uid)return;
 const type=kind==="universe"?key:selector.value;
 if(type==="batataria"&&kind==="universe")return;
 const listKind=kind==="universe"?"blockedUniverses":"blockedServices";
 const value=kind==="universe"?key:type+":"+key;
 const next=safeSet(user.accessPolicy?.[listKind]);
 const willBlock=!next.has(value);
 if(willBlock&&!confirm("Bloquear "+value+" para "+(user.email||user.uid)+"? Os dados existentes serão preservados."))return;
 saving=true;paint();message.textContent="Atualizando permissão no Firebase...";
 try{
  const actor=auth.currentUser;
  if(!actor||actor.email?.trim().toLowerCase()!=="pixmcp@gmail.com")throw Error("Somente o ADM pode alterar permissões");
  const verified=await getIdTokenResult(actor,true);
  if(!verified.claims.email_verified||verified.signInProvider!=="google.com"||verified.claims.potebatataAdmin!==true)throw Error("Conta Google ou permissão administrativa não verificada");
  const ref=doc(db,"users",user.uid),snapshot=await getDoc(ref);
  if(!snapshot.exists())throw Error("Conta não encontrada");
  if(snapshot.data().email?.toLowerCase()==="pixmcp@gmail.com")throw Error("ADM não pode ser bloqueado");
  const before=snapshot.data().accessPolicy||{};
  const blocked=safeSet(before[listKind]);
  if(blocked.has(value))blocked.delete(value);else blocked.add(value);
  // Preservar workerAuthoritative e quaisquer políticas futuras. Gravar
  // apenas o campo alterado, sem sobrescrever outras permissões simultâneas.
  const policy={...before,
    blockedUniverses:[...safeSet(before.blockedUniverses)],
    blockedServices:[...safeSet(before.blockedServices)]};
  policy[listKind]=[...blocked].sort();
  // Exclusão de Batataria do bloqueio geral é intencional.
  policy.blockedUniverses=policy.blockedUniverses.filter(x=>x!=="batataria");
  await updateDoc(ref,{[`accessPolicy.${listKind}`]:policy[listKind],
   updatedAt:serverTimestamp()});
  user.accessPolicy=policy;message.textContent=(willBlock?"Bloqueado: ":"Liberado: ")+value+". Dados preservados.";
 }catch(error){message.textContent="Não foi possível alterar: "+(error.code||error.message)}
 finally{saving=false;paint()}
}
universes?.addEventListener("click",event=>{const key=event.target.closest("[data-universe-toggle]")?.dataset.universeToggle;if(key)void toggle("universe",key)});
serviceGrid?.addEventListener("click",event=>{const key=event.target.closest("[data-service-toggle]")?.dataset.serviceToggle;if(key)void toggle("service",key)});
voiceButton?.addEventListener('click',async()=>{
 if(saving||!user)return;
 const uid=user.uid,actor=auth.currentUser,enable=!voiceAllowed(user);
 if(!actor||!confirm((enable?'Autorizar':'Bloquear')+' locução IA para '+(user.email||uid)+'?'))return;
 saving=true;paint();
 try{
  const token=await getIdTokenResult(actor,true);
  if(actor.email?.toLowerCase()!=='pixmcp@gmail.com'||token.claims.email_verified!==true||token.signInProvider!=='google.com'||token.claims.potebatataAdmin!==true||auth.currentUser?.uid!==actor.uid)throw Error('Somente ADM verificado');
  const ref=doc(db,'users',uid);
  await updateDoc(ref,{'accessPolicy.voiceAiEnabled':enable,'accessPolicy.voiceAiChangedAt':serverTimestamp(),'accessPolicy.voiceAiChangedBy':actor.uid,updatedAt:serverTimestamp()});
  if(user?.uid===uid)user.accessPolicy={...user.accessPolicy,voiceAiEnabled:enable};
  message.textContent=enable?'Autorização concedida. A licença comercial e o servidor continuam obrigatórios.':'Autorização revogada.';
 }catch(e){message.textContent='Falha: '+(e.code||e.message)}finally{saving=false;paint()}
});
selector?.addEventListener("change",paint);
const wBalance=root.querySelector('#poteAiBalance'),wAmount=root.querySelector('#poteAiAmount'),wReason=root.querySelector('#poteAiReason'),wStatus=root.querySelector('#poteAiStatus'),wAdd=root.querySelector('#poteAiAdd'),wRemove=root.querySelector('#poteAiRemove');
let wBusy=false,wReady=false,wSeq=0;
function wButtons(){wAdd.disabled=wRemove.disabled=!user||wBusy||!wReady;}
async function verifiedAdmin(){
 const actor=auth.currentUser;if(!actor||actor.email?.toLowerCase()!=='pixmcp@gmail.com')throw Error('Somente ADM');
 const token=await getIdTokenResult(actor,true);
 if(token.claims.email_verified!==true||token.signInProvider!=='google.com'||token.claims.potebatataAdmin!==true||auth.currentUser?.uid!==actor.uid)throw Error('ADM não verificado');
 return actor;
}
async function loadWallet(){
 const seq=++wSeq,uid=user?.uid;wReady=false;wButtons();wBalance.textContent=uid?'Consultando saldo...':'Selecione uma conta';wStatus.textContent='';
 if(!uid)return;
 try{await verifiedAdmin();const snap=await getDoc(doc(db,'users',uid,'aiWallet','main'));if(seq!==wSeq||user?.uid!==uid)return;const n=snap.exists()?snap.data().balance:0;if(!Number.isSafeInteger(n)||n<0)throw Error('Saldo inválido');wBalance.textContent=n.toLocaleString('pt-BR')+' créditos IA';wReady=true;}
 catch(e){if(seq===wSeq){wBalance.textContent='Carteira indisponível';wStatus.textContent=e.code||e.message;}}
 finally{if(seq===wSeq)wButtons();}
}
async function adjustWallet(sign){
 if(wBusy||!wReady||!user)return;
 const uid=user.uid,amount=Number(wAmount.value),reason=wReason.value.trim();
 if(!Number.isSafeInteger(amount)||amount<1||amount>1000000||reason.length<3||reason.length>180){wStatus.textContent='Informe quantidade inteira e motivo.';return;}
 if(!confirm((sign>0?'Adicionar ':'Remover ')+amount+' créditos IA para '+(user.email||uid)+'?'))return;
 wBusy=true;wButtons();const seq=wSeq;wStatus.textContent='Registrando ajuste...';
 try{
  const actor=await verifiedAdmin(),walletRef=doc(db,'users',uid,'aiWallet','main'),eventId=crypto.randomUUID(),eventRef=doc(db,'users',uid,'aiWallet','main','entries',eventId);
  const next=await runTransaction(db,async tx=>{
   const snap=await tx.get(walletRef),old=snap.exists()?snap.data().balance:0,delta=sign*amount,after=old+delta;
   if(!Number.isSafeInteger(old)||old<0||!Number.isSafeInteger(after)||after<0||after>100000000)throw Error('Saldo insuficiente ou inválido');
   tx.set(walletRef,{balance:after,lastEventId:eventId,updatedAt:serverTimestamp()});
   tx.set(eventRef,{kind:'admin_adjustment',before:old,after,delta,reason,actorUid:actor.uid,at:serverTimestamp()});
   return after;
  });
  if(seq===wSeq&&user?.uid===uid){wBalance.textContent=next.toLocaleString('pt-BR')+' créditos IA';wStatus.textContent='Ajuste registrado com sucesso.';wAmount.value='';wReason.value='';}
 }catch(e){if(seq===wSeq)wStatus.textContent='Não foi possível ajustar: '+(e.code||e.message);}
 finally{wBusy=false;wButtons();}
}
wAdd.addEventListener('click',()=>adjustWallet(1));wRemove.addEventListener('click',()=>adjustWallet(-1));
window.POTE_ADMIN_PERMISSIONS={renderAccount(account){const changed=user?.uid!==account?.uid;user=account||null;paint();if(changed)void loadWallet();},get state(){return {selected:user?.uid,saving}}};
