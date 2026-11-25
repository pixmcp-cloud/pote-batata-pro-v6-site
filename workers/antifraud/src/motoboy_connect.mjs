import {OperationalError,recordPath} from "./domain.mjs";
import {trackingPath,lifecycleRows,updateTracking} from "./tracking.mjs";
export const QUICK_MESSAGES=Object.freeze({
 address:"Não estou encontrando o endereço.",reference:"Tem um ponto de referência?",color:"Qual a cor da casa?",
 gate:"Qual o portão ou entrada correta?",building:"Qual o bloco ou apartamento?",arriving:"Estou chegando. Pode me aguardar na entrada?",
 delay:"Tive um imprevisto no trajeto. Avisarei assim que possível."
});
const deny=(message,code="connect_denied",status=403)=>{throw new OperationalError(message,status,code)};
const uuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const email=x=>typeof x==="string"&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)?x.trim().toLowerCase():"";
const str=(x,max)=>typeof x==="string"&&x.trim().length>0&&x.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(x)?x.trim():"";
const put=(path,data,old)=>({path,data,precondition:old?{updateTime:old.updateTime}:{exists:false}});
const jobPath=id=>"motoboyConnectJobs/"+id;
const terminal=s=>["entregue","cancelado"].includes(s);
const jobLive=(job,order,now)=>!job.revokedAt&&!terminal(order.status)&&Date.parse(job.expiresAt)>now;
const rounded=x=>Math.round(x*100000)/100000;
export function validatePosition(p){
 if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||!Number.isFinite(p.accuracy)||p.accuracy<0||p.accuracy>150)deny("GPS impreciso ou indisponível.","invalid_position",400);
 return {lat:rounded(p.lat),lng:rounded(p.lng),accuracy:Math.round(p.accuracy)};
}
export function participant(job,user){
 if(user.uid===job.ownerUid)return "merchant";
 if(user.uid===job.consumerUid)return "customer";
 if(job.courierUid===user.uid)return "courier";
 if(!job.courierUid&&email(user.email)&&email(user.email)===job.courierEmail)return "invitee";
 return null;
}
export function projectJob(job,order,role,now){
 const active=jobLive(job,order,now),moving=active&&order.status==="saiu_entrega";
 return {id:job.id,role,status:order.status,active,accepted:!!job.courierUid,courierName:job.courierName||"",
  storeTitle:order.storeTitle,code:"#P"+String(order.lines[0]?.orderNumber||0).padStart(7,"0"),createdAt:order.createdAt,
  expiresAt:job.expiresAt,position:moving&&job.position&&now-Date.parse(job.position.at)<=90000?job.position:null,
  messages:moving&&role!=="invitee"?job.messages||[]:[],
  ...(role==="courier"&&active?{address:order.deliveryAddress||"",instructions:job.instructions||""}:{}),
  ...(role==="merchant"?{courierEmail:job.courierEmail}:{}),
  durationSeconds:order.durationSeconds??null};
}
export async function connectOperation({input,user,env,repository,at,merchantAllowed}){
 if(env.ENABLE_MOTOBOY_CONNECT!=="true"||env.ENABLE_WRITES!=="true")deny("Motoboy Connect em homologação.","connect_disabled",423);
 const now=at.getTime(),iso=at.toISOString(),action=input?.action;
 if(!["invite","find","view","accept","position","message","start","deliver","revoke"].includes(action))deny("Operação inválida.","invalid_connect",400);
 const tx=await repository(env).transaction();
 try{
  let path,doc,job,orderDoc,orderPath;
  if(["invite","find"].includes(action)){
   if(!uuid(input.checkoutId)||!["batataria","pizzaria","hamburgueria","hotdog","lancheria","pastelaria"].includes(input.universe))deny("Pedido inválido.","invalid_connect",400);
   if(!await merchantAllowed(tx,user,input.universe))deny("Loja não autorizada.");
   const event=await tx.get("users/"+user.uid+"/publicCheckoutEvents/"+input.checkoutId);
   if(!event?.data?.consumerUid)deny("Pedido não localizado.","connect_missing",404);
   orderPath=trackingPath(event.data.consumerUid,input.checkoutId);orderDoc=await tx.get(orderPath);
   const order=orderDoc?.data;
   if(!order||order.deliveryType!=="Tele-entrega")deny("Pedido sem tele-entrega.");
   const rowId=order.lines.find(l=>l.status!=="cancelado")?.id;
   const row=rowId&&await tx.get(recordPath(user.uid,input.universe,"orders",rowId));
   if(!row?.data?.record||row.data.record.universe!==input.universe||row.data.record.item.checkoutId!==input.checkoutId)deny("Pedido não pertence a este ramo.");
   if(order.connectJobId){path=jobPath(order.connectJobId);doc=await tx.get(path);job=doc?.data;if(job&&job.ownerUid!==user.uid)deny("Vínculo inválido.");}
   if(action==="find")return {ok:true,job:job?projectJob(job,order,"merchant",now):null};
   if(!["finalizado","saiu_entrega"].includes(order.status))deny("Conclua o preparo antes de convidar o entregador.","order_state",409);
   const target=email(input.email),instructions=input.instructions===""?"":str(input.instructions,240);
   if(!target||target===email(user.email)||instructions===""&&input.instructions!=="")deny("Informe e-mail Google do motoboy e instruções válidas.","invalid_connect",400);
   if(job&&jobLive(job,order,now)){
    if(job.courierEmail===target)return {ok:true,job:projectJob(job,order,"merchant",now)};
    deny("Revogue o convite anterior antes de trocar o motoboy.","connect_exists",409);
   }
   const id=crypto.randomUUID();path=jobPath(id);
   job={id,ownerUid:user.uid,consumerUid:event.data.consumerUid,checkoutId:input.checkoutId,universe:input.universe,courierEmail:target,courierUid:null,courierName:"",instructions,createdAt:iso,expiresAt:new Date(now+8*3600000).toISOString(),revokedAt:null,position:null,messages:[]};
   const writes=[put(path,job,null),put(orderPath,{...order,connectJobId:id},orderDoc)];
   if(doc)writes.push(put(jobPath(doc.data.id),{...doc.data,revokedAt:iso,position:null,messages:[]},doc));
   await tx.commit(writes);return {ok:true,job:projectJob(job,order,"merchant",now)};
  }
  if(!uuid(input.id))deny("Convite inválido.","invalid_connect",400);
  path=jobPath(input.id);doc=await tx.get(path);job=doc?.data;
  const role=job&&participant(job,user);
  if(!role)deny("Convite indisponível.","connect_missing",404);
  orderPath=trackingPath(job.consumerUid,job.checkoutId);orderDoc=await tx.get(orderPath);
  const order=orderDoc?.data;
  if(!order||order.connectJobId!==job.id)deny("Convite indisponível.","connect_missing",404);
  if(action==="view")return {ok:true,job:projectJob(job,order,role,now)};
  if(action==="deliver"&&role==="courier"&&order.status==="entregue"&&job.completedAt)return {ok:true,job:projectJob(job,order,role,now)};
  if(!jobLive(job,order,now))deny("Entrega encerrada ou convite expirado.","connect_closed",409);
  // Browser samples are client supplied, not hardware attestation. Never allow
  // a courier's operational command without a valid location sample.
  const gpsRequired=(role==="courier"&&["start","deliver","message"].includes(action))||(role==="invitee"&&action==="accept");
  if(gpsRequired&&!input.position)deny("Ative a localização precisa para continuar.","gps_required",409);
  const actionPosition=gpsRequired?validatePosition(input.position):null;
  if(action==="revoke"){
   if(role!=="merchant"||!await merchantAllowed(tx,user,job.universe))deny("Somente a loja pode revogar.");
   job={...job,revokedAt:iso,position:null,messages:[]};
  }else if(action==="accept"){
   if(role==="courier")return {ok:true,job:projectJob(job,order,role,now)};
   if(role!=="invitee")deny("Use a conta Google convidada.");
   const name=str(input.name,80);if(!name)deny("Informe seu nome.","invalid_connect",400);
   const pp="motoboyConnectProfiles/"+user.uid,profile=await tx.get(pp);
   job={...job,courierUid:user.uid,courierName:name,acceptedAt:iso};
   await tx.commit([put(path,job,doc),put(pp,{uid:user.uid,name,email:email(user.email),createdAt:profile?.data?.createdAt||iso},profile)]);
   return {ok:true,job:projectJob(job,order,"courier",now)};
  }else if(action==="position"){
   if(role!=="courier"||order.status!=="saiu_entrega")deny("GPS disponível somente na entrega ativa.");
   const position=validatePosition(input.position);
   if(job.position&&now-Date.parse(job.position.at)<15000)return {ok:true,job:projectJob(job,order,role,now)};
   job={...job,position:{...position,at:iso}};
  }else if(action==="message"){
   if(!["courier","customer"].includes(role)||order.status!=="saiu_entrega")deny("Conversa disponível somente durante a entrega.");
   const message=role==="courier"?(Object.hasOwn(QUICK_MESSAGES,input.template)?QUICK_MESSAGES[input.template]:""):str(input.text,300);
   if(typeof message!=="string"||!message||!uuid(input.messageId))deny("Mensagem inválida.","invalid_connect",400);
   const messages=job.messages||[];
   if(messages.some(m=>m.id===input.messageId&&m.sender===role))return {ok:true,job:projectJob(job,order,role,now)};
   if(messages.length>=40)deny("Limite de mensagens nesta entrega atingido.","message_limit",409);
   const last=messages.filter(m=>m.sender===role).at(-1);
   if(last&&now-Date.parse(last.at)<5000)deny("Aguarde alguns segundos.","message_rate",429);
   job={...job,messages:[...messages,{id:input.messageId,sender:role,text:message,at:iso}],...(role==="courier"&&actionPosition?{position:{...actionPosition,at:iso}}:{})};
  }else if(["start","deliver"].includes(action)){
   if(role!=="courier")deny("Somente o motoboy vinculado pode confirmar esta ação.");
   if(!await merchantAllowed(tx,{uid:job.ownerUid,isAdmin:false},job.universe))deny("Loja sem autorização operacional.");
   if(action==="start"&&order.status==="saiu_entrega")return {ok:true,job:projectJob(job,order,role,now)};
   if(action==="start"&&order.status!=="finalizado"||action==="deliver"&&order.status!=="saiu_entrega")deny("Etapa incompatível.","order_state",409);
   const root="users/"+job.ownerUid,guardPath=root+"/appState/v5InventoryGuard",pulsePath=root+"/appState/v5Pulse";
   const [guard,pulse]=await Promise.all([tx.get(guardPath),tx.get(pulsePath)]);
   if(!Number.isSafeInteger(guard?.data?.revision)||!pulse?.data?.eventId)deny("Sincronização indisponível.","not_ready",409);
   const rows=await lifecycleRows(tx,job.ownerUid,job.universe,{doc:orderDoc,path:orderPath},action==="start"?"dispatch":"deliver",iso);
   const next=updateTracking(order,rows.map(r=>r.next),iso);
   if(action==="deliver")job={...job,position:null,messages:[],completedAt:iso};else job={...job,position:{...actionPosition,at:iso}};
   const changedKeys=rows.map(r=>r.path.split("/").at(-1));
   const writes=rows.map(r=>put(r.path,{record:{...r.doc.data.record,item:r.next}},r.doc));
   writes.push(put(orderPath,next,orderDoc),put(path,job,doc),put(guardPath,{revision:guard.data.revision+1},guard),put(pulsePath,{eventId:"connect-"+crypto.randomUUID(),previousEventId:pulse.data.eventId,origin:"motoboy-connect",affected:changedKeys.length,changedKeys,metaChanged:false,sensitive:true},pulse));
   await tx.commit(writes);return {ok:true,job:projectJob(job,next,role,now)};
  }
  await tx.commit([put(path,job,doc)]);return {ok:true,job:projectJob(job,order,role,now)};
 }finally{await tx.rollback()}
}
// Merchant fulfillment remains authoritative; discard latest GPS and messages when terminal.
export async function closeConnectJob(tx,tracking,at){
 const id=tracking?.connectJobId;if(!uuid(id))return null;
 const path=jobPath(id),doc=await tx.get(path);
 if(!doc)return null;
 return put(path,{...doc.data,position:null,messages:[],completedAt:at},doc);
}
