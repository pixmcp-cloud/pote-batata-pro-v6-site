// B02.5 transport boundary. Synthetic project only, no live Worker route.
const allowed={quote:["storeId","operationId","input"],submit:["storeId","operationId","quoteId","input","expectedRevision","expectedTotalCents"],transition:["storeId","operationId","orderId","action","paymentReference","reconciliation"],status:["storeId","orderId"],closeCash:["sessionId","operationId","epoch","countedCashCents"],openCash:["sessionId","operationId","epoch","openingCashCents"],moveCash:["sessionId","operationId","epoch","kind","amountCents","reason"],adjustStock:["storeId","epoch","operationId","stockId","kind","quantityUnits","expectedUnits","reason","purchaseCostCents","purchaseReference","supplierId"]};
const error=(status,code)=>({status,body:{error:code}});
const forbidden=["uid","role","ownerUid","customerUid","token","projectId","now"];
export function createCheckoutHttpLab({projectId,enabled=false,api,origin="http://localhost"}={}){
 const active=projectId==="demo-nucleobit-checkout"&&enabled===true&&typeof api?.execute==="function"&&typeof api?.closeCash==="function";
 return async function dispatch({method,path,requestOrigin,authorization,bodyText,contentType}={}){
  if(!active)return error(503,"lab_disabled");
  if(method!=="POST")return error(405,"method_not_allowed");
  if(requestOrigin!==origin)return error(403,"origin_denied");
  const kind=typeof path==="string"&&path.startsWith("/checkout-lab/")?path.slice(14):"";
  if(!Object.hasOwn(allowed,kind))return error(404,"not_found");
  if(typeof authorization!=="string"||!/^Bearer [A-Za-z0-9._-]{1,8192}$/.test(authorization))return error(401,"login_required");
  if(typeof contentType!=="string"||!/^application\/json(?:\s*;|$)/i.test(contentType))return error(415,"invalid_content_type");
  if(typeof bodyText!=="string"||bodyText.length>8192)return error(413,"body_limit");
  let body;try{body=JSON.parse(bodyText)}catch{return error(400,"invalid_json")}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>forbidden.includes(k)||!allowed[kind].includes(k)))return error(400,"invalid_request");
  try{
   const args={...body,token:authorization.slice(7)};
   const cashMethod=["closeCash","openCash","moveCash","adjustStock"].includes(kind);
   if(cashMethod&&typeof api[kind]!=="function")return error(503,"lab_disabled");
   const result=cashMethod?await api[kind](args):await api.execute({...args,kind});
   return {status:200,body:result};
  }catch(e){
   const code=e?.code;
   if(code==="login_required")return error(401,code);
   if(code==="forbidden")return error(403,code);
   if(code==="not_found")return error(404,code);
   if(["invalid_request","invalid_action","invalid_operation","invalid_reconciliation","payment_reference_required","refund_reference_required","invalid_movement","invalid_counted_cash","invalid_stock_adjustment","invalid_stock_precision","no_stock_change","invalid_purchase_evidence","invalid_supplier"].includes(code))return error(400,code);
   if(["idempotency_conflict","insufficient_stock","invalid_quote","quote_changed","cash_not_open","reservation_expired","reservation_not_expired","manual_reconciliation_required","prepared_stock_cannot_return","cash_refund_requires_reconciliation","invalid_transition","invalid_payment_state","refund_not_due","cash_already_closed","cash_already_open","session_exists","insufficient_cash","cutover_not_ready","stock_changed","shared_kitchen_divergent"].includes(code)||e?.status===409)return error(409,code&&typeof code==="string"?code:"conflict");
   return error(503,"operation_not_confirmed");
  }
 };
}
