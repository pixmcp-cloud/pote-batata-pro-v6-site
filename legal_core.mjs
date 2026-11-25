// Pure contract: the published server policy is authoritative, not local storage.
export const policyPath="legalPolicy/current";
export const acceptancePath=(uid,version)=>"users/"+uid+"/legalAcceptances/"+version;
export function validPolicy(p){
 return p?.active===true&&p.brand==="PDV MULTIVERSAL"&&typeof p.version==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(p.version)&&/^[a-f0-9]{64}$/.test(p.sha256||"")&&typeof p.text==="string"&&p.text.length>=100&&p.text.length<=60000&&typeof p.controller==="string"&&p.controller.trim().length>=5&&typeof p.privacyContact==="string"&&p.privacyContact.includes("@");
}
export async function policyDigest(text){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,"0")).join("");}
export const matchesAcceptance=(a,p,uid)=>a?.uid===uid&&a.version===p.version&&a.sha256===p.sha256&&a.accepted===true&&!!a.acceptedAt;
export async function requireLegalAcceptance(repository,uid){
 const tx=await repository.transaction();
 try{
  const p=(await tx.get(policyPath))?.data;
  if(!validPolicy(p)||await policyDigest(p.text)!==p.sha256)throw Object.assign(Error("legal_policy_unavailable"),{code:"legal_policy_unavailable",status:503});
  const a=(await tx.get(acceptancePath(uid,p.version)))?.data;
  if(!matchesAcceptance(a,p,uid))throw Object.assign(Error("legal_acceptance_required"),{code:"legal_acceptance_required",status:403});
  return p;
 }finally{await tx.rollback()}
}
