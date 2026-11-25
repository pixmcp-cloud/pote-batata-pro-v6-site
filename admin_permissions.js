/* Controles por conta: universos acessíveis no FREE por padrão; bloqueio opcional do ADM.
   Nenhuma ação comercial/serviço pago é criada aqui. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {getAuth,getIdTokenResult} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
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
 '<h4>Locução IA premium · autorização independente</h4><p>Bloqueada por padrão para FREE e PRO. Franquias ativas têm liberação automática e cota de 20% do total dividida igualmente entre todas as franquias ativas, salvo bloqueio do ADM. Liberar uma conta não ativa cobrança nem substitui a licença comercial do provedor.</p><button type="button" id="poteVoicePermission" class="pote-access-toggle is-locked" disabled>🔒 Locução IA bloqueada</button>'+
 '<p id="poteAccessMessage" role="status" aria-live="polite">Selecione uma conta para alterar permissões.</p>';
const host=document.querySelector("#poteAdmOverlay .pote-adm-editor");
if(host)host.appendChild(root);
const universes=root.querySelector("#poteAccessUniverses"),serviceGrid=root.querySelector("#poteAccessServices"),
 selector=root.querySelector("#poteAccessType"),message=root.querySelector("#poteAccessMessage");
selector.innerHTML=types.map(([id,label])=>'<option value="'+id+'">'+esc(label)+'</option>').join("");
const voiceButton=root.querySelector('#poteVoicePermission');
let user=null,saving=false;
const voiceAllowed=u=>u?.accessPolicy?.voiceAiEnabled===true||(u?.accessPolicy?.voiceAiEnabled!==false&&u?.franchise?.status==='active'&&u.franchise.brandId==='potebatata');
const safeSet=v=>new Set(Array.isArray(v)?v.filter(x=>typeof x==="string"):[]);
function paint(){
 if(!universes||!serviceGrid)return;
 if(voiceButton){const granted=voiceAllowed(user);voiceButton.disabled=!user||saving;voiceButton.className='pote-access-toggle '+(granted?'is-open':'is-locked');voiceButton.textContent=granted?'🔓 Locução IA autorizada — bloquear':'🔒 Locução IA bloqueada — autorizar';}
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
 if(self)message.textContent="Conta ADM: a locução IA também exige autorização explícita.";
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
window.POTE_ADMIN_PERMISSIONS={renderAccount(account){user=account||null;paint()},get state(){return {selected:user?.uid,saving}}};
