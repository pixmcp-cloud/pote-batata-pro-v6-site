const assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
let puppeteer;
for(const p of [process.env.POTE_QA_PUPPETEER,"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){
 try{puppeteer=require(p);break}catch{}
}
if(!puppeteer)throw Error("Puppeteer unavailable");
(async()=>{
const browser=await puppeteer.launch({headless:true,
 executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",
 args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
try{
 for(const width of [375,430]){
  const page=await browser.newPage();
  await page.setViewport({width,height:832,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.setRequestInterception(true);
  page.on("request",r=>r.url().includes("/firebase_integration.js")?
   r.respond({status:200,contentType:"text/javascript",body:""}):r.continue());
  await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,
   {waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>window.POTE_PAYMENT?.validate&&window.POTE_PDV?.open,
   {timeout:20000});
  const result=await page.evaluate(()=>{
   window.POTE_AUTH={uid:"sale-qa",proActive:true,role:"admin",email:"qa@example.invalid"};
   window.POTE_APP_READY=true;
   let recovered=0;
   window.POTE_SYNC_GUARD={blocked:false,showRecovery(){recovered++;}};
   document.getElementById("poteAuthGate")?.remove();
   go("orders");
   const button=document.getElementById("poteOrderOpenCash");
   if(!button)throw Error("PDV sangria shortcut missing");
   button.click();
   const opened=!document.getElementById("potePdvDialog")?.hidden;
   window.POTE_PDV.close();
   document.getElementById("orderPayment").value="dinheiro";
   document.getElementById("orderPrice").value="21.90";
   document.getElementById("orderDelivery").value="0";
   document.getElementById("orderCashReceived").value="";
   window.POTE_PAYMENT.sync();
   const exact=window.POTE_PAYMENT.validate();
   const preview=document.getElementById("potePaymentPreview")?.innerText;
   window.POTE_SYNC_GUARD.blocked=true;
   const orderCountBefore=window.POTE_APP.snapshot().data.orders.length;
   newOrder();
   const orderCountAfter=window.POTE_APP.snapshot().data.orders.length;
   const warning=document.getElementById("poteOrderSyncWarning");
   return {opened,paid:exact?.paidAmount,change:exact?.changeGiven,preview,
    orderCountBefore,orderCountAfter,recovered,warningVisible:!warning.hidden,
    warningHasBackup:!!warning.querySelector('button[onclick*="downloadPending"]'),
    width:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert(result.opened,"Cash dialog shortcut must open actual PDV");
  assert.equal(result.paid,21.9);
  assert.equal(result.change,0);
  assert.match(result.preview,/Valor exato considerado/);
  assert.equal(result.orderCountAfter,result.orderCountBefore,
   "Sync conflict must block new sale without creating order");
  assert.equal(result.recovered,1,"Sync banner should be revealed on blocked sale");
  assert.equal(result.warningVisible,true);
  assert.equal(result.warningHasBackup,true);
  assert(result.width<=result.viewport+2,"Mobile layout must not overflow");
  console.log("PASS mobile sales",width,JSON.stringify(result));
  await page.close();
 }
}finally{await browser.close()}
})().catch(e=>{console.error("MOBILE_ORDER_RECOVERY_FAILED",e.stack||e);process.exitCode=1});
