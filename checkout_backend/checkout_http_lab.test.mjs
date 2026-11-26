import {createCheckoutHttpLab} from './checkout_http_lab.mjs';
async function run(create,log){
 let n=0,calls=[];const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const cfg={projectId:"demo-nucleobit-checkout",enabled:true,api:{execute:async args=>{calls.push(args);if(args.storeId==="denied")throw Object.assign(Error("secret"),{code:"forbidden"});if(args.storeId==="expired")throw Object.assign(Error("private"),{code:"license_required"});if(args.storeId==="blocked")throw Object.assign(Error("private"),{code:"access_blocked"});if(args.storeId==="failed")throw Error("private stack");return {ok:true}},closeCash:async args=>{calls.push(args);return {ok:true}},openCash:async args=>{calls.push(args);return {ok:true}},moveCash:async args=>{calls.push(args);if(args.amountCents>5000)throw Object.assign(Error("private"),{code:"insufficient_cash"});return {ok:true}}}};
 const req={method:"POST",path:"/checkout-lab/quote",requestOrigin:"http://localhost",authorization:"Bearer token.123",contentType:"application/json",bodyText:'{"storeId":"s","operationId":"operation_00000001","input":{}}'};
 const api=create(cfg);const check=async(x,status,code)=>{const result=await api({...req,...x});eq(result.status,status);if(code)eq(result.body.error,code)};
 eq((await create({...cfg,projectId:"prod"})(req)).status,503);
 await check({method:"GET"},405,"method_not_allowed");await check({requestOrigin:"http://evil"},403,"origin_denied");await check({authorization:"Bearer bad token"},401,"login_required");await check({path:"/checkout-lab/toString"},404,"not_found");await check({contentType:"text/plain"},415,"invalid_content_type");await check({bodyText:"x".repeat(8193)},413,"body_limit");await check({bodyText:"{"},400,"invalid_json");
 for(const k of ["uid","ownerUid","role","token","now","projectId","priceCents"])await check({bodyText:JSON.stringify({[k]:"fake"})},400,"invalid_request");
 eq(calls.length,0);await check({},200);eq(calls[0].token,"token.123");eq(calls[0].kind,"quote");
 await check({bodyText:'{"storeId":"denied"}'},403,"forbidden");await check({bodyText:'{"storeId":"failed"}'},503,"operation_not_confirmed");await check({bodyText:'{"storeId":"expired"}'},403,"license_required");await check({bodyText:'{"storeId":"blocked"}'},403,"access_blocked");
 await check({path:"/checkout-lab/closeCash",bodyText:'{"sessionId":"shift1","operationId":"operation_00000002"}'},200);eq(calls.at(-1).sessionId,"shift1");
 await check({path:"/checkout-lab/openCash",bodyText:'{"sessionId":"shift1","operationId":"operation_00000003","epoch":"checkout_epoch_001","openingCashCents":5000}'},200);eq(calls.at(-1).openingCashCents,5000);
 await check({path:"/checkout-lab/moveCash",bodyText:'{"sessionId":"shift1","operationId":"operation_00000004","epoch":"checkout_epoch_001","kind":"sangria","amountCents":2000,"reason":"Teste"}'},200);eq(calls.at(-1).kind,"sangria");
 await check({path:"/checkout-lab/moveCash",bodyText:'{"amountCents":9999}'},409,"insufficient_cash");await check({path:"/checkout-lab/openCash",bodyText:'{"ownerUid":"forged"}'},400,"invalid_request");
 log("PASS B02.13 HTTP",n,"assertivas");
}
await run(createCheckoutHttpLab,console.log);
