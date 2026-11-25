import {serviceAccessToken} from "./auth.mjs";
import {auditFirebase} from "./firebase_commercial_audit.mjs";
import indexes from "../../../firestore.checkout-v6.indexes.json" with {type:"json"};
const out=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const equal=(a,b)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
export async function firebaseProbe(req,env,{clock=Date.now,token=serviceAccessToken,audit=auditFirebase}={}){
 const now=clock(),expires=Number(env.FIREBASE_PROBE_EXPIRES),hash=String(env.FIREBASE_PROBE_HASH||"");
 if(env.FIREBASE_PROJECT_ID!=="potobatata-b71f3"||env.ENABLE_CHECKOUT!=="false"||env.ENABLE_TRACKING!=="false"||env.CHECKOUT_CANARY_UIDS!==""||env.REQUIRE_LEGAL_TERMS!=="true"||!Number.isSafeInteger(expires)||expires<=now||expires-now>600000||!/^[a-f0-9]{64}$/.test(hash))return out({error:"not_found"},404);
 const proof=req.headers.get("X-Firebase-Probe")||"";
 if(req.method!=="POST"||!/^[a-f0-9]{64}$/.test(proof)||!equal(await digest(proof),hash))return out({error:"not_found"},404);
 if(env.GCP_CLIENT_EMAIL!=="multiversal-checkout@potobatata-b71f3.iam.gserviceaccount.com")return out({status:"identity_mismatch",oauth:false});
 if(typeof env.GCP_PRIVATE_KEY!=="string")return out({status:"key_missing",oauth:false});
 let bearer;
 try{bearer=await token(env);if(typeof bearer!=="string"||!bearer)throw Error();}catch{return out({status:"oauth_failed",oauth:false});}
 try{return out({status:"audit_complete",oauth:true,report:await audit({token:bearer,expected:indexes.indexes})});}
 catch{return out({status:"audit_failed",oauth:true});}
}
