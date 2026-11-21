/* F05: comprovação SOMENTE LEITURA da identidade Google instalada no
 * staging do projeto oficial. Exclusivamente durante homologação; sem dados
 * comerciais, sem retorno de token, email ou detalhes do Google.
 */
import {serviceAccessToken} from "./auth.mjs";
const project="potobatata-b71f3";
const expectedEmail="pote-batata-f05-worker@"+project+".iam.gserviceaccount.com";
const response=(payload,status,headers={})=>
 new Response(JSON.stringify(payload),{status,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers
 }});
const same=(x,y)=>{
 const a=new TextEncoder().encode(x),b=new TextEncoder().encode(y);
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);
 return diff===0;
};
export async function verifyStagingCredential(req,env,headers={},
 {token=serviceAccessToken,requestFetch=fetch}={}){
 if(env.FIREBASE_PROJECT_ID!==project||env.ENABLE_WRITES!=="false")
  return response({error:"disabled"},503,headers);
 const secret=String(env.F05_STAGING_PROBE_TOKEN||"");
 const candidate=req.headers.get("X-F05-Staging-Probe-Token")||"";
 if(secret.length<43||candidate.length!==secret.length||!same(candidate,secret))
  return response({error:"not_authorized"},403,headers);
 if(env.GCP_CLIENT_EMAIL!==expectedEmail)
  return response({status:"identity_mismatch",identityMatched:false,
   oauthValidated:false,firestoreMetadataReadable:false,writesEnabled:false},409,headers);
 try{
  const bearer=await token(env,requestFetch);
  if(typeof bearer!=="string"||bearer.length<32)throw Error("OAuth no bearer");
  const url="https://firestore.googleapis.com/v1/projects/"+project+
   "/databases/(default)";
  const r=await requestFetch(url,{method:"GET",headers:{
   Authorization:"Bearer "+bearer
  },signal:AbortSignal.timeout(15000)});
  if(!r.ok)return response({status:"metadata_denied",identityMatched:true,
   oauthValidated:true,firestoreMetadataReadable:false,writesEnabled:false},502,headers);
  // Do not read or expose document IDs, collection names or content.
  return response({status:"ok",identityMatched:true,oauthValidated:true,
   firestoreMetadataReadable:true,writesEnabled:false},200,headers);
 }catch{
  return response({status:"oauth_or_metadata_failed",identityMatched:true,
   oauthValidated:false,firestoreMetadataReadable:false,writesEnabled:false},502,headers);
 }
}
