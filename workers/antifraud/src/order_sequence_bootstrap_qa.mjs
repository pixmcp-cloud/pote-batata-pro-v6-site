/* F02: strictly QA/demo-only sequence bootstrap from a complete, stable
 * preflight. Never expose as a public Worker HTTP route. Production migration
 * requires its own approved cutover and a verified account backup.
 */
const fail=code=>{const e=new Error(code);e.code=code;throw e};
export async function bootstrapOrderSequenceQa({
 uid,universe,env,report,repository,clock=()=>new Date()
}={}){
 if(!/^demo-[a-z0-9-]+$/.test(env?.FIREBASE_PROJECT_ID||""))
  fail("qa_project_only");
 // Deliberately unusable by deployed Workers or with a normal production CLI.
 if(typeof process==="undefined"||!process.env.FIRESTORE_EMULATOR_HOST||
    process.env.GCLOUD_PROJECT!==env.FIREBASE_PROJECT_ID)
  fail("qa_emulator_required");
 if(typeof uid!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)||
    typeof universe!=="string"||!/^[a-z0-9_-]{1,64}$/.test(universe)||
    typeof repository!=="function")
  fail("invalid_bootstrap_request");
 const a=report?.anchors;
 if(report?.scope?.uid!==uid||report.scope.universe!==universe||
    report.scope.projectId!==env.FIREBASE_PROJECT_ID)
  fail("preflight_scope_mismatch");
 if(report?.status!=="ready"||report.action!=="initialize_after_authorization"||
    report.listingComplete!==true||report.snapshotStable!==true||
    !Number.isSafeInteger(report.proposedLast)||report.proposedLast<0||
    !a||typeof a.metaUpdateTime!=="string"||
    typeof a.guardUpdateTime!=="string"||
    typeof a.pulseUpdateTime!=="string"||
    a.controlUpdateTime!==null||
    !Number.isSafeInteger(a.guardRevision)||a.guardRevision<0||
    typeof a.pulseEventId!=="string"||!a.pulseEventId)
  fail("unverified_sequence_preflight");
 const root="users/"+uid;
 const metaPath=root+"/appState/v2";
 const guardPath=root+"/appState/v2InventoryGuard";
 const pulsePath=root+"/appState/v2Pulse";
 const markerPath=root+"/appState/v2OrderSequence__"+universe;
 const tx=await repository(env).transaction();
 try{
  const [meta,guard,pulse,marker]=await Promise.all([
   tx.get(metaPath),tx.get(guardPath),tx.get(pulsePath),tx.get(markerPath)
  ]);
  if(!meta||!guard||!pulse||marker||
     meta.updateTime!==a.metaUpdateTime||
     guard.updateTime!==a.guardUpdateTime||
     pulse.updateTime!==a.pulseUpdateTime||
     guard.data?.revision!==a.guardRevision||
     pulse.data?.eventId!==a.pulseEventId||
     meta.data?.schemaVersion!==2||meta.data?.migration?.status==="copying")
   fail("stale_sequence_preflight");
  const state=meta.data.state?.data;
  const branch=state?.businessType===universe?state:state?.businessUniverses?.[universe];
  if(!branch||branch.orderSequenceLast!==report.proposedLast)
   fail("stale_sequence_preflight");
  const id="qa-sequence-init-"+universe+"-"+(guard.data.revision+1);
  const writes=[
   {path:markerPath,data:{version:1,universe,last:report.proposedLast},
    precondition:{exists:false}},
   {path:guardPath,data:{revision:guard.data.revision+1},
    precondition:{updateTime:guard.updateTime}},
   {path:pulsePath,data:{eventId:id,previousEventId:pulse.data.eventId,
    origin:"qa-sequence-bootstrap",changedKeys:[],affected:0,
    metaChanged:false,sensitive:true,at:clock().toISOString()},
    precondition:{updateTime:pulse.updateTime}}
  ];
  await tx.commit(writes);
  return Object.freeze({ok:true,project:"demo-only",last:report.proposedLast,
   guardRevision:guard.data.revision+1});
 }finally{await tx.rollback()}
}
