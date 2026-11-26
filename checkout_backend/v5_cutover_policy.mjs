// Candidate migration policy. Only a trusted administrator/server can modify accessPolicy.
// Missing policy retains legacy behavior. Any unknown explicit mode fails closed.
export function checkoutAuthorityMode(profile){
 const p=profile?.accessPolicy;
 if(p===undefined)return "legacy";
 if(p===null||typeof p!=="object"||Array.isArray(p))return "frozen";
 const value=p.checkoutAuthority;
 if(value===undefined||value==="legacy")return "legacy";
 return value==="server-only"?"server-only":"frozen";
}
export function legacyWritesAllowed(profile){return checkoutAuthorityMode(profile)==="legacy";}
export function requireCheckoutAuthority(profile,epoch){
 const policy=profile?.accessPolicy;
 if(checkoutAuthorityMode(profile)!=="server-only"||typeof epoch!=="string"||! /^[A-Za-z0-9_-]{16,100}$/.test(epoch)||policy.checkoutEpoch!==epoch)
  throw Object.assign(Error("cutover_not_ready"),{code:"cutover_not_ready"});
}
// A freeze is not a rollback. Before releasing the legacy writer, reconcile
// every reserved/consumed order, receipt, refund, physical stock and counter.
export function assessCutover({pendingOrders,unresolvedFinancial,divergentStocks,unmappedWriters,backupVerified,restoreTested,clientRulesVerified,legacyWorkerFenced}={}){
 const counts=[pendingOrders,unresolvedFinancial,divergentStocks,unmappedWriters];
 if(counts.some(n=>!Number.isSafeInteger(n)||n<0))throw Error("invalid_cutover_evidence");
 const reasons=[];
 if(pendingOrders)reasons.push("pending_orders");
 if(unresolvedFinancial)reasons.push("unresolved_financial");
 if(divergentStocks)reasons.push("divergent_stock");
 if(unmappedWriters)reasons.push("unmapped_writers");
 if(backupVerified!==true)reasons.push("backup_unverified");
 if(restoreTested!==true)reasons.push("restore_untested");
 if(clientRulesVerified!==true)reasons.push("rules_unverified");
 if(legacyWorkerFenced!==true)reasons.push("worker_unfenced");
 return {ready:reasons.length===0,reasons};
}
