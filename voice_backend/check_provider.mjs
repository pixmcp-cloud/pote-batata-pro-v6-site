// Diagnostic only. Never logs secret, personal details, or response bodies.
const key=process.env.ELEVENLABS_API_KEY;
if(!key){console.error('SECRET_NOT_CONFIGURED: configure ELEVENLABS_API_KEY no GitHub Actions.');process.exit(1)}
async function get(path,label){
 const res=await fetch('https://api.elevenlabs.io'+path,{headers:{'xi-api-key':key},signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!res.ok)throw Error(label+'_HTTP_'+res.status);
 return res.json();
}
try{
 const s=await get('/v1/user/subscription','SUBSCRIPTION');
 const catalog=await get('/v2/voices?page_size=100','VOICES');
 const overageOff=s.max_credit_limit_extension===0||(s.max_credit_limit_extension==null&&s.can_extend_character_limit===false);
 const safeInt=x=>Number.isSafeInteger(x)&&x>=0?x:null;
 const tier=typeof s.tier==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(s.tier)?s.tier:'unknown';
 console.log(JSON.stringify({subscription:tier,limit:safeInt(s.character_limit),used:safeInt(s.character_count),overageOff,instantClone:s.can_use_instant_voice_cloning===true,voiceCount:Array.isArray(catalog.voices)?catalog.voices.length:0,moreVoices:catalog.has_more===true},null,2));
 if(!['starter','creator','pro','scale','business','enterprise'].includes(tier))throw Error('PAID_TIER_NOT_CONFIRMED');
 if(!overageOff)throw Error('OVERAGE_NOT_CONFIRMED_OFF');
 if(!Array.isArray(catalog.voices)||catalog.voices.length===0)throw Error('NO_VOICES_AVAILABLE');
 console.log('PASS: chave, assinatura e catálogo validados por GET; nenhum áudio ou clone gerado.');
}catch(e){console.error('CHECK_FAILED: '+(/^[A-Z_0-9]+$/.test(e.message)?e.message:'NETWORK_OR_INVALID_RESPONSE'));process.exitCode=1}
