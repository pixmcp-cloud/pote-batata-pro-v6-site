// LOCAL ONLY — authenticated production F05 smoke without web-origin exceptions.
// Binds 127.0.0.1:8765. It never receives inventory data from the browser,
// forwards exactly one random nonexistent-item request, never logs a token.
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {randomUUID} from "node:crypto";
const baseDir=path.dirname(fileURLToPath(import.meta.url));
let last={status:"waiting"};
const respond=(res,status,body)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(body))};
createServer(async(req,res)=>{
 const pathName=new URL(req.url,"http://localhost:8765").pathname;
 if(req.method==="GET"&&pathName==="/status"){respond(res,200,last);return}
 if(req.method==="GET"&&pathName==="/qa/firebase-prod-f05-auto.html"){
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
  res.end(await readFile(path.join(baseDir,"firebase-prod-f05-auto.html")));return
 }
 if(req.method!=="POST"||pathName!=="/f05-probe"){respond(res,404,{error:"not_found"});return}
 const auth=req.headers.authorization||"";
 if(req.headers.origin!=="http://localhost:8765"||!/^Bearer [A-Za-z0-9._-]{100,12000}$/.test(auth)){
  respond(res,403,{error:"unauthorized_local_request"});return
 }
 // A fresh unguessable inventory ID is not part of any real product catalog.
 const itemId="__f05_probe_"+randomUUID().replace(/-/g,"");
 const body={universe:"batataria",operationId:"f05-prod-smoke-"+randomUUID().replace(/-/g,""),
  group:"ingredients",itemId,delta:-1,reason:"loss",lossReason:"vencimento",
  note:"Verificacao sem registro real; item aleatorio inexistente"};
 try{
  const remote=await fetch("https://pote-batata-f05-live.pixmcp.workers.dev/v1/inventory/adjust",{
    method:"POST",headers:{"Authorization":auth,"Content-Type":"application/json"},
    body:JSON.stringify(body),signal:AbortSignal.timeout(16000)});
  const data=await remote.json().catch(()=>({}));
  last={status:"done",http:remote.status,code:data.error||null,
   noStockWrite:remote.status!==200,expectedMissing:remote.status===404&&data.error==="stock_item_missing"};
  console.log("F05 production no-write smoke",JSON.stringify(last));
  respond(res,200,last);
 }catch(e){last={status:"error",message:e.name==="TimeoutError"?"timeout":"network_error"};respond(res,502,last)}
}).listen(8765,"127.0.0.1",()=>console.log("F05 read-only localhost proxy ready on 127.0.0.1:8765"));
