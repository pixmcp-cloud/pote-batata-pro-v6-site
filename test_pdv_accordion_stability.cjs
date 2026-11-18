const assert=require("node:assert/strict");
const path=require("node:path"),{pathToFileURL}=require("node:url");
let puppeteer;for(const p of ["puppeteer",process.env.POTE_QA_PUPPETEER,"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){try{puppeteer=require(p);break}catch{}}
if(!puppeteer)throw Error("Requires Puppeteer for mobile/browser testing");
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
 try{
  for(const width of [375,430,1280]){
   const page=await browser.newPage();
   await page.setViewport({width,height:860,isMobile:width<600,hasTouch:width<600,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on("request",req=>req.url().includes("/firebase_integration.js")?req.respond({status:200,contentType:"text/javascript",body:""}):req.continue());
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,{waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForFunction(()=>window.POTE_PDV?.open,{timeout:12000});
   await page.evaluate(()=>{
    window.POTE_AUTH={uid:"qa-accordion",role:"admin",proActive:true,email:"qa@example.com"};
    window.POTE_APP_READY=true;
    window.POTE_SYNC_GUARD={blocked:false};
    window.__qaData={cashSessions:[{id:"s1",status:"open",openingCash:100,openedAt:"2026-11-18T12:00:00Z",operator:"Tester"}],
     orders:[{id:"o1",cashSessionId:"s1",name:"Batata",qty:1,price:30,status:"entregue",paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro"}],
     cashMovements:[]};
    window.POTE_APP={snapshot:()=>({data:structuredClone(window.__qaData)}),applyState:s=>{window.__qaData=structuredClone(s.data)}};
    document.getElementById("poteAuthGate")?.remove();
    window.POTE_PDV.open();
   });
   const selector='#potePdvBody details summary';
   await page.waitForSelector(selector,{timeout:6000});
   const targetSelector='#potePdvBody details[data-pdv-detail="cash-equation"]';
   const has=await page.evaluate(()=>!!document.querySelector('#potePdvBody details[data-pdv-detail="cash-equation"]'));
   if(!has){
    const simple=await page.evaluate(()=>{
      const arr=Array.from(document.querySelectorAll("#potePdvBody details"));
      const d=arr.find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
      return {index:arr.indexOf(d),selector:"#potePdvBody details:nth-of-type("+ (arr.indexOf(d)+1)+")"};
    });console.log("UNPATCHED_TARGET",JSON.stringify(simple));
   }
   const target=has?targetSelector:null;
   if(target){await page.click(target+" summary")}
   else await page.evaluate(()=>{
    const d=[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
    d.querySelector("summary").click();
   });
   const initial=await page.evaluate(()=>{
     const d=[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
     return {open:d?.open,containsEquation:!!d?.querySelector(".pote-pdv-equation"),cash:d?.textContent?.includes("Troco inicial")};
   });
   assert(initial.open&&initial.containsEquation&&initial.cash,"Accordion opens immediately with cash calculation");
   await page.evaluate(()=>window.POTE_PDV.refresh());
   const afterForcedRefresh=await page.evaluate(()=>{
     const d=[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
     return {open:d?.open,contents:d?.textContent?.includes("Troco inicial"),element:d};
   });
   console.log("AFTER_REFRESH",width,JSON.stringify({open:afterForcedRefresh.open,contents:afterForcedRefresh.contents}));
   assert(afterForcedRefresh.open&&afterForcedRefresh.contents,"Cash equation must stay expanded during automatic refresh");
   await page.evaluate(()=>window.dispatchEvent(new Event("pote:changed")));
   await new Promise(r=>setTimeout(r,360));
   const afterEvent=await page.evaluate(()=>{
     const d=[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
     return {open:d?.open,scroll:document.querySelector(".pote-pdv-container")?.scrollTop};
   });
   assert(afterEvent.open,"App sync event must not collapse explanation");
   await page.evaluate(()=>{
     window.__qaData.orders.push({id:"o2",cashSessionId:"s1",name:"Pix",qty:1,price:50,status:"entregue",paymentMethod:"Pix",paymentStatus:"pago"});
     window.dispatchEvent(new Event("pote:changed"));
   });
   await new Promise(r=>setTimeout(r,360));
   const afterDataChange=await page.evaluate(()=>{
     const d=[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
     return {open:d?.open,total:document.querySelector(".pote-pdv-kpi.receipts strong")?.textContent,calculation:d?.textContent};
   });
   assert(afterDataChange.open,"Adding a payment must not collapse cash equation");
   assert.match(afterDataChange.total,/80,00/,"PDV total should update while accordion remains open");
   assert.match(afterDataChange.calculation,/100,00/,"Cash explanation must retain opening float");
   const afterClose=await page.evaluate(()=>{
     const d=[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"));
     d.querySelector("summary").click();return d.open;
   });
   assert.equal(afterClose,false,"A second tap should close the section");
   await page.evaluate(()=>window.dispatchEvent(new Event("pote:changed")));
   await new Promise(r=>setTimeout(r,290));
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll("#potePdvBody details")].find(x=>x.querySelector("summary")?.textContent?.includes("Entenda de onde veio esse valor"))?.open),false,"Closed state should persist");
   const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
   assert(scroll<=width+2,"No horizontal scrolling on mobile");
   assert.deepEqual(errors.filter(e=>!e.includes("No Firebase App")&&!e.includes("Firebase App")),[],"Unexpected non-mocked page errors");
   console.log("PASS_DETAIL_TOGGLE_STABLE",width,"no unintended collapse, updated totals, second tap closes");
   await page.close();
  }
 }finally{await browser.close()}
 console.log("PASS all device sizes: cash breakdown accordion stable on sync and refresh.");
})().catch(e=>{console.error("PDV_ACCORDION_QA_FAILED",e.stack);process.exitCode=1});
