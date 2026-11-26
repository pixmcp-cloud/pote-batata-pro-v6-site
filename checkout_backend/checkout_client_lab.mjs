// Laboratory frontend bridge. Firebase auth/sdk and server transport are injected.
// No auto login, no production endpoint, no actual checkout UI import.
export function createCheckoutClient({auth,signIn,send,subscribePrivate,onAuthChanged,clock=()=>Date.now()}={}){
 if(!auth||typeof signIn!=="function"||typeof send!=="function"||typeof subscribePrivate!=="function"||typeof onAuthChanged!=="function")throw Error("invalid_config");
 let epoch=0,stopped=false,login=null,stopView=null;
 const stopAuth=onAuthChanged(()=>{epoch++;if(stopView){stopView();stopView=null;}});
 const usable=u=>u&&typeof u.uid==="string"&&typeof u.getIdToken==="function"&&u.emailVerified===true&&u.providerData?.some(p=>p.providerId==="google.com");
 async function userForOrder(){
  if(stopped)throw Error("closed");
  if(!usable(auth.currentUser)){
   if(!login)login=Promise.resolve().then(()=>signIn()).finally(()=>{login=null});
   await login;
  }
  const u=auth.currentUser;if(stopped||!usable(u))throw Error("login_required");return u;
 }
 async function request(kind,params){
  const user=await userForOrder(),before=epoch,token=await user.getIdToken();
  if(stopped||epoch!==before||auth.currentUser!==user)throw Error("session_changed");
  const response=await send(kind,params,token);
  if(stopped||epoch!==before||auth.currentUser!==user)throw Error("session_changed");
  return response;
 }
 function watch(storeId,orderId,emit){
  const u=auth.currentUser;if(stopped||!usable(u))throw Error("login_required");
  if(stopView)stopView();
  const before=epoch;let active=true;
  const detach=subscribePrivate(storeId,orderId,event=>{
   if(!active||stopped||epoch!==before||auth.currentUser!==u)return;
   if(event?.customerUid!==u.uid||event?.storeId!==storeId||event?.status?.id!==orderId)return;
   // Snapshot time is commit time, NOT current time. Transport must supply a
   // fresh server clock sample for live timing; otherwise remain disconnected.
   const live=event.connected===true&&Number.isSafeInteger(event.serverNowMs);
   emit({order:event.status,serverNowMs:live?event.serverNowMs:clock(),connected:live});
  },()=>{if(active&&!stopped&&epoch===before&&auth.currentUser===u)emit({connected:false})});
  const cleanup=()=>{if(!active)return;active=false;if(typeof detach==="function")detach();emit({reset:true,connected:false})};
  stopView=cleanup;
  return ()=>{cleanup();if(stopView===cleanup)stopView=null};
 }
 return {quote:params=>request("quote",params),submit:params=>request("submit",params),watch,close(){stopped=true;if(stopView)stopView();if(typeof stopAuth==="function")stopAuth();}};
}
