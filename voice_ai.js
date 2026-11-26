/* Locução IA: cliente sem credenciais do provedor, sem débito local.
 * Servidor autorizado deve fornecer status, orçamento e execução.
 * Sem endpoint comercial homologado: falha fechada. */
import {app} from "./firebase_app.mjs?v=init-20261120";
import {getAuth} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,doc,getDoc,collection,query,orderBy,limit,getDocs} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
let quote=null,busy=false,url=null,uid=null;
const endpoint=()=>{const p=window.POTE_AUTH,u=auth.currentUser;return window.location?.origin&&p?.uid===u?.uid&&p?.role==='admin'&&u?.email==='pixmcp@gmail.com'?'https://pote-batata-guard-staging.pixmcp.workers.dev/voice':null;}; // piloto ADM autenticado; clientes seguem sem consumo
function state(message){if($("csVoiceState"))$("csVoiceState").textContent=message;}
function renderQuota(q){
 const panel=$("csVoiceQuota");if(!panel)return;panel.hidden=!q;if(!q)return;
 const fmt=x=>Number(x).toLocaleString("pt-BR");
 $("csVoiceLimit").textContent=fmt(q.share);
 $("csVoiceRemaining").textContent=fmt(q.remaining);
 $("csVoiceUsed").textContent=fmt(q.used);
 $("csVoiceProgress").max=Math.max(1,q.share);$("csVoiceProgress").value=Math.min(q.share,q.used);
 $("csVoiceShare").textContent=q.count+" franquia(s) ativa(s) · "+(20/q.count).toLocaleString("pt-BR",{maximumFractionDigits:3})+"% da cota total por franquia. Limite coletivo: 20%.";
}
function renderChars(){
 const field=$("csVoiceText"),label=$("csVoiceChars"),seconds=Number($("csVoiceDuration")?.value||15);
 if(!field||!label)return;
 const cap=seconds*10;field.maxLength=cap;
 label.textContent=field.value.length+" / "+cap+" caracteres · "+seconds/15+" IA"+(field.value.length>cap?" · Reduza o texto ou escolha outra duração.":"");
}
function clear(){quote=null;uid=null;if($("csAiWallet"))$("csAiWallet").hidden=true;if($("csAiPackages"))$("csAiPackages").hidden=true;if($("csAiHistory")){$("csAiHistory").replaceChildren();$("csAiHistory").hidden=true;}renderQuota(null);if($("csVoiceAudio")){$("csVoiceAudio").pause();$("csVoiceAudio").removeAttribute("src");$("csVoiceAudio").hidden=true;}if($("csVoiceDownload")){$("csVoiceDownload").removeAttribute("href");$("csVoiceDownload").hidden=true;}if($("csVoiceForm"))$("csVoiceForm").hidden=true;if($("csVoiceGenerate"))$("csVoiceGenerate").disabled=true;if($("pvFileNamePanel"))$("pvFileNamePanel").hidden=true;if($("pvFileName"))$("pvFileName").value="";if(url)URL.revokeObjectURL(url);url=null;}
const permitted=()=>{
 const p=window.POTE_AUTH,flag=p?.accessPolicy?.voiceAiEnabled;
 if(!auth.currentUser||p?.uid!==auth.currentUser.uid||flag===false)return false;
 if(p.role==="admin"||p.franchiseActive===true)return true;
 return p.proActive===true&&(p.plan==="lifetime"||(p.plan==="pro"&&Number.isFinite(p.expiresAt)&&p.expiresAt>Date.now()));
};
const packages=Object.freeze([[5,990],[10,1790],[25,3990],[50,6990],[75,9490],[100,11990]].map(Object.freeze));
const brl=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function refreshWallet(){
 const user=auth.currentUser,root=$("csAiWallet"),label=$("csAiBalance"),status=$("csAiWalletStatus");
 if(!user||!root||!permitted())return;
 root.hidden=false;label.textContent="Consultando…";status.textContent="";
 try{
  const snap=await getDoc(doc(db,"users",user.uid,"aiWallet","main"));
  if(auth.currentUser?.uid!==user.uid||!permitted()||root!==$("csAiWallet"))return;
  const n=snap.exists()?snap.data().balance:0;
  if(!Number.isSafeInteger(n)||n<0)throw Error("Saldo inválido.");
  label.textContent=n.toLocaleString("pt-BR")+" créditos";
 }catch(e){if(auth.currentUser?.uid===user.uid&&root===$("csAiWallet")){label.textContent="Indisponível";status.textContent="Carteira aguardando publicação das regras ou sincronização.";}}
}
async function history(){
 const user=auth.currentUser,panel=$("csAiHistory");if(!user||!panel||!permitted())return;
 panel.hidden=!panel.hidden;if(panel.hidden)return;
 panel.textContent="Consultando histórico…";
 try{
  const data=await getDocs(query(collection(db,"users",user.uid,"aiWallet","main","entries"),orderBy("at","desc"),limit(30)));
  if(auth.currentUser?.uid!==user.uid||!permitted()||panel!==$("csAiHistory"))return;
  panel.replaceChildren();
  if(data.empty){panel.textContent="Nenhuma movimentação registrada.";return;}
  for(const entry of data.docs){
   const d=entry.data(),row=document.createElement("p");row.className="cs-voice-state";
   const date=d.at?.toDate?.();row.textContent=(date?date.toLocaleString("pt-BR"):"Data pendente")+" · "+(d.delta>0?"+":"")+d.delta+" créditos · "+String(d.reason||"Movimentação")+" · saldo "+d.after;
   panel.append(row);
  }
 }catch(e){if(panel===$("csAiHistory"))panel.textContent="Histórico indisponível.";}
}
function shop(){window.POTE_IA_UNIVERSE?.open();}
async function api(path,body){
 const user=auth.currentUser,root=endpoint();
 if(!permitted()||!root)throw Error("Locução indisponível: autorização e servidor comercial obrigatórios.");
 const token=await user.getIdToken();
 const res=await fetch(root+path,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body)});
 if(!res.ok){const d=await res.json().catch(()=>({}));throw Error(typeof d.error==="string"?d.error:"Servidor recusou a operação. Consulte o histórico.");}
 if(auth.currentUser?.uid!==user.uid||!permitted())throw Error("Conta ou autorização alterada.");
 return res;
}
// Dedicated studio opens independently of commercial provider availability.
const voiceConsole=document.createElement('dialog');
voiceConsole.id='poteVoiceConsole';voiceConsole.setAttribute('aria-labelledby','pvTitle');
voiceConsole.innerHTML=`<div class="pv-shell"><header class="pv-header"><button id="pvBack" type="button" aria-label="Voltar">‹</button><div><small>PDV MULTIVERSAL · AUDIO LAB</small><strong>VOICE STUDIO</strong></div><button id="pvWallet" type="button" aria-label="Abrir carteira IA COIN"><span id="pvBalance">—</span> IA COIN</button></header><section class="pv-intro"><small>ESTÚDIO PROFISSIONAL</small><h1 id="pvTitle">Sua marca. Sua voz.</h1><p>Produza chamadas, ofertas e anúncios falados com ElevenLabs.</p><div id="pvStatus" role="status" aria-live="polite"></div></section><div id="csVoiceForm" class="pv-layout"><main class="pv-editor"><div class="pv-panel"><div class="pv-line"><h2>01 · Roteiro</h2><button id="pvImport" type="button" class="pv-secondary">Importar criativo</button></div><textarea id="csVoiceText" maxlength="750" rows="9" placeholder="Digite o anúncio que será narrado..."></textarea><div class="pv-line"><small id="csVoiceChars">0 / 150 caracteres</small><button id="pvClear" type="button" class="pv-secondary">Limpar</button></div><p class="pv-hint">A pontuação e as quebras de frase ajudam a definir o ritmo. A duração é estimada.</p></div><div class="pv-panel"><h2>02 · Duração e orçamento</h2><div class="pv-tiers" id="pvTiers"></div><label class="pv-sr">Duração estimada<select id="csVoiceDuration"><option value="15">15 segundos</option><option value="30">30 segundos</option><option value="45">45 segundos</option><option value="60">60 segundos</option><option value="75">75 segundos</option></select></label><p id="csVoiceQuote" aria-live="polite">Selecione a duração e escreva o roteiro.</p></div></main><aside class="pv-panel pv-settings"><h2>03 · Configuração da voz</h2><label for="csVoiceSelect" hidden>Voz</label><select id="csVoiceSelect" hidden></select><details class="pv-voice-picker" id="pvVoicePicker"><summary><span id="pvVoicePickerLabel">Escolher voz</span></summary><div class="pv-voice-picker-tools"><button type="button" id="pvOnlyFavorites" class="pv-secondary" aria-pressed="false">Todas as vozes</button><small>Marque a estrela à esquerda para favoritar.</small></div><div id="pvVoiceList" class="pv-voice-list" role="group" aria-label="Escolher voz"></div></details><div class="pv-voice-meta"><strong id="pvVoiceName"></strong><p id="pvVoiceDescription"></p><small id="pvVoiceAvailability"></small><button id="pvPreviewPt" type="button" class="pv-secondary" disabled>Ouvir prévia em português</button><p class="pv-hint" id="pvPreviewText">Uma das 11 frases em português será sorteada na primeira demonstração de cada voz.</p><small id="pvPreviewStatus" role="status" aria-live="polite">Demonstração fixa · sem desconto de IA COIN.</small><audio id="pvVoiceSample" controls preload="none" hidden></audio></div><label>Modelo<select id="pvModel"><option value="eleven_flash_v2_5">Eleven Flash v2.5 · econômico</option></select></label><label>Idioma<select id="pvLanguage"><option value="pt">Português</option><option value="">Detecção automática</option><option value="en">Inglês</option><option value="es">Espanhol</option></select></label><div class="pv-presets"><small>Presets de configuração</small><div><button type="button" data-pv-preset="natural">Natural</button><button type="button" data-pv-preset="commercial">Comercial</button><button type="button" data-pv-preset="calm">Suave</button></div></div><div id="pvSliders"></div><label class="pv-check"><input type="checkbox" id="pvBoost" checked> Reforço de similaridade do locutor (Speaker Boost)</label><button class="pv-secondary" id="pvReset" type="button">Restaurar padrão</button><p class="pv-hint">Apenas opções do modelo configurado. Vozes e modelos adicionais dependem da licença e do catálogo autorizado.</p></aside><section class="pv-panel pv-clone" id="pvCloneAdmin" hidden><div class="pv-line"><h2>Vozes oficiais · ADM</h2><span>Exclusivo ADM</span></div><p class="pv-hint">Crie um clone autorizado e publique no catálogo do PDV. Os clientes elegíveis apenas utilizam a voz na locução.</p><label>Nome comercial<input id="pvCloneName" maxlength="65" placeholder="Ex.: Locutor oficial 01"></label><label>Descrição<input id="pvCloneDescription" maxlength="250" placeholder="Ex.: Voz brasileira para ofertas"></label><label>Amostra de voz (MP3, WAV, M4A, AAC ou OGG, até 8 MB)<input id="pvCloneFile" type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.acc,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg"></label><audio id="pvCloneSample" controls hidden></audio><p class="pv-hint">Recomendado: 1 a 2 minutos de fala limpa, uma pessoa, sem música.</p><label>Referência da autorização<input id="pvCloneConsentRef" maxlength="180" placeholder="Identificador do termo de autorização"></label><label class="pv-check"><input id="pvCloneConsent" type="checkbox"> Confirmo autorização expressa para clonagem e uso comercial da voz por clientes do PDV.</label><button id="pvCloneCreate" type="button" disabled>Criar clone oficial</button><p id="pvCloneStatus" role="status" aria-live="polite"></p><div class="pv-line"><h2>Biblioteca de vozes oficiais</h2><button type="button" class="pv-secondary" id="pvCloneReload">Atualizar</button></div><div id="pvCloneList"></div></section><section class="pv-panel pv-output"><div class="pv-line"><h2>04 · Áudio final</h2><span>MP3 · 44,1 kHz / 128 kbps</span></div><div id="pvWave" aria-hidden="true"></div><p id="pvOutputHint">O áudio aparecerá aqui após geração confirmada.</p><audio id="csVoiceAudio" controls hidden></audio><div id="pvFileNamePanel" class="pv-file-name" hidden><label for="pvFileName">Nome do áudio</label><input id="pvFileName" type="text" maxlength="100" placeholder="Ex.: Oferta do dia" autocomplete="off"><small id="pvFileNamePreview">Arquivo: locucao-pdv.mp3</small></div><a id="csVoiceDownload" download="locucao-pdv.mp3" hidden>Baixar MP3</a></section></div><footer class="pv-footer"><p id="pvActionStatus" role="status" aria-live="polite" style="grid-column:1/-1;margin:0;font-size:11px;overflow-wrap:anywhere;color:#e3d2ac"></p><div><small>Custo da modalidade</small><strong id="pvCost">1 IA COIN</strong></div><button type="button" id="csVoicePrice" disabled>Validar orçamento</button><button type="button" id="csVoiceGenerate" disabled>Gerar áudio</button></footer></div>`;
document.body.append(voiceConsole);
const voiceSettingsSpec=[['stability','Estabilidade',0,1,.01,.5,'Menor: mais variação · maior: mais constante'],['similarity_boost','Similaridade',0,1,.01,.75,'Fidelidade à voz original'],['style','Exagero de estilo',0,1,.01,0,'Intensidade da interpretação'],['speed','Velocidade',.7,1.2,.01,1,'Mais lenta ou mais rápida']];
$('pvSliders').innerHTML=voiceSettingsSpec.map(([key,label,min,max,step,value,hint])=>'<label class="pv-slider"><span>'+label+' <output id="pvOut_'+key+'">'+value.toFixed(2)+'</output></span><input id="pv_'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><small>'+hint+'</small></label>').join('');
$('pvTiers').innerHTML=[15,30,45,60,75].map(n=>'<button type="button" data-pv-seconds="'+n+'"><b>'+n+' s</b><small>'+n/15+' IA COIN</small></button>').join('');
$('pvWave').innerHTML=Array.from({length:44},(_,i)=>'<i style="height:'+(8+Math.round(25*Math.abs(Math.sin(i*1.7)*Math.cos(i*.29))))+'px"></i>').join('');
// Official Infinity replacements; references only until commercial status approves the voice.
// Source: https://elevenlabs.io/docs/pt/help-center/product/voices/my-voices/what-are-default-voices
const infinityCatalog=Object.freeze([["gOupLcAkjEnguROwi4oS","Darian","Narração acolhedora"],["OZ0L6eISlOejga3XjDFt","Talia","Tom suave e acolhedor"],["WQP7cQUF5aAS6Axh5yaa","Elara","Narração profissional"],["6WwXjDDEMyNmFG95zycZ","Eldrin","Barítono britânico"],["dvbL7qkNGZY1IqPGZAjM","Elowen","Narração animada"],["ktkP7Nsj67dw2zcplQYt","Lawrence","Tom claro e informativo"],["BFd5oBc2DDna33pSi4Gf","Alicia","Apresentação sofisticada"],["QtY3JBOUKEB5xzrRfOKc","Maisie","Tom amigável"],["7QN34D2r3hCNwbOYIeK0","Warren","Estilo natural"],["g7LVvkPWALzPxOQbF6OE","Jade","Interpretação animada"],["l7kNoIfnJKPg7779LI2t","Eddie","Tom natural"],["AaOhDHYJ1XLZk74lXhdE","Caleb","Tom confiável"],["fnYMz3F5gMEDGMWcH1ex","Finley","Apresentação articulada"],["22N9cF8z0o7y23njdyaY","Florence","Narração atmosférica"],["FrS6cKLB1wg4WYgPa9GW","Wyatt","Tom experiente"]].map(([id,name,description])=>Object.freeze({id,name,description})));
let displayedVoices=[],authorizedVoiceIds=new Set();
function voicePreviewUrl(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)return null;
 const host=u.hostname.toLowerCase();return host==='storage.googleapis.com'&&u.pathname.startsWith('/eleven-public-')||host==='eleven-public-cdn.elevenlabs.io'||host.endsWith('.elevenlabs.io')?u.href:null;}catch{return null;}
}
let previewObjectUrl=null,previewSequence=0,previewBusy=false;
let favoritesOnly=false;
const favoriteKey=uid=>'pote.voiceFavorites.v1.'+uid;
function readVoiceFavorites(){try{const owner=auth.currentUser?.uid;if(!owner)return new Set();const data=JSON.parse(window.localStorage?.getItem(favoriteKey(owner))||'[]');return new Set(Array.isArray(data)?data.filter(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id)):[]);}catch{return new Set();}}
let voiceFavorites=new Set();
function toggleVoiceFavorite(id){if(!auth.currentUser?.uid||!displayedVoices.some(v=>v.id===id))return;const next=new Set(voiceFavorites);if(next.has(id))next.delete(id);else next.add(id);voiceFavorites=next;try{window.localStorage?.setItem(favoriteKey(auth.currentUser.uid),JSON.stringify([...next]));}catch{}renderVoiceList();}
function orderedVoices(){return [...displayedVoices].sort((a,b)=>Number(voiceFavorites.has(b.id))-Number(voiceFavorites.has(a.id)));}
function renderVoiceList(){
 const list=$('pvVoiceList');list.replaceChildren();
 const selected=$('csVoiceSelect').value,chosen=displayedVoices.find(v=>v.id===selected);
 $('pvVoicePickerLabel').textContent=chosen?(voiceFavorites.has(chosen.id)?'★ ':'')+chosen.name:'Escolher voz';
 $('pvOnlyFavorites').setAttribute('aria-pressed',String(favoritesOnly));$('pvOnlyFavorites').textContent=favoritesOnly?'★ Favoritos':'Todas as vozes';
 const items=orderedVoices().filter(v=>!favoritesOnly||voiceFavorites.has(v.id));
 if(!items.length){const empty=document.createElement('p');empty.textContent='Nenhuma voz favorita. Marque uma estrela na lista de vozes.';list.append(empty);return;}
 for(const v of items){const row=document.createElement('div');row.className='pv-voice-row';const star=document.createElement('button');star.type='button';star.className='pv-favorite-star';star.textContent=voiceFavorites.has(v.id)?'★':'☆';star.setAttribute('aria-pressed',String(voiceFavorites.has(v.id)));star.setAttribute('aria-label',(voiceFavorites.has(v.id)?'Remover dos favoritos: ':'Adicionar aos favoritos: ')+v.name);star.onclick=()=>toggleVoiceFavorite(v.id);
 const choice=document.createElement('button');choice.type='button';choice.className='pv-voice-choice';choice.textContent=v.name;choice.setAttribute('aria-pressed',String(v.id===selected));choice.onclick=()=>{if($('csVoiceSelect').value!==v.id){$('csVoiceSelect').value=v.id;renderSelectedVoice();invalidate();}else renderVoiceList();$('pvVoicePicker').open=false;};row.append(star,choice);list.append(row);}
}
$('pvOnlyFavorites').onclick=()=>{favoritesOnly=!favoritesOnly;renderVoiceList();};
function resetPortuguesePreview(){
 ++previewSequence;
 const sample=$('pvVoiceSample');sample.pause();sample.removeAttribute('src');sample.hidden=true;
 if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=null;
 $('pvPreviewStatus').textContent='Demonstração fixa · sem desconto de IA COIN.';$('pvPreviewText').textContent='Uma das 11 frases em português será sorteada na primeira demonstração de cada voz.';
}
function renderSelectedVoice(){
 const selected=displayedVoices.find(v=>v.id===$('csVoiceSelect').value);
 resetPortuguesePreview();
 $('pvVoiceName').textContent=selected?.name||'Escolha uma voz';
 $('pvVoiceDescription').textContent=selected?.description||'';
 const ready=!!selected&&authorizedVoiceIds.has(selected.id);
 $('pvVoiceAvailability').textContent=ready?'Liberada pelo servidor':'Referência oficial · disponibilidade comercial ainda não confirmada';
 $('pvPreviewPt').disabled=!ready||previewBusy;renderVoiceList();
}
$('pvPreviewPt').onclick=async()=>{
 if(previewBusy||!permitted()||!voiceConsole.open)return;
 const id=$('csVoiceSelect').value,actor=auth.currentUser?.uid,seq=previewSequence;
 if(!authorizedVoiceIds.has(id))return;
 const sample=$('pvVoiceSample'),status=$('pvPreviewStatus');
 if(previewObjectUrl&&!sample.hidden){void sample.play().catch(()=>{});return;}
 previewBusy=true;$('pvPreviewPt').disabled=true;status.textContent='Preparando ou recuperando demonstração em português…';
 try{
  const res=await api('/preview',{voiceId:id});
  if(!res.headers.get('content-type')?.startsWith('audio/mpeg'))throw Error('Amostra indisponível.');
  const blob=await res.blob();
  if(seq!==previewSequence||actor!==auth.currentUser?.uid||!voiceConsole.open||!permitted())return;
  if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl=URL.createObjectURL(blob);sample.src=previewObjectUrl;sample.hidden=false;
  const phrase=res.headers.get('X-Voice-Preview-Text');if(phrase){try{$('pvPreviewText').textContent=decodeURIComponent(phrase);}catch{}}status.textContent='Prévia em português · nenhum IA COIN debitado.';
  void sample.play().catch(()=>{});
 }catch(e){if(seq===previewSequence)status.textContent=e.message;}
 finally{previewBusy=false;$('pvPreviewPt').disabled=!authorizedVoiceIds.has($('csVoiceSelect').value)||!voiceConsole.open||!permitted();}
};
function voiceDescriptionPt(v){
 if(v.name==='Pablo Marshal')return 'Voz masculina de meia-idade, com sotaque mexicano. Locução bastante entusiasmada, com leve ceceio ocasional.';
 if(v.officialClone===true&&typeof v.description==='string')return v.description.slice(0,250)||'Voz oficial personalizada.';
 const labels=v.labels||{},gender={male:'Masculina',female:'Feminina',neutral:'Neutra'}[String(labels.gender||'').toLowerCase()],age={young:'Jovem',middle_aged:'Meia-idade','middle-aged':'Meia-idade',old:'Madura'}[String(labels.age||'').toLowerCase()],accent={brazilian:'Brasileiro',brazil:'Brasileiro',portuguese:'Português',american:'Americano',british:'Britânico',mexican:'Mexicano',australian:'Australiano',indian:'Indiano',spanish:'Espanhol',french:'Francês',german:'Alemão',italian:'Italiano'}[String(labels.accent||'').toLowerCase()];
 return [gender&&'Voz '+gender.toLowerCase(),age,accent&&'Sotaque '+accent.toLowerCase()].filter(Boolean).join(' · ')||'Voz disponível na sua conta ElevenLabs. Ouça a demonstração em português para avaliar o timbre e o sotaque.';
}
function loadVoiceCatalog(live=[]){
 const select=$('csVoiceSelect'),previous=select.value;
 const refs=new Map(infinityCatalog.map(v=>[v.id,v]));authorizedVoiceIds=new Set();
 for(const v of live){
  if(!v||typeof v.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(v.id)||typeof v.name!=='string')continue;
  authorizedVoiceIds.add(v.id);refs.set(v.id,{...refs.get(v.id),id:v.id,name:v.name,description:voiceDescriptionPt(v),previewUrl:v.previewUrl});
 }
 displayedVoices=[...refs.values()].filter(v=>authorizedVoiceIds.size===0||authorizedVoiceIds.has(v.id));
 select.replaceChildren(...displayedVoices.map(v=>new Option(v.name+' — '+(v.description||'Voz do catálogo')+(authorizedVoiceIds.has(v.id)?'':' · referência'),v.id)));
 select.value=displayedVoices.some(v=>v.id===previous)?previous:displayedVoices[0]?.id||'';
 renderSelectedVoice();
}
let consoleReady=false,consoleSeq=0,draftOwner=null;
const cloneMime=file=>({mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',acc:'audio/aac',ogg:'audio/ogg'})[String(file?.name||'').split('.').at(-1).toLowerCase()]||null;
let cloneBusy=false,cloneSampleUrl=null,cloneRequestId=null,cloneEpoch=0;
const cloneAdmin=()=>{const p=window.POTE_AUTH,user=auth.currentUser;return permitted()&&!!user&&p?.uid===user.uid&&p.role==='admin'&&user.email?.toLowerCase()==='pixmcp@gmail.com';};
function cloneStatus(message){$('pvCloneStatus').textContent=message;}
function resetCloneDraft(){
 ++cloneEpoch;cloneRequestId=null;
 if(cloneSampleUrl)URL.revokeObjectURL(cloneSampleUrl);cloneSampleUrl=null;
 const player=$('pvCloneSample');player.pause();player.removeAttribute('src');player.hidden=true;
 for(const id of ['pvCloneName','pvCloneDescription','pvCloneFile','pvCloneConsentRef'])$(id).value='';
 $('pvCloneConsent').checked=false;$('pvCloneList').replaceChildren();cloneStatus('');
}
async function refreshClones(){
 const epoch=cloneEpoch,actor=auth.currentUser?.uid;
 $('pvCloneAdmin').hidden=!cloneAdmin();$('pvCloneCreate').disabled=true;
 if(!cloneAdmin())return;
 if(!endpoint()){cloneStatus('Área preparada. A clonagem e publicação dependem do servidor e do plano comercial ElevenLabs.');return;}
 try{
  const result=await(await api('/admin/clone/list',{})).json();
  if(epoch!==cloneEpoch||auth.currentUser?.uid!==actor||!cloneAdmin())return;
  $('pvCloneList').replaceChildren();
  for(const v of result.voices||[]){
   const row=document.createElement('div');row.className='pv-clone-row';
   const label=document.createElement('div');label.textContent=v.name+' · '+({published:'Publicada',draft:'Rascunho',verification_required:'Verificação pendente'}[v.state]||v.state);
   const btn=document.createElement('button');btn.type='button';btn.textContent=v.state==='published'?'Retirar do catálogo':'Publicar para clientes';
   btn.disabled=v.state==='verification_required'||(v.state!=='published'&&!result.sharedCloneApproved);
   btn.onclick=async()=>{if(cloneBusy||!cloneAdmin()||!confirm(btn.textContent+' — '+v.name+'?'))return;cloneBusy=true;btn.disabled=true;try{await api('/admin/clone/publish',{voiceId:v.id,publish:v.state!=='published'});if(epoch===cloneEpoch)cloneStatus('Catálogo atualizado. Reabra o estúdio para sincronizar.');}catch(e){if(epoch===cloneEpoch)cloneStatus(e.message);}finally{cloneBusy=false;if(epoch===cloneEpoch)void refreshClones();}};
   row.append(label,btn);$('pvCloneList').append(row);
  }
  $('pvCloneCreate').disabled=!result.cloneApproved||cloneBusy;
  if(!result.cloneApproved)cloneStatus('Clonagem comercial ainda não habilitada.');else if(!$('pvCloneStatus').textContent)cloneStatus('Clonagem habilitada no ADM. Vozes verificadas podem ser usadas no estúdio.');
 }catch(e){if(epoch===cloneEpoch)cloneStatus(e.message);}
}
$('pvCloneFile').addEventListener('change',()=>{
 if(cloneSampleUrl)URL.revokeObjectURL(cloneSampleUrl);cloneSampleUrl=null;cloneRequestId=null;
 const file=$('pvCloneFile').files?.[0],player=$('pvCloneSample');player.pause();player.hidden=true;player.removeAttribute('src');
 if(file&&file.size<=8*1024*1024&&cloneMime(file)){cloneSampleUrl=URL.createObjectURL(file);player.src=cloneSampleUrl;player.hidden=false;}else if(file)cloneStatus('Selecione MP3, WAV, M4A, AAC ou OGG de até 8 MB.');
});
for(const id of ['pvCloneName','pvCloneDescription','pvCloneConsentRef','pvCloneConsent'])$(id).addEventListener('input',()=>{if(!cloneBusy)cloneRequestId=null;});
$('pvCloneReload').onclick=refreshClones;
$('pvCloneCreate').onclick=async()=>{
 if(cloneBusy||!cloneAdmin()||!endpoint())return;
 const file=$('pvCloneFile').files?.[0],name=$('pvCloneName').value.trim(),description=$('pvCloneDescription').value.trim(),consentRef=$('pvCloneConsentRef').value.trim();
 if(!file||file.size>8*1024*1024||!cloneMime(file)||name.length<3||consentRef.length<5||!$('pvCloneConsent').checked)return cloneStatus('Preencha nome, arquivo e autorização expressa.');
 if(!confirm('Criar clone oficial? A amostra será enviada à ElevenLabs. Nenhuma publicação automática.'))return;
 const epoch=cloneEpoch,actor=auth.currentUser.uid;
 cloneBusy=true;cloneRequestId=cloneRequestId||crypto.randomUUID();$('pvCloneCreate').disabled=true;
 for(const id of ['pvCloneName','pvCloneDescription','pvCloneFile','pvCloneConsentRef','pvCloneConsent'])$(id).disabled=true;
 try{
  const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
  if(epoch!==cloneEpoch||auth.currentUser?.uid!==actor||!cloneAdmin())return;
  const result=await(await api('/admin/clone/create',{requestId:cloneRequestId,name,description,consentRef,consent:true,mime:cloneMime(file),audio:encoded})).json();
  if(epoch!==cloneEpoch||auth.currentUser?.uid!==actor)return;
  resetCloneDraft();cloneStatus(result.state==='verification_required'?'Clone exige verificação no provedor; não será publicado.':'Clone criado. Reabra o estúdio para utilizá-lo no ADM. Publicação aos lojistas ainda em homologação.');
 }catch(e){if(epoch===cloneEpoch)cloneStatus('Não foi possível confirmar a clonagem. Consulte o histórico antes de repetir. '+(e.message||''));}
 finally{cloneBusy=false;for(const id of ['pvCloneName','pvCloneDescription','pvCloneFile','pvCloneConsentRef','pvCloneConsent'])$(id).disabled=false;if(auth.currentUser?.uid===actor&&cloneAdmin())void refreshClones();}
};

function studioStatus(message){$('pvStatus').textContent=message;const footer=$('pvActionStatus');if(footer)footer.textContent=message;state(message);}
function settings(){return Object.fromEntries([...voiceSettingsSpec.map(([key])=>[key,Number($('pv_'+key).value)]),['use_speaker_boost',$('pvBoost').checked]]);}
function options(){return {modelId:$('pvModel').value,languageCode:$('pvLanguage').value||null,voiceSettings:settings()};}
function canStartVoice(){const text=$('csVoiceText').value.trim(),seconds=Number($('csVoiceDuration').value);return consoleReady&&!busy&&authorizedVoiceIds.has($('csVoiceSelect').value)&&!!text&&[15,30,45,60,75].includes(seconds)&&text.length<=seconds*10;}
function invalidate(){quote=null;$('csVoiceGenerate').disabled=!canStartVoice();$('csVoicePrice').disabled=!canStartVoice();renderChars();const n=Number($('csVoiceDuration').value);$('pvCost').textContent=n/15+' IA COIN';$('pvTiers').querySelectorAll('[data-pv-seconds]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.pvSeconds)===n)));for(const [key] of voiceSettingsSpec)$('pvOut_'+key).textContent=Number($('pv_'+key).value).toFixed(2);$('csVoiceQuote').textContent='Custo previsto: '+n/15+' IA COIN · '+n*10+' caracteres. Validação no servidor obrigatória.';}
function applyPreset(vals){for(const [key,,,,,def] of voiceSettingsSpec)$('pv_'+key).value=String(vals[key]??def);$('pvBoost').checked=true;invalidate();}
// A name is local download metadata: no new provider request or IA COIN debit.
function voiceFileName(value){
 let stem=String(value||'').normalize('NFC').trim().replace(/(?:\.mp3)+$/gi,'').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'-').replace(/\s+/g,' ').replace(/^[.\s]+|[.\s]+$/g,'').slice(0,100).trim();
 if(!stem)stem='locucao-pdv';
 if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(stem))stem='locucao-'+stem;
 return stem+'.mp3';
}
function syncVoiceFileName(){
 const name=voiceFileName($('pvFileName').value);
 $('csVoiceDownload').download=name;$('pvFileNamePreview').textContent='Arquivo: '+name;
 return name;
}
$('pvFileName').addEventListener('input',syncVoiceFileName);
$('csVoiceDownload').addEventListener('click',e=>{
 if(!url||!permitted()||auth.currentUser?.uid!==draftOwner){e.preventDefault();return;}
 syncVoiceFileName();
});
function importCreative(){const value=['creativeHeadline','creativeBody','creativeCta'].map(id=>$(id)?.value||'').filter(Boolean).join('. ').slice(0,750);$('csVoiceText').value=value;$('csVoiceDuration').value=String(Math.min(75,Math.max(15,Math.ceil(value.length/150)*15)));invalidate();}
$('pvImport').onclick=importCreative;$('pvClear').onclick=()=>{$('csVoiceText').value='';invalidate();};
$('pvBack').onclick=()=>{if(!busy&&!cloneBusy)voiceConsole.close();};
$('pvWallet').onclick=()=>{if(!busy&&!cloneBusy){voiceConsole.close();shop();}};
$('pvReset').onclick=()=>applyPreset({});
voiceConsole.addEventListener('click',e=>{const tier=e.target.closest('[data-pv-seconds]'),preset=e.target.closest('[data-pv-preset]');if(tier){$('csVoiceDuration').value=tier.dataset.pvSeconds;invalidate();}if(preset){const p={natural:{},commercial:{stability:.45,similarity_boost:.8,style:.25,speed:1.05},calm:{stability:.7,similarity_boost:.75,style:.05,speed:.85}};applyPreset(p[preset.dataset.pvPreset]||{});}});
for(const id of ['csVoiceText','csVoiceSelect','csVoiceDuration','pvModel','pvLanguage','pvBoost',...voiceSettingsSpec.map(([key])=>'pv_'+key)])$(id).addEventListener('input',invalidate);
$('csVoiceSelect').addEventListener('change',()=>{renderSelectedVoice();invalidate();});
$('csVoicePrice').onclick=price;$('csVoiceGenerate').onclick=generate;
voiceConsole.addEventListener('cancel',e=>{if(busy||cloneBusy)e.preventDefault();});
voiceConsole.addEventListener('close',()=>{resetPortuguesePreview();$('pvCloneSample').pause();++consoleSeq;quote=null;consoleReady=false;$('csVoiceGenerate').disabled=true;});
async function consoleBalance(user,seq){try{const snap=await getDoc(doc(db,'users',user.uid,'aiWallet','main'));if(seq!==consoleSeq||auth.currentUser?.uid!==user.uid||!voiceConsole.open)return;const n=snap.exists()?snap.data().balance:0;$('pvBalance').textContent=Number.isSafeInteger(n)&&n>=0?n.toLocaleString('pt-BR'):'—';}catch{if(seq===consoleSeq)$('pvBalance').textContent='—';}}
async function open(){
 if(busy)return;
 if(!permitted())return state('IA exclusiva para PRO ativo, vitalício e franquias. FREE e teste gratuito não podem usar IA. Bloqueios do ADM continuam válidos.');
 const user=auth.currentUser,seq=++consoleSeq;consoleReady=false;quote=null;uid=user.uid;
 if(draftOwner!==uid){resetCloneDraft();clear();uid=user.uid;draftOwner=uid;voiceFavorites=readVoiceFavorites();favoritesOnly=false;$('pvOutputHint').textContent='O áudio aparecerá aqui após geração confirmada.';importCreative();applyPreset({});}
 $('csVoiceForm').hidden=false;$('pvBalance').textContent='—';loadVoiceCatalog();
 if(!voiceConsole.open)voiceConsole.showModal();invalidate();void consoleBalance(user,seq);void refreshWallet();void refreshClones();
 if(!endpoint()){studioStatus('Modo preparação · editor disponível. As vozes Infinity são referências oficiais. A síntese e o orçamento final aguardam servidor e licença comercial ElevenLabs. Nenhuma IA COIN será debitada.');return;}
 studioStatus('Consultando serviço autorizado…');
 try{
  const data=await(await api('/status',{})).json();
  if(seq!==consoleSeq||auth.currentUser?.uid!==user.uid||!voiceConsole.open)return;
  if(data.commercialReady!==true||data.authorized!==true)throw Error('Serviço comercial indisponível.');
  const voices=Array.isArray(data.voices)?data.voices:[];
  loadVoiceCatalog(voices);
  consoleReady=authorizedVoiceIds.size>0;renderQuota(data.franchiseAllocation);invalidate();
  studioStatus(consoleReady?(data.pilot?'Piloto ADM conectado · geração real. Toque em Gerar áudio para validar o custo e confirmar.':'Catálogo autorizado conectado. Valide o orçamento antes de gerar.'):'Nenhuma voz autorizada disponível.');
 }catch(e){if(seq===consoleSeq)studioStatus(e.message);}
}
function allocationText(q){return q?" Sua cota: "+q.share+" créditos do provedor · usados/reservados: "+q.used+" · disponíveis: "+q.remaining+" · "+q.count+" franquias ativas.":"";}
async function price(){
 if(busy||!consoleReady||!voiceConsole.open||!authorizedVoiceIds.has($("csVoiceSelect").value))return;busy=true;quote=null;$("csVoiceGenerate").disabled=true;$("csVoicePrice").disabled=true;
 try{
  const text=$("csVoiceText").value.trim(),voiceId=$("csVoiceSelect").value;
  const seconds=Number($("csVoiceDuration").value);
  if(![15,30,45,60,75].includes(seconds)||!text||text.length>seconds*10)throw Error("Ajuste o texto ao limite da duração escolhida.");
  const opts=options(),seq=consoleSeq;
  const data=await(await api("/quote",{text,voiceId,seconds,...opts})).json();
  if(seq!==consoleSeq||!voiceConsole.open||JSON.stringify(opts)!==JSON.stringify(options())||text!==$("csVoiceText").value.trim()||voiceId!==$("csVoiceSelect").value||seconds!==Number($("csVoiceDuration").value))return;
  if(!Number.isSafeInteger(data.credits)||data.credits!==seconds/15||data.seconds!==seconds||typeof data.quoteId!=="string")throw Error("Orçamento inválido.");
  quote={id:data.quoteId,credits:data.credits,text,voiceId,seconds,opts};renderQuota(data.franchiseAllocation);
  $("csVoiceQuote").textContent="Custo: "+data.credits+" créditos IA · saldo: "+data.balance+allocationText(data.franchiseAllocation);
  $("csVoiceGenerate").disabled=data.balance<data.credits;if(data.balance<data.credits){quote=null;if($("csAiWallet"))$("csAiWallet").hidden=false;studioStatus("Saldo insuficiente. Consulte os pacotes na carteira IA.");return null;}return quote;
 }catch(e){studioStatus(e.message);return null;}finally{busy=false;$("csVoicePrice").disabled=!canStartVoice();$("csVoiceGenerate").disabled=!canStartVoice();}
}
async function generate(){
 if(!canStartVoice()||auth.currentUser?.uid!==uid||!permitted())return;
 const startSeq=consoleSeq,startActor=auth.currentUser.uid;
 const q=quote||await price();if(!q||startSeq!==consoleSeq||auth.currentUser?.uid!==startActor||!permitted()||!voiceConsole.open||busy)return;
 const seq=consoleSeq,actor=auth.currentUser.uid; if(q.text!==$("csVoiceText").value.trim()||q.voiceId!==$("csVoiceSelect").value||q.seconds!==Number($("csVoiceDuration").value)||JSON.stringify(q.opts)!==JSON.stringify(options()))return;
 if(!confirm("Consumir "+q.credits+" IA para a locução de "+q.seconds+" segundos estimados?"))return;
 busy=true;quote=null;$("csVoiceGenerate").disabled=true;$("csVoicePrice").disabled=true;
 try{
  const res=await api("/generate",{quoteId:q.id});
  if(!res.headers.get("content-type")?.startsWith("audio/mpeg"))throw Error("Resposta não contém MP3.");
  const blob=await res.blob();if(seq!==consoleSeq||auth.currentUser?.uid!==actor||!permitted()||!voiceConsole.open)return;
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);
  $("csVoiceAudio").src=url;$("csVoiceAudio").hidden=false;
  if(!$("pvFileName").value.trim())$("pvFileName").value=q.text.split(/[.!?\n]/)[0].trim().slice(0,80)||'Locução PDV';
  $("pvFileNamePanel").hidden=false;syncVoiceFileName();
  $("csVoiceDownload").href=url;$("csVoiceDownload").hidden=false;
  studioStatus("Locução pronta. Dê um nome ao áudio e baixe o MP3.");$("pvOutputHint").textContent="Áudio gerado nesta sessão. Renomear não consome IA COIN.";renderQuota(null);void consoleBalance(auth.currentUser,consoleSeq);void refreshWallet();
 }catch(e){if(seq===consoleSeq&&auth.currentUser?.uid===actor)studioStatus(e.message+" Consulte o histórico antes de tentar novamente.")}finally{busy=false;if(seq===consoleSeq)invalidate();}
}
window.POTE_VOICE_AI={open,shop,history};
window.addEventListener("pote:profile-updated",()=>{if(!permitted()){voiceFavorites=new Set();favoritesOnly=false;consoleReady=false;draftOwner=null;resetCloneDraft();++consoleSeq;if(voiceConsole.open)voiceConsole.close();$("csVoiceText").value="";clear();state("IA bloqueada: confira seu plano ou permissão ADM.");}});
window.addEventListener("pote:user-logout",()=>{voiceFavorites=new Set();favoritesOnly=false;draftOwner=null;consoleReady=false;resetCloneDraft();++consoleSeq;if(voiceConsole.open)voiceConsole.close();$("csVoiceText").value="";clear();});

/* IA Universe: isolated full-screen wallet, no simulated credit or payment. */
const universe=document.createElement('dialog');
universe.id='poteAiUniverse';
universe.setAttribute('aria-labelledby','poteAiUniverseTitle');
universe.innerHTML=`
 <div class="iau-shell">
  <header class="iau-header"><button class="iau-back iau-orb" type="button" data-iau-close aria-label="Voltar ao PDV"><span>IA</span></button><span class="iau-brand"><strong>PDV</strong><small>MULTIVERSAL</small></span><button class="iau-back iau-close" type="button" data-iau-close aria-label="Fechar carteira">×</button></header>
  <section class="iau-hero"><h1 id="poteAiUniverseTitle"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 9V7l15-5 2 6M4 9h18a3 3 0 0 1 3 3v12H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Zm21 5h-7a3 3 0 0 0 0 6h7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg> Carteira <span>IA COIN</span></h1><p>Sua moeda para usar os recursos de IA</p></section>
  <div id="iauGate" role="status"></div>
  <div id="iauContent" hidden>
   <section class="iau-wallet"><div id="iauWalletArt" aria-hidden="true"></div><div class="iau-wallet-info"><small>Saldo disponível</small><div class="iau-balance-line"><strong id="iauBalance">—</strong><span>IA COIN</span></div><div class="iau-wallet-actions"><button type="button" id="iauBuyScroll">Comprar IA COIN</button><button type="button" id="iauHistoryBtn">Histórico</button><button type="button" id="iauRefresh" class="iau-refresh" aria-label="Atualizar saldo">↻</button></div></div></section><section class="iau-rules"><strong>ⓘ FREE não usa IA</strong><span>Acesso à IA disponível para <b>PRO, Vitalício e Franquia</b></span></section>
   <section id="iauHistory" hidden aria-label="Extrato de créditos"></section>
   <section class="iau-store" id="iauStore"><h2><span aria-hidden="true">▱</span> Loja de IA COIN</h2><p>Escolha um pacote e abasteça sua carteira IA COIN</p><div class="iau-grid" id="iauPackages"></div><div id="iauPurchase" role="status" hidden></div></section>
   <section class="iau-services"><h2>Seu poder criativo</h2><button type="button" id="iauVoice">Locução profissional <span>›</span></button><p>Chef IA e imagens: integração de consumo em preparação.</p></section>
  </div>
  <footer class="iau-footer">IA COIN · Uso interno · Não transferível · Sem conversão em dinheiro</footer>
 </div>`;
document.body.append(universe);
const u=id=>universe.querySelector('#'+id);
// Original vector artwork: ridged gold edge, holographic face and stacked coins.
const coin=(tier,prefix='pack'+tier)=>{
 const n=[1,2,3,5,7,10][tier],id='iau-'+prefix;
 const stack=Array.from({length:n-1},(_,j)=>{
  const x=47+(j%3)*34,y=104-Math.floor(j/3)*13;
  return '<g transform="translate('+x+' '+y+')"><ellipse cy="7" rx="27" ry="10" fill="url(#'+id+'-edge)" stroke="#d9a34b"/><rect x="-27" y="0" width="54" height="8" fill="url(#'+id+'-edge)"/><ellipse rx="27" ry="10" fill="url(#'+id+'-face)" stroke="#ffe2a2" stroke-width="1.8"/><ellipse rx="21" ry="7" fill="none" stroke="#e078ff" opacity=".75"/></g>';
 }).join('');
 return '<svg class="iau-coin-art" viewBox="0 0 180 132" aria-hidden="true"><defs><linearGradient id="'+id+'-edge"><stop stop-color="#663507"/><stop offset=".23" stop-color="#f4cb73"/><stop offset=".43" stop-color="#7f420e"/><stop offset=".65" stop-color="#ffdc83"/><stop offset="1" stop-color="#7b3c19"/></linearGradient><radialGradient id="'+id+'-face" cx=".28" cy=".22" r=".86"><stop stop-color="#765df4"/><stop offset=".42" stop-color="#251651"/><stop offset=".8" stop-color="#130c2d"/><stop offset="1" stop-color="#30267b"/></radialGradient><linearGradient id="'+id+'-rim" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#00e8ff"/><stop offset=".35" stop-color="#9868ff"/><stop offset=".65" stop-color="#f853ed"/><stop offset="1" stop-color="#ffd789"/></linearGradient></defs><ellipse cx="90" cy="116" rx="69" ry="9" fill="none" stroke="#00deff" opacity=".52"/>'+stack+'<g transform="translate('+ (n===1?90:109)+' 63) rotate(-17)"><ellipse cx="5" cy="5" rx="38" ry="48" fill="url(#'+id+'-edge)" stroke="#f8d27b" stroke-width="2"/><ellipse rx="38" ry="48" fill="url(#'+id+'-face)" stroke="#ffe19a" stroke-width="3"/><ellipse rx="33" ry="43" fill="none" stroke="url(#'+id+'-rim)" stroke-width="5"/><ellipse rx="28" ry="37" fill="none" stroke="#b79dff" stroke-dasharray="1 5" stroke-width="2"/><ellipse rx="23" ry="31" fill="none" stroke="#9774e2" opacity=".5"/><text y="9" text-anchor="middle" fill="#f7d8ff" stroke="#c490ff" stroke-width=".6" font-family="system-ui,sans-serif" font-size="29" font-weight="900">IA</text><path d="M-24 -31Q-10 -45 6 -43" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g></svg>';
};
u('iauWalletArt').innerHTML=coin(3,'wallet');
u('iauPackages').innerHTML=packages.map(([amount,cents],i)=>'<article class="iau-pack" data-tier="'+i+'"><div class="iau-coins">'+coin(i)+'</div><div class="iau-amount"><strong>'+amount+'</strong> <span>IA COIN</span></div><b>'+brl(cents)+'</b><button type="button" data-package="'+i+'"><span aria-hidden="true">＋</span> Comprar</button></article>').join('');
u('iauBuyScroll').addEventListener('click',()=>{if(permitted())u('iauStore').scrollIntoView({block:'start'});});
const isOwnAdmin=()=>{const p=window.POTE_AUTH,user=auth.currentUser;return !!user&&p?.uid===user.uid&&p.role==='admin'&&user.email?.toLowerCase()==='pixmcp@gmail.com';};
const creditDialog=document.createElement('dialog');
creditDialog.id='iauAdminCredit';creditDialog.setAttribute('aria-labelledby','iauAdminCreditTitle');
creditDialog.innerHTML='<h2 id="iauAdminCreditTitle">Adicionar IA COIN</h2><p id="iauCreditPrompt"></p><div id="iauCreditQtyRow" class="iau-quantity"><button type="button" id="iauCreditMinus" aria-label="Diminuir quantidade">−</button><label>Pacotes<input id="iauCreditQty" type="number" min="1" max="99" step="1" inputmode="numeric" value="1"></label><button type="button" id="iauCreditPlus" aria-label="Aumentar quantidade">+</button></div><strong id="iauCreditTotal"></strong><p id="iauCreditStatus" role="status" aria-live="polite"></p><div class="iau-credit-actions"><button type="button" id="iauCreditCancel">Cancelar</button><button type="button" id="iauCreditConfirm">Adicionar saldo</button></div>';
document.body.append(creditDialog);
const cd=id=>creditDialog.querySelector('#'+id);
let selectedCredit=null,creditBusy=false;
function closeCredit(){if(creditBusy)return;if(creditDialog.open)creditDialog.close();selectedCredit=null;}
cd('iauCreditCancel').addEventListener('click',closeCredit);
creditDialog.addEventListener('cancel',e=>{if(creditBusy)e.preventDefault();else selectedCredit=null;});
function showCredit(amount,cents){
 if(creditBusy||!permitted()||!auth.currentUser)return;
 const admin=isOwnAdmin();
 selectedCredit={amount,cents,quantity:1,admin,uid:auth.currentUser.uid,eventId:crypto.randomUUID()};
 cd('iauAdminCreditTitle').textContent=admin?'Adicionar IA COIN':'Carrinho IA COIN';
 cd('iauCreditPrompt').textContent=admin?'Adicionar saldo à sua própria conta ADM? Sem cobrança real.':'Escolha quantos pacotes deseja comprar.';
 cd('iauCreditQty').value='1';cd('iauCreditQtyRow').hidden=false;
 renderCreditQuantity();
 cd('iauCreditStatus').textContent='';cd('iauCreditConfirm').disabled=false;cd('iauCreditConfirm').textContent=admin?'Adicionar saldo':'Continuar compra';cd('iauCreditCancel').disabled=false;cd('iauCreditCancel').textContent='Cancelar';
 if(!creditDialog.open)creditDialog.showModal();
}
function renderCreditQuantity(){
 const s=selectedCredit;if(!s)return;
 const q=Number(cd('iauCreditQty').value),valid=Number.isSafeInteger(q)&&q>=1&&q<=99;
 cd('iauCreditConfirm').disabled=!valid||creditBusy;
 cd('iauCreditMinus').disabled=creditBusy||!valid||q<=1;
 cd('iauCreditPlus').disabled=creditBusy||!valid||q>=99;
 if(!valid){cd('iauCreditTotal').textContent='Informe de 1 a 99 pacotes.';return;}
 if(s.quantity!==q){s.quantity=q;s.eventId=crypto.randomUUID();}
 cd('iauCreditTotal').textContent=q+' × '+s.amount+' = '+(q*s.amount)+' IA COIN'+(s.admin?' · Sem cobrança': ' · Total '+brl(s.cents*q));
}
cd('iauCreditQty').addEventListener('input',renderCreditQuantity);
for(const [id,delta] of [['iauCreditMinus',-1],['iauCreditPlus',1]])cd(id).addEventListener('click',()=>{
 if(creditBusy||!selectedCredit)return;
 cd('iauCreditQty').value=String(Math.min(99,Math.max(1,Number(cd('iauCreditQty').value||1)+delta)));renderCreditQuantity();
});
cd('iauCreditConfirm').addEventListener('click',async()=>{
 const selected=selectedCredit;if(creditBusy||!selected||!permitted()||auth.currentUser?.uid!==selected.uid||!Number.isSafeInteger(selected.quantity)||selected.quantity<1||selected.quantity>99)return;
 if(!selected.admin){cd('iauCreditStatus').textContent='Checkout PIX ainda não homologado. Nenhum pagamento ou crédito foi registrado.';return;}
 if(!isOwnAdmin())return;
 creditBusy=true;cd('iauCreditQtyRow').hidden=true;cd('iauCreditConfirm').disabled=true;cd('iauCreditCancel').disabled=true;cd('iauCreditStatus').textContent='Registrando saldo…';
 try{
  const api=window.POTE_ADMIN_PERMISSIONS;if(!api?.addOwnWalletPackage)throw Error('Módulo ADM indisponível. Atualize a página.');
  const next=await api.addOwnWalletPackage(selected.amount,selected.eventId,selected.uid,selected.quantity);
  if(auth.currentUser?.uid!==selected.uid||!isOwnAdmin())return;
  cd('iauCreditStatus').textContent='Adicionado com sucesso! Novo saldo: '+next.toLocaleString('pt-BR')+' IA COIN.';
  cd('iauCreditCancel').textContent='Fechar';selectedCredit=null;
  if(universe.open)await universeRefresh();
  void refreshWallet();
 }catch(e){
  if(auth.currentUser?.uid===selected.uid&&isOwnAdmin()){
   cd('iauCreditStatus').textContent=e.code==='permission-denied'?'O Firebase recusou o ajuste. Verifique as permissões da carteira e a autorização ADM. Nenhum saldo foi confirmado.':'Não foi possível confirmar o ajuste: '+(e.code||e.message)+'. Você pode tentar novamente sem duplicar o crédito.';
   cd('iauCreditConfirm').disabled=false;cd('iauCreditConfirm').textContent='Tentar novamente';
  }
 }finally{creditBusy=false;cd('iauCreditCancel').disabled=false;if(auth.currentUser?.uid!==selected.uid)closeCredit();}
});
let universeSeq=0;
async function universeRefresh(){
 const seq=++universeSeq,user=auth.currentUser;
 const allowed=permitted();u('iauPackages').querySelectorAll('[data-package]').forEach(b=>{b.textContent=isOwnAdmin()?'+ Adicionar':'+ Comprar';});u('iauContent').hidden=!allowed;u('iauGate').hidden=allowed;
 u('iauGate').textContent=allowed?'':'Acesso exclusivo aos planos PRO ativo, Vitalício e Franquia. FREE e teste gratuito não compram nem utilizam IA. Seu saldo anterior permanece preservado.';
 u('iauBalance').textContent='—';u('iauHistory').replaceChildren();u('iauHistory').hidden=true;u('iauPurchase').hidden=true;
 if(!allowed||!user)return;
 try{
  const snap=await getDoc(doc(db,'users',user.uid,'aiWallet','main'));
  if(seq!==universeSeq||!universe.open||auth.currentUser?.uid!==user.uid||!permitted())return;
  const balance=snap.exists()?snap.data().balance:0;if(!Number.isSafeInteger(balance)||balance<0)throw Error('Saldo inválido');
  u('iauBalance').textContent=balance.toLocaleString('pt-BR');
 }catch{if(seq===universeSeq&&universe.open)u('iauBalance').textContent='Indisponível';}
}
function closeUniverse(){if(universe.open)universe.close();}
function openUniverse(){
 if(!auth.currentUser||!window.POTE_APP_READY)return;
 if(!universe.open)universe.showModal();
 void universeRefresh();window.dispatchEvent(new Event('pote:ia-universe-state'));
}
universe.addEventListener('close',()=>{++universeSeq;u('iauBalance').textContent='—';u('iauHistory').replaceChildren();u('iauPurchase').hidden=true;window.dispatchEvent(new Event('pote:ia-universe-state'));});
universe.querySelectorAll('[data-iau-close]').forEach(b=>b.addEventListener('click',closeUniverse));
u('iauRefresh').addEventListener('click',universeRefresh);
u('iauPackages').addEventListener('click',e=>{
 const b=e.target.closest('[data-package]');if(!b||!permitted())return;
 const pack=packages[Number(b.dataset.package)];if(!pack)return;
 showCredit(pack[0],pack[1]);
});
u('iauHistoryBtn').addEventListener('click',async()=>{
 const user=auth.currentUser,panel=u('iauHistory');if(!user||!permitted())return;
 panel.hidden=!panel.hidden;if(panel.hidden)return;
 const seq=universeSeq;panel.textContent='Consultando extrato…';
 try{
  const snap=await getDocs(query(collection(db,'users',user.uid,'aiWallet','main','entries'),orderBy('at','desc'),limit(30)));
  if(seq!==universeSeq||!universe.open||auth.currentUser?.uid!==user.uid||!permitted())return;
  panel.replaceChildren();
  if(snap.empty)panel.textContent='Nenhuma movimentação.';
  for(const entry of snap.docs){const d=entry.data(),row=document.createElement('p');row.textContent=(d.delta>0?'+':'')+d.delta+' IA COIN · '+String(d.reason||'Movimentação')+' · saldo '+d.after;panel.append(row);}
 }catch{if(seq===universeSeq)panel.textContent='Extrato indisponível.';}
});
u('iauVoice').addEventListener('click',()=>{if(!permitted())return;closeUniverse();void open();});
window.POTE_IA_UNIVERSE={open:openUniverse,close:closeUniverse,isOpen:()=>universe.open};
window.addEventListener('pote:user-logout',()=>{if(creditDialog.open)creditDialog.close();selectedCredit=null;closeUniverse();});
for(const name of ['pote:license-updated','pote:profile-updated'])window.addEventListener(name,()=>{if(universe.open)void universeRefresh();});
window.dispatchEvent(new Event('pote:ia-universe-ready'));
