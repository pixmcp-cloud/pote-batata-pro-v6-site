const assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const puppeteer=require(process.env.POTE_QA_PUPPETEER||"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
 try{
  for(const width of [375,430]){
   const page=await browser.newPage();
   await page.setViewport({width,height:832,isMobile:true,hasTouch:true,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on("request",r=>r.url().includes("/firebase_integration.js")?
    r.respond({status:200,contentType:"text/javascript",body:""}):r.continue());
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(process.cwd(),"public","index.html")).href,
    {waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForFunction(()=>typeof window.newOrder==="function"&&typeof window.savePendingSaleNote==="function",{timeout:20000});
   const response=await page.evaluate(width=>{
    const account="queued-test-"+width;
    window.POTE_AUTH={uid:account,proActive:true,role:"admin",email:"qa@example.invalid"};
    window.POTE_APP_READY=true;
    window.POTE_SYNC_GUARD={blocked:true,diagnosis:()=>({title:"Outra aba alterou o estoque",
      reason:"Registro alterado em outro dispositivo: batata"}),showRecovery(){document.getElementById("poteOrderSyncWarning").hidden=false}};
    document.getElementById("poteAuthGate")?.remove();
    const seeded=window.POTE_APP.snapshot();
    seeded.data.businessType="batataria";
    seeded.data.recipes=[{id:"r-test",name:"Batata QA",items:[{id:"batata",g:205}],pricingMode:"gain",targetGainPct:100}];
    seeded.data.ingredients=[{id:"batata",name:"Batata",stock:2000,minimum:1000,purchasePrice:5,purchaseQuantity:1,purchaseUnit:"kg",measureUnit:"g",yield:100}];
    window.POTE_APP.applyState(seeded);
    go("orders");
    const count=window.POTE_APP.snapshot().data.orders.length;
    document.getElementById("orderQty").value="2";
    document.getElementById("orderPrice").value="21.90";
    document.getElementById("orderPayment").value="pix";
    newOrder();
    const key="pote-sale-notes-v1:"+account+":batataria";
    const notes=JSON.parse(localStorage.getItem(key)||"[]");
    const one=notes.length;
    const official=window.POTE_APP.snapshot().data.orders.length;
    const visible=document.body.innerText.includes("PEDIDOS PENDENTES NESTE APARELHO");
    const draft=notes[0];
    restorePendingSaleNote(draft?.id);
    const restoredPrice=document.getElementById("orderPrice").value;
    const restoredQty=document.getElementById("orderQty").value;
    return {one,official,count,visible,restoredPrice,restoredQty,
     key,formItem:document.getElementById("orderItem")?.value,toast:document.getElementById("toast")?.textContent,storageKeys:Object.keys(localStorage),reason:window.POTE_SYNC_GUARD.diagnosis().title,
     docWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   },width);
   console.log("PENDING_DIAGNOSTIC",JSON.stringify(response));
   assert.equal(response.one,1);
   assert.equal(response.official,response.count,"Unconfirmed draft must not create an official order");
   assert.equal(response.visible,true,"Drafts must be visibly listed");
   assert.equal(response.restoredPrice,"21.90");
   assert.equal(response.restoredQty,"2");
   assert(response.docWidth<=response.viewport+2,"No horizontal overflow");
   assert.deepEqual(errors.filter(x=>!x.includes("No Firebase App")),[],errors.join("; "));
   console.log("PASS PENDING SALE CHROME MOBILE",width,JSON.stringify(response));
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error("PENDING_SALE_QA_FAIL",e.stack||e);process.exitCode=1});