const assert=require("node:assert/strict");
const path=require("node:path"),{pathToFileURL}=require("node:url");
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
  page.on("request",req=>req.url().includes("/firebase_integration.js")?
   req.respond({status:200,contentType:"text/javascript",body:""}):req.continue());
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,
   {waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>!!window.POTE_PDV?.open,{timeout:15000});
  await page.evaluate(()=>{
   window.POTE_APP_READY=true;
   window.POTE_AUTH={uid:"pdv-sangria-qa",role:"admin",proActive:true,email:"qa@example.invalid"};
   window.POTE_SYNC_GUARD={blocked:false};
   window.__cashQA={cashSessions:[{id:"s1",status:"open",operator:"QA",
    openingCash:100,openedAt:"2026-11-18T12:00:00Z"}],
    cashMovements:[],orders:[{id:"o1",cashSessionId:"s1",qty:1,price:40,
     name:"Batata QA",status:"entregue",paymentMethod:"Dinheiro",
     paymentStatus:"Pago em dinheiro"}]};
   window.POTE_APP={snapshot:()=>({data:structuredClone(window.__cashQA)}),
    applyState:s=>{window.__cashQA=structuredClone(s.data)}};
   document.querySelector("#poteAuthGate")?.remove();
   window.POTE_PDV.open();
  });
  const base=await page.evaluate(()=>{
   const root=document.querySelector("#potePdvBody");
   const frame=document.querySelector(".pote-pdv-container").getBoundingClientRect();
   return {buttons:root.querySelectorAll("button[data-pdv-action=withdraw]").length,
    expected:root.querySelector(".pote-pdv-check-number strong")?.textContent,
    viewportBottom:window.innerHeight,frameBottom:frame.bottom,
    internalScroll:root.scrollHeight>root.clientHeight};
  });
  assert.equal(base.buttons,1,"Sangria must be an explicit primary action");
  assert.match(base.expected,/140,00/);
  assert(base.internalScroll,"Tall cashier must scroll internally");
  assert(base.frameBottom<=base.viewportBottom+2,"Dialog cannot overflow screen");
  await page.click('[data-pdv-action="withdraw"]');
  assert.equal(await page.evaluate(()=>document.querySelector("#potePdvMovementEditor").hidden),
   false,"Withdrawal editor must remain visible");
  await page.type('#potePdvMovementEditor input[name="amount"]',"30,00");
  await page.type('#potePdvMovementEditor input[name="reason"]',"Deposito bancario");
  await page.click('#potePdvMovementEditor button[type="submit"]');
  const afterWithdraw=await page.evaluate(()=>({
   movements:window.__cashQA.cashMovements,
   expected:document.querySelector(".pote-pdv-check-number strong")?.textContent,
   editorHidden:document.querySelector("#potePdvMovementEditor").hidden
  }));
  assert.equal(afterWithdraw.movements.length,1);
  assert.equal(afterWithdraw.movements[0].kind,"sangria");
  assert.equal(afterWithdraw.movements[0].amount,30);
  assert.equal(afterWithdraw.movements[0].reason,"Deposito bancario");
  assert.match(afterWithdraw.expected,/110,00/);
  assert(afterWithdraw.editorHidden,"Editor closes only AFTER successful save");
  await page.click('[data-pdv-action="supply"]');
  assert.equal(await page.evaluate(()=>document.querySelector(
   '#potePdvMovementEditor input[name="kind"]').value),"suprimento");
  await page.type('#potePdvMovementEditor input[name="amount"]',"20,00");
  await page.type('#potePdvMovementEditor input[name="reason"]',"Troco adicional");
  await page.click('#potePdvMovementEditor button[type="submit"]');
  const afterSupply=await page.evaluate(()=>({
   movements:window.__cashQA.cashMovements,
   expected:document.querySelector(".pote-pdv-check-number strong")?.textContent
  }));
  assert.equal(afterSupply.movements.length,2);
  assert.equal(afterSupply.movements[0].kind,"suprimento");
  assert.match(afterSupply.expected,/130,00/);
  const finalSelector='#potePdvBody details[data-pdv-detail="closed-history"] summary';
  await page.click(finalSelector);
  const beforeSync=await page.evaluate(()=>({
   opened:document.querySelector('details[data-pdv-detail="closed-history"]').open,
   scroll:document.querySelector("#potePdvBody").scrollTop
  }));
  assert(beforeSync.opened&&beforeSync.scroll>0,"Last accordion must expand in scrollable body");
  await page.evaluate(()=>window.dispatchEvent(new Event("pote:changed")));
  await new Promise(r=>setTimeout(r,250));
  assert(await page.evaluate(()=>document.querySelector(
   'details[data-pdv-detail="closed-history"]').open),"Sync cannot collapse last accordion");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,
   "No horizontal overflow");
  assert.deepEqual(errors.filter(x=>!x.includes("Firebase App")&&!x.includes("No Firebase App")),
   [],"Unexpected browser exceptions");
  console.log("PASS PDV CASH MOBILE",width,"sangria -30, suprimento +20, drawer R$130, expanded history retained");
  await page.close();
 }
 }finally{await browser.close()}
})().catch(error=>{console.error("PDV CASH SURGERY FAILED",error.stack||error);process.exitCode=1});
