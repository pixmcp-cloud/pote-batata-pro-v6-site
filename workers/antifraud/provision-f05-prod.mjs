// Commercial F05 provisioning: IAM least privilege + ephemeral Google private key -> Cloudflare secrets.
// Run only after owner approval; private key and OAuth token never leave memory or enter GitHub/logs.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import path from "node:path";
const project="potobatata-b71f3";
const accountId="pote-batata-f05-worker";
const email=accountId+"@"+project+".iam.gserviceaccount.com";
const cliRoot=path.join(process.env.APPDATA||"","npm","node_modules","firebase-tools","lib");
const require=createRequire(import.meta.url);
const account=require(path.join(cliRoot,"auth.js")).getGlobalDefaultAccount();
assert.equal(account?.user?.email,"pixmcp@gmail.com","Unexpected Google account");
const auth=require(path.join(cliRoot,"auth.js"));
const scopes=require(path.join(cliRoot,"scopes.js"));
const tokenResult=await auth.getAccessToken(account.tokens.refresh_token,[scopes.CLOUD_PLATFORM]);
const token=tokenResult?.access_token;
assert(typeof token==="string"&&token.length>50,"Google access token missing");
async function api(url,method="GET",body=null,permitMissing=false){
 const response=await fetch(url,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body===null?{}:{body:JSON.stringify(body)})});
 if(permitMissing&&response.status===404)return null;
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(method+" "+new URL(url).pathname+" HTTP "+response.status+" "+(result.error?.status||"failed"));
 return result;
}
const root="https://iam.googleapis.com/v1/projects/"+project+"/serviceAccounts";
let service=await api(root+"/"+email,"GET",null,true);
if(!service){
 service=await api(root,"POST",{accountId,serviceAccount:{displayName:"Potê Batata F05 Inventory Worker",description:"Cloudflare authoritative F05 inventory only; no admin or billing access"}});
 console.log("Created commercial F05 service account",service.email);
}else console.log("Reusing commercial F05 service account",service.email);
assert.equal(service.email,email);
const policyUrl="https://cloudresourcemanager.googleapis.com/v1/projects/"+project;
const policy=await api(policyUrl+":getIamPolicy","POST",{});
const role="roles/datastore.user",member="serviceAccount:"+email;
const matches=policy.bindings?.some(x=>x.role===role&&x.members?.includes(member));
if(!matches){
 const bindings=policy.bindings||[];
 const target=bindings.find(x=>x.role===role&&!x.condition);
 if(target){target.members=[...new Set([...(target.members||[]),member])]}else bindings.push({role,members:[member]});
 const saved=await api(policyUrl+":setIamPolicy","POST",{policy:{...policy,bindings}});
 assert(saved.bindings?.some(x=>x.role===role&&x.members?.includes(member)),"IAM membership not confirmed");
 console.log("Granted commercial F05 service identity Datastore User only");
}else console.log("Commercial F05 service identity already has Datastore User");
if(process.argv[2]!=="--create-worker-secrets"){
 console.log("IAM provisioning complete; Cloudflare secret creation withheld without explicit flag");
 process.exit(0);
}
const key=await api(root+"/"+email+"/keys","POST",{privateKeyType:"TYPE_GOOGLE_CREDENTIALS_FILE",keyAlgorithm:"KEY_ALG_RSA_2048"});
assert(typeof key.privateKeyData==="string","No service key returned");
const parsed=JSON.parse(Buffer.from(key.privateKeyData,"base64").toString("utf8"));
assert.equal(parsed.type,"service_account");
assert.equal(parsed.project_id,project);
assert.equal(parsed.client_email,email);
assert(parsed.private_key?.startsWith("-----BEGIN PRIVATE KEY-----"));
console.log("Generated F05 key in memory only; key identifier",key.name?.split("/").at(-1)||"unavailable");
for(const [name,value] of [["GCP_CLIENT_EMAIL",email],["GCP_PRIVATE_KEY",parsed.private_key]]){
 const child=spawnSync("cmd.exe",["/d","/s","/c","npx.cmd wrangler secret put "+name+" --config wrangler.f05.toml"],{cwd:path.dirname(new URL(import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/,""),input:value+"\n",encoding:"utf8",timeout:120000});
 if(child.status!==0)throw Error("Cloudflare secret "+name+" failed (no credentials logged)");
 console.log("Configured Cloudflare F05 secret",name);
}
console.log("F05 PROVISIONED: NO ENVIRONMENT WRITES ENABLED");
