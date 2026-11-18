// Regressão F20: registros financeiros artificiais não podem omitir o pedido,
// a origem ou a comprovação. Exclusivamente Firestore Emulator.
const {initializeEmulator,assertFails,assertSucceeds,sdk}=require('./qa/firestore/environment.cjs');
const {doc,setDoc,serverTimestamp}=sdk;
(async()=>{
 const env=await initializeEmulator({hardened:false});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),'users','f20-pro'),{
    email:'f20-pro@example.com',license:{status:'active',kind:'lifetime',term:'lifetime'}});
  });
  const db=env.authenticatedContext('f20-pro',{
   email:'f20-pro@example.com',email_verified:true,
   firebase:{sign_in_provider:'google.com'}
  }).firestore();
  const write=(id,item)=>setDoc(doc(db,'users','f20-pro','records',id),{
   record:{universe:'batataria',group:'cashMovements',id,item:{id,...item},rank:0},
   updatedAt:serverTimestamp()
  });
  const base={sessionId:'shift-now',amount:32.9,at:'2026-11-18T10:00:00.000Z'};
  await assertFails(write('fake-refund-no-order',{...base,kind:'reembolso'}));
  await assertFails(write('fake-late-no-order',{...base,kind:'late_payment'}));
  await assertFails(write('fake-late-no-ref',{...base,kind:'late_payment',orderId:'order-1',originSessionId:'shift-old',paymentMethod:'pix'}));
  await assertFails(write('fake-refund-no-origin',{...base,kind:'reembolso',orderId:'order-1'}));
  await assertSucceeds(write('valid-refund',{...base,kind:'reembolso',orderId:'order-1',originSessionId:'shift-old',reason:'Devolução ao cliente'}));
  await assertSucceeds(write('valid-late',{...base,kind:'late_payment',orderId:'order-2',originSessionId:'shift-old',paymentMethod:'pix',reference:'Comprovante verificado'}));
  console.log('PASS F20: eventos de caixa obrigam metadados de rastreabilidade e aceitam eventos legítimos.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error('F20 CASH EVENTS FAILED:',e.message||e);process.exitCode=1});
