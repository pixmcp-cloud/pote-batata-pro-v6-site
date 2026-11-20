// Remove only a specified obsolete commercial F05 service-account key.
// Never print OAuth tokens or private-key materials.
import assert from "node:assert/strict";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const root=path.join(process.env.APPDATA||"","npm","node_modules","firebase-tools","lib");
const auth=require(path.join(root,"auth.js"));
const scopes=require(path.join(root,"scopes.js"));
const account=auth.getGlobalDefaultAccount();
assert.equal(account?.user?.email,"pixmcp@gmail.com");
const access=(await auth.getAccessToken(account.tokens.refresh_token,[scopes.CLOUD_PLATFORM])).access_token;
const project="potobatata-b71f3",email="pote-batata-f05-worker@"+project+".iam.gserviceaccount.com";
const base="https://iam.googleapis.com/v1/projects/"+project+"/serviceAccounts/"+email+"/keys";
const response=await fetch(base,{headers:{Authorization:"Bearer "+access}});
assert.equal(response.status,200,"Cannot read service keys");
const list=(await response.json()).keys||[];
const old="0fd0f14d4953c98460f92979d9dfe61dcc4adedc";
const current="c5228b9d4561ede4d87c4f3d6a2df7ed872d3b7e";
assert(list.some(k=>k.name.endsWith("/"+current)),"Active Cloudflare F05 key must exist");
const obsolete=list.find(k=>k.name.endsWith("/"+old));
if(!obsolete){console.log("Obsolete commercial F05 key already absent");process.exit(0)}
assert.equal(process.argv[2],"--remove-obsolete","Explicit cleanup flag required");
const deleted=await fetch("https://iam.googleapis.com/v1/"+obsolete.name,{method:"DELETE",headers:{Authorization:"Bearer "+access}});
assert(deleted.ok,"Could not revoke obsolete key HTTP "+deleted.status);
console.log("Revoked obsolete commercial F05 service key; current Cloudflare key preserved");
