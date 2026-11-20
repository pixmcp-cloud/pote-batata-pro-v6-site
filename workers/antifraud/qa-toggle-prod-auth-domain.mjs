// Temporarily authorize localhost for a no-write production F05 OAuth smoke, then revoke.
// The only field mutated is authorizedDomains. Never logs credentials or other config.
import assert from "node:assert/strict";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const lib=path.join(process.env.APPDATA||"","npm","node_modules","firebase-tools","lib");
const auth=require(path.join(lib,"auth.js"));
const scopes=require(path.join(lib,"scopes.js"));
const user=auth.getGlobalDefaultAccount();
assert.equal(user?.user?.email,"pixmcp@gmail.com");
const access=(await auth.getAccessToken(user.tokens.refresh_token,[scopes.CLOUD_PLATFORM])).access_token;
assert(typeof access==="string"&&access.length>50);
const url="https://identitytoolkit.googleapis.com/admin/v2/projects/potobatata-b71f3/config";
const read=async()=>{const r=await fetch(url,{headers:{Authorization:"Bearer "+access}});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error("Firebase Auth config read HTTP "+r.status+" "+(v.error?.status||""));return v};
const config=await read();
assert(Array.isArray(config.authorizedDomains),"Missing authorizedDomains");
const mode=process.argv[2];
const has=config.authorizedDomains.includes("localhost");
console.log("Commercial Firebase authorizedDomains",config.authorizedDomains.join(", "));
if(mode==="--inspect"){console.log("LOCALHOST_AUTHORIZED",has);process.exit(0)}
assert(["--add-localhost","--remove-localhost"].includes(mode),"Only add/remove localhost supported");
if(mode==="--add-localhost"&&has){console.log("Localhost already present, no change");process.exit(0)}
if(mode==="--remove-localhost"&&!has){console.log("Localhost already absent, no change");process.exit(0)}
const domains=mode==="--add-localhost"?[...config.authorizedDomains,"localhost"]:config.authorizedDomains.filter(d=>d!=="localhost");
const update=await fetch(url+"?updateMask=authorizedDomains",{method:"PATCH",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify({authorizedDomains:domains})});
const result=await update.json().catch(()=>({}));
if(!update.ok)throw Error("Firebase Auth domain update HTTP "+update.status+" "+(result.error?.status||""));
assert.deepEqual(new Set(result.authorizedDomains||[]),new Set(domains),"Authorized domains unexpectedly changed");
console.log("AUTHORIZED_DOMAINS_UPDATED mode",mode,"count",domains.length);
