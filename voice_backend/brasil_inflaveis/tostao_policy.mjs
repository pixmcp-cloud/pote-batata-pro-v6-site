// Proposta isolada para Brasil Infláveis. Sem acesso a banco, provedor ou deploy.
function integer(n,min=0,max=100000000){return Number.isSafeInteger(n)&&n>=min&&n<=max;}
export function planTostaoVoice({seconds,wallet,payment}={}){
 if(![15,30,45,60,75].includes(seconds))throw Error('Duração inválida.');
 const commercial=wallet?.commercial,promo=wallet?.promo;
 if(!integer(commercial)||!integer(promo))throw Error('Saldo de Tostões inválido.');
 const spendCommercial=payment?.commercial,spendPromo=payment?.promo;
 if(!integer(spendCommercial)||!integer(spendPromo))throw Error('Informe a composição inteira de pagamento.');
 const priceUnits=seconds/15*2;
 if(2*spendCommercial+spendPromo!==priceUnits)throw Error('Pagamento deve corresponder exatamente à tarifa.');
 if(spendCommercial>commercial||spendPromo>promo)throw Error('Saldo insuficiente na carteira correspondente.');
 return {seconds,maxChars:seconds*10,priceUnits,debited:{commercial:spendCommercial,promo:spendPromo},before:{commercial,promo},after:{commercial:commercial-spendCommercial,promo:promo-spendPromo}};
}
export function availableTostaoPayments({seconds,wallet}={}){
 if(![15,30,45,60,75].includes(seconds)||!integer(wallet?.commercial)||!integer(wallet?.promo))throw Error('Consulta inválida.');
 const options=[];
 for(let commercial=seconds/15;commercial>=0;commercial--){
 const promo=seconds/15*2-commercial*2;
 if(commercial<=wallet.commercial&&promo<=wallet.promo)options.push({commercial,promo});
 }
 return options;
}
export function fundingGate({plan,providerCostMicroBrl,netCommercialMicroBrl,promoBudgetAvailableMicroBrl}={}){
 const debit=plan?.debited;
 if(!integer(debit?.commercial,0,5)||!integer(debit?.promo,0,10)||!integer(plan?.priceUnits,2,10)||plan.priceUnits%2!==0||2*debit.commercial+debit.promo!==plan.priceUnits)throw Error('Plano de débito inválido.');
 if(!integer(providerCostMicroBrl,1,100000000)||!integer(netCommercialMicroBrl)||!integer(promoBudgetAvailableMicroBrl))throw Error('Custos e orçamento devem ser informados pelo servidor.');
 // Promoção não representa receita recebida. Reservar verba real para sua fração de custo.
 const subsidy=Math.ceil(providerCostMicroBrl*debit.promo/plan.priceUnits);
 const commercialCost=providerCostMicroBrl-subsidy;
 const netRevenue=debit.commercial*netCommercialMicroBrl;
 return {allowed:promoBudgetAvailableMicroBrl>=subsidy&&netRevenue>=2*commercialCost,promoBudgetReserveMicroBrl:subsidy,netRevenueMicroBrl:netRevenue,commercialCostMicroBrl:commercialCost};
}
