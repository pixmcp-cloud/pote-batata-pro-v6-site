// Synthetic Firebase-shaped signed token verifier. Never connected to live auth.
import {jwtVerify} from "jose";
export function createCheckoutAuthLab({projectId,jwks,clock=()=>Date.now()}={}){
 if(projectId!=="demo-nucleobit-checkout"||!jwks)throw Error("lab_disabled");
 return async (token,requestedProject)=>{
  const deny=()=>{throw Object.assign(Error("login_required"),{code:"login_required"})};
  if(requestedProject!==projectId||typeof token!=="string"||token.length>12000)return deny();
  try{
   const currentDate=new Date(clock()),now=Math.floor(currentDate.getTime()/1000);
   const {payload}=await jwtVerify(token,jwks,{issuer:"https://securetoken.google.com/"+projectId,audience:projectId,algorithms:["RS256"],requiredClaims:["sub","exp","iat","auth_time"],currentDate,clockTolerance:5});
   if(typeof payload.sub!=="string"||!/^[A-Za-z0-9_-]{1,100}$/.test(payload.sub)||payload.email_verified!==true||payload.firebase?.sign_in_provider!=="google.com"||!Number.isSafeInteger(payload.auth_time)||payload.auth_time>now+5||!Number.isSafeInteger(payload.iat)||payload.iat>now+5||payload.exp<=now||payload.exp-payload.iat>3700)return deny();
   return {uid:payload.sub,emailVerified:true,provider:"google.com"};
  }catch{return deny()}
 };
}
