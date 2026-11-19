const assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const puppeteer=require(process.env.POTE_QA_PUPPETEER||
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
 try{
  for(const width of [375,430]){
   const page=await browser.newPage();
   await page.setViewport({width,height:840,isMobile:true,hasTouch:true,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on("request",r=>r.url().includes("/firebase_integration.js")?
    r.respond({status:200,contentType:"text/javascript",body:""}):r.continue());
   await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,
    {waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForFunction(()=>typeof window.go==="function"&&typeof window.pageOrderSyncWarning==="function",
    {timeout:19000});
   const result=await page.evaluate(w=>{
    const account="banner-test-"+w;
    window.POTE_AUTH={uid:account,proActive:true,role:"admin",email:"qa@example.invalid"};
    window.POTE_APP_READY=true;
    window.POTE_SYNC_GUARD={blocked:true,diagnosis:()=>({
     title:"Backup com dados comerciais divergentes",
     cause:"Pedidos (aparelho: 2, nuvem: 1; conteudo divergente). Motivo: mudanca simultanea",
     action:"Baixe o backup antes de recuperar."}),showRecovery(){}};
    document.getElementById("poteAuthGate")?.remove();
    const data=window.POTE_APP.snapshot();
    data.data.businessType="batataria";
    data.data.recipes=[{id:"r-test",name:"Frango cremoso QA",items:[{id:"batata",g:205}],targetGainPct:100}];
    data.data.ingredients=[{id:"batata",name:"Batata",stock:1000,minimum:200,purchasePrice:5,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100}];
    window.POTE_APP.applyState(data);
    const key="pote-sale-notes-v1:"+account+":batataria";
    window.localStorage.setItem(key,JSON.stringify([{id:"draft-qa",createdAt:"2026-11-19T00:10:00.000Z",
     fields:{orderItem:"recipe:r-test",orderQty:"1",orderPrice:"21.90"},universe:"batataria"}]));
    go("orders");
    const banner=document.getElementById("poteOrderSyncWarning");
    const draft=document.querySelector('section[aria-label="Pedidos anotados no aparelho"]');
    return {title:banner?.querySelector("[data-sync-title]")?.textContent,
     cause:banner?.querySelector("[data-sync-cause]")?.textContent,
     action:banner?.querySelector("[data-sync-action]")?.textContent,
     visible:!banner?.hidden,
     backupAction:!!banner?.querySelector('button[onclick*="downloadPending"]'),
     draftName:draft?.innerText,
     docWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   },width);
   assert.equal(result.title,"Backup com dados comerciais divergentes");
   assert.match(result.cause,/Pedidos \(aparelho: 2, nuvem: 1/);
   assert.match(result.action,/Baixe o backup/);
   assert(result.visible&&result.backupAction);
   assert.match(result.draftName,/Frango cremoso QA/);
   assert(!result.draftName.includes("1x recipe:r-test"),"Product IDs should have readable labels");
   assert(result.docWidth<=result.viewport+2,"No mobile horizontal overflow");
   console.log("PASS LIVE-SHAPE SYNC BANNER CHROME",width);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error("SYNC_BANNER_CHROME_FAIL",e.stack||e);process.exitCode=1});