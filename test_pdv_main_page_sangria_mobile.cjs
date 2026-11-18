const assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const puppeteer=require(process.env.POTE_QA_PUPPETEER||
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.POTE_QA_CHROME||
   "C:/Program Files/Google/Chrome/Application/chrome.exe",
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
  await page.waitForFunction(()=>window.POTE_PDV?.openMovement,{timeout:18000});
  await page.evaluate(()=>{
   window.POTE_APP_READY=true;
   window.POTE_AUTH={uid:"cash-page-qa",role:"admin",proActive:true,email:"qa@example.invalid"};
   window.POTE_SYNC_GUARD={blocked:false};
   window.__cashQA={cashSessions:[{id:"s1",status:"open",operator:"QA",
     openingCash:100,openedAt:"2026-11-18T12:00:00Z"}],cashMovements:[],orders:[]};
   window.POTE_APP={snapshot:()=>({data:structuredClone(window.__cashQA)}),
    applyState:s=>{window.__cashQA=structuredClone(s.data)}};
   document.getElementById("poteAuthGate")?.remove();
   go("pdv");
  });
  const before=await page.evaluate(()=>{
   const root=document.querySelector("#potePdvPage");
   const x=root?.querySelector(".pote-pdv-page-cash-actions");
   const close=root?.querySelector(".pote-pdv-page-controls");
   return {buttons:x?.querySelectorAll("button").length,
    actionBeforeClose:!!(x.compareDocumentPosition(close)&Node.DOCUMENT_POSITION_FOLLOWING),
    withdraw:x?.querySelector(".pote-pdv-page-withdraw")?.textContent,
    supply:x?.querySelector(".pote-pdv-page-supply")?.textContent,
    viewport:innerWidth,docWidth:document.documentElement.scrollWidth};
  });
  assert.equal(before.buttons,2,"Page must display both cash movement buttons");
  assert.equal(before.actionBeforeClose,true,"Sangria belongs above close cashier");
  assert.match(before.withdraw,/Retirada \/ Sangria/);
  assert.match(before.supply,/Reforço \/ Suprimento/);
  assert(before.docWidth<=before.viewport+2,"Main PDV page must not overflow horizontally");
  await page.click("#potePdvPage .pote-pdv-page-withdraw");
  const opened=await page.evaluate(()=>({
   visible:!document.querySelector("#potePdvDialog").hidden,
   editor:!document.querySelector("#potePdvMovementEditor").hidden,
   kind:document.querySelector('#potePdvMovementEditor input[name="kind"]').value,
   amount:document.activeElement?.name
  }));
  assert(opened.visible&&opened.editor,"Sangria must open its actual form");
  assert.equal(opened.kind,"sangria");
  await page.type('#potePdvMovementEditor input[name="amount"]',"30,00");
  await page.type('#potePdvMovementEditor input[name="reason"]',"Sangria QA");
  await page.click('#potePdvMovementEditor button[type="submit"]');
  const after=await page.evaluate(()=>({
   cash:window.__cashQA.cashMovements,
   expected:document.querySelector(".pote-pdv-check-number strong")?.textContent
  }));
  assert.equal(after.cash.length,1);
  assert.equal(after.cash[0].kind,"sangria");
  assert.equal(after.cash[0].amount,30);
  assert.match(after.expected,/70,00/);
  await page.evaluate(()=>window.POTE_PDV.close());
  await page.click("#potePdvPage .pote-pdv-page-supply");
  assert.equal(await page.evaluate(()=>document.querySelector(
   '#potePdvMovementEditor input[name="kind"]').value),"suprimento");
  await page.type('#potePdvMovementEditor input[name="amount"]',"20,00");
  await page.type('#potePdvMovementEditor input[name="reason"]',"Troco QA");
  await page.click('#potePdvMovementEditor button[type="submit"]');
  const supplied=await page.evaluate(()=>({
   kinds:window.__cashQA.cashMovements.map(x=>x.kind),
   expected:document.querySelector(".pote-pdv-check-number strong")?.textContent
  }));
  assert.equal(supplied.kinds.length,2);
  assert.match(supplied.expected,/90,00/);
  console.log("PASS main PDV page",width,
   "Sangria visible above close, click saves -30, supply +20, expected R$90");
  await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error("PDV main-page Sangria QA failed",e.stack||e);process.exitCode=1});
