// G9: privileged service boundary, not a live ADM endpoint. Server clock only.
import {resolveLicense,expiryForTerm} from "../license_terms.mjs";
const fail=code=>{throw Object.assign(Error(code),{code})};
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
export function createTrialGrantLab({projectId,repository,verifyAdmin,clock=()=>Date.now()}={}){
 if(projectId!=="demo-nucleobit-checkout"||typeof repository?.transaction!=="function"||typeof verifyAdmin!=="function")fail("lab_disabled");
 return async ({token,targetUid,operationId}={})=>{
  if(typeof token!=="string"||!token||!id(targetUid)||!id(operationId)||operationId.length<16)fail("invalid_request");
  const actor=await verifyAdmin(token,projectId);
  if(!actor||actor.isAdmin!==true||actor.emailVerified!==true||actor.provider!=="google.com"||!id(actor.uid)||actor.uid===targetUid)fail("forbidden");
  const tx=await repository.transaction();
  try{
   const root="users/"+targetUid,profile=await tx.get(root);
   if(!profile)fail("not_found");
   const path=root+"/trialGrantOperations/"+operationId,event=await tx.get(path);
   if(event){if(event.data.actorUid!==actor.uid||event.data.targetUid!==targetUid)fail("idempotency_conflict");return {...event.data.result,duplicate:true}}
   const now=clock();if(!Number.isSafeInteger(now)||now<=0||now>8e15)fail("invalid_time");
   if(profile.data.trialGrant7d!==undefined||profile.data.license?.term==="trial7d")fail("trial_already_used");
   if(resolveLicense(profile.data.license,now).active||profile.data.franchise?.status==="active")fail("active_entitlement");
   const end=expiryForTerm("trial7d",new Date(now)).getTime(),result={targetUid,term:"trial7d",startsAt:new Date(now).toISOString(),expiresAt:new Date(end).toISOString()};
   const license={kind:"trial",term:"trial7d",status:"active",startsAt:result.startsAt,expiresAt:result.expiresAt,changedAt:result.startsAt,grantedByUid:actor.uid};
   const marker={operationId,actorUid:actor.uid,startsAt:result.startsAt,expiresAt:result.expiresAt};
   // Adapter supports this narrowly scoped masked update only in local emulator.
   await tx.commit([{path:root,data:{license,trialGrant7d:marker},precondition:{updateTime:profile.updateTime},labTrialGrant:true},{path,data:{actorUid:actor.uid,targetUid,previousTerm:profile.data.license?.term??"free",result},precondition:{exists:false}}]);
   return {...result,duplicate:false};
  }finally{await tx.rollback()}
 };
}
