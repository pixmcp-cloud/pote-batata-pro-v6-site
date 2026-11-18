/* F20/PDV: an authoritative cash shift requires a migrated per-universe
 * control record. No migration, no opening: never infer absence of old shifts.
 */
import {OperationalError,recordPath} from "./domain.mjs";
const bad=(code,msg,status=409)=>{throw new OperationalError(msg,status,code)};
const change=(path,data,previous)=>({path,data,
 precondition:previous?{updateTime:previous.updateTime}:{exists:false}});
const id=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{20,80}$/.test(x);
function validate(body){
 if(!body||typeof body!=="object"||Array.isArray(body)||
  Object.keys(body).some(k=>!["universe","operationId","openingCashCents","operator"].includes(k))||
  typeof body.universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(body.universe)||
  !id(body.operationId)||!Number.isSafeInteger(body.openingCashCents)||
  body.openingCashCents<0||body.openingCashCents>1000000||
  (body.operator!==undefined&&
   (typeof body.operator!=="string"||body.operator.length>90)))
  bad("invalid_cash_open","Dados de abertura de caixa inválidos",400);
 return {universe:body.universe,operationId:body.operationId,
  openingCashCents:body.openingCashCents,
  operator:(body.operator||"Operador").trim()||"Operador"};
}
export async function openCashSession(body,{user,env,repository,clock,hasAccess}){
 const {universe,operationId,openingCashCents,operator}=validate(body);
 const uid=user.uid,root="users/"+uid;
 const marker=root+"/appState/v2CashControl__"+universe;
 const guardPath=root+"/appState/v2InventoryGuard",pulsePath=root+"/appState/v2Pulse";
 const eventPath=root+"/workerEvents/"+operationId;
 const sessionId="cf-turn-"+operationId,sessionPath=recordPath(uid,universe,"cashSessions",sessionId);
 const tx=await repository(env).transaction();
 try{
  const [profile,meta,guard,pulse,control,event,existing]=await Promise.all([
   tx.get(root),tx.get(root+"/appState/v2"),tx.get(guardPath),
   tx.get(pulsePath),tx.get(marker),tx.get(eventPath),tx.get(sessionPath)
  ]);
  if(!profile||!hasAccess(profile.data,user,universe))
   bad("not_allowed","Operação não autorizada",403);
  if(event){
   const prev=event.data;
   if(prev.action!=="cash_open"||prev.universe!==universe||
      prev.openingCashCents!==openingCashCents||prev.operator!==operator)
    bad("idempotency_conflict","Identificador utilizado por outra operação");
   return {ok:true,alreadyApplied:true,sessionId:prev.sessionId,operationId};
  }
  if(!meta||meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying"||
     !guard||!Number.isInteger(guard.data?.revision)||!pulse?.data?.eventId)
   bad("not_ready","Sincronização V2 não está pronta");
  // Initialize only by a separately validated migration that checks old sessions.
  if(!control||control.data?.version!==1||
     !Object.hasOwn(control.data,"activeSessionId"))
   bad("cash_migration_required","Controle do caixa precisa ser homologado");
  if(control.data.activeSessionId!==null)
   bad("cash_already_open","Já existe um caixa aberto nesta unidade");
  if(existing)bad("session_conflict","Turno de caixa já existe");
  const at=clock().toISOString(),cash=openingCashCents/100;
  const session={id:sessionId,status:"open",openedAt:at,openingCash:cash,
   operator,version:1,openedByUid:uid,bankReconciled:false};
  const changed=[sessionPath.split("/").at(-1)];
  const writes=[
   change(sessionPath,{record:{universe,group:"cashSessions",
    id:sessionId,rank:-clock().getTime(),item:session}},null),
   change(marker,{...control.data,activeSessionId:sessionId},control),
   change(guardPath,{revision:guard.data.revision+1},guard),
   change(pulsePath,{eventId:"cf-"+operationId,previousEventId:pulse.data.eventId,
    origin:"cloudflare-worker",changedKeys:changed,affected:1,
    metaChanged:false,sensitive:true},pulse),
   change(eventPath,{action:"cash_open",universe,operationId,sessionId,
    openingCashCents,operator,actorUid:uid},null)
  ];
  await tx.commit(writes);
  return {ok:true,alreadyApplied:false,sessionId,operationId,
   status:"open",openingCashCents,bankReconciled:false};
 }finally{await tx.rollback()}
}
