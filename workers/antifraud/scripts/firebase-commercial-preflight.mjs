// Read-only commercial readiness audit. Does not create, update, or delete Firestore resources.
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {serviceAccessToken} from "../src/auth.mjs";
const PROJECT="potobatata-b71f3";
const base="https://firestore.googleapis.com/v1/projects/"+PROJECT+"/databases/(default)";
const normal=fields=>JSON.stringify((fields||[]).filter(x=>x.fieldPath!=="__name__").map(x=>({fieldPath:x.fieldPath,order:x.order})));
export async function auditFirebase({token,expected,requestFetch=fetch}){
 if(typeof token!=="string"||!token)throw Error("missing_token");
 const get=async path=>requestFetch(base+path,{method:"GET",headers:{Authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(15000)});
 const report={database:"UNKNOWN",policy:"UNKNOWN",indexes:[]};
 try{const r=await get("");report.database=r.ok?"READABLE":"HTTP_"+r.status;}catch{}
 try{
  const r=await get("/documents/legalPolicy/current");
  if(r.status===404)report.policy="MISSING";
  else if(!r.ok)report.policy="HTTP_"+r.status;
  else{
   const b=await r.json(),f=b.fields||{};
   report.policy=f.active?.booleanValue===true?"ACTIVE_REQUIRES_REVIEW":"INACTIVE";
  }
 }catch{}
 for(const group of [...new Set(expected.map(x=>x.collectionGroup))]){
  let all=[],page="",complete=false;const seen=new Set();
  try{
   for(let n=0;n<100;n++){
    const r=await get("/collectionGroups/"+encodeURIComponent(group)+"/indexes?pageSize=100"+(page?"&pageToken="+encodeURIComponent(page):""));
    if(!r.ok)break;const b=await r.json();all.push(...(b.indexes||[]));page=b.nextPageToken||"";
    if(!page){complete=true;break;}if(seen.has(page))break;seen.add(page);
   }
  }catch{}
  for(const i of expected.filter(x=>x.collectionGroup===group)){
   const matches=all.filter(x=>x.queryScope===i.queryScope&&normal(x.fields)===normal(i.fields));
   const state=matches.some(x=>x.state==="READY")?"READY":matches.some(x=>x.state==="CREATING")?"CREATING":matches.length?"NOT_READY":complete?"MISSING":"UNKNOWN";
   report.indexes.push({collectionGroup:group,fields:i.fields,state});
  }
 }
 return report;
}
async function main(){
 const expected=JSON.parse(await readFile(new URL("../../../firestore.checkout-v6.indexes.json",import.meta.url),"utf8")).indexes;
 const env=process.env;
 if(!env.GCP_CLIENT_EMAIL||!env.GCP_PRIVATE_KEY){console.log("FIREBASE_SERVICE_CREDENTIALS_NOT_AVAILABLE");return;}
 // The checkout identity must be separate from old stock workers and broad Firebase Admin accounts.
 if(env.GCP_CLIENT_EMAIL!=="multiversal-checkout@"+PROJECT+".iam.gserviceaccount.com"){console.log("FIREBASE_DEDICATED_IDENTITY_REQUIRED");return;}
 let token;try{token=await serviceAccessToken(env);console.log("FIREBASE_OAUTH_OK");}catch{console.log("FIREBASE_OAUTH_NOT_VERIFIED");return;}
 const report=await auditFirebase({token,expected});
 console.log(JSON.stringify(report,null,2));
 console.log("FIREBASE_INDEXES_READY_"+report.indexes.filter(x=>x.state==="READY").length+"_OF_"+expected.length);
 console.log("FIREBASE_COMMERCIAL_GATE_NOT_ACTIVATED");
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main().catch(()=>{console.error("FIREBASE_PREFLIGHT_FAILED");process.exitCode=1;});
