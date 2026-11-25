// Policy only, independent from browser and subscription level.
export function isFranchise(profile){return profile?.franchise?.status==='active'&&profile.franchise.brandId==='potebatata';}
export function authorized(profile){const flag=profile?.accessPolicy?.voiceAiEnabled;return flag===true||(flag!==false&&isFranchise(profile));}
export function validateText(text){
 if(typeof text!=='string'||!text.trim()||text.length>777)throw Error('Texto de 1 a 777 caracteres.');
 return text.trim();
}
export function priceCredits(text,{providerMicroBrlPer1000,creditMicroBrl},profile){
 const n=validateText(text).length;
 for(const v of [providerMicroBrlPer1000,creditMicroBrl])if(!Number.isSafeInteger(v)||v<=0)throw Error('Preço do provedor e valor de crédito precisam ser configurados pelo servidor.');
 const a=2n*BigInt(n)*BigInt(providerMicroBrlPer1000)*BigInt(isFranchise(profile)?80:100),b=100000n*BigInt(creditMicroBrl);
 const value=(a+b-1n)/b;
 if(value>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Orçamento fora do limite.');
 return Math.max(1,Number(value));
}
export function commercialReady(subscription,config){
 return config?.commercialApproved===true&&Array.isArray(config?.licensedTiers)&&config.licensedTiers.length>0&&
 typeof subscription?.tier==='string'&&subscription.tier!=='free'&&subscription.tier!=='free_tier'&&config.licensedTiers.includes(subscription.tier)&&
 (subscription.max_credit_limit_extension===0||(subscription.max_credit_limit_extension==null&&subscription.can_extend_character_limit===false));
}
export function canReserve({profile,commercial,quote,balance,uid,now}){
 return authorized(profile)&&commercial===true&&quote?.uid===uid&&quote?.state==='quoted'&&
 Number.isSafeInteger(quote?.credits)&&quote.credits>0&&Number.isSafeInteger(balance)&&balance>=quote.credits&&
 Number.isSafeInteger(quote?.expiresAt)&&quote.expiresAt>now;
}
