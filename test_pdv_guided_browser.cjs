const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
let puppeteer;
for(const candidate of ["puppeteer",process.env.POTE_QA_PUPPETEER,"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){
 try{puppeteer=require(candidate);break}catch{}
}
if(!puppeteer)throw Error("Run browser QA with Puppeteer installed or set POTE_QA_PUPPETEER.");

(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
 try{
  for(const width of [375,430,1280]){
   const page=await browser.newPage();
   await page.setViewport({width,height:855,deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
   await page.setRequestInterception(true);
   page.on("request",request=>request.url().includes("/firebase_integration.js")?
    request.respond({status:200,contentType:"text/javascript",body:""}):request.continue());
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,{waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForFunction(()=>window.POTE_PDV?.open,{timeout:14000});
   const first=await page.evaluate(()=>{
    const orders=[
      {id:"cash1",name:"Batata carne",cashSessionId:"shift1",qty:1,price:100,deliveryFee:0,paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro",status:"entregue"},
      {id:"pix1",name:"Batata ninho",cashSessionId:"shift1",qty:1,price:150,deliveryFee:0,paymentMethod:"Pix",paymentStatus:"Informado",status:"recebido"},
      {id:"pix2",name:"Batata pizza",cashSessionId:"shift1",qty:1,price:50,deliveryFee:0,paymentMethod:"Pix",paymentStatus:"pago",status:"entregue"},
      {id:"card1",name:"Batata frango",cashSessionId:"shift1",qty:1,price:200,deliveryFee:0,paymentMethod:"Cartão",paymentStatus:"pago",status:"entregue"}
    ];
    window.POTE_AUTH={uid:"qa-pdv",email:"qa-pdv@exemplo.com",role:"admin",proActive:true};
    window.POTE_APP_READY=true;
    window.POTE_SYNC_GUARD={blocked:false};
    window.__qaData={orders,cashSessions:[{id:"shift1",status:"open",operator:"Operadora",openedAt:"2026-11-17T19:00:00Z",openingCash:30}],cashMovements:[]};
    window.POTE_APP={
     snapshot:()=>({data:structuredClone(window.__qaData)}),
     applyState:state=>{window.__qaData=structuredClone(state.data)}
    };
    window.confirm=()=>true;
    window.prompt=()=> "Pix conferido no extrato de teste";
    document.getElementById("poteAuthGate")?.remove();
    window.POTE_PDV.open();
    const body=document.getElementById("potePdvBody");
    return {hasChart:body.textContent.includes("Veja quanto entrou em cada meio"),hasConfirm:body.textContent.includes("Confirmar recebimento"),hasClosing:body.textContent.includes("DINHEIRO QUE DEVE TER NA GAVETA"),hasInput:!!body.querySelector('[name="countedCash"]'),bars:[...body.querySelectorAll(".pote-pdv-chart-fill")].map(x=>x.style.width),text:body.textContent.slice(0,800),visible:document.getElementById("potePdvDialog").hidden===false};
   });
   console.log("INITIAL",width,JSON.stringify(first));
   assert(first.visible&&first.hasChart&&first.hasConfirm&&first.hasClosing&&first.hasInput);
   assert.deepEqual(first.bars,["28.57%","14.29%","57.14%"]);
   await page.evaluate(()=>{
    const input=document.querySelector("#potePdvBody [name='countedCash']");
    input.value="127,00";input.dispatchEvent(new Event("input",{bubbles:true}));
   });
   const difference=await page.evaluate(()=>{
    const el=document.getElementById("potePdvCountPreview");
    return {result:el?.dataset?.result,text:el?.textContent?.trim()};
   });
   assert.equal(difference.result,"falta");
   assert.match(difference.text,/3,00/);
   const pending=await page.$('button[data-pdv-action="confirm"][data-order-id="pix1"]');
   assert(pending,"Aguardando Pix should have Confirmar recebimento");
   await pending.click();
   const after=await page.evaluate(()=>{
    const body=document.getElementById("potePdvBody");
    return {paid:window.__qaData.orders.find(x=>x.id==="pix1")?.paymentStatus,
      confirmed:window.__qaData.orders.find(x=>x.id==="pix1")?.paymentConfirmationReference,
      summary:body.querySelector(".pote-pdv-kpi.receipts strong")?.textContent,
      pending:body.querySelector(".pote-pdv-kpi.pending strong")?.textContent,
      chart:[...body.querySelectorAll(".pote-pdv-chart-caption strong")].map(x=>x.textContent),
      bars:[...body.querySelectorAll(".pote-pdv-chart-fill")].map(x=>x.style.width),
      scroll:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   console.log("CONFIRMED",width,JSON.stringify(after));
   assert.equal(after.paid,"pago");
   assert.match(after.confirmed,/Pix conferido/);
   assert.match(after.summary,/500,00/);
   assert.match(after.pending,/0,00/);
   assert.deepEqual(after.bars.map(parseFloat),[20,40,40]);
   assert(after.scroll<=after.viewport+2,"Horizontal overflow on phone");
   await page.evaluate(()=>{document.querySelector(".pote-pdv-container").scrollTop=0});
   if(width===375){await page.screenshot({path:path.join(__dirname,"_qa_pdv_guided_mobile.png"),fullPage:false})}
   if(width===1280){await page.screenshot({path:path.join(__dirname,"_qa_pdv_guided_desktop.png"),fullPage:false})}
   const closed=await page.evaluate(()=>{
    const input=document.querySelector("#potePdvBody [name=countedCash]");
    input.value="130,00";
    input.dispatchEvent(new Event("input",{bubbles:true}));
    document.querySelector("form[data-pdv-form=close]").requestSubmit();
    const last=window.__qaData.cashSessions[0];
    return {status:last.status,expected:last.expectedCash,counted:last.countedCash,difference:last.difference,history:document.getElementById("potePdvBody").textContent.slice(0,600)};
   });
   assert.equal(closed.status,"closed");
   assert.equal(closed.expected,130);
   assert.equal(closed.counted,130);
   assert.equal(closed.difference,0);
   assert.match(closed.history,/Último fechamento/);
   console.log("CLOSED_REPORT",width,JSON.stringify(closed));
   await page.close();
   if(errors.length)console.log("PAGE_ERRORS",width,JSON.stringify(errors.slice(0,7)));
  }
 }finally{await browser.close()}
 console.log("PASS Guided PDV UI, chart values and percentages, confirmation and cash count preview.");
})().catch(error=>{console.error("GUIDED_PDV_QA_FAILED",error.stack);process.exitCode=1});
