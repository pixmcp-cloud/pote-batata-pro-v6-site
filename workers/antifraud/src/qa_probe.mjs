/* Cloudflare QA runtime OAuth smoke. Dedicated Worker, never a PDV endpoint.
 * No Firestore writes, no client identity, no secret/token in response.
 * Must never target the Potê Batata commercial Firestore.
 */
import {serviceAccessToken} from "./auth.mjs";
const PROJECT="pote-batata-qa-worker";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex"
}});
const constantTimeEqual=(left,right)=>{
 const a=new TextEncoder().encode(left),b=new TextEncoder().encode(right);
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)
  diff|=(a[i]||0)^(b[i]||0);
 return diff===0;
};
export function createQaProbe({auth=serviceAccessToken,requestFetch=fetch}={}){
 return {async fetch(req,env){
  // Two independent safeguards: QA project only and no writes, regardless
  // of Cloudflare dashboard configuration or accidental deploy.
  if(env.FIREBASE_PROJECT_ID!==PROJECT||env.ENABLE_WRITES!=="false")
   return json({error:"qa_configuration_invalid"},503);
  const url=new URL(req.url);
  if(req.method==="GET"&&url.pathname==="/health")
   return json({status:"ok",mode:"qa-auth-readonly",writesEnabled:false});
  if(req.method!=="POST"||url.pathname!=="/v1/qa/oauth-probe")
   return json({error:"not_found"},404);
  const expected=String(env.F05_QA_PROBE_TOKEN||"");
  const actual=req.headers.get("X-F05-QA-Probe-Token")||"";
  if(expected.length<43||actual.length!==expected.length||
      !constantTimeEqual(expected,actual))
   return json({error:"not_authorized"},403);
  try{
   const token=await auth(env,requestFetch);
   if(typeof token!=="string"||token.length<30)
    throw Error("Google OAuth did not return a bearer");
   const address="https://firestore.googleapis.com/v1/projects/"+PROJECT+
    "/databases/(default)/documents:listCollectionIds";
   const response=await requestFetch(address,{
    method:"POST",headers:{"Authorization":"Bearer "+token,
     "Content-Type":"application/json"},
    body:JSON.stringify({pageSize:1}),
    signal:AbortSignal.timeout(12000)
   });
   // Never disclose Google IAM errors, service emails or document metadata.
   if(!response.ok)return json({status:"error",oauth:true,
    firestoreQaRead:false},502);
   return json({status:"ok",oauth:true,firestoreQaRead:true,
    writesEnabled:false});
  }catch{
   return json({status:"error",oauth:false,firestoreQaRead:false},502);
  }
 }};
}
export default createQaProbe();
