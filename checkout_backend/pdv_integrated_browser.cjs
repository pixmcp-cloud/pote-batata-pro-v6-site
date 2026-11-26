// Test-only HTTP server; loopback, synthetic credentials, bounded requests.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const puppeteer=require("../qa/mobile/node_modules/puppeteer-core");
exports.runIntegratedBrowser=async({api,config,readSnapshot,verifyAfter,readCatalog,readQueue,catalogEditor,setCatalogExpired})=>{
 const {createCheckoutHttpLab}=await import("./checkout_http_lab.mjs");
 const {createCheckoutAuthLab}=await import("../workers/antifraud/src/checkout_auth_lab.mjs");
 const {generateKeyPair,SignJWT}=await import(require.resolve("jose",{paths:[path.join(__dirname,"../workers/antifraud")]}));
 const projectId="demo-nucleobit-checkout",{privateKey,publicKey}=await generateKeyPair("RS256");
 const verify= createCheckoutAuthLab({projectId,jwks:publicKey});
 const ownerUid=config.ownerToken,buyerUid=config.buyerToken;
 const issue=uid=>new SignJWT({email_verified:true,firebase:{sign_in_provider:"google.com"},auth_time:Math.floor(Date.now()/1000)}).setProtectedHeader({alg:"RS256"}).setIssuer("https://securetoken.google.com/"+projectId).setAudience(projectId).setSubject(uid).setIssuedAt().setExpirationTime("15m").sign(privateKey);
 config={...config,ownerUid,buyerUid,ownerToken:await issue(ownerUid),buyerToken:await issue(buyerUid)};
 const {authorizeCheckoutRoute}=await import("./checkout_access_lab.mjs");
 const store={ownerUid,online:config.online,counter:config.counter};
 if(typeof readCatalog!=="function"||typeof readQueue!=="function"||typeof catalogEditor!=="function")throw Error("V5 adapters required");
 let origin,dropNextSubmit=false,submitCount=0,separated=false;
 const allowed=new Set(["pdv_integrated_lab.html","pdv_integrated_lab.mjs","pdv_checkout_queue.mjs","checkout_cash_lab.mjs","order_ticker.mjs","order_ticker.css","checkout_recovery_lab.mjs","customer_menu_lab.html","customer_menu_lab.mjs","merchant_pdv_lab.html","google_checkout_bridge_lab.mjs","checkout_client_lab.mjs"]);
 const server=http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(body))};
  try{
   if(req.method==="GET"&&allowed.has(req.url.slice(1))){const name=req.url.slice(1);res.writeHead(200,{"Content-Type":name.endsWith(".html")?"text/html; charset=utf-8":name.endsWith(".css")?"text/css":"text/javascript; charset=utf-8"});res.end(fs.readFileSync(path.join(__dirname,name)));return}
   if(req.method!=="POST"||req.headers.origin!==origin){send(403,{error:"origin_denied"});return}
   let body="";for await(const chunk of req){body+=chunk.toString();if(body.length>8192){send(413,{error:"body_limit"});return}}
   if(req.url==="/lab/bootstrap"){if(separated){send(404,{error:"not_found"});return}send(200,config);return}
   if(separated&&req.url==="/customer/catalog"){try{send(200,await readCatalog())}catch(e){if(e?.code==="license_required")send(200,{storeId:store.online,products:[],deliveryEnabled:false,deliveryFeeCents:0,orderingEnabled:false});else send(503,{error:"catalog_not_ready"})}return}
   if(separated&&req.url==="/customer/login"){send(200,{uid:buyerUid,token:await issue(buyerUid)});return}
   let identity;try{identity=await verify(req.headers.authorization?.startsWith("Bearer ")?req.headers.authorization.slice(7):"",projectId)}catch{send(401,{error:"login_required"});return}
   if(separated&&req.url==="/merchant/config"){if(identity.uid!==ownerUid){send(403,{error:"forbidden"});return}send(200,{ownerUid,counter:store.counter,epoch:config.epoch,products:config.products});return}
   if(separated&&/^\/merchant\/catalog\/(choices|preview|approve)$/.test(req.url)){
    if(identity.uid!==ownerUid){send(403,{error:"forbidden"});return}
    const kind=req.url.split("/").at(-1);let args;try{args=JSON.parse(body)}catch{send(400,{error:"invalid_json"});return}
    const allowedKeys=kind==="preview"?["operationId","revision","selection"]:kind==="approve"?["operationId","revision"]:[];
    if(!args||typeof args!=="object"||Array.isArray(args)||Object.keys(args).some(k=>!allowedKeys.includes(k))){send(400,{error:"invalid_request"});return}
    try{send(200,await catalogEditor({...args,kind,token:identity.uid}))}catch(e){send(409,{error:e.code??"catalog_not_ready"})}return;
   }
   if(req.url==="/lab/snapshot"){if(separated){send(404,{error:"not_found"});return}if(identity.uid!==ownerUid){send(403,{error:"forbidden"});return}send(200,await readSnapshot());return}
   let route=req.url.slice(14),dispatchPath=req.url;
   if(separated){
    const match=req.url.match(/^\/(customer|merchant)\/api\/([A-Za-z]+)$/);
    if(!match){send(404,{error:"not_found"});return}
    let args;try{args=JSON.parse(body)}catch{send(400,{error:"invalid_json"});return}
    try{authorizeCheckoutRoute({surface:match[1],route:match[2],identity,body:args,store})}catch(e){send(e.code==="invalid_request"?400:403,{error:e.code});return}
    route=match[2];dispatchPath="/checkout-lab/"+route;
    if(route==="snapshot"){if(Object.keys(args).some(k=>k!=="cursors")){send(400,{error:"invalid_request"});return}const s=await readSnapshot({includeOrders:false}),q=await readQueue(args.cursors??{});send(200,{...s,...q});return}
   }
   const buyerRoutes=["quote","submit","submitSaved","recoverSubmit","status"];
   if(identity.uid!==ownerUid&&!buyerRoutes.includes(route)){send(403,{error:"forbidden"});return}
   // Test harness only: authenticated UID bridges into fixture verifier, never a live credential.
   const scopedApi=Object.fromEntries(Object.entries(api).filter(([,v])=>typeof v==="function").map(([k,v])=>[k,args=>v({...args,token:identity.uid})]));
   const dispatch=createCheckoutHttpLab({projectId,enabled:true,api:scopedApi,origin});
   const result=await dispatch({method:req.method,path:dispatchPath,requestOrigin:req.headers.origin,authorization:req.headers.authorization,contentType:req.headers["content-type"],bodyText:body});
   if(route==="submitSaved"&&result.status===200){submitCount++;if(dropNextSubmit){dropNextSubmit=false;send(503,{error:"operation_not_confirmed"});return}}
   send(result.status,result.body);
  }catch(e){send(500,{error:"lab_failure"});console.error(e.message)}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));origin="http://127.0.0.1:"+server.address().port;
 let browser;
 try{
  const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>p&&fs.existsSync(p));if(!chrome)throw Error("Chrome ausente");
  browser=await puppeteer.launch({headless:true,executablePath:chrome,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const page=await browser.newPage(),errors=[],external=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(!r.url().startsWith(origin+"/"))external.push(r.url())});
  await page.setViewport({width:375,height:800,isMobile:true,hasTouch:true});
  await page.goto(origin+"/pdv_integrated_lab.html");await page.waitForSelector('body[data-ready="true"]');
  for(const width of [320,375,834,1366]){await page.setViewport({width,height:800,isMobile:width<600,hasTouch:width<600});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  const waitText=(sel,txt)=>page.waitForFunction((s,t)=>document.querySelector(s)?.textContent.includes(t),{},sel,txt);
  const cash=async(button,value,reason)=>{await page.click(button);await page.waitForSelector("#cash-dialog[open]");await page.type("#cash-amount",value);if(reason)await page.type("#cash-reason",reason);await page.click("#cash-confirm");await page.waitForFunction(()=>!document.querySelector("#cash-dialog").open);await waitText("#feedback","Caixa atualizado")};
  await page.click("#tab-cash");await page.waitForFunction(()=>!document.querySelector("#open").disabled);await cash("#open","50");await cash("#supply","20","Troco");await cash("#withdraw","10","Retirada teste");
  async function sale(tab){await page.click("#tab-"+tab);await page.$eval('[data-product="meal"]',e=>{e.value="1";e.dispatchEvent(new Event("change"))});await page.click("#quote");await waitText("#quote-total","14,50");await page.click("#submit");await waitText("#feedback","registrado.");return (await page.$eval("#feedback",e=>e.textContent)).match(/P[0-9]{7}/)[0]}
  const counter=await sale("counter"),online=await sale("online");assert.notEqual(counter,online);await waitText("#ticker","Pedido recebido");
  await page.click("#tab-queue");await page.waitForSelector('[data-order="'+counter+'"] input',{visible:true});await page.waitForSelector('[data-order="'+online+'"] input',{visible:true});await waitText("#stock","0 g");
  const action=async(id,a)=>{const s='[data-order="'+id+'"] [data-action="'+a+'"]';await page.waitForSelector(s);await page.click(s);await waitText("#feedback","Pedido atualizado.")};
  for(const id of [counter,online]){const ref='[data-order="'+id+'"] input';await page.waitForSelector(ref,{visible:true});await page.type(ref,"Conferência sintética");await action(id,"confirm_payment");await action(id,"prepare");await action(id,"ready");await action(id,"deliver")}
  await page.click("#tab-online");await waitText("#ticker","Seu pedido foi entregue");const clock=await page.$eval("#ticker time",e=>e.textContent);
  await new Promise(resolve=>setTimeout(resolve,1200));assert.equal(await page.$eval("#ticker time",e=>e.textContent),clock);
  await page.click("#tab-queue");await page.waitForSelector('[data-order="'+counter+'"] [data-action="receipt"]');await page.click('[data-order="'+counter+'"] [data-action="receipt"]');await waitText("#receipt-text","VENDA DE BALCÃO");
  await page.emulateMediaType("print");assert.equal(await page.$eval("header",e=>getComputedStyle(e).display),"none");await page.emulateMediaType("screen");
  await page.click("#tab-cash");await waitText("#metrics","74,50");await cash("#close","74");await waitText("#closed-summary","0,50");
  await page.click("#tab-stock");await waitText("#inventory-list","Batata: 0 g");
  async function adjust(kind,qty,expected){await page.select("#inventory-kind",kind);await page.type("#inventory-qty",String(qty));await page.type("#inventory-reason","Conferência laboratório");await page.click("#inventory-save");await waitText("#feedback","Ajuste de estoque registrado.");await waitText("#inventory-list","Batata: "+expected+" g")}
  await adjust("purchase",1000,1000);await adjust("loss",100,900);await adjust("count",800,800);
  await page.click("#tab-online");await page.$eval('[data-product="meal"]',e=>{e.value="1";e.dispatchEvent(new Event("input"))});
  await page.$eval('[data-extra="extra"]',e=>{e.value="2";e.dispatchEvent(new Event("input"))});
  await page.select("#fulfillment","delivery");await page.type("#address","Endereço fictício");await page.click("#quote");await waitText("#quote-total","25,50");dropNextSubmit=true;const beforeSubmit=submitCount;await page.click("#submit");await waitText("#feedback","operation_not_confirmed");
  assert.equal(submitCount,beforeSubmit+1);
  const stored=await page.evaluate(()=>Object.values(sessionStorage).join(" "));assert(stored.includes("operationId"));assert(!stored.includes("Endereço fictício")&&!stored.includes("paymentMethod"));
  await page.reload();await page.waitForSelector('body[data-ready="true"]');await page.click("#tab-online");await waitText("#feedback","registrado.");
  assert.equal(submitCount,beforeSubmit+1);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("nucleobit:checkout:g1:")).length),0);
  const deliveryOrder=(await page.$eval("#feedback",e=>e.textContent)).match(/P[0-9]{7}/)[0];
  await page.click("#tab-queue");await page.waitForSelector('[data-order="'+deliveryOrder+'"] [data-action="cancel"]',{visible:true});await waitText("#stock","200 g");
  page.once("dialog",d=>d.accept());await action(deliveryOrder,"cancel");await waitText("#stock","800 g");
  const rejected=await page.evaluate(async({token})=>{const call=(kind,token)=>fetch("/checkout-lab/"+kind,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:"{}"}).then(r=>r.status);return [await call("openCash",token),await call("recoverSubmit","forged-token")]},{token:config.buyerToken});assert.deepEqual(rejected,[403,401]);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await verifyAfter({counter,online,deliveryOrder});
  // Disable combined fixture endpoints before opening separated surfaces.
  separated=true;await page.close();
  const customer=await browser.newPage();const customerErrors=[],customerRequests=[];customer.on("pageerror",e=>customerErrors.push(e.message));customer.on("request",r=>customerRequests.push(r.url()));
  await customer.setViewport({width:375,height:800,isMobile:true,hasTouch:true});
  await customer.goto(origin+"/customer_menu_lab.html");await customer.waitForSelector('body[data-ready="true"]');
  assert.equal(await customer.$("#tab-cash"),null);assert.equal(await customer.$("#tab-stock"),null);
  assert(!customerRequests.some(url=>url.endsWith("/customer/login")));
  await customer.$eval('[data-product="meal"]',e=>{e.value="1";e.dispatchEvent(new Event("input"))});
  await customer.click("#quote");await customer.waitForFunction(()=>document.querySelector("#quote-total").textContent.includes("14,50"));
  assert(customerRequests.some(url=>url.endsWith("/customer/login")));
  const checks=await customer.evaluate(async({counter,online})=>{
   const post=(p,body={},token)=>fetch(p,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});
   const auth=await (await post("/customer/login")).json(),cat=await (await post("/customer/catalog")).json();
   return {catalog:cat,statuses:[(await post("/lab/bootstrap")).status,(await post("/merchant/config",{},auth.token)).status,(await post("/merchant/api/snapshot",{},auth.token)).status,(await post("/customer/api/openCash",{},auth.token)).status,(await post("/customer/api/quote",{storeId:counter},auth.token)).status,(await post("/checkout-lab/quote",{storeId:online},auth.token)).status]};
  },{counter:store.counter,online:store.online});
  assert.deepEqual(checks.statuses,[404,403,403,403,403,404]);
  assert.deepEqual(Object.keys(checks.catalog).sort(),["deliveryEnabled","deliveryFeeCents","products","revision","storeId"]);
  assert.deepEqual(customerErrors,[]);await customer.close();
  const merchant=await browser.newPage();const merchantErrors=[];merchant.on("pageerror",e=>merchantErrors.push(e.message));
  await merchant.evaluateOnNewDocument(token=>{window.__syntheticMerchantToken=token},config.ownerToken);
  await merchant.goto(origin+"/merchant_pdv_lab.html");await merchant.waitForSelector('body[data-ready="true"]');
  assert.equal(await merchant.$("#tab-online"),null);await merchant.click("#tab-cash");await merchant.waitForFunction(()=>document.querySelector("#metrics").textContent.includes("Fechado"));
  await merchant.waitForFunction(()=>!document.querySelector("#tab-catalog").disabled);await merchant.click("#tab-catalog");await merchant.waitForSelector("[data-catalog-group=recipes]",{visible:true});
  await merchant.waitForFunction(()=>!document.querySelector("#tab-catalog").disabled);await merchant.click("#catalog-preview");await merchant.waitForFunction(()=>!document.querySelector("#catalog-approve").disabled&&!document.querySelector("#tab-catalog").disabled);await merchant.click("#catalog-approve");await merchant.waitForFunction(()=>document.querySelector("#feedback").textContent.includes("Revisão aprovada"));
  assert.deepEqual(merchantErrors,[]);await merchant.close();
  if(typeof setCatalogExpired==="function"){
   await setCatalogExpired(true);
   try{const expired=await browser.newPage();await expired.goto(origin+"/customer_menu_lab.html");await expired.waitForSelector('body[data-ready="true"]');assert.equal(await expired.$eval("#quote",x=>x.disabled),true);assert.equal(await expired.$eval("#submit",x=>x.disabled),true);assert.equal(await expired.$eval("#recover",x=>x.disabled),false);await expired.click("#recover");await expired.waitForFunction(()=>document.querySelector("#feedback").textContent.includes("Nenhuma tentativa"));await expired.close();}finally{await setCatalogExpired(false)}
  }
  console.log("PASS B02-G2 separated customer/merchant surfaces: anonymous catalog, on-demand synthetic Google, six denied cross-surface requests, private owner cash.");
  console.log("PASS B02-G1 browser integrated: signed identity, reload recovery, real emulator writes from UI; 4 viewport widths; shared stock, drawer, receipt, frozen ticker; no external requests.");
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
};
