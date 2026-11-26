import {createVoiceLab} from './voice_lab_adapter.mjs';
async function run(createVoiceLab, Request, log) {
 const origin="https://lab.invalid", valid={product:"brasil-inflaveis",tenantId:"tenant-a",subjectId:"user-a",voiceAllowed:true,membershipVerified:true};
 let auth=valid, calls=[], jobs=new Map(), quotes=new Map(), debits=0;
 const fail=status=>{throw {status}};
 const sid=s=>JSON.stringify([s.product,s.tenantId,s.subjectId]);
 const broker={
  async quote(s,k,p){calls.push(["quote",s,k,p]);const id=sid(s)+k;const fp=JSON.stringify(p);if(quotes.has(id)&&quotes.get(id).fp!==fp)fail(409);if(!quotes.has(id))quotes.set(id,{fp,s:sid(s),quoteId:"quote-"+quotes.size,expiresAt:2000000000000,paymentChoice:p.paymentChoice});return quotes.get(id)},
  async submit(s,k,q){calls.push(["submit",s,k,q]);const quote=[...quotes.values()].find(x=>x.quoteId===q&&x.s===sid(s));if(!quote)fail(404);const id=sid(s)+k;if(jobs.has(id)){if(jobs.get(id).quoteId!==q)fail(409);return jobs.get(id)}if([...jobs.values()].some(j=>j.quoteId===q))fail(409);const j={jobId:"job-"+jobs.size,state:"WALLET_HELD",quoteId:q,s:sid(s),secret:"must not leak"};jobs.set(id,j);debits++;return j},
  async status(s,j){calls.push(["status",s,j]);return [...jobs.values()].find(x=>x.jobId===j&&x.s===sid(s))??null}
 };
 const adapter=createVoiceLab({mode:"mock",authenticate:async()=>auth,broker,allowedOrigin:origin});
 const key="unique-0000001";
 const body={text:"Locução de teste",durationSeconds:30,voiceId:"voice-1",paymentChoice:{commercial:1,promo:2}};
 const req=(path,method="POST",obj=body,headers={})=>new Request(origin+path,{method,headers:{Origin:origin,"Content-Type":"application/json","Idempotency-Key":key,...headers},...(method==="GET"||method==="DELETE"?{}:{body:typeof obj==="string"?obj:JSON.stringify(obj)})});
 let n=0;
 async function expect(handler,request,status,verify=()=>true){const res=await handler(request),json=await res.json();if(res.status!==status||!verify(json))throw Error("Expected "+status+", got "+res.status+" "+JSON.stringify(json));n++;return json;}
 const q="/api/voice/quotes",j="/api/voice/jobs";
 await expect(createVoiceLab(),req(q),503);
 await expect(createVoiceLab({mode:"production",authenticate:async()=>valid,broker,allowedOrigin:origin}),req(q),503);
 await expect(adapter,req("/api/other"),404);
 await expect(adapter,req(q,"GET"),405);
 await expect(adapter,req(q,"POST",body,{Origin:"https://evil.invalid"}),403);
 auth=null;await expect(adapter,req(q),401);
 auth={...valid,product:"pdv"};await expect(adapter,req(q),403);
 auth={...valid,membershipVerified:false};await expect(adapter,req(q),403);
 auth={...valid,voiceAllowed:false};await expect(adapter,req(q),403);
 auth={...valid,tenantId:""};await expect(adapter,req(q),403);
 auth=valid;
 await expect(adapter,req(q,"POST",body,{"Idempotency-Key":"short"}),400);
 await expect(adapter,req(q,"POST",body,{"Content-Type":"text/plain"}),415);
 await expect(adapter,req(q,"POST","{broken"),400);
 await expect(adapter,req(q,"POST","x".repeat(8193)),413);
 for(const change of [{tenantId:"forged"},{subjectId:"forged"},{price:0},{product:"pdv"},{durationSeconds:16},{text:""},{text:"a".repeat(301)},{voiceId:"../voice"},{paymentChoice:{commercial:1,promo:1}},{paymentChoice:{commercial:1.5,promo:1}},{paymentChoice:{commercial:1,promo:2,extra:1}},{options:{modelId:"unapproved"}}])await expect(adapter,req(q,"POST",{...body,...change}),400);
 if(calls.length!==0)throw Error("invalid requests reached broker");n++;
 const first=await expect(adapter,req(q),200,x=>x.lab===true&&x.maxChars===300&&x.paymentChoice.commercial===1);
 await expect(adapter,req(q),200,x=>x.quoteId===first.quoteId);
 await expect(adapter,req(q,"POST",{...body,text:"Outro texto"}),409);
 const job=await expect(adapter,req(j,"POST",{quoteId:first.quoteId}),202,x=>x.state==="WALLET_HELD"&&!Object.hasOwn(x,"secret"));
 await expect(adapter,req(j,"POST",{quoteId:first.quoteId}),202,x=>x.jobId===job.jobId);
 await expect(adapter,req(j,"POST",{quoteId:first.quoteId},{"Idempotency-Key":"unique-0000002"}),409);
 await expect(adapter,req(j,"POST",{quoteId:first.quoteId,price:0}),400);
 await expect(adapter,req(j+"/"+job.jobId,"GET"),202,x=>x.jobId===job.jobId);
 auth={...valid,tenantId:"tenant-b"};
 await expect(adapter,req(j+"/"+job.jobId,"GET"),404);
 await expect(adapter,req(j,"POST",{quoteId:first.quoteId}),404);
 const other=await expect(adapter,req(q),200,x=>x.quoteId!==first.quoteId);
 await expect(adapter,req(j,"POST",{quoteId:other.quoteId}),202,x=>x.jobId!==job.jobId);
 auth={...valid,subjectId:"user-b"};
 await expect(adapter,req(j+"/"+job.jobId,"GET"),404);
 if(debits!==2)throw Error("mock debit count");n++;
 auth=valid;
 const unavailable=createVoiceLab({mode:"mock",authenticate:async()=>{throw Error("private")},broker,allowedOrigin:origin});
 await expect(unavailable,req(q),503,x=>!JSON.stringify(x).includes("private"));
 const badBroker=createVoiceLab({mode:"mock",authenticate:async()=>valid,broker:{quote:async()=>({quoteId:"q",expiresAt:1,paymentChoice:{commercial:2,promo:0}})},allowedOrigin:origin});
 await expect(badBroker,req(q),503);
 log("PASS A09",n,"assertivas do adaptador, broker mock");
}
await run(createVoiceLab, Request, console.log);
