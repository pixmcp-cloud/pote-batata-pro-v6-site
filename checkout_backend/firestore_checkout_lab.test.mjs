import {createCheckoutLabRepository} from './firestore_checkout_lab.mjs';
async function run(create,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};async function rejects(fn,code){let e;try{await fn()}catch(x){e=x}eq(e?.code,code)}
 const data=new Map();let version=0,failCommit=false,commitCount=0;
 const clone=x=>JSON.parse(JSON.stringify(x));const set=(p,v)=>data.set(p,{data:clone(v),updateTime:"v"+ ++version});
 const read=p=>data.get(p)?.data;
 const root="users/merchant1",stock=root+"/recordsV5/model~potato",pulse=root+"/appState/v5Pulse",guard=root+"/appState/v5InventoryGuard";
 const manifest={lab:true,enabled:true,ownerUid:"merchant1",universe:"batataria",revision:"rev1",deliveryEnabled:true,deliveryFeeCents:500,stockMap:[{stockId:"potato",universe:"batataria",group:"ingredients",itemId:"potato",recordKey:"model~potato",scale:1000}],products:[{id:"meal",title:"Batata",available:true,priceCents:3000,recipe:[{stockId:"potato",units:250}],extras:[]}]};
 for(const s of ["shop1","shop2"]){set("checkoutLabStores/"+s,manifest);set("checkoutLabStores/"+s+"/meta/sequence",{value:0})}
 set(root+"/appState/v5",{schemaVersion:5});set(guard,{revision:0});set(pulse,{eventId:"seed"});set(stock,{record:{universe:"batataria",group:"ingredients",id:"potato",item:{stock:.5,name:"Batata"},rank:7}});
 const repository={async transaction(){const reads=new Map();return {async get(p){if(!reads.has(p))reads.set(p,data.has(p)?clone(data.get(p)):null);return reads.get(p)},async commit(writes){if(failCommit){failCommit=false;throw Object.assign(Error("injected"),{code:"injected"})}for(const [p,old] of reads){if((data.get(p)?.updateTime??null)!==(old?.updateTime??null))throw Object.assign(Error("conflict"),{code:"conflict"})}const paths=new Set();for(const w of writes){if(paths.has(w.path))throw Error("duplicate write");paths.add(w.path);const old=data.get(w.path);if(w.precondition.exists===false?!!old:old?.updateTime!==w.precondition.updateTime)throw Object.assign(Error("conflict"),{code:"conflict"})}for(const w of writes)set(w.path,w.data);commitCount++},async rollback(){}}}};
 let now=1000000;const cfg={projectId:"demo-nucleobit-checkout",enabled:true,repository,clock:()=>now,verifyToken:async t=>({uid:t,emailVerified:t!=="unverified",provider:"google.com"})};
 const api=create(cfg);const id=n=>"operation_"+String(n).padStart(8,"0");const input={lines:[{productId:"meal",quantity:2,extras:[]}],fulfillment:"pickup",paymentMethod:"pix"};
 const q=(shop,token,n)=>api.execute({storeId:shop,token,kind:"quote",operationId:id(n),input});
 const submit=(shop,token,n,qid)=>api.execute({storeId:shop,token,kind:"submit",operationId:id(n),quoteId:id(qid),input,expectedRevision:"rev1",expectedTotalCents:6000});
 const action=(shop,token,n,a)=>api.execute({storeId:shop,token,kind:"transition",operationId:id(n),orderId:"P0000001",action:a});
 const status=(shop,token)=>api.execute({storeId:shop,token,kind:"status",orderId:"P0000001"});
 await rejects(()=>create({...cfg,projectId:"potobatata-b71f3"}).execute({}),"lab_disabled");await rejects(()=>create({...cfg,enabled:false}).execute({}),"lab_disabled");
 await rejects(()=>q("shop1","unverified",1),"login_required");
 const first=await q("shop1","buyer1",1);eq(first.totalCents,6000);eq(read(stock).record.item.stock,.5);eq((await q("shop1","buyer1",1)).quoteId,id(1));eq(commitCount,1);
 await q("shop2","buyer2",2);await rejects(()=>submit("shop1","buyer2",3,1),"invalid_quote");await rejects(()=>api.execute({storeId:"shop1",token:"buyer1",kind:"submit",operationId:id(3),quoteId:id(1),input,expectedRevision:"rev1",expectedTotalCents:1}),"invalid_quote");
 failCommit=true;await rejects(()=>submit("shop1","buyer1",3,1),"injected");eq(read(stock).record.item.stock,.5);eq(read("checkoutLabStores/shop1/orders/P0000001"),undefined);eq(read(guard).revision,0);
 const outcomes=await Promise.allSettled([submit("shop1","buyer1",3,1),submit("shop2","buyer2",4,2)]);eq(outcomes.filter(x=>x.status==="fulfilled").length,1);eq(outcomes.find(x=>x.status==="rejected").reason.code,"conflict");eq(read(stock).record.item.stock,0);eq(read(guard).revision,1);eq(read(pulse).affected,1);
 const winner=outcomes[0].status==="fulfilled"?"shop1":"shop2",loser=winner==="shop1"?"shop2":"shop1",buyer=winner==="shop1"?"buyer1":"buyer2",other=winner==="shop1"?"buyer2":"buyer1",op=winner==="shop1"?3:4,qid=winner==="shop1"?1:2,lop=winner==="shop1"?4:3,lqid=winner==="shop1"?2:1;
 await rejects(()=>submit(loser,other,lop,lqid),"insufficient_stock");eq((await submit(winner,buyer,op,qid)).duplicate,true);eq(read(guard).revision,1);await rejects(()=>status(winner,other),"not_found");await rejects(()=>action(winner,other,5,"prepare"),"forbidden");eq((await status(winner,buyer)).status,"received");eq(read("checkoutLabStores/"+winner+"/customerViews/P0000001").customerUid,buyer);
 const mpath="checkoutLabStores/"+winner;const changed=clone(manifest);changed.stockMap[0].scale=100;set(mpath,changed);await rejects(()=>action(winner,"merchant1",6,"cancel"),"stock_mapping_changed");eq(read(stock).record.item.stock,0);set(mpath,manifest);
 now+=1000;eq((await action(winner,"merchant1",6,"cancel")).status,"cancelled");eq(read(stock).record.item.stock,.5);eq(read(guard).revision,2);eq((await action(winner,"merchant1",6,"cancel")).duplicate,true);eq(read(guard).revision,2);
 const retry=await submit(loser,other,lop,lqid);eq(retry.status,"received");eq(read(stock).record.item.stock,0);eq(read(guard).revision,3);
 now+=1000;eq((await action(loser,"merchant1",7,"prepare")).status,"preparing");eq(read(stock).record.item.stock,0);eq(read(guard).revision,3);await rejects(()=>action(loser,"merchant1",8,"cancel"),"manual_reconciliation_required");
 now+=1000;eq((await action(loser,"merchant1",9,"ready")).status,"ready");now+=1000;eq((await action(loser,"merchant1",10,"deliver")).status,"delivered");const frozen=(await status(loser,other)).elapsedMs;now+=100000;eq((await status(loser,other)).elapsedMs,frozen);
 eq(read("checkoutLabStores/"+loser+"/customerViews/P0000001").status.elapsedMs,frozen);
 eq([...data.keys()].filter(p=>p.includes("/stockLedger/")).length,3);
 const cash="checkoutLabCash/merchant1",session=cash+"/sessions/shift1",orderPath="checkoutLabStores/"+loser+"/orders/P0000001",receiptPath=cash+"/receipts/"+loser.length+"_"+loser+"_P0000001";
 const confirm=()=>api.execute({storeId:loser,token:"merchant1",kind:"transition",operationId:id(11),orderId:"P0000001",action:"confirm_payment",paymentReference:"Extrato conferido"});
 await rejects(confirm,"cash_not_open");eq(read(orderPath).paymentStatus,"pending");
 set(cash,{activeSessionId:"shift1"});set(session,{id:"shift1",ownerUid:"merchant1",status:"open",openedAt:now-1000,revision:0,totals:{cash:0,pix:0,card:0,count:0}});
 failCommit=true;await rejects(confirm,"injected");eq(read(orderPath).paymentStatus,"pending");eq(read(receiptPath),undefined);eq(read(session).revision,0);
 eq((await confirm()).paymentStatus,"confirmed");eq(read(receiptPath).amountCents,6000);eq(read(session).totals,{cash:0,pix:6000,card:0,count:1});eq((await confirm()).duplicate,true);eq(read(session).revision,1);
 await rejects(()=>api.closeCash({token:"buyer1",sessionId:"shift1",operationId:id(12)}),"not_found");
 const closed=await api.closeCash({token:"merchant1",sessionId:"shift1",operationId:id(12)});eq(closed.receivedCents,6000);eq(closed.cashDrawerIncreaseCents,0);eq(read(cash).activeSessionId,null);eq(read(session).status,"closed");eq(await api.closeCash({token:"merchant1",sessionId:"shift1",operationId:id(12)}),closed);await rejects(()=>api.closeCash({token:"merchant1",sessionId:"shift1",operationId:id(13)}),"cash_already_closed");eq((await confirm()).duplicate,true);eq(read(session).closedSummary,closed);eq(read(stock).record.item.stock,0);
 log("PASS B02.4",n,"assertivas com mock de transações versionadas e conflito");
}
await run(createCheckoutLabRepository,console.log);
