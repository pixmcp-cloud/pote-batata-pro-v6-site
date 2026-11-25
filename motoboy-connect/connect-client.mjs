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
 let renderSignature="",mapSignature="",mapEnabled=false;
 const stopGPS=()=>{if(watch!==null){navigator.geolocation?.clearWatch(watch);watch=null}};
 const end=()=>{closed=true;generation++;clearInterval(timer);stopGPS();root.replaceChildren();onClose?.()};
 const call=async(action,extra={})=>{const t=await token();if(closed)throw Error("Sessão encerrada.");return connectCall(t,{action,id:currentId,...extra})};
 async function send(action,extra={}){
  if(busy||closed)return;
  busy=true;generation++;notice.textContent="Confirmando…";
  try{const next=await call(action,extra);if(closed)return;job=next;if(action==="message"&&role==="customer"){const field=chat.querySelector("textarea");if(field)field.value="";}notice.textContent="";paint()}
  catch(e){if(!closed)notice.textContent=e.message}
  finally{busy=false}
 }
 function startGPS(){
  if(watch!==null||!job?.active||job.status!=="saiu_entrega"||role!=="courier")return;
  if(!navigator.geolocation){notice.textContent="GPS indisponível neste aparelho.";return}
  watch=navigator.geolocation.watchPosition(p=>{
   if(closed||!job?.active||job.status!=="saiu_entrega"||Date.now()-lastSend<16000||p.coords.accuracy>150)return;
   lastSend=Date.now();void call("position",{position:{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}}).catch(e=>{if(!closed)notice.textContent=e.message});
  },e=>{notice.textContent="Localização indisponível. Confira a permissão GPS.";stopGPS()},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  notice.textContent="GPS autorizado durante a entrega. Mantenha a página aberta.";
 }
 function paint(){
  if(!job||closed)return;
  status.textContent=job.code+" · "+({recebido:"Recebido",em_preparo:"Em produção",finalizado:"Pronto",saiu_entrega:"Saiu para entrega",entregue:"Entregue",cancelado:"Cancelado"}[job.status]||job.status)+(job.active?"":" · Encerrado");
  details.textContent=job.storeTitle+(job.courierName?" · "+job.courierName:"")+(job.address?" · "+job.address:"")+(job.instructions?" · "+job.instructions:"");
  if(!job.active||job.status!=="saiu_entrega")stopGPS();
  const ms=JSON.stringify(job.position);
  if(ms!==mapSignature){mapSignature=ms;map.replaceChildren();
   if(job.position){const p=job.position;map.append(el("p","Última localização: "+new Date(p.at).toLocaleTimeString("pt-BR")+" · precisão "+p.accuracy+" m"),link("Abrir localização no mapa",mapLink(p)));
    // Map is loaded only after explicit user action: the map service sees coordinates.
    const draw=()=>{const frame=el("iframe");frame.title="Posição mais recente do motoboy";frame.loading="lazy";frame.referrerPolicy="no-referrer";const delta=.009;frame.src="https://www.openstreetmap.org/export/embed.html?bbox="+encodeURIComponent([p.lng-delta,p.lat-delta,p.lng+delta,p.lat+delta].join(","))+"&layer=mapnik&marker="+encodeURIComponent(p.lat+","+p.lng);map.append(frame)};
    if(mapEnabled)draw();else {const show=btn("Visualizar mapa nesta janela",()=>{mapEnabled=true;show.remove();draw()});map.append(show);}
   }else map.append(el("p","Sem localização recente. O GPS depende da autorização e da página aberta do motoboy."));
  }
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
   if(job.status==="saiu_entrega")actions.append(btn("Compartilhar minha localização",startGPS),btn("Confirmar entrega",()=>{if(confirm("Confirma que o cliente recebeu o pedido?"))void send("deliver")}));
  }
  if(job.active&&job.role==="merchant")actions.append(link("Compartilhar convite pelo WhatsApp","https://wa.me/?text="+encodeURIComponent("Convite individual Motoboy Connect: "+inviteLink(job.id))),btn("Copiar link",()=>navigator.clipboard.writeText(inviteLink(job.id)).catch(()=>prompt("Copie o link",inviteLink(job.id)))),btn("Revogar convite",()=>{if(confirm("Revogar o acesso deste motoboy?"))void send("revoke")}));
  if(!job.active){clearInterval(timer);stopGPS();}
 }
 async function refresh(){
  if(closed||polling||busy||document.hidden)return;polling=true;const g=++generation;
  try{const next=await call("view");if(closed||g!==generation)return;job=next;paint()}
  catch(e){if(!closed&&g===generation){notice.textContent=e.message;stopGPS();job=null;status.textContent="Conexão indisponível. Tentando atualizar.";details.textContent="";chat.replaceChildren();actions.replaceChildren();renderSignature="";map.replaceChildren(el("p","Localização indisponível."));mapSignature="";}}
  finally{polling=false}
 }
 timer=setInterval(refresh,20000);void refresh();return {root,close:end,refresh};
}
