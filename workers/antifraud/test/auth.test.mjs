import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPair,exportJWK,exportPKCS8,createLocalJWKSet,SignJWT,jwtVerify} from "jose";
import {verifyFirebaseToken,serviceAccessToken} from "../src/auth.mjs";
const project="potobatata-b71f3";
let keys;
async function keySet(){
 if(!keys){
  const pair=await generateKeyPair("RS256",{extractable:true});
  const jwk=await exportJWK(pair.publicKey);
  jwk.kid="unit-key";jwk.alg="RS256";jwk.use="sig";
  keys={...pair,jwks:createLocalJWKSet({keys:[jwk]})};
 }
 return keys;
}
async function token(claims={}){
 const k=await keySet(),now=Math.floor(Date.now()/1000);
 return new SignJWT({
  email:"operator@example.com",email_verified:true,
  firebase:{sign_in_provider:"google.com"},auth_time:now-20,
  ...claims
 }).setProtectedHeader({alg:"RS256",kid:"unit-key"})
 .setIssuer("https://securetoken.google.com/"+project)
 .setAudience(project).setSubject("firebase-owner-uid")
 .setIssuedAt(now).setExpirationTime(now+3600).sign(k.privateKey);
}
test("verify signed Google/Firebase identity, tenant and provider",async()=>{
 const k=await keySet();
 const s=await token();
 const user=await verifyFirebaseToken(s,project,k.jwks);
 assert.equal(user.uid,"firebase-owner-uid");
 assert.equal(user.isAdmin,false);
 await assert.rejects(()=>verifyFirebaseToken(s,"another-project",k.jwks));
 await assert.rejects(async()=>verifyFirebaseToken(await token({email_verified:false}),project,k.jwks));
 await assert.rejects(async()=>verifyFirebaseToken(await token({
  firebase:{sign_in_provider:"password"}}),project,k.jwks));
});
test("admin privilege requires signed claim AND pinned email",async()=>{
 const k=await keySet();
 const forged=await token({potebatataAdmin:true});
 assert.equal((await verifyFirebaseToken(forged,project,k.jwks)).isAdmin,false);
 const authorized=await token({potebatataAdmin:true,email:"pixmcp@gmail.com"});
 assert.equal((await verifyFirebaseToken(authorized,project,k.jwks)).isAdmin,true);
});
test("service JWT is short-lived, datastore-scoped and never returns private key",async()=>{
 const k=await keySet();
 const privatePem=await exportPKCS8(k.privateKey);
 const env={GCP_CLIENT_EMAIL:"qa-unique@potobatata-b71f3.iam.gserviceaccount.com",
  GCP_PRIVATE_KEY:privatePem};
 let calls=0;
 const fakeFetch=async(url,options)=>{
  calls++;
  assert.equal(url,"https://oauth2.googleapis.com/token");
  const form=new URLSearchParams(options.body.toString());
  assert.equal(form.get("grant_type"),"urn:ietf:params:oauth:grant-type:jwt-bearer");
  const {payload}=await jwtVerify(form.get("assertion"),k.publicKey,
   {audience:url,issuer:env.GCP_CLIENT_EMAIL});
  assert.equal(payload.scope,"https://www.googleapis.com/auth/datastore");
  assert(payload.exp-payload.iat<=3300);
  return new Response(JSON.stringify({access_token:"fake-access-token",expires_in:3300}),
   {status:200,headers:{"content-type":"application/json"}});
 };
 const got=await serviceAccessToken(env,fakeFetch);
 assert.equal(got,"fake-access-token");
 assert.equal(await serviceAccessToken(env,fakeFetch),got,"OAuth grant cached");
 assert.equal(calls,1);
});
