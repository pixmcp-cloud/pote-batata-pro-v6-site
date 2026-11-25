import test from 'node:test';
import assert from 'node:assert/strict';
import {authorized,priceCredits,durationQuote,validateVoiceOptions,commercialReady,canReserve,franchiseQuota,canUseFranchiseQuota,individualFranchiseQuota} from './policy.mjs';
test('FREE e teste grátis ficam bloqueados; PRO válido, vitalício, franquia e ADM verificado autorizam',()=>{
 for(const p of [undefined,{}, {plan:'pro'}, {role:'admin'}, {franchise:{status:'active'}},{accessPolicy:{voiceAiEnabled:'true'}}])assert.equal(authorized(p),false);
 assert.equal(authorized({accessPolicy:{voiceAiEnabled:true}}),false);
 const p={license:{kind:'pro',term:'month1',status:'active',expiresAt:{toMillis:()=>200}}};
 assert.equal(authorized(p,100),true);assert.equal(authorized(p,200),false);
 assert.equal(authorized({...p,accessPolicy:{voiceAiEnabled:false}},100),false);
 assert.equal(authorized({license:{...p.license,kind:'trial',term:'trial24h'}},100),false);
 assert.equal(authorized({license:{kind:'lifetime',term:'lifetime',status:'active'}},100),true);
 assert.equal(authorized({},100,true),true);
 assert.equal(authorized({accessPolicy:{voiceAiEnabled:false}},100,true),false);
 const f={franchise:{status:'active',brandId:'potebatata'}};
 assert.equal(authorized(f),true);assert.equal(authorized({...f,accessPolicy:{voiceAiEnabled:false}}),false);
 assert.equal(authorized({franchise:{status:'inactive',brandId:'potebatata'}}),false);
});
test('2x custo e arredondamento para cima',()=>{
 const cfg={providerMicroBrlPer1000:1000000,creditMicroBrl:100000};
 assert.equal(priceCredits('x'.repeat(100),cfg),2);
 assert.equal(priceCredits('x'.repeat(101),cfg),3);
 assert.equal(priceCredits('x',cfg),1);
 assert.throws(()=>priceCredits('x',{}));
 assert.throws(()=>priceCredits('x'.repeat(778),cfg));
});
test('licença comercial positiva e plano gratuito sempre bloqueado',()=>{
 const cfg={commercialApproved:true,licensedTiers:['starter','free']};
 const s={tier:'starter',max_credit_limit_extension:0};
 assert.equal(commercialReady(s,cfg),true);
 assert.equal(commercialReady({...s,tier:'free'},cfg),false);
 assert.equal(commercialReady(s,{...cfg,commercialApproved:false}),false);
 assert.equal(commercialReady({...s,max_credit_limit_extension:100},cfg),false);
});
test('reserva exige identidade, autorização, licença, saldo e cotação única válida',()=>{
 const a={profile:{license:{kind:'pro',term:'month1',status:'active',expiresAt:{toMillis:()=>200}}},commercial:true,quote:{uid:'u',state:'quoted',credits:3,expiresAt:100},balance:5,uid:'u',now:10};
 assert.equal(canReserve(a),true);
 for(const b of [{balance:2},{commercial:false},{profile:{}},{uid:'other'},{now:100},{quote:{...a.quote,state:'reserved'}}])assert.equal(canReserve({...a,...b}),false);
});

test('franquias compartilham 20% da cota do ciclo; sem desconto no preço',()=>{
 const cfg={providerMicroBrlPer1000:1000000,creditMicroBrl:100000};
 assert.equal(priceCredits('x'.repeat(500),cfg),10);
 const q=franchiseQuota({character_limit:10000,next_character_count_reset_unix:1800000000});
 assert.deepEqual(q,{cycle:'1800000000',limit:2000});
 assert.equal(canUseFranchiseQuota({limit:q.limit,used:1990,requested:10}),true);
 assert.equal(canUseFranchiseQuota({limit:q.limit,used:1990,requested:11}),false);
 assert.throws(()=>franchiseQuota({character_limit:10000}));
 assert.equal(canUseFranchiseQuota({limit:2000,used:-1,requested:1}),false);
});

test('divisão igual para 1, 2, 3, 4 e 10 franquias',()=>{
 for(const [count,share] of [[1,2000],[2,1000],[3,666],[4,500],[10,200]]){
  const q=individualFranchiseQuota({limit:2000,count,used:0,individualUsed:0});
  assert.equal(q.share,share);assert.equal(q.remaining,share);assert.ok(q.share*count<=2000);
 }
});
test('entrada e saída de franquias preservam uso e teto coletivo',()=>{
 const q=(count,used,individualUsed)=>individualFranchiseQuota({limit:2000,count,used,individualUsed});
 assert.equal(q(1,800,800).remaining,1200);
 assert.equal(q(2,800,800).remaining,200);
 assert.equal(q(3,800,800).remaining,0);
 assert.equal(q(3,800,0).remaining,666);
 assert.equal(q(2,1900,0).remaining,100);
 assert.equal(q(1,1900,100).remaining,100);
 assert.equal(q(2,2000,0).remaining,0);
 assert.throws(()=>q(0,0,0));assert.throws(()=>q(2,10,11));
});

test('valor de referência da moeda não supera R$1,10 líquido',()=>{
 const cfg={providerMicroBrlPer1000:3000000,creditMicroBrl:2000000};
 assert.equal(priceCredits('x'.repeat(500),cfg),3);
 assert.equal(priceCredits('x'.repeat(777),cfg),5);
 assert.equal(priceCredits('x'.repeat(500),{...cfg,creditMicroBrl:900000}),4);
});

test('tarifa fixa aprovada: uma moeda a cada 15 segundos até 75',()=>{
 const cfg={providerMicroBrlPer1000:3000000,creditMicroBrl:1100000};
 for(const seconds of [15,30,45,60,75]){
  const q=durationQuote('x'.repeat(seconds*10),seconds,cfg);
  assert.deepEqual(q,{seconds,credits:seconds/15,maxChars:seconds*10});
  assert.throws(()=>durationQuote('x'.repeat(seconds*10+1),seconds,cfg));
 }
 for(const seconds of [0,14,16,90,'15'])assert.throws(()=>durationQuote('x',seconds,cfg));
 assert.throws(()=>durationQuote('x'.repeat(150),15,{...cfg,providerMicroBrlPer1000:10000000}));
});

test('voice configuration is constrained to approved model, language and provider parameters',()=>{
 const good={modelId:'eleven_flash_v2_5',languageCode:'pt',voiceSettings:{stability:.45,similarity_boost:.8,style:.25,speed:1.05,use_speaker_boost:true}};
 assert.deepEqual(validateVoiceOptions(good),good);
 assert.equal(validateVoiceOptions().voiceSettings.speed,1);
 for(const v of [.69,1.21,'1',NaN])assert.throws(()=>validateVoiceOptions({...good,voiceSettings:{...good.voiceSettings,speed:v}}));
 assert.throws(()=>validateVoiceOptions({...good,modelId:'eleven_v3'}));
 assert.throws(()=>validateVoiceOptions({...good,languageCode:'bad'}));
 assert.throws(()=>validateVoiceOptions({...good,voiceSettings:{...good.voiceSettings,style:2}}));
 assert.throws(()=>validateVoiceOptions({...good,voiceSettings:{...good.voiceSettings,use_speaker_boost:'true'}}));
 assert.throws(()=>validateVoiceOptions({...good,voiceSettings:{...good.voiceSettings,extra:1}}));
});
