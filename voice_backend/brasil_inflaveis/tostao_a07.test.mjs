import {planTostaoVoice,availableTostaoPayments,fundingGate} from './tostao_policy.mjs';
function runA07({planTostaoVoice:plan,availableTostaoPayments:options,fundingGate:funding}){
 const stats={wallet:0,funding:0,invalid:0,simulation:0};
 function check(group,condition,label){if(!condition)throw Error(group+": "+label);stats[group]++;}
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function reject(group,fn,label){let ok=false;try{fn()}catch{ok=true}check(group,ok,label)}
 const tiers=[15,30,45,60,75];
 // Exhaustively enumerate the bounded domain, independently of options().
 for(const seconds of tiers)for(let commercial=0;commercial<=6;commercial++)for(let promo=0;promo<=12;promo++){
  const wallet=Object.freeze({commercial,promo}),expected=[];
  for(let c=6;c>=0;c--)for(let p=0;p<=12;p++)if(c<=commercial&&p<=promo&&2*c+p===seconds/15*2)expected.push({commercial:c,promo:p});
  const choices=options({seconds,wallet});
  check("wallet",same(choices,expected),"complete exact enumeration");
  for(const payment of choices){
   Object.freeze(payment);const q=plan({seconds,wallet,payment});
   check("wallet",q.priceUnits===seconds/15*2&&q.maxChars===seconds*10,"tariff");
   check("wallet",q.after.commercial===commercial-payment.commercial&&q.after.promo===promo-payment.promo,"balance");
   check("wallet",q.after.commercial>=0&&q.after.promo>=0,"nonnegative");
   check("wallet",2*(commercial-q.after.commercial)+promo-q.after.promo===q.priceUnits,"conservation");
   check("wallet",same(q.before,wallet)&&same(q.debited,payment),"snapshot");
  }
 }
 for(const seconds of tiers)for(const payment of options({seconds,wallet:{commercial:6,promo:12}})){
  const q=plan({seconds,wallet:{commercial:6,promo:12},payment});
  for(const cost of [1,2,3,7,999,400000,100000000]){
   const subsidy=Number((BigInt(cost)*BigInt(payment.promo)+BigInt(q.priceUnits)-1n)/BigInt(q.priceUnits));
   const direct=cost-subsidy;
   for(const net of [0,1,400000,100000000])for(const budget of [0,Math.max(0,subsidy-1),subsidy,100000000]){
    const result=funding({plan:q,providerCostMicroBrl:cost,netCommercialMicroBrl:net,promoBudgetAvailableMicroBrl:budget});
    check("funding",result.promoBudgetReserveMicroBrl===subsidy&&result.commercialCostMicroBrl===direct&&result.netRevenueMicroBrl===net*payment.commercial,"integer allocation");
    check("funding",result.allowed===(budget>=subsidy&&payment.commercial*net>=2*direct),"funding gate");
   }
  }
 }
 const good={seconds:30,wallet:{commercial:5,promo:5},payment:{commercial:1,promo:2}};
 const bad=[undefined,null,-1,0.5,NaN,Infinity,"1",true,{},[],100000001,Number.MAX_SAFE_INTEGER];
 for(const value of bad){
  for(const key of ["commercial","promo"]){
   reject("invalid",()=>plan({...good,wallet:{...good.wallet,[key]:value}}),"invalid wallet");
   reject("invalid",()=>options({seconds:30,wallet:{...good.wallet,[key]:value}}),"invalid enumeration");
   reject("invalid",()=>plan({...good,payment:{...good.payment,[key]:value}}),"invalid payment");
  }
  for(const key of ["providerCostMicroBrl","netCommercialMicroBrl","promoBudgetAvailableMicroBrl"]){
   reject("invalid",()=>funding({plan:plan(good),providerCostMicroBrl:1,netCommercialMicroBrl:1,promoBudgetAvailableMicroBrl:1,[key]:value}),"invalid financial input");
  }
 }
 for(const seconds of [0,14,16,90,777,"15",null,undefined,Infinity])reject("invalid",()=>plan({...good,seconds}),"invalid tier");
 for(const payment of [{commercial:0,promo:0},{commercial:0,promo:3},{commercial:1,promo:3},{commercial:2,promo:2},{commercial:3,promo:0}])reject("invalid",()=>plan({...good,payment}),"under/overcharge");
 // Reference model only. Synchronous serialized transitions mimic an ideal atomic store;
 // NOT production D1, concurrent DB, authentication, or provider integration.
 const wallets=new Map([["bi/a/u",{commercial:2,promo:4}],["bi/b/u",{commercial:2,promo:4}],["pdv/a/u",{commercial:2,promo:4}]]);
 const jobs=new Map();let dispatches=0,global=300,budget=100;
 function reserve(scope,key,seconds,payment){
  if(!scope.startsWith("bi/"))throw Error("product");
  const id=JSON.stringify([scope,key]),fp=JSON.stringify([seconds,payment.commercial,payment.promo]);
  if(jobs.has(id)){const prior=jobs.get(id);if(prior.fp!==fp)throw Error("conflict");return prior;}
  const q=plan({seconds,wallet:wallets.get(scope),payment});
  const cost=seconds*10,g=funding({plan:q,providerCostMicroBrl:cost,netCommercialMicroBrl:1000,promoBudgetAvailableMicroBrl:budget});
  if(global<cost||!g.allowed)throw Error("quota/funding");
  global-=cost;budget-=g.promoBudgetReserveMicroBrl;wallets.set(scope,q.after);
  const j={id,scope,fp,q,cost,subsidy:g.promoBudgetReserveMicroBrl,state:"held"};jobs.set(id,j);return j;
 }
 function dispatch(j){if(j.state!=="held")throw Error("state");j.state="intent";dispatches++;}
 function fail(j){if(j.state==="intent")j.state="reconcile";else if(j.state==="held"){const w=wallets.get(j.scope);wallets.set(j.scope,{commercial:w.commercial+j.q.debited.commercial,promo:w.promo+j.q.debited.promo});global+=j.cost;budget+=j.subsidy;j.state="released";}}
 function complete(j){if(j.state==="completed")return;if(j.state!=="intent")throw Error("state");j.state="completed";}
 const a=reserve("bi/a/u","1",15,{commercial:1,promo:0});
 check("simulation",reserve("bi/a/u","1",15,{commercial:1,promo:0})===a,"repeat returns same job");
 check("simulation",same(wallets.get("bi/a/u"),{commercial:1,promo:4}),"one debit");
 reject("simulation",()=>reserve("bi/a/u","1",15,{commercial:0,promo:2}),"conflicting retry");
 reject("simulation",()=>reserve("pdv/a/u","1",15,{commercial:1,promo:0}),"reject other product");
 check("simulation",same(wallets.get("pdv/a/u"),{commercial:2,promo:4}),"other product unaffected");
 const b=reserve("bi/b/u","1",15,{commercial:1,promo:0});
 check("simulation",b!==a&&global===0,"tenant-specific key and shared cap");
 reject("simulation",()=>reserve("bi/a/u","2",15,{commercial:1,promo:0}),"exhausted global");
 fail(b);fail(b);
 check("simulation",global===150&&same(wallets.get("bi/b/u"),{commercial:2,promo:4}),"release once");
 reject("simulation",()=>reserve("bi/b/u","promo",15,{commercial:0,promo:2}),"unfunded promo");
 const c=reserve("bi/b/u","commercial",15,{commercial:1,promo:0});
 dispatch(a);reject("simulation",()=>dispatch(a),"no duplicate dispatch");
 fail(a);fail(a);
 check("simulation",a.state==="reconcile"&&global===0,"ambiguous retains hold");
 reject("simulation",()=>dispatch(a),"no retry ambiguous");
 dispatch(c);complete(c);complete(c);
 check("simulation",dispatches===2&&c.state==="completed","capture idempotent");
 check("simulation",same(wallets.get("bi/a/u"),{commercial:1,promo:4})&&same(wallets.get("bi/b/u"),{commercial:1,promo:4}),"isolated balances");
 check("simulation",budget===100,"failed promo does not consume budget");
 // Independent mixed-payment scenario with reset mock fixtures.
 global=300;budget=150;wallets.set("bi/c/u",{commercial:1,promo:2});
 const mixed=reserve("bi/c/u","mixed",30,{commercial:1,promo:2});
 check("simulation",global===0&&budget===0&&same(wallets.get("bi/c/u"),{commercial:0,promo:0}),"mixed payment and subsidy both reserved");
 check("simulation",reserve("bi/c/u","mixed",30,{commercial:1,promo:2})===mixed&&budget===0,"mixed retry retains one reservation");
 fail(mixed);fail(mixed);
 check("simulation",global===300&&budget===150&&same(wallets.get("bi/c/u"),{commercial:1,promo:2}),"mixed release restores both balances and subsidy exactly once");
 const finalMixed=reserve("bi/c/u","mixed2",30,{commercial:1,promo:2});
 dispatch(finalMixed);complete(finalMixed);complete(finalMixed);
 check("simulation",global===0&&budget===0&&same(wallets.get("bi/c/u"),{commercial:0,promo:0}),"mixed capture retains funded charge");
 return stats;
}
const stats=runA07({planTostaoVoice,availableTostaoPayments,fundingGate});
console.log('PASS A07',JSON.stringify(stats),'total',Object.values(stats).reduce((a,b)=>a+b,0));
