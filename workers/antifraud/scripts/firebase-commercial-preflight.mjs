// Read-only commercial readiness audit. Does not create, update, or delete Firestore resources.
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {serviceAccessToken} from "../src/auth.mjs";
import {auditFirebase} from "../src/firebase_commercial_audit.mjs";
export {auditFirebase};
const PROJECT="potobatata-b71f3";
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
