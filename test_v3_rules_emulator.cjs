/* V3: regras de segurança em emulador isolado. Nunca acessa Firebase real. */
const fs=require("node:fs"),assert=require("node:assert/strict");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp}=require("firebase/firestore");
const projectId="demo-pote-batata-v3";
const rules=fs.readFileSync(process.env.V3_RULES_FILE||"firestore.rules","utf8");
function google(email){return {email,email_verified:true,firebase:{sign_in_provider:"google.com"}}}
async function main(){
 const env=await initializeTestEnvironment({projectId,firestore:{rules}});
 try{
  const owner=env.authenticatedContext("owner",google("owner@example.com")).firestore();
  const outsider=env.authenticatedContext("outside",google("outside@example.com")).firestore();
  const admin=env.authenticatedContext("admin",google("pixmcp@gmail.com")).firestore();
  const unverified=env.authenticatedContext("unverified",{
   email:"fake@example.com",email_verified:false,firebase:{sign_in_provider:"google.com"}
  }).firestore();
  const password=env.authenticatedContext("password",{
   email:"password@example.com",email_verified:true,firebase:{sign_in_provider:"password"}
  }).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  await env.withSecurityRulesDisabled(async context=>{
   const setup=context.firestore();
   await setDoc(doc(setup,"users","owner"),{
    email:"owner@example.com",displayName:"Teste",createdAt:new Date(),updatedAt:new Date(),
    license:{kind:"free",term:"free",status:"active"}
   });
   await setDoc(doc(setup,"users","outside"),{
    email:"outside@example.com",displayName:"Outro",createdAt:new Date(),updatedAt:new Date()
   });
   await setDoc(doc(setup,"franchiseCatalog","potebatata"),{brandId:"potebatata",version:1});
  });
  const profile=doc(owner,"users","owner");
  const record=doc(owner,"users","owner","records","record-1");
  await assertSucceeds(getDoc(profile));
  await assertFails(getDoc(doc(outsider,"users","owner")));
  await assertFails(getDoc(doc(anonymous,"users","owner")));
  await assertFails(getDoc(doc(unverified,"users","owner")));
  await assertFails(getDoc(doc(password,"users","owner")));
  await assertSucceeds(getDoc(doc(admin,"users","owner")));
  await assertFails(updateDoc(profile,{license:{kind:"lifetime",term:"lifetime",status:"active"}}));
  await assertFails(setDoc(doc(owner,"licenseAudit","event1"),{action:"promover"}));
  await assertSucceeds(setDoc(record,{record:{
   universe:"batataria",group:"recipes",id:"r1",item:{id:"r1",name:"Receita"},rank:0
  },updatedAt:serverTimestamp()}));
  await assertSucceeds(getDoc(record));
  await assertFails(getDoc(doc(outsider,"users","owner","records","record-1")));
  await assertFails(setDoc(record,{record:{
   universe:"batataria",group:"recipes",id:"r1",item:{id:"r1"},rank:0
  },updatedAt:new Date()}));
  await assertFails(setDoc(doc(owner,"users","owner","records","bad-group"),{record:{
   universe:"batataria",group:"maliciousGroup",id:"x",item:{},rank:0
  },updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(owner,"franchiseCatalog","potebatata")));
  await env.withSecurityRulesDisabled(async context=>{
   await updateDoc(doc(context.firestore(),"users","owner"),{
    franchise:{brandId:"potebatata",status:"active"}
   });
  });
  await assertSucceeds(getDoc(doc(owner,"franchiseCatalog","potebatata")));
  await assertFails(getDoc(doc(outsider,"franchiseCatalog","potebatata")));
  // A V3 candidata impede acesso financeiro sem licença validada no servidor.
  const cashRef=doc(owner,"users","owner","records","cash-s1");
  const movementRef=doc(owner,"users","owner","records","cash-m1");
  const financialDoc=(group,id,item)=>({record:{
    universe:"batataria",group,id,item,rank:0
  },updatedAt:serverTimestamp()});
  const cashOpening=financialDoc("cashSessions","s1",{
    id:"s1",status:"open",openingCash:100,openedAt:"2026-11-16T12:00:00"
  });
  // Primeiro remover a licença de franquia concedida no teste de catálogo.
  await env.withSecurityRulesDisabled(async context=>{
   await updateDoc(doc(context.firestore(),"users","owner"),{
    franchise:{brandId:"potebatata",status:"revoked"}
   });
  });
  await assertFails(setDoc(cashRef,cashOpening));
  await env.withSecurityRulesDisabled(async context=>{
   await updateDoc(doc(context.firestore(),"users","owner"),{
    license:{kind:"pro",term:"month1",status:"active",
      expiresAt:new Date(Date.now()+24*3600*1000)}
   });
  });
  await assertSucceeds(setDoc(cashRef,cashOpening));
  await assertSucceeds(setDoc(movementRef,financialDoc("cashMovements","m1",{
   id:"m1",sessionId:"s1",kind:"sangria",amount:10,reason:"banco"
  })));
  await assertFails(setDoc(movementRef,financialDoc("cashMovements","m1",{
   id:"m1",sessionId:"s1",kind:"sangria",amount:500,reason:"fraude"
  })));
  await assertFails(deleteDoc(movementRef));
  await assertSucceeds(setDoc(cashRef,financialDoc("cashSessions","s1",{
   id:"s1",status:"closed",openingCash:100,closedAt:"2026-11-16T16:00:00"
  })));
  await assertFails(setDoc(cashRef,financialDoc("cashSessions","s1",{
   id:"s1",status:"open",openingCash:100
  })));
  await assertFails(deleteDoc(cashRef));
  await env.withSecurityRulesDisabled(async context=>{
   await updateDoc(doc(context.firestore(),"users","owner"),{
    license:{kind:"pro",term:"month1",status:"active",
      expiresAt:new Date(Date.now()-24*3600*1000)}
   });
  });
  await assertFails(setDoc(doc(owner,"users","owner","records","cash-m2"),
   financialDoc("cashMovements","m2",{id:"m2",sessionId:"s1",kind:"sangria",amount:5})));
  await env.withSecurityRulesDisabled(async context=>{
   await updateDoc(doc(context.firestore(),"users","owner"),{
    franchise:{brandId:"potebatata",status:"active"}
   });
  });
  await assertSucceeds(setDoc(doc(owner,"users","owner","records","cash-m3"),
   financialDoc("cashMovements","m3",{id:"m3",sessionId:"s1",kind:"suprimento",amount:5})));
  console.log("PASS V3 Firebase Emulator: isolamento, licenças PRO/FRANQUIA e imutabilidade de lançamentos de caixa.");
 }finally{await env.cleanup()}
}
main().catch(e=>{console.error("V3_FIRESTORE_EMULATOR_TEST_FAILED",e.message);process.exitCode=1});
