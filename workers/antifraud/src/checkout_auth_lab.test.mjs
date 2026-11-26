import assert from "node:assert/strict";
import {generateKeyPair,SignJWT} from "jose";
import {createCheckoutAuthLab} from "./checkout_auth_lab.mjs";
const projectId="demo-nucleobit-checkout",now=1700000000,{privateKey,publicKey}=await generateKeyPair("RS256");
const verify=createCheckoutAuthLab({projectId,jwks:publicKey,clock:()=>now*1000});
const issue=(p={},key=privateKey)=>new SignJWT({sub:"buyer1",iss:"https://securetoken.google.com/"+projectId,aud:projectId,iat:now-10,exp:now+600,auth_time:now-20,email_verified:true,firebase:{sign_in_provider:"google.com"},...p}).setProtectedHeader({alg:"RS256"}).sign(key);
let n=0;assert.deepEqual(await verify(await issue({role:"merchant",potebatataAdmin:true}),projectId),{uid:"buyer1",emailVerified:true,provider:"google.com"});n++;
for(const payload of [{aud:"prod"},{iss:"https://evil.invalid"},{exp:now-1},{exp:undefined},{iat:now+100},{auth_time:now+100},{email_verified:false},{firebase:{sign_in_provider:"password"}},{sub:"a/b"},{exp:now+9000}]){
 await assert.rejects(()=>issue(payload).then(t=>verify(t,projectId)),e=>e.code==="login_required");n++;
}
const foreign=await generateKeyPair("RS256");await assert.rejects(()=>issue({},foreign.privateKey).then(t=>verify(t,projectId)),e=>e.code==="login_required");n++;
await assert.rejects(()=>issue().then(t=>verify(t,"prod")),e=>e.code==="login_required");n++;
console.log("PASS B02.7 JWT",n,"assertivas com assinatura RSA sintética");
