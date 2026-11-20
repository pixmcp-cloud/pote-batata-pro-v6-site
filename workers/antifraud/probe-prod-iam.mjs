// Read-only capability probe: never logs Firebase CLI tokens.
import {createRequire} from "node:module";
import path from "node:path";
import assert from "node:assert/strict";
const root=path.join(process.env.APPDATA||"", "npm","node_modules","firebase-tools","lib");
const require=createRequire(import.meta.url);
const config=require(path.join(root,"configstore.js")).configstore;
const auth=require(path.join(root,"auth.js"));
const account=auth.getGlobalDefaultAccount();
if(account?.user?.email!=="pixmcp@gmail.com")throw Error("Expected project owner CLI account not available");
const scopes=require(path.join(root,"scopes.js"));
const credential=await auth.getAccessToken(account.tokens.refresh_token,[scopes.CLOUD_PLATFORM]);
if(typeof credential?.access_token!=="string")throw Error("Firebase CLI OAuth unavailable");
const project="potobatata-b71f3";
const urls=[
 ["iam_service_list","https://iam.googleapis.com/v1/projects/"+project+"/serviceAccounts?pageSize=1"],
 ["project_policy","https://cloudresourcemanager.googleapis.com/v1/projects/"+project+":getIamPolicy"]
];
for(const [step,url] of urls){
 const response=await fetch(url,{method:step==="project_policy"?"POST":"GET",headers:{Authorization:"Bearer "+credential.access_token,"Content-Type":"application/json"},...(step==="project_policy"?{body:"{}"}:{})});
 const result=await response.json().catch(()=>({}));
 console.log(step,"HTTP",response.status, "result",response.ok?"accessible":result.error?.status||"denied");
 if(!response.ok)process.exitCode=1;
 if(step==="project_policy"&&response.ok){
 const bindings=result.bindings||[];
 const owners=bindings.filter(b=>b.role==="roles/owner"||b.role==="roles/editor").flatMap(b=>b.members||[]);
 console.log("cli_owner_binding",owners.includes("user:pixmcp@gmail.com"));
 }
}
