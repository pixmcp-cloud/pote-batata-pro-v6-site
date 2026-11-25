// Policy only, independent from browser and subscription level.
export function isFranchise(profile){return profile?.franchise?.status==='active'&&profile.franchise.brandId==='potebatata';}
// FREE and trial are excluded, even if an old explicit voice grant exists.
export function authorized(profile,now=Date.now(),admin=false){
 if(profile?.accessPolicy?.voiceAiEnabled===false)return false;
 if(admin===true)return true;
 if(isFranchise(profile))return true;
 const l=profile?.license;
 if(l?.status!=='active')return false;
 if(l.kind==='lifetime')return l.term==='lifetime';
 const expires=typeof l.expiresAt?.toMillis==='function'?l.expiresAt.toMillis():NaN;
 return l.kind==='pro'&&['month1','month6','year1'].includes(l.term)&&Number.isFinite(expires)&&expires>now;
}
export function validateText(text){
 if(typeof text!=='string'||!text.trim()||text.length>777)throw Error('Texto de 1 a 777 caracteres.');
 return text.trim();
}
export function priceCredits(text,{providerMicroBrlPer1000,creditMicroBrl}){
 const n=validateText(text).length;
 for(const v of [providerMicroBrlPer1000,creditMicroBrl])if(!Number.isSafeInteger(v)||v<=0)throw Error('Preço do provedor e valor de crédito precisam ser configurados pelo servidor.');
 const a=2n*BigInt(n)*BigInt(providerMicroBrlPer1000),b=1000n*BigInt(creditMicroBrl);
 const value=(a+b-1n)/b;
 if(value>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Orçamento fora do limite.');
 return Math.max(1,Number(value));
}
export function commercialReady(subscription,config){
 return config?.commercialApproved===true&&Array.isArray(config?.licensedTiers)&&config.licensedTiers.length>0&&
 typeof subscription?.tier==='string'&&subscription.tier!=='free'&&subscription.tier!=='free_tier'&&config.licensedTiers.includes(subscription.tier)&&
 (subscription.max_credit_limit_extension===0||(subscription.max_credit_limit_extension==null&&subscription.can_extend_character_limit===false));
}
export function canReserve({profile,commercial,quote,balance,uid,now,admin=false}){
 return authorized(profile,now,admin)&&commercial===true&&quote?.uid===uid&&quote?.state==='quoted'&&
 Number.isSafeInteger(quote?.credits)&&quote.credits>0&&Number.isSafeInteger(balance)&&balance>=quote.credits&&
 Number.isSafeInteger(quote?.expiresAt)&&quote.expiresAt>now;
}

// Limite coletivo por ciclo da assinatura, em créditos do provedor; estimativa conservadora de 1 crédito/caractere.
export function franchiseQuota(subscription){
 const {character_limit:limit,next_character_count_reset_unix:reset}=subscription||{};
 if(!Number.isSafeInteger(limit)||limit<0||!Number.isSafeInteger(reset)||reset<=0)throw Error('Ciclo ou cota do provedor indisponível.');
 return {cycle:String(reset),limit:Math.floor(limit/5)};
}
export function canUseFranchiseQuota({limit,used,requested}){
 return [limit,used,requested].every(Number.isSafeInteger)&&limit>=0&&used>=0&&requested>0&&requested<=limit-used;
}

 // Equal integer allocation; remainder stays unallocated to preserve equality.
export function individualFranchiseQuota({limit,count,used,individualUsed}){
 if(![limit,count,used,individualUsed].every(Number.isSafeInteger)||limit<0||count<1||used<0||individualUsed<0||individualUsed>used)throw Error('Cota individual ou cadastro de franquias inválido.');
 const share=Math.floor(limit/count);
 return {count,share,used:individualUsed,remaining:Math.max(0,Math.min(share-individualUsed,limit-used))};
}
