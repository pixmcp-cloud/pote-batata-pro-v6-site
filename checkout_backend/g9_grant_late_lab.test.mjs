import {createTrialGrantLab} from "./trial_grant_lab.mjs";
import {planLateCheckoutReceipt} from "./checkout_cash_lab.mjs";
async function run(grantFactory,late,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=async(fn,code)=>{let e;try{await fn()}catch(x){e=x}eq(e?.code??e?.message,code)};
 const now=1700000000000,epoch="checkout_epoch_001",ownerUid="owner1",storeId="shop1",session={id:"shift1",ownerUid,cutoverEpoch:epoch,status:"closed",openedAt:now-10000,closedAt:now-1000,closedSummary:{receivedCents:0}},order={id:"P0000001",storeId,acceptedCashSessionId:session.id,createdAt:now-5000,status:"delivered",paymentStatus:"confirmed",paymentMethod:"pix",totalCents:1450,paymentConfirmationReference:"Confirmado",paymentConfirmedAt:now};
 const args={ownerUid,storeId,order,session,now,epoch};
 const before=JSON.stringify(session),r=late(args);eq(r.amountCents,1450);eq(r.sessionId,null);eq(r.originSessionId,"shift1");eq(r.source,"checkout-lab-late");eq(r.outsideDrawer,true);eq(JSON.stringify(session),before);
 eq(late({...args,order:{...order,paymentMethod:"card"}}).method,"card");
 await reject(()=>late({...args,order:{...order,paymentMethod:"cash"}}),"cash_late_requires_reconciliation");
 await reject(()=>late({...args,order:{...order,acceptedCashSessionId:undefined}}),"invalid_origin_session");
 await reject(()=>late({...args,session:{...session,id:"other"}}),"invalid_origin_session");
 await reject(()=>late({...args,session:{...session,ownerUid:"other"}}),"invalid_origin_session");
 await reject(()=>late({...args,session:{...session,status:"open"}}),"invalid_origin_session");
 await reject(()=>late({...args,order:{...order,createdAt:now}}),"invalid_origin_session");
 await reject(()=>late({...args,priorReceipt:r}),"receipt_exists");
 const root="users/owner1",docs=new Map([[root,{email:"private",name:"Original",createdAt:"original"}]]),cp=x=>JSON.parse(JSON.stringify(x));let commits=0;
 const repository={transaction:async()=>({get:async p=>docs.has(p)?{data:cp(docs.get(p)),updateTime:"v1"}:null,commit:async writes=>{commits++;for(const w of writes)docs.set(w.path,cp(w.labTrialGrant?{...docs.get(w.path),...w.data}:w.data))},rollback:async()=>{}})};
 const cfg={projectId:"demo-nucleobit-checkout",repository,clock:()=>now,verifyAdmin:async t=>({uid:t,isAdmin:t==="admin1",emailVerified:true,provider:"google.com"})},grant=grantFactory(cfg),g={token:"admin1",targetUid:ownerUid,operationId:"grant_operation_001"};
 await reject(()=>grant({...g,token:"buyer"}),"forbidden");await reject(()=>grant({...g,targetUid:"admin1"}),"forbidden");await reject(()=>grant({...g,targetUid:"missing"}),"not_found");eq(commits,0);
 const granted=await grant({...g,now:0,expiresAt:"forged"});eq(Date.parse(granted.startsAt),now);eq(Date.parse(granted.expiresAt)-now,604800000);eq(docs.get(root).name,"Original");eq(docs.get(root).createdAt,"original");eq(docs.get(root).license.term,"trial7d");
 eq((await grant(g)).duplicate,true);eq(commits,1);await reject(()=>grant({...g,operationId:"grant_operation_002"}),"trial_already_used");
 docs.set(root,{license:{status:"active",kind:"pro",term:"month1",expiresAt:new Date(now+1000).toISOString()}});await reject(()=>grant({...g,operationId:"grant_operation_003"}),"active_entitlement");
 docs.set(root,{license:{status:"revoked",kind:"trial",term:"trial7d"}});await reject(()=>grant({...g,operationId:"grant_operation_004"}),"trial_already_used");
 log("PASS B02-G9 grant and late receipt",n,"assertivas");
}
await run(createTrialGrantLab,planLateCheckoutReceipt,console.log);
