import {createCheckoutClient} from './checkout_client_lab.mjs';
async function run(create,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};async function rejects(fn,msg){let e;try{await fn()}catch(x){e=x}eq(e?.message,msg)}
 const user=uid=>({uid,emailVerified:true,providerData:[{providerId:"google.com"}],getIdToken:async()=>"token-"+uid});
 const auth={currentUser:null};let authChanged,updates,errors,signin=0,calls=[],detached=0,authDetached=0;const events=[];
 const c=create({auth,signIn:async()=>{signin++;auth.currentUser=user("buyer1");authChanged()},send:async(kind,params,token)=>{calls.push({kind,params,token});return {ok:true}},subscribePrivate:(s,o,next,error)=>{updates=next;errors=error;return()=>detached++},onAuthChanged:f=>{authChanged=f;return()=>authDetached++},clock:()=>500});
 eq(signin,0);eq(calls.length,0);await rejects(async()=>c.watch("shop1","P1",e=>events.push(e)),"login_required");eq(signin,0);
 eq(await c.quote({storeId:"shop1"}),{ok:true});eq(signin,1);eq(calls[0].token,"token-buyer1");await c.submit({storeId:"shop1"});eq(signin,1);
 c.watch("shop1","P1",e=>events.push(e));updates({customerUid:"buyer2",storeId:"shop1",status:{id:"P1"}});eq(events.length,0);
 updates({customerUid:"buyer1",storeId:"shop2",status:{id:"P1"}});eq(events.length,0);
 updates({customerUid:"buyer1",storeId:"shop1",status:{id:"P1"},connected:true,serverNowMs:1000});eq(events.at(-1).connected,true);
 errors();eq(events.at(-1).connected,false);auth.currentUser=user("buyer2");authChanged();eq(detached,1);eq(events.at(-1).reset,true);const count=events.length;
 updates({customerUid:"buyer1",storeId:"shop1",status:{id:"P1"},connected:true,serverNowMs:2000});eq(events.length,count);
 c.close();eq(authDetached,1);await rejects(()=>c.quote({}),"closed");
 log("PASS B02.2 client",n,"assertivas, Firebase/transport mock");
}
await run(createCheckoutClient,console.log);
