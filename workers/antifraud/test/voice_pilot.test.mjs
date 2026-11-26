import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoicePilot} from '../src/voice_pilot.mjs';
const uid='admin-test',root='users/'+uid,wp=root+'/aiWallet/main',voiceId='gOupLcAkjEnguROwi4oS',id='12345678-1234-4234-8234-123456789abc',env={VOICE_PILOT_ENABLED:'true',ENABLE_WRITES:'false',ELEVENLABS_API_KEY:'mock',FIREBASE_PROJECT_ID:'demo'};
const request=(route,body={},token='admin')=>new Request('https://example.com/voice/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://pixmcp-cloud.github.io'},body:JSON.stringify(body)});
function setup({failAudio=false}={}){
 const docs=new Map([[root,{email:'pixmcp@gmail.com'}],[wp,{balance:10}]]);let audioCalls=0;
 let tail=Promise.resolve();
 const repo=()=>({async transaction(){let release;const previous=tail;tail=new Promise(r=>release=r);await previous;let closed=false;const end=()=>{if(!closed){closed=true;release();}};return {async get(path){return docs.has(path)?{data:structuredClone(docs.get(path)),updateTime:'v'}:null},async commit(writes){for(const w of writes){if(w.precondition.exists===false&&docs.has(w.path))throw Error('exists');}for(const w of writes)docs.set(w.path,structuredClone(w.data));end();},async rollback(){end();}}}});
 const providerFetch=async(url,opts)=>{if(url.includes('/subscription'))return Response.json({tier:'starter',character_limit:40000,character_count:0,max_credit_limit_extension:0});if(url.includes('/voices?'))return Response.json({voices:[{voice_id:voiceId,name:'Darian'},{voice_id:'unauthorized',name:'Private'}]});if(url.includes('/text-to-speech/')){audioCalls++;assert.equal(opts.method,'POST');return failAudio?new Response('',{status:500}):new Response(new Uint8Array([73,68,51]),{headers:{'content-type':'audio/mpeg'}});}throw Error('unknown route');};
 const handler=createVoicePilot({verify:async token=>({uid,email:token==='admin'?'pixmcp@gmail.com':'other@example.org',isAdmin:token==='admin'}),repo,providerFetch,uuid:()=>id,clock:()=>10000});
 return {docs,handler,calls:()=>audioCalls};
}
test('authenticated pilot: server catalog, quote, one atomic debit, MP3 and no retry',async()=>{
 const {docs,handler,calls}=setup();
 assert.equal((await handler(request('status',{},'customer'),env)).status,403);
 const status=await (await handler(request('status'),env)).json();assert.equal(status.balance,10);assert.equal(status.voices.length,1);
 const quote=await (await handler(request('quote',{voiceId,text:'Teste',seconds:15}),env)).json();assert.equal(quote.credits,1);
 const [a,b]=await Promise.all([handler(request('generate',{quoteId:id}),env),handler(request('generate',{quoteId:id}),env)]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);assert.equal(calls(),1);assert.equal(docs.get(wp).balance,9);assert.equal(docs.get(wp+'/entries/voice-'+id+'-debit').delta,-1);
});
test('ambiguous provider failure does not retry or automatically refund',async()=>{
 const {docs,handler,calls}=setup({failAudio:true});
 await handler(request('quote',{voiceId,text:'Teste',seconds:15}),env);
 assert.equal((await handler(request('generate',{quoteId:id}),env)).status,502);
 assert.equal((await handler(request('generate',{quoteId:id}),env)).status,409);
 assert.equal(calls(),1);assert.equal(docs.get(wp).balance,9);assert.equal(docs.get('voicePilotOperations/active').state,'reconcile');
});
test('stock enabled or pilot disabled denies voice',async()=>{
 const {handler}=setup();assert.equal((await handler(request('status'),{...env,ENABLE_WRITES:'true'})).status,423);assert.equal((await handler(request('status'),{...env,VOICE_PILOT_ENABLED:'false'})).status,423);
});
