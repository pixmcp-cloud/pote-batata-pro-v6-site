"use strict";
/* Test actual finance renderer from admin_console.js with synthetic data.
   Firebase account isolation is separately validated in Firestore Emulator. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"../.."),art=path.join(__dirname,"artifacts");
let puppeteer;
for(const n of ["puppeteer-core","puppeteer",process.env.POTE_QA_PUPPETEER,
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){
 try{puppeteer=require(n);break}catch{}
}
if(!puppeteer)throw Error("Puppeteer missing");
const chrome=[process.env.CHROME_BIN,process.env.POTE_QA_CHROME,
 "C:/Program Files/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome",
 "/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(x=>x&&fs.existsSync(x));
if(!chrome)throw Error("Chrome missing");
const src=fs.readFileSync(path.join(root,"admin_console.js"),"utf8");
const a=src.indexOf("function renderFranchiseFinance(){");
const b=src.indexOf("async function openFranchiseFinance()",a);
assert(a>=0&&b>a,"Real admin finance renderer not found");
const renderer=src.slice(a,b);
const css=fs.readFileSync(path.join(root,"admin_console.css"),"utf8");
const data={orders:[
 {id:"o1",qty:2,price:35,createdAt:"2026-11-18T10:00:00Z",
  paymentConfirmedAt:"2026-11-18T10:05:00Z",paymentStatus:"pago",paymentMethod:"Pix",unitVariableCost:10},
 {id:"o2",qty:1,price:40,createdAt:"2026-11-17T09:00:00Z",
  paymentConfirmedAt:"2026-11-17T09:02:00Z",paymentStatus:"pago",paymentMethod:"Cartão",unitVariableCost:15},
 {id:"o3",qty:1,price:15,createdAt:"2026-11-18T11:00:00Z",paymentStatus:"Pendente",
  paymentMethod:"Dinheiro",unitVariableCost:4}
],expenses:[{id:"e1",at:"2026-11-18T14:00:00Z",amount:20}],
cashMovements:[{kind:"reembolso",at:"2026-11-18T17:00:00Z",amount:10,orderId:"o4",reason:"QA"}]};
const widths=[320,375,430,768];
async function main(){
 const {computeFranchiseFinances}=await import(pathToFileURL(path.join(root,"franchise_financial_report.mjs")).href);
 const now=new Date("2026-11-18T18:00:00.000Z");
 const computed={7:computeFranchiseFinances(data,7,now),30:computeFranchiseFinances(data,30,now)};
 const body='<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<style>body{margin:0;background:#091625;font:14px system-ui;color:#f5f5f5}*,*:before,*:after{box-sizing:border-box}'+css+'</style></head><body>'+
  '<section id="poteAdmFinancialPanel" class="pote-adm-financial-panel">'+
  '<div class="pote-adm-financial-header"><h3>Desempenho da franquia</h3><button>Fechar</button></div>'+
  '<p id="poteAdmFinancialName">Franquia QA</p>'+
  '<div class="pote-adm-financial-tabs">'+
  '<button data-financial-days="7" aria-pressed="true">Semanal</button>'+
  '<button data-financial-days="30" aria-pressed="false">Mensal</button></div>'+
  '<p id="poteAdmFinancialStatus">Dados simulados</p>'+
  '<div id="poteAdmFinancialMetrics"></div><div id="poteAdmFinancialChart"></div>'+
  '<div id="poteAdmFinancialTender"></div><p class="pote-adm-financial-muted">Estimativa, não saldo bancário</p>'+
  '</section></body></html>';
 const script='let financialRecords='+JSON.stringify(data)+';let financialDays=7;'+
  'const computed='+JSON.stringify(computed)+';'+
  'const computeFranchiseFinances=(records,days)=>computed[days];'+
  'const $=id=>document.getElementById(id);'+
  'const esc=x=>String(x??"").replace(/[&<>\\x22\\x27]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'+
  '"\\x22":"&quot;","\\x27":"&#39;"}[c]));'+
  'const financeBRL=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});'+
  renderer+';window.qaSetPeriod=d=>{financialDays=d;renderFranchiseFinance()};';
 fs.mkdirSync(art,{recursive:true});
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  for(const width of widths){
   const page=await browser.newPage();
   await page.setViewport({width,height:width<600?812:1024,deviceScaleFactor:2,
    isMobile:width<600,hasTouch:width<600});
   await page.setContent(body);
   await page.addScriptTag({content:script});
   for(const days of [7,30]){
    await page.evaluate(d=>window.qaSetPeriod(d),days);
    const snapshot=await page.evaluate(()=>({
     viewport:innerWidth,scroll:document.documentElement.scrollWidth,
     bars:document.querySelectorAll(".pote-adm-financial-bar").length,
     metrics:document.querySelectorAll("#poteAdmFinancialMetrics .pote-adm-financial-metrics > div").length,
     tender:document.querySelectorAll("#poteAdmFinancialTender .pote-adm-financial-metrics > div").length,
     text:document.getElementById("poteAdmFinancialMetrics").textContent,
     selected:[...document.querySelectorAll("[data-financial-days]")]
      .filter(x=>x.getAttribute("aria-pressed")==="true").map(x=>x.dataset.financialDays)
    }));
    assert.equal(snapshot.bars,days,"Number of daily bars");
    assert.equal(snapshot.metrics,8,"Financial metrics missing");
    assert.equal(snapshot.tender,4,"Cash/Pix/Card/other breakdown missing");
    assert.deepEqual(snapshot.selected,[String(days)]);
    assert(snapshot.scroll<=snapshot.viewport+2,"Franchise report overflows "+width+"x"+days);
    assert(snapshot.text.includes("Resultado estimado"),"Missing estimated result label");
    if(width===320||width===430)
     await page.screenshot({path:path.join(art,"franchise-"+width+"-"+days+"d.jpg"),
      type:"jpeg",quality:74});
    console.log("PASS FRANCHISE_MOBILE",width,days,"bars",snapshot.bars);
   }
   await page.close();
  }
 }finally{await browser.close()}
 console.log("PASS FRANCHISE MOBILE 7/30 days x 320/375/430/768");
}
main().catch(e=>{console.error("FRANCHISE MOBILE FAILED",e.stack||e);process.exitCode=1});
