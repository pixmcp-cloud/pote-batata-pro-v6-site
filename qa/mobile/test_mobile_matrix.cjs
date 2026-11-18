"use strict";
/* Real Chromium browser/device emulation, no Google login, no production data.
 * Run against local compiled public/ (Chrome on Windows / GitHub ubuntu-latest).
 * Android OS is NOT emulated: Chrome touch, viewport, DPR and network are. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {once}=require("node:events");
const ROOT=path.resolve(__dirname,"../.."),WEB=path.join(ROOT,"public");
const ART=path.join(__dirname,"artifacts");
const devices=[
 {id:"android-small",width:320,height:694,dpr:2,isMobile:true,hasTouch:true},
 {id:"android-a",width:360,height:780,dpr:3,isMobile:true,hasTouch:true},
 {id:"android-b",width:375,height:812,dpr:3,isMobile:true,hasTouch:true},
 {id:"android-c",width:390,height:844,dpr:3,isMobile:true,hasTouch:true},
 {id:"android-large",width:430,height:932,dpr:3,isMobile:true,hasTouch:true},
 {id:"android-landscape",width:844,height:390,dpr:2,isMobile:true,hasTouch:true},
 {id:"android-tablet",width:768,height:1024,dpr:2,isMobile:true,hasTouch:true},
 {id:"desktop",width:1366,height:768,dpr:1,isMobile:false,hasTouch:false},
];
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".mjs":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
 ".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",
 ".jpeg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".ico":"image/x-icon"};
let puppeteer;
for(const n of ["puppeteer-core","puppeteer",process.env.POTE_QA_PUPPETEER,
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){
 try{puppeteer=require(n);break}catch{}
}
if(!puppeteer)throw Error("Instale as dependências: npm ci --prefix qa/mobile, ou informe POTE_QA_PUPPETEER.");
function chromePath(){
 const candidates=[process.env.CHROME_BIN,process.env.POTE_QA_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium",
  "/usr/bin/chromium-browser"].filter(Boolean);
 const chrome=candidates.find(x=>fs.existsSync(x));
 if(!chrome)throw Error("Chrome/Chromium não localizado. Instale Chrome e configure CHROME_BIN.");
 return chrome;
}
function serve(){
 return http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,"http://localhost").pathname)}
  catch{res.writeHead(400);return res.end("Bad URL")}
  const file=path.resolve(WEB,"."+name.replace(/\/$/,"/index.html"));
  if(!(file===WEB||file.startsWith(WEB+path.sep))){res.writeHead(403);return res.end("Forbidden")}
  fs.readFile(file,(err,body)=>{
   if(err){res.writeHead(404);return res.end("Not Found")}
   res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");
   res.setHeader("Cache-Control","no-store");
   res.setHeader("X-Content-Type-Options","nosniff");
   res.writeHead(200);res.end(body);
  });
 });
}
async function setupPage(browser,profile,baseUrl){
 const page=await browser.newPage();
 await page.setViewport({width:profile.width,height:profile.height,deviceScaleFactor:profile.dpr,
  isMobile:profile.isMobile,hasTouch:profile.hasTouch});
 if(profile.isMobile)await page.setUserAgent(
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) "+
  "Chrome/131.0.0.0 Mobile Safari/537.36");
 const exceptions=[];
 page.on("pageerror",err=>exceptions.push(String(err.message).slice(0,180)));
 await page.setRequestInterception(true);
 page.on("request",req=>{
  const url=req.url();
  if(url.startsWith(baseUrl)&&new URL(url).pathname==="/firebase_integration.js"){
   // Only the login/auth network adapter is stubbed; the real app UI/JS runs.
   return req.respond({status:200,contentType:"application/javascript",
     body:"window.POTE_TEST_FIREBASE_STUB=true;"});
  }
  if(url.startsWith(baseUrl)||url.startsWith("data:")||url.startsWith("blob:"))
   return req.continue();
  // No Google/Firebase/third-party requests, protecting production and costs.
  return req.abort("blockedbyclient");
 });
 return {page,exceptions};
}
const clean=x=>JSON.parse(JSON.stringify(x));
async function layoutSnapshot(page){
 return page.evaluate(()=>{
  const doc=document.documentElement;
  const gate=document.getElementById("poteAuthGate");
  const state=window.POTE_APP?.snapshot?.();
  const nodes=[...document.querySelectorAll("button,a,[role=button]")];
  const targets=nodes.filter(e=>{
   const r=e.getBoundingClientRect(),style=getComputedStyle(e);
   return r.width>0&&r.height>0&&style.visibility!=="hidden"&&style.display!=="none";
  });
  const exceptions=nodes.filter(e=>e.getAttribute("aria-label")===""||e.getAttribute("title")==="");
  return {
   viewport:innerWidth,scroll:doc.scrollWidth,viewportTag:document.querySelector('meta[name=viewport]')?.content||"",
   gate:!!gate&&getComputedStyle(gate).display!=="none",
   data:{orders:state?.data?.orders?.length??null,cash:state?.data?.cashSessions?.length??null},
   touchTargets:targets.length,smallTargets:targets.filter(e=>{
    const r=e.getBoundingClientRect();return Math.min(r.height,r.width)<26;
   }).length,
   blankLabels:exceptions.length,
   scrollY:window.scrollY,
   hasPdv:!!document.getElementById("potePdvPage"),
   hasLogo:!!document.querySelector('img[src*="pote-logo"]'),
   viewportHeight:innerHeight
  };
 });
}
async function simulateSale(page){
 return page.evaluate(()=>{
  if(!window.POTE_APP?.snapshot||typeof finishOrder!=="function")
   throw Error("Falta inicialização real de POTE_APP/finishOrder");
  const before=window.POTE_APP.snapshot();
  window.POTE_AUTH={uid:"sim-qa",role:"admin",proActive:true,email:"qa-only@example.invalid"};
  window.POTE_APP_READY=true;window.POTE_SYNC_GUARD={blocked:false};
  document.getElementById("poteAuthGate")?.remove();
  const recipe=before.data.recipes?.find(r=>r.id&&r.items?.length)||{
   id:"qa-recipe",name:"Batata QA",category:"Salgado",
   items:[{id:"qa-potato",g:150}],steps:["Montar"],pricingMode:"gain",targetGainPct:100
  };
  before.data.recipes=[recipe];
  before.data.orders=[
   {id:"qa-pix",recipeId:recipe.id,name:"Batata QA",status:"em_producao",
    qty:1,price:20.90,deliveryFee:0,paymentMethod:"Pix",paymentStatus:"Informado",
    cashSessionId:null,createdAt:new Date().toISOString()},
   {id:"qa-card",recipeId:recipe.id,name:"Batata QA",status:"em_producao",
    qty:2,price:30,deliveryFee:0,paymentMethod:"Cartão",paymentStatus:"Informado",
    cashSessionId:null,createdAt:new Date().toISOString()},
   {id:"qa-cash",recipeId:recipe.id,name:"Batata QA",status:"em_producao",
    qty:1,price:10,deliveryFee:0,paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro",
    cashSessionId:null,createdAt:new Date().toISOString()},
   {id:"qa-delivery",recipeId:recipe.id,name:"Batata QA",status:"em_producao",
    qty:1,price:40,deliveryFee:0,paymentMethod:"Na entrega",paymentStatus:"Pendente",
    cashSessionId:null,createdAt:new Date().toISOString()}
  ];
  before.data.cashSessions=[];before.data.cashMovements=[];
  window.POTE_APP.applyState(before);
  window.confirm=()=>{throw Error("Não pode exigir confirmação extra da venda")};
  window.prompt=()=>{throw Error("Não pode exigir redigitação da venda")};
  const failures=[];
  for(const id of before.data.orders.map(o=>o.id)){
   try{finishOrder(id)}catch(error){failures.push(id+": "+error.message)}
  }
  go("pdv");
  const after=window.POTE_APP.snapshot().data;
  const session=after.cashSessions?.find(x=>x.status==="open");
  const chart=[...document.querySelectorAll(".pote-pdv-chart-caption strong")].map(x=>x.textContent);
  const result={
   failures,
   orders:after.orders.map(x=>({id:x.id,status:x.status,paymentStatus:x.paymentStatus,
    cashSessionId:x.cashSessionId,confirmed:Boolean(x.paymentConfirmedAt)})),
   sessions:after.cashSessions?.length||0,
   sessionId:session?.id||null,autoStarted:session?.autoStarted===true,
   pending:after.orders.filter(x=>x.status==="entregue"&&
    !["pago","Pago em dinheiro"].includes(x.paymentStatus)).map(x=>x.id),
   chart,scroll:document.documentElement.scrollWidth,viewport:innerWidth
  };
  finishOrder("qa-pix");
  result.sessionsAfterRetry=window.POTE_APP.snapshot().data.cashSessions.length;
  return result;
 });
}
async function main(){
 fs.mkdirSync(ART,{recursive:true});
 const results={utc:new Date().toISOString(),chrome:chromePath(),devices:[],network:{},failures:[]};
 const server=serve();server.listen(0,"127.0.0.1");await once(server,"listening");
 const baseUrl="http://127.0.0.1:"+server.address().port;
 const browser=await puppeteer.launch({headless:true,executablePath:chromePath(),
  args:["--no-sandbox","--disable-dev-shm-usage"],timeout:30000});
 try{
  for(const profile of devices){
   const {page,exceptions}=await setupPage(browser,profile,baseUrl);
   try{
    await page.goto(baseUrl+"/",{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(()=>Boolean(window.POTE_APP?.snapshot),{timeout:18000});
    const layout=await layoutSnapshot(page);
    assert(layout.viewportTag.includes("width=device-width"),"Missing mobile viewport");
    assert.equal(layout.gate,true,"Login gate not visible on "+profile.id);
    assert.equal(layout.data.orders,0,"Pre-login orders leaked to "+profile.id);
    assert.equal(layout.data.cash,0,"Pre-login PDV movements leaked to "+profile.id);
    assert(layout.scroll<=layout.viewport+2,
     "Horizontal page overflow "+profile.id+" "+JSON.stringify(layout));
    let sale=null;
    if(["android-small","android-b","android-large","android-landscape","desktop"].includes(profile.id)){
     sale=await simulateSale(page);
     assert.deepEqual(sale.failures,[],JSON.stringify(sale));
     assert.equal(sale.sessions,1,"Must open exactly one PDV turn");
     assert.equal(sale.sessionsAfterRetry,1,"Repeat sale must not double count");
     assert.equal(sale.autoStarted,true,"Automatic PDV turn missing");
     assert.deepEqual(sale.orders.map(x=>x.status),Array(4).fill("entregue"));
     assert.deepEqual(sale.orders.slice(0,3).map(x=>x.paymentStatus),
      ["pago","pago","Pago em dinheiro"]);
     assert.deepEqual(sale.pending,["qa-delivery"]);
     assert(sale.scroll<=sale.viewport+2,"PDV has horizontal overflow");
     assert.equal(sale.chart.length>=3,true,"PDV cash/Pix/card chart missing");
     await page.screenshot({path:path.join(ART,profile.id+"-pdv.jpg"),type:"jpeg",quality:74});
    }else{
     await page.screenshot({path:path.join(ART,profile.id+"-login.jpg"),type:"jpeg",quality:74});
    }
    if(profile.id==="android-b"){
     // Simula uma rede celular lenta com DevTools, sem pedir internet externa.
     const network=await page.createCDPSession();
     await network.send("Network.enable");
     await network.send("Network.emulateNetworkConditions",{
      offline:false,latency:260,downloadThroughput:45000,
      uploadThroughput:22000,connectionType:"cellular3g"});
     const slow=await page.evaluate(async url=>{
      const started=performance.now();
      const reply=await fetch(url+"/mobile.css?qa=slow");
      return {status:reply.status,elapsedMs:Math.round(performance.now()-started)};
     },baseUrl);
     assert.equal(slow.status,200,"CSS must remain available in slow network");
     results.network.slow3g=slow;
     await network.send("Network.emulateNetworkConditions",{
      offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
     await network.detach();
     await page.setOfflineMode(true);
     const offline=await page.evaluate(()=>({online:navigator.onLine,
      localOrders:window.POTE_APP?.snapshot()?.data?.orders?.length??null}));
     assert.equal(offline.online,false,"Offline network simulation failed");
     await page.setOfflineMode(false);
     results.network.offline=offline;
    }
    results.devices.push({id:profile.id,width:profile.width,height:profile.height,dpr:profile.dpr,
     layout,sale,consoleErrors:exceptions});
    console.log("MOBILE_QA_PASS",profile.id,"width",profile.width,
     "loginOrders",layout.data.orders,"touchTargets",layout.touchTargets,
     "pdv",sale?"yes":"no","errors",exceptions.length);
   }catch(error){
    results.failures.push({device:profile.id,error:error.message,exceptions});
    console.error("MOBILE_QA_FAIL",profile.id,error.message);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
  fs.writeFileSync(path.join(ART,"report.json"),JSON.stringify(results,null,2));
 }
 if(results.failures.length)throw Error("Mobile matrix failures: "+JSON.stringify(results.failures));
 assert.equal(results.devices.length,devices.length,"Incomplete matrix");
 console.log("PASS MOBILE MATRIX:",devices.length,
  "profiles, 5 real simulated-PDV runs, pre-login tenant isolation, offline mode.");
}
main().catch(e=>{console.error("MOBILE_MATRIX_ERROR",e.stack||e);process.exitCode=1});
