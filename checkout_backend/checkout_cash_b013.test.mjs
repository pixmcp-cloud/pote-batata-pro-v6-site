import {openCheckoutCash,planDrawerMovement,checkoutDrawer,applyCheckoutReceipt,freezeCheckoutCashSession} from "./checkout_cash_lab.mjs";
function run(lib,log){
 const {openCheckoutCash:open,planDrawerMovement:move,checkoutDrawer:drawer,applyCheckoutReceipt:receive,freezeCheckoutCashSession:close}=lib;
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};
 const reject=(fn,code)=>{let e;try{fn()}catch(x){e=x}eq(e?.code,code)};
 const now=1700000000000,epoch="checkout_epoch_001",op=i=>"cash_operation_"+String(i).padStart(4,"0");
 const opts={ownerUid:"owner1",sessionId:"shift1",openingCashCents:5000,operationId:op(1),now,epoch};
 let s=open(opts);eq(drawer(s).expectedCashCents,5000);eq(s.revision,0);
 reject(()=>open({...opts,openingCashCents:-1}),"invalid_request");reject(()=>open({...opts,epoch:"bad"}),"invalid_request");reject(()=>open({...opts,openingCashCents:1.5}),"invalid_request");
 const m=(kind,amountCents,reason="teste")=>move({session:s,kind,amountCents,reason,operationId:op(2),now});
 reject(()=>m("sangria",5001),"insufficient_cash");reject(()=>m("sangria",0),"invalid_movement");reject(()=>m("suprimento",100," "),"invalid_movement");reject(()=>m("reembolso",100),"invalid_movement");
 const supply=m("suprimento",2000);eq(supply.movement.amountCents,2000);eq(drawer(s).expectedCashCents,5000);s=supply.session;eq(drawer(s).expectedCashCents,7000);
 s=m("sangria",1000).session;eq(drawer(s).expectedCashCents,6000);eq(s.cashAdjustments.count,2);
 const receipt=method=>({ownerUid:"owner1",sessionId:"shift1",method,amountCents:1450});
 s=receive(s,receipt("pix"));eq(drawer(s).expectedCashCents,6000);
 s=receive(s,receipt("cash"));eq(drawer(s).expectedCashCents,7450);
 reject(()=>m("sangria",7451),"insufficient_cash");reject(()=>close(s,now,op(3),-1),"invalid_counted_cash");
 const done=close(s,now,op(3),7400);eq(done.closedSummary.differenceCents,-50);eq(done.closedSummary.receivedCents,2900);eq(done.closedSummary.expectedCashCents,7450);eq(done.closedSummary.cashDrawerIncreaseCents,1450);eq(done.status,"closed");eq(s.status,"open");
 s=done;reject(()=>m("suprimento",1),"invalid_movement");reject(()=>close(s,now,op(4),7400),"invalid_close");
 log("PASS B02.13 cash",n,"assertivas");
}
run({openCheckoutCash,planDrawerMovement,checkoutDrawer,applyCheckoutReceipt,freezeCheckoutCashSession},console.log);
