// Safe production F05 smoke: existing Google owner's Firebase session; nonexistent inventory ID.
// No persistent credentials, no stock writes, no tokens emitted.
import assert from "node:assert/strict";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const root=path.join(process.env.APPDATA||"","npm","node_modules","firebase-tools","lib");
const auth=require(path.join(root,"auth.js"));
const scopes=require(path.join(root,"scopes.js"));
const account=auth.getGlobalDefaultAccount();
assert.equal(account?.user?.email,"pixmcp@gmail.com");
const google=(await auth.getAccessToken(account.tokens.refresh_token,[scopes.CLOUD_PLATFORM])).access_token;
const apiKey="AIzaSyCG8KCd6LKhYOIH3eLxifoT7IC9k3oMYCk";
const login=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key="+encodeURIComponent(apiKey),{
 method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({postBody:"access_token="+encodeURIComponent(google)+"&providerId=google.com",requestUri:"http://localhost",returnSecureToken:true})
});
const session=await login.json().catch(()=>({}));
if(!login.ok){console.log("F05_PROD_AUTH_HTTP",login.status,"error",session.error?.message||"idp_rejected");process.exit(1)}
assert.equal(session.email?.toLowerCase(),"pixmcp@gmail.com");
assert.equal(session.registered,true,"Refuse newly created account");
assert(typeof session.idToken==="string"&&session.idToken.length>100);
const remote="https://pote-batata-f05-live.pixmcp.workers.dev";
const body={universe:"batataria",operationId:"f05-prod-validation-no-stock-20261120-0001",group:"ingredients",
 itemId:"__F05_PROBE_NONEXISTENT_20261120__",delta:-1,reason:"loss",lossReason:"vencimento",note:"Somente verificacao, sem registro existente"};
const response=await fetch(remote+"/v1/inventory/adjust",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.idToken},body:JSON.stringify(body)});
const payload=await response.json().catch(()=>({}));
console.log("F05_PROD_CANARY_HTTP",response.status,"code",payload.error||"ok","nonexistentStockUsed",true);
if(response.status===200)throw Error("Unexpected inventory write! Halt release and investigate");
if(![403,404,409,503].includes(response.status))process.exitCode=1;
