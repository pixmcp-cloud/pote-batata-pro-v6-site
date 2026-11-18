// Franchise reporting: admin-only cross-account access, no data mixing.
const assert=require("node:assert/strict");
const {initializeEmulator,assertFails,assertSucceeds,sdk}=require("./qa/firestore/environment.cjs");
(async()=>{
 const env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==="1"});
 try{
  const {recordId}=await import("./v2_store_core.mjs");
  const uid="franchise-report-owner",other="franchise-report-other";
  const id=recordId("batataria","orders","franchise-order-1");
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const key of [uid,other]){
    await sdk.setDoc(sdk.doc(db,"users",key),{
     email:key+"@example.com",license:{status:"active",kind:"lifetime",term:"lifetime"},
     franchise:{status:"active",brandId:"potebatata"}});
   }
   await sdk.setDoc(sdk.doc(db,"users",uid,"records",id),{
    record:{universe:"batataria",group:"orders",id:"franchise-order-1",
     item:{id:"franchise-order-1",qty:1,price:50,status:"entregue",
      createdAt:"2026-11-18T10:00:00Z",paymentStatus:"pago",paymentMethod:"Pix"},rank:0},
    updatedAt:sdk.serverTimestamp()});
  });
  const auth=(id,email,claim=false)=>env.authenticatedContext(id,{
   email,email_verified:true,
   firebase:{sign_in_provider:"google.com"},
   ...(claim?{potebatataAdmin:true}:{})
  }).firestore();
  const owner=auth(uid,uid+"@example.com");
  const outsider=auth(other,other+"@example.com");
  const fakeAdmin=auth("fake-admin","pixmcp@gmail.com");
  const admin=auth("real-admin","pixmcp@gmail.com",true);
  const queryFor=db=>sdk.query(
   sdk.collection(db,"users",uid,"records"),
   sdk.where("record.group","==","orders"),sdk.limit(250));
  const expected=await assertSucceeds(sdk.getDocs(queryFor(owner)));
  assert.equal(expected.size,1);
  const rows=await assertSucceeds(sdk.getDocs(queryFor(admin)));
  assert.equal(rows.size,1);
  assert.equal(rows.docs[0].data().record.item.price,50);
  await assertFails(sdk.getDocs(queryFor(outsider)));
  await assertFails(sdk.getDocs(queryFor(fakeAdmin)));
  console.log("PASS franchise admin report: owner and signed admin allowed, other franchise and spoofed admin denied.");
 }finally{await env.cleanup()}
})().catch(error=>{console.error("FRANCHISE SECURITY FAILURE",error.stack||error);process.exitCode=1});
