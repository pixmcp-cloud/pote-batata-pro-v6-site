// Candidate only: never deployed by this module.
export function candidateTrialRules(source){
 const once=(a,b)=>{if(source.split(a).length!==2)throw Error("Rules source changed: "+a);source=source.replace(a,b)};
 once("account.license.kind in ['trial', 'pro']","((account.license.kind == 'trial' && account.license.term in ['trial24h', 'trial7d']) || (account.license.kind == 'pro' && account.license.term in ['month1', 'month6', 'year1']))");
 once("            && canEditOperationalRecord(userId, oldRecord)));","            && canEditOperationalRecord(userId, oldRecord)\n            && (canUseFinancialRecords(userId) || !(oldRecord.group in ['recipes','ingredients','suppliers']))));");
 once("          && !isFinancialGroup(resource.data.record.group)","          && !isFinancialGroup(resource.data.record.group)\n          && (canUseFinancialRecords(userId) || !(resource.data.record.group in ['recipes','ingredients','suppliers']) || isTrustedModel(resource.data.record))");
 return source;
}
