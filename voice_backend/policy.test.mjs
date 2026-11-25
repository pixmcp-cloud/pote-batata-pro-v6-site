import test from 'node:test';
import assert from 'node:assert/strict';
import {authorized,priceCredits,commercialReady,canReserve} from './policy.mjs';
test('PRO, ADM e perfil ausente não autorizam por si; franquia oficial é exceção',()=>{
 for(const p of [undefined,{}, {plan:'pro'}, {role:'admin'}, {franchise:{status:'active'}},{accessPolicy:{voiceAiEnabled:'true'}}])assert.equal(authorized(p),false);
 assert.equal(authorized({accessPolicy:{voiceAiEnabled:true}}),true);
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
 const a={profile:{accessPolicy:{voiceAiEnabled:true}},commercial:true,quote:{uid:'u',state:'quoted',credits:3,expiresAt:100},balance:5,uid:'u',now:10};
 assert.equal(canReserve(a),true);
 for(const b of [{balance:2},{commercial:false},{profile:{}},{uid:'other'},{now:100},{quote:{...a.quote,state:'reserved'}}])assert.equal(canReserve({...a,...b}),false);
});

test('franquia ativa recebe 20% antes do arredondamento, demais pagam preço integral',()=>{
 const cfg={providerMicroBrlPer1000:1000000,creditMicroBrl:100000};const f={franchise:{status:'active',brandId:'potebatata'}};
 assert.equal(priceCredits('x'.repeat(500),cfg),10);assert.equal(priceCredits('x'.repeat(500),cfg,f),8);
 assert.equal(priceCredits('x'.repeat(501),cfg,f),9);assert.equal(priceCredits('x'.repeat(500),cfg,{franchise:{status:'inactive',brandId:'potebatata'}}),10);
});
