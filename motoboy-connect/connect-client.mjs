export const endpoint="https://pote-batata-guard-staging.pixmcp.workers.dev/v1/motoboy-connect";
export const quickMessages={address:"Não estou encontrando o endereço.",reference:"Tem um ponto de referência?",color:"Qual a cor da casa?",gate:"Qual o portão ou entrada correta?",building:"Qual o bloco ou apartamento?",arriving:"Estou chegando. Pode me aguardar na entrada?",delay:"Tive um imprevisto no trajeto. Avisarei assim que possível."};
export async function connectCall(token,input){
 const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.ok!==true)throw Error(result?.message||"Motoboy Connect indisponível.");
 return result.job;
}
export function mapLink(position){return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(position.lat+","+position.lng)}
export function navigationLink(address){return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(address)+"&travelmode=driving"}
export function inviteLink(id){const url=new URL("../motoboy-connect/",import.meta.url);url.hash=id;return url.href}
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
const link=(label,url)=>{const a=el("a",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a};
export function makeConnectPanel({role,token,id,onClose,container}){
 let currentId=id,job=null,timer=null,watch=null,closed=false,busy=false,lastSend=0,polling=false,generation=0;
 const root=container||el("section");root.classList.add("connect-panel");
 const title=el("h2","MOTOBOY CONNECT"),status=el("p","Consultando entrega…"),details=el("p"),map=el("div"),chat=el("div"),actions=el("div"),notice=el("p");
 status.setAttribute("role","status");notice.setAttribute("role","status");map.className="connect-map";chat.className="connect-chat";actions.className="connect-actions";
 root.replaceChildren(title,status,details,map,chat,actions,notice);
 const btn=(label,fn)=>{const b=el("button",label);b.type="button";b.onclick=fn;return b};
 const riderMode=role==="courier";
 let gpsSample=null,gpsAt=0,gpsConsent=false,gpsProblem="Ative a localização precisa para trabalhar.",gpsTimer=null,gpsGeneration=0;
 const gpsBox=el("section"),gpsText=el("strong"),gpsHelp=el("p"),gpsEnable=btn("Ativar GPS obrigatório",()=>{gpsConsent=true;startGPS()});
 gpsBox.className="connect-gps-gate";gpsText.setAttribute("role","status");gpsBox.append(gpsText,gpsHelp,gpsEnable);gpsBox.hidden=!riderMode;root.insertBefore(gpsBox,map);
 const gpsFresh=()=>Boolean(gpsSample&&Date.now()-gpsAt<=45000&&navigator.onLine!==false);
 function updateGate(){
  if(!riderMode)return;
  const active=Boolean(job?.active),valid=gpsFresh();
  gpsBox.hidden=!active;
  gpsBox.dataset.ready=String(valid);
  gpsText.textContent=valid?"● GPS ATIVO":"● GPS OBRIGATÓRIO";
  gpsHelp.textContent=valid?"Localização autorizada. Mantenha a página aberta durante a entrega.":gpsProblem;
  gpsEnable.hidden=valid;
  chat.hidden=actions.hidden=active&&!valid;
  details.hidden=active&&!valid;
  if(!active){chat.hidden=false;actions.hidden=false;details.hidden=false;}
 }
 let renderSignature="",mapSignature="",mapEnabled=false,frame=null,position=null;
 const mapStage=el("div"),mapInfo=el("p"),mapControls=el("div");
 mapStage.className="connect-map-stage";mapControls.className="connect-map-controls";mapInfo.className="connect-map-info";
 const fullscreen=el("dialog");fullscreen.className="connect-map-fullscreen";fullscreen.setAttribute("aria-label","Mapa do motoboy em tela cheia");
 const fullHead=el("header"),fullTitle=el("strong","Trajeto do motoboy"),fullInfo=el("span");
 const fullClose=btn("×",()=>collapseMap());fullClose.setAttribute("aria-label","Fechar mapa em tela cheia");fullClose.className="connect-map-close";
 fullHead.append(fullTitle,fullInfo,fullClose);fullscreen.append(fullHead);if(!riderMode)document.body.append(fullscreen);
 const expand=btn("⛶ Tela cheia",()=>{if(!position||!frame||closed||fullscreen.open)return;fullscreen.showModal();moveStage(fullscreen);fullClose.focus()});expand.className="connect-map-expand";
 const enable=btn("Visualizar mapa nesta janela",()=>{mapEnabled=true;paintMap(position)});
 const outside=link("Abrir localização no mapa","#");
 const moveStage=parent=>{if(mapStage.parentNode===parent)return;if(typeof parent.moveBefore==="function"){try{parent.moveBefore(mapStage,null);return}catch{}}parent.append(mapStage)};
 function collapseMap(){if(fullscreen.open)fullscreen.close();moveStage(map);if(expand.isConnected&&!expand.hidden)expand.focus({preventScroll:true})}
 fullscreen.addEventListener("cancel",event=>{event.preventDefault();collapseMap()});
 fullscreen.addEventListener("close",()=>{if(!closed&&!fullscreen.open)moveStage(map)});
 map.append(mapInfo,mapControls,mapStage);mapControls.append(enable,expand,outside);
 function paintMap(p){
  if(riderMode){map.hidden=true;return}
  position=p;
  if(!p){if(fullscreen.open)collapseMap();frame?.remove();frame=null;mapStage.hidden=true;mapControls.hidden=true;mapInfo.textContent="Sem localização recente. O GPS depende da autorização e da página aberta do motoboy.";fullInfo.textContent="";return}
  mapControls.hidden=false;mapInfo.textContent="Última localização: "+new Date(p.at).toLocaleTimeString("pt-BR")+" · precisão "+p.accuracy+" m";fullInfo.textContent=mapInfo.textContent;
  outside.href=mapLink(p);enable.hidden=mapEnabled;expand.hidden=!mapEnabled;mapStage.hidden=!mapEnabled;
  if(!mapEnabled)return;
  if(!frame){frame=el("iframe");frame.title="Posição mais recente do motoboy";frame.loading="lazy";frame.referrerPolicy="no-referrer";mapStage.append(frame)}
  const delta=.009,url="https://www.openstreetmap.org/export/embed.html?bbox="+encodeURIComponent([p.lng-delta,p.lat-delta,p.lng+delta,p.lat+delta].join(","))+"&layer=mapnik&marker="+encodeURIComponent(p.lat+","+p.lng);
  if(frame.getAttribute("src")!==url)frame.src=url;
 }
 paintMap(null);
 const stopGPS=()=>{gpsGeneration++;if(watch!==null){navigator.geolocation?.clearWatch(watch);watch=null}gpsSample=null;gpsAt=0};
 const gpsError=message=>{stopGPS();gpsProblem=message;updateGate()};
 function readPosition(p){
  const q={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};
  if(!Number.isFinite(q.lat)||!Number.isFinite(q.lng)||!Number.isFinite(q.accuracy)||q.accuracy<0||q.accuracy>150)throw Error("GPS impreciso. Ative a localização precisa.");
  return q;
 }
 function freshPosition(){
  return new Promise((resolve,reject)=>{
   if(!gpsConsent||!navigator.geolocation||navigator.onLine===false){reject(Error("Ative o GPS e a conexão para continuar."));return}
   navigator.geolocation.getCurrentPosition(p=>{try{const q=readPosition(p);gpsSample=q;gpsAt=Date.now();updateGate();resolve(q)}catch(e){reject(e)}},()=>reject(Error("GPS indisponível. Autorize a localização precisa.")),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  });
 }
 const end=()=>{closed=true;generation++;clearInterval(timer);clearInterval(gpsTimer);window.removeEventListener("offline",offlineGPS);document.removeEventListener("visibilitychange",resumeGPS);stopGPS();if(fullscreen.open)fullscreen.close();frame?.remove();fullscreen.remove();root.replaceChildren();onClose?.()};
 const call=async(action,extra={})=>{const t=await token();if(closed)throw Error("Sessão encerrada.");return connectCall(t,{action,id:currentId,...extra})};
 async function send(action,extra={}){
  if(busy||closed)return;
  busy=true;generation++;notice.textContent="Confirmando…";
  try{if(riderMode&&["accept","start","deliver","message"].includes(action)){try{extra={...extra,position:await freshPosition()}}catch(e){gpsError(e.message);throw e}}const next=await call(action,extra);if(closed)return;job=next;if(action==="message"&&role==="customer"){const field=chat.querySelector("textarea");if(field)field.value="";}notice.textContent="";paint()}
  catch(e){if(!closed)notice.textContent=e.message}
  finally{busy=false}
 }
 function startGPS(){
  if(!riderMode||!gpsConsent||!job?.active||closed||watch!==null)return;
  if(!navigator.geolocation){gpsError("GPS indisponível neste aparelho.");return}
  const g=++gpsGeneration;
  gpsProblem="Aguardando localização precisa…";updateGate();
  watch=navigator.geolocation.watchPosition(p=>{
   if(closed||g!==gpsGeneration||!job?.active)return;
   try{gpsSample=readPosition(p);gpsAt=Date.now();updateGate()}catch(e){gpsSample=null;gpsAt=0;gpsProblem=e.message;updateGate();return}
   if(job.role!=="courier"||job.status!=="saiu_entrega"||Date.now()-lastSend<16000)return;
   lastSend=Date.now();void call("position",{position:gpsSample}).catch(e=>{if(!closed&&g===gpsGeneration)gpsError(e.message)});
  },()=>{if(g===gpsGeneration)gpsError("GPS desligado, bloqueado ou sem sinal. Ative a localização precisa.")},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
 }
 function offlineGPS(){if(riderMode)gpsError("Sem conexão. Reconecte para trabalhar.")}
 function resumeGPS(){if(riderMode&&!document.hidden&&job?.active&&gpsConsent){stopGPS();startGPS();updateGate()}}
 if(riderMode){window.addEventListener("offline",offlineGPS);document.addEventListener("visibilitychange",resumeGPS);gpsTimer=setInterval(()=>{if(!gpsFresh()){gpsProblem="Localização sem atualização. Ative ou recupere o GPS.";updateGate()}},1000)}
 function paint(){
  if(!job||closed)return;
  status.textContent=job.code+" · "+({recebido:"Recebido",em_preparo:"Em produção",finalizado:"Pronto",saiu_entrega:"Saiu para entrega",entregue:"Entregue",cancelado:"Cancelado"}[job.status]||job.status)+(job.active?"":" · Encerrado");
  details.textContent=job.storeTitle+(job.courierName?" · "+job.courierName:"")+(job.address?" · "+job.address:"")+(job.instructions?" · "+job.instructions:"");
  if(!job.active)stopGPS();else if(riderMode&&gpsConsent&&watch===null)startGPS();
  updateGate();
  const ms=JSON.stringify(job.position);if(ms!==mapSignature){mapSignature=ms;paintMap(job.active&&job.status==="saiu_entrega"?job.position:null);}
  const signature=JSON.stringify([job.role,job.active,job.status,job.accepted,job.messages]);
  if(signature===renderSignature)return;renderSignature=signature;
  const draft=chat.querySelector("textarea")?.value||"";
  chat.replaceChildren();actions.replaceChildren();
  if(job.active&&job.status==="saiu_entrega"&&["courier","customer","merchant"].includes(job.role)){
   chat.append(el("h3","Mensagens da entrega"));
   for(const m of job.messages||[]){const p=el("p",(m.sender==="courier"?"Motoboy: ":"Cliente: ")+m.text);chat.append(p)}
   if(job.role==="courier")for(const [key,label] of Object.entries(quickMessages))chat.append(btn(label,()=>send("message",{template:key,messageId:crypto.randomUUID()})));
   if(job.role==="customer"){const field=el("textarea");field.maxLength=300;field.placeholder="Escreva sua resposta ao motoboy";field.value=draft;chat.append(field,btn("Enviar resposta",()=>{const text=field.value.trim();if(text)void send("message",{text,messageId:crypto.randomUUID()})}));}
  }
  if(job.active&&job.role==="invitee"){const name=el("input");name.placeholder="Seu nome completo";name.maxLength=80;actions.append(name,btn("Cadastrar e aceitar entrega",()=>send("accept",{name:name.value})));}
  if(job.active&&job.role==="courier"){
   if(job.address)actions.append(link("Abrir navegação GPS",navigationLink(job.address)));
   if(job.status==="finalizado")actions.append(btn("Iniciar entrega",()=>{if(confirm("Confirma a retirada do pedido e início do percurso?"))void send("start")}));
   if(job.status==="saiu_entrega")actions.append(btn("Confirmar entrega",()=>{if(confirm("Confirma que o cliente recebeu o pedido?"))void send("deliver")}));
  }
  if(job.active&&job.role==="merchant")actions.append(link("Compartilhar convite pelo WhatsApp","https://wa.me/?text="+encodeURIComponent("Convite individual Motoboy Connect: "+inviteLink(job.id))),btn("Copiar link",()=>navigator.clipboard.writeText(inviteLink(job.id)).catch(()=>prompt("Copie o link",inviteLink(job.id)))),btn("Revogar convite",()=>{if(confirm("Revogar o acesso deste motoboy?"))void send("revoke")}));
  if(!job.active){clearInterval(timer);clearInterval(gpsTimer);stopGPS();}updateGate();
 }
 async function refresh(){
  if(closed||polling||busy||document.hidden)return;polling=true;const g=++generation;
  try{const next=await call("view");if(closed||g!==generation)return;job=next;paint()}
  catch(e){if(!closed&&g===generation){notice.textContent=e.message;stopGPS();job=null;updateGate();status.textContent="Conexão indisponível. Tentando atualizar.";details.textContent="";chat.replaceChildren();actions.replaceChildren();renderSignature="";paintMap(null);mapInfo.textContent="Localização indisponível.";mapSignature="";}}
  finally{polling=false}
 }
 timer=setInterval(refresh,20000);void refresh();return {root,close:end,refresh};
}
