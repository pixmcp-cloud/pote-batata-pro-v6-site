import {jwtVerify,createRemoteJWKSet,SignJWT,importPKCS8} from "jose";

const firebaseKeys=createRemoteJWKSet(new URL(
 "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
));
export async function verifyFirebaseToken(token,projectId,jwks=firebaseKeys){
 if(typeof token!=="string"||token.length<100||token.length>12000)
  throw Error("Firebase ID token missing or malformed");
 const {payload}=await jwtVerify(token,jwks,{
  issuer:"https://securetoken.google.com/"+projectId,
  audience:projectId,algorithms:["RS256"],clockTolerance:"5s"
 });
 const now=Math.floor(Date.now()/1000);
 if(!payload.sub||typeof payload.sub!=="string"||payload.sub.length>128||
    payload.email_verified!==true||payload.firebase?.sign_in_provider!=="google.com"||
    !Number.isFinite(payload.auth_time)||payload.auth_time>now+5)
  throw Error("Unverified Google Firebase identity");
 return {uid:payload.sub,email:payload.email||"",isAdmin:payload.potebatataAdmin===true&&
  payload.email==="pixmcp@gmail.com"};
}
let cached=null;
export async function serviceAccessToken(env,requestFetch=(...args)=>fetch(...args)){
 const email=env.GCP_CLIENT_EMAIL,raw=env.GCP_PRIVATE_KEY;
 if(typeof email!=="string"||!email.endsWith(".gserviceaccount.com")||
    typeof raw!=="string"||!raw.includes("PRIVATE KEY"))
  throw Error("Firestore service identity not configured");
 if(cached?.email===email&&cached.exp>Date.now()+120000)return cached.token;
 const pem=raw.replace(/\\n/g,"\n");
 const key=await importPKCS8(pem,"RS256");
 const now=Math.floor(Date.now()/1000);
 const assertion=await new SignJWT({
  scope:"https://www.googleapis.com/auth/datastore"
 }).setProtectedHeader({alg:"RS256",typ:"JWT"}).setIssuedAt(now).setExpirationTime(now+3300)
 .setIssuer(email).setSubject(email).setAudience("https://oauth2.googleapis.com/token").sign(key);
 const response=await requestFetch("https://oauth2.googleapis.com/token",{
  method:"POST",redirect:"manual",signal:AbortSignal.timeout(10000),headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})
 });
 if(!response.ok)throw Error("Firestore service authentication failed");
 const result=await response.json();
 if(typeof result.access_token!=="string"||!Number.isFinite(result.expires_in))
  throw Error("Invalid service token response");
 cached={email,token:result.access_token,
  exp:Date.now()+Math.min(3300,result.expires_in)*1000};
 return cached.token;
}
