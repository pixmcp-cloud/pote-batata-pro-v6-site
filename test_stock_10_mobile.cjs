const assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
let puppeteer;for(const p of [process.env.POTE_QA_PUPPETEER,
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean))
 try{puppeteer=require(p);break}catch{}
if(!puppeteer)throw Error("Puppeteer missing");
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
 try{
 for(const width of [375,430]){
  const page=await browser.newPage();
  await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.setRequestInterception(true);
  page.on("request",r=>r.url().includes("/firebase_integration.js")?
   r.respond({status:200,contentType:"text/javascript",body:""}):r.continue());
  await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,
   {waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>window.POTE_STOCK_UI?.criticalStock10Apply
   &&window.POTE_APP?.snapshot,{timeout:20000});
  const results=await page.evaluate(()=>{
   let backups=0;window.POTE_AUTH={uid:"qa-owner",role:"admin",
    email:"pixmcp@gmail.com",proActive:true};
   window.POTE_APP_READY=true;
   window.POTE_SYNC_GUARD={blocked:false,hasPending:()=>false,
    downloadPending(){backups++},showRecovery(){}};
   window.confirm=()=>true;
   document.getElementById("poteAuthGate")?.remove();
   go("ingredients");
   const panel=document.getElementById("poteStockCriticalTest");
   if(!panel)throw Error("Stock test action missing from inventory");
   const before=window.POTE_APP.snapshot().data.ingredients.find(x=>x.id==="batata");
   if(!before)throw Error("Batata sample missing");
   panel.querySelector('button[onclick*="criticalStock10Apply"]').click();
   const after=window.POTE_APP.snapshot().data.ingredients.find(x=>x.id==="batata");
   const restore=document.querySelector('button[onclick*="criticalStock10Restore"]');
   restore.click();
   const recovered=window.POTE_APP.snapshot().data.ingredients.find(x=>x.id==="batata");
   return {before:before.stock,target:after.stock,expected:
    window.POTE_STOCK_UI.criticalStockTarget(before),
    restored:recovered.stock,backups,
    visible:!!document.getElementById("poteStockCriticalTest"),
    viewport:innerWidth,width:document.documentElement.scrollWidth};
  });
  assert.equal(results.target,results.expected);
  assert.equal(results.restored,results.before);
  assert.equal(results.backups,1);
  assert.equal(results.visible,true);
  assert(results.width<=results.viewport+2);
  console.log("PASS STOCK 10% MOBILE",width,JSON.stringify(results));
  await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error("STOCK_10_MOBILE_FAILED",e.stack||e);process.exitCode=1});
