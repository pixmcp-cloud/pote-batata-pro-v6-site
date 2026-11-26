import {queueRow,orderPrintText,createQueueController} from './pdv_checkout_queue.mjs';
async function run({queueRow,row,orderPrintText:print,createQueueController:create},log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=async(f,msg)=>{let e;try{await f()}catch(x){e=x}eq(e?.message,msg)};
 const base={id:"P0000001",storeId:"shop1",status:"received",paymentStatus:"pending",stockState:"reserved",createdAt:1000000,totalCents:6500,fulfillment:"delivery",lines:[{title:"Batata",quantity:2,totalCents:6000}],events:[{status:"received",at:1000000}]};
 eq(queueRow(base,1001000).actions,["prepare","cancel","confirm_payment"]);
 eq(queueRow({...base,paymentStatus:"confirmed"},1001000).actions,["prepare"]);
 eq(queueRow({...base,status:"preparing",stockState:"consumed"},1001000).actions,["ready","confirm_payment"]);
 eq(queueRow({...base,status:"ready"},1001000).actions,["dispatch","confirm_payment"]);
 eq(queueRow({...base,status:"ready",fulfillment:"pickup"},1001000).actions,["deliver","confirm_payment"]);
 const delivered={...base,status:"delivered",stockState:"consumed",deliveredAt:1065000,elapsedMs:65000};
 eq(queueRow(delivered,2000000).elapsedMs,65000);eq(queueRow(delivered,2000000).actions,["confirm_payment"]);
 eq(queueRow({...delivered,paymentStatus:"confirmed"},2000000).actions,[]);
 eq(queueRow({...base,status:"cancelled",events:[...base.events,{status:"cancelled",at:1005000}]},2000000).elapsedMs,5000);
 eq(print(delivered).includes("Tempo total: 00:01:05"),true);eq(print(delivered).includes("Pagamento: Pendente"),true);
 eq(print({...delivered,paymentStatus:"confirmed"}).includes("Confirmado pelo lojista"),true);
 let update,offline,detaches=0,rows=[],calls=[];
 const controller=create({storeId:"shop1",subscribeOwner:(s,f,e)=>{eq(s,"shop1");update=f;offline=e;return()=>detaches++},transition:async p=>{calls.push(p);return {ok:true}},emit:r=>rows=r,clock:()=>2000000});
 update([base,{...base,id:"P2",storeId:"other"}]);eq(rows.length,1);eq(rows[0].id,base.id);
 await reject(()=>controller.act("P2","prepare","operation_00000001"),"unavailable");
 await reject(()=>controller.act(base.id,"deliver","operation_00000001"),"invalid_action");
 await reject(()=>controller.act(base.id,"confirm_payment","operation_00000001",""),"payment_reference_required");
 eq(await controller.act(base.id,"confirm_payment","operation_00000001"," Extrato conferido "),{ok:true});
 eq(calls[0].paymentReference,"Extrato conferido");eq(calls[0].storeId,"shop1");
 update([delivered]);eq(controller.print(base.id).includes("00:01:05"),true);offline();eq(rows,[]);controller.close();eq(detaches,1);update([base]);eq(rows,[]);
 log("PASS B02.3 queue",n,"assertivas");
}
await run({queueRow,orderPrintText,createQueueController},console.log);
