const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
let puppeteer;
for(const p of ["puppeteer",process.env.POTE_QA_PUPPETEER,"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){try{puppeteer=require(p);break}catch{}}
if(!puppeteer)throw Error("Puppeteer is required");
(async()=>{
 const b=await puppeteer.launch({headless:true,executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--no-sandbox","--allow-file-access-from-files","--disable-web-security"]});
 try{
  for(const width of [375,430,1280]){
   const page=await b.newPage();
   await page.setViewport({width,height:840,isMobile:width<600,hasTouch:width<600,deviceScaleFactor:1});
   await page.setRequestInterception(true);
   page.on("request",req=>req.url().includes("/firebase_integration.js")?req.respond({status:200,contentType:"text/javascript",body:""}):req.continue());
   await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,{waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForFunction(()=>!!window.POTE_PDV?.renderPage&&typeof go==="function",{timeout:17000});
   const closed=await page.evaluate(()=>{
    const historical={id:"shift-history",status:"closed",openedAt:"2026-11-17T11:00:00Z",closedAt:"2026-11-17T17:00:00Z",
     openingCash:50,countedCash:150,expectedCash:150,difference:0,
     closedSummary:{openingCash:50,expectedCash:150,expectedCashCents:15000,pending:0,pendingCount:0,
       confirmedByMethod:{cash:100,pix:130,card:70},previousByMethod:{cash:0,pix:0,card:0},
       supply:0,withdraw:0,refunds:0}};
    window.POTE_AUTH={uid:"qa-pdv-visible",role:"admin",proActive:true,email:"qa-pdv@example.com"};
    window.POTE_APP_READY=true;
    window.__pdvQA={cashSessions:[historical],cashMovements:[],orders:[]};
    window.POTE_APP={snapshot:()=>({data:structuredClone(window.__pdvQA)}),applyState:s=>window.__pdvQA=structuredClone(s.data)};
    document.getElementById("poteAuthGate")?.remove();
    go("home");
    const card=[...document.querySelectorAll(".ops-card")].find(el=>el.textContent.includes("Caixa PDV"));
    if(!card)throw Error("Caixa PDV card is missing on Home");
    card.click();
    const el=document.getElementById("potePdvPage");
    const parts=[...el.querySelectorAll(".pote-pdv-chart-caption strong")].map(x=>x.textContent);
    return {route:window.POTE_ROUTE_BRIDGE.current().tab,hasCard:!!card,hasMenu:document.getElementById("navdesktop")?.textContent?.includes("Caixa PDV"),
      total:el.querySelector(".pote-pdv-page-summary strong")?.textContent,parts,
      chart:!!el.querySelector(".pote-pdv-chart"),end:el.textContent.includes("Último caixa fechado"),
      scroll:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   console.log("CLOSED_PDV_PAGE",width,JSON.stringify(closed));
   assert.equal(closed.route,"pdv");
   assert(closed.hasCard&&closed.hasMenu&&closed.chart&&closed.end);
   assert.match(closed.total,/300,00/);
   assert.match(closed.parts[0],/100,00/);
   assert.match(closed.parts[1],/130,00/);
   assert.match(closed.parts[2],/70,00/);
   assert(closed.scroll<=closed.viewport+2,"Horizontal overflow");
   if(width===375)await page.screenshot({path:path.join(__dirname,"_qa_pdv_page_closed_mobile.png")});
   await page.click(".pote-pdv-page-action");
   const modal=await page.evaluate(()=>({open:!document.getElementById("potePdvDialog").hidden,
     chart:document.getElementById("potePdvBody").textContent.includes("Gráfico")||
       !!document.getElementById("potePdvBody").querySelector(".pote-pdv-chart")}));
   console.log("CLOSED_MODAL",width,JSON.stringify(modal));
   if(!modal.open){
    const direct=await page.evaluate(()=>{
      const btn=document.querySelector(".pote-pdv-page-action");
      const before={markup:btn?.outerHTML,ready:window.POTE_APP_READY,auth:window.POTE_AUTH,
        app:!!window.POTE_APP?.snapshot,dialog:document.getElementById("potePdvDialog")?.outerHTML?.slice(0,180)};
      window.POTE_PDV.open();
      return {before,after:{hidden:document.getElementById("potePdvDialog")?.hidden,body:document.getElementById("potePdvBody")?.innerHTML?.slice(0,240)}};
    });
    console.log("DIRECT_OPEN_DIAG",width,JSON.stringify(direct));
   }
   assert(modal.open&&modal.chart,"Closed cashier modal should still show chart");
   await page.evaluate(()=>window.POTE_PDV.close());
   const live=await page.evaluate(()=>{
    window.__pdvQA.cashSessions.unshift({id:"shift-open",status:"open",openingCash:20,openedAt:"2026-11-18T10:00:00Z",operator:"Operadora"});
    window.__pdvQA.orders=[
     {id:"o1",name:"Dinheiro",qty:1,price:40,cashSessionId:"shift-open",status:"entregue",paymentMethod:"Dinheiro",paymentStatus:"Pago em dinheiro"},
     {id:"o2",name:"Pix",qty:1,price:60,cashSessionId:"shift-open",status:"entregue",paymentMethod:"Pix",paymentStatus:"nao_pago"},
     {id:"o3",name:"Cartão",qty:1,price:80,cashSessionId:"shift-open",status:"entregue",paymentMethod:"Cartão",paymentStatus:"pago"}
    ];
    window.POTE_PDV.refresh();
    const el=document.getElementById("potePdvPage");
    return {status:el.textContent.includes("ABERTO"),
       confirmed:el.querySelector(".pote-pdv-page-summary strong")?.textContent,
       values:[...el.querySelectorAll(".pote-pdv-chart-caption strong")].map(x=>x.textContent),
       expected:/R\$\s*60,00/.test(el.textContent),
       screen:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   console.log("ACTIVE_PDV_PAGE",width,JSON.stringify(live));
   assert(live.status&&live.expected);
   assert.match(live.confirmed,/120,00/);
   assert.match(live.values[0],/40,00/);
   assert.match(live.values[1],/0,00/);
   assert.match(live.values[2],/80,00/);
   assert(live.screen<=live.viewport+2);
   if(width===375)await page.screenshot({path:path.join(__dirname,"_qa_pdv_page_active_mobile.png")});
   await page.close();
  }
 }finally{await b.close()}
 console.log("PASS dedicated Caixa PDV route/card/menu, closed chart, open chart, modal controls, mobile responsiveness.");
})().catch(error=>{console.error("PDV_VISIBLE_BROWSER_FAILED",error.stack);process.exitCode=1});
