import {planTostaoVoice,availableTostaoPayments,fundingGate} from './tostao_policy.mjs';
function runTests(plan,options,funding){
 let count=0;
 const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Divergência: '+JSON.stringify([a,b]));count++;};
 const rejects=(fn)=>{let rejected=false;try{fn()}catch{rejected=true}if(!rejected)throw Error('Entrada inválida aceita');count++;};
 for(const seconds of [15,30,45,60,75]){
 const c=seconds/15,wallet={commercial:10,promo:20};
 const choices=options({seconds,wallet});
 eq(choices.length,c+1);
 for(const payment of choices){
 const q=plan({seconds,wallet,payment});
 eq(q.priceUnits,c*2);eq(q.maxChars,seconds*10);eq(q.after,{commercial:10-payment.commercial,promo:20-payment.promo});
 eq(q.before,wallet);
 }
 }
 eq(options({seconds:30,wallet:{commercial:1,promo:2}}),[{commercial:1,promo:2}]);
 eq(options({seconds:30,wallet:{commercial:0,promo:3}}),[]);
 const input={seconds:30,wallet:{commercial:5,promo:5},payment:{commercial:1,promo:2}};
 for(const change of [{seconds:14},{seconds:'30'},{payment:{commercial:0,promo:3}},{payment:{commercial:2,promo:1}},{payment:{commercial:1,promo:2.5}},{payment:{commercial:-1,promo:6}},{wallet:{commercial:0,promo:5}},{wallet:{commercial:5,promo:1}},{wallet:{commercial:Infinity,promo:5}},{wallet:{commercial:5,promo:NaN}},{payment:null},{wallet:null}])rejects(()=>plan({...input,...change}));
 const q=plan(input);const costs={plan:q,providerCostMicroBrl:400000,netCommercialMicroBrl:500000,promoBudgetAvailableMicroBrl:200000};
 eq(funding(costs),{allowed:true,promoBudgetReserveMicroBrl:200000,netRevenueMicroBrl:500000,commercialCostMicroBrl:200000});
 eq(funding({...costs,promoBudgetAvailableMicroBrl:199999}).allowed,false);
 eq(funding({...costs,netCommercialMicroBrl:399999}).allowed,false);
 const p=plan({seconds:15,wallet:{commercial:0,promo:2},payment:{commercial:0,promo:2}});
 eq(funding({...costs,plan:p,promoBudgetAvailableMicroBrl:400000}).allowed,true);
 eq(funding({...costs,plan:p,promoBudgetAvailableMicroBrl:0}).allowed,false);
 const commercialOnly=plan({seconds:15,wallet:{commercial:1,promo:0},payment:{commercial:1,promo:0}});
 eq(funding({...costs,plan:commercialOnly,netCommercialMicroBrl:800000,promoBudgetAvailableMicroBrl:0}).allowed,true);
 rejects(()=>funding({...costs,providerCostMicroBrl:0}));
 rejects(()=>funding({...costs,plan:{priceUnits:2,debited:{commercial:0,promo:0}}}));
 return count;
}
console.log('PASS: '+runTests(planTostaoVoice,availableTostaoPayments,fundingGate)+' verificações');
