const assert=require("node:assert/strict");
const path=require("node:path");const {pathToFileURL}=require("node:url");
let puppeteer;for(const pkg of ["puppeteer",process.env.POTE_QA_PUPPETEER,"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){try{puppeteer=require(pkg);break}catch{}}
if(!puppeteer)throw Error("Puppeteer browser QA required");
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--no-sandbox","--disable-web-security","--allow-file-access-from-files"]});
 try{
  for(const width of [375,430,1280]){
   const page=await browser.newPage();
   await page.setViewport({width,height:855,isMobile:width<600,hasTouch:width<600,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on("request",req=>req.url().includes("/firebase_integration.js")?req.respond({status:200,contentType:"text/javascript",body:""}):req.continue());
   await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,{waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForFunction(()=>window.POTE_PDV?.completeSalePayment&&window.POTE_APP?.snapshot,{timeout:16000});
   const result=await page.evaluate(()=>{
    window.POTE_AUTH={uid:"auto-qa",role:"admin",proActive:true,email:"qa@example.com"};
    window.POTE_APP_READY=true;window.POTE_SYNC_GUARD={blocked:false};
    document.getElementById("poteAuthGate")?.remove();
    window.prompt=()=>{throw Error("Confirmation prompt should never appear")};
    window.confirm=()=>{throw Error("Second payment confirmation should never appear")};
    const before=window.POTE_APP.snapshot();
    const recipe=before.data.recipes.find(r=>r.id&&r.items?.length)||{
     id:"qa-frango-cremoso",name:"Frango Cremoso",category:"Salgado",time:30,
     items:[{id:"qa-frango",g:150}],steps:["Cozinhar", "Montar"],pricingMode:"gain",targetGainPct:100
    };
    before.data.recipes=[recipe];
    const orders=[
     {id:"qa-pix",recipeId:recipe.id,name:"Frango Cremoso",status:"em_producao",qty:1,price:20.9,deliveryFee:0,
      paymentMethod:"Pix",paymentStatus:"Informado",cashSessionId:null,createdAt:new Date().toISOString()},
     {id:"qa-card",recipeId:recipe.id,name:"Frango Cremoso",status:"em_producao",qty:2,price:30,deliveryFee:0,
      paymentMethod:"Cartão",paymentStatus:"Informado",cashSessionId:null,createdAt:new Date().toISOString()},
     {id:"qa-cash",recipeId:recipe.id,name:"Frango Cremoso",status:"em_producao",qty:1,price:10,deliveryFee:0,
      paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro",cashSessionId:null,createdAt:new Date().toISOString()},
     {id:"qa-delivery",recipeId:recipe.id,name:"Frango Cremoso",status:"em_producao",qty:1,price:40,deliveryFee:0,
      paymentMethod:"Na entrega",paymentStatus:"Pendente",cashSessionId:null,createdAt:new Date().toISOString()}
    ];
    before.data.orders=orders;before.data.cashSessions=[];before.data.cashMovements=[];
    window.POTE_APP.applyState(before);
    const errors=[];
    for(const id of orders.map(x=>x.id)){
     try{finishOrder(id)}catch(e){errors.push([id,e.message])}
    }
    const after=window.POTE_APP.snapshot();
    const session=after.data.cashSessions.find(x=>x.status==="open");
    go("pdv");
    const dashboard=document.getElementById("potePdvPage");
    const lines=[...dashboard.querySelectorAll(".pote-pdv-chart-caption strong")].map(x=>x.textContent);
    const pending=after.data.orders.filter(x=>x.status==="entregue"&&!["pago","Pago em dinheiro"].includes(x.paymentStatus));
    return {errors,
     orders:after.data.orders.map(x=>({id:x.id,status:x.status,paymentStatus:x.paymentStatus,cashSessionId:x.cashSessionId,
      confirmedAt:x.paymentConfirmedAt||null})),
     session:session?{id:session.id,openingCash:session.openingCash,autoStarted:session.autoStarted}:null,
     cashSessions:after.data.cashSessions.length,
     modalPending:pending.map(x=>x.id),
     total:dashboard.querySelector(".pote-pdv-page-summary strong")?.textContent,
     chart:lines,page:document.querySelector(".pote-pdv-page-heading h2")?.textContent,
     width:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   console.log("CONCLUDE_SALES_AUTO_PDV",width,JSON.stringify(result));
   assert.deepEqual(result.errors,[]);
   assert(result.session&&result.session.autoStarted&&result.session.openingCash===0,"Automatic zero float turn");
   assert.equal(result.cashSessions,1,"Single turn for all completed payments");
   assert.deepEqual(result.orders.map(x=>x.status),Array(4).fill("entregue"));
   assert.deepEqual(result.orders.slice(0,3).map(x=>x.paymentStatus),["pago","pago","Pago em dinheiro"]);
   assert.deepEqual(result.modalPending,["qa-delivery"]);
   assert(result.orders.slice(0,3).every(x=>x.cashSessionId===result.session.id));
   assert.match(result.total,/90,90/);
   assert.match(result.chart[0],/10,00/);
   assert.match(result.chart[1],/20,90/);
   assert.match(result.chart[2],/60,00/);
   assert(result.width<=result.viewport+2);
   const checkAgain=await page.evaluate(()=>{
    finishOrder("qa-pix");
    const d=window.POTE_APP.snapshot().data;
    return {sessions:d.cashSessions.length,pix:d.orders.find(x=>x.id==="qa-pix")?.paymentStatus,
      movements:d.cashMovements?.length||0};
   });
   assert.equal(checkAgain.sessions,1);
   assert.equal(checkAgain.movements,0);
   assert.equal(checkAgain.pix,"pago");
   await page.close();
  }
 }finally{await browser.close()}
 console.log("PASS real Concluir order -> automatic Pix/Card/Cash PDV receipt without extra prompts or clicks.");
})().catch(e=>{console.error("AUTO_SALE_BROWSER_QA_FAILED",e.stack);process.exitCode=1});
