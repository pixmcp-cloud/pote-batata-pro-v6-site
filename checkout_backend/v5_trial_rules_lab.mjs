// Candidate only: never deployed by this module.
export function candidateTrialRules(source){
 const once=(a,b)=>{if(source.split(a).length!==2)throw Error("Rules source changed: "+a);source=source.replace(a,b)};
 once("account.license.kind in ['trial', 'pro']","((account.license.kind == 'trial' && account.license.term in ['trial24h', 'trial7d']) || (account.license.kind == 'pro' && account.license.term in ['month1', 'month6', 'year1']))");
 once("            && canEditOperationalRecord(userId, oldRecord)));","            && canEditOperationalRecord(userId, oldRecord)\n            && (canUseFinancialRecords(userId) || !(oldRecord.group in ['recipes','ingredients','suppliers']))));");
 once("          && !isFinancialGroup(resource.data.record.group)","          && !isFinancialGroup(resource.data.record.group)\n          && (canUseFinancialRecords(userId) || !(resource.data.record.group in ['recipes','ingredients','suppliers']) || isTrustedModel(resource.data.record))");
 return source;
}

 // The trusted server is the only writer for a seven-day grant. Existing paid
 // renewal/revoke remains possible, but cannot erase the one-time marker.
 export function candidateTrialGrantRules(source){
  const from="allow update: if isAdmin() || (\n        isOwner(userId)";
  if(source.split(from).length!==2)throw Error("Rules source changed");
  return source.replace(from,`allow update: if (isAdmin()
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['trialGrant7d'])
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['license'])
          || request.resource.data.get('license', {}).get('term', 'free') != 'trial7d')) || (
        isOwner(userId)`);
 }
