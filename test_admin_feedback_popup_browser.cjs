"use strict";
/* Browser reproduction: ADM confirmation must remain centered even if the
 * operator scrolled to franchise controls on a small Android viewport. */
const assert=require("node:assert/strict"),fs=require("node:fs");
let puppeteer;
for(const item of [
 process.env.POTE_QA_PUPPETEER,
 "./qa/mobile/node_modules/puppeteer-core",
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"
].filter(Boolean)){try{puppeteer=require(item);break}catch{}}
if(!puppeteer)throw Error("Puppeteer Core não instalado");
const chrome=[
 process.env.CHROME_BIN,process.env.POTE_QA_CHROME,
 "C:/Program Files/Google/Chrome/Application/chrome.exe",
 "/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"
].find(p=>p&&fs.existsSync(p));
if(!chrome)throw Error("Chrome/Chromium não disponível");
const js=fs.readFileSync("admin_console.js","utf8"),css=fs.readFileSync("admin_console.css","utf8");
const html=js.match(/(<div id="poteAdmActionPopup"[\s\S]*?<\/div>\s*<\/div>)/);
assert(html,"Popup não encontrado no modelo original");
const a=js.indexOf("let popupReturnFocus=null;"),b=js.indexOf("async function assertAdmin(){",a);
assert(a>0&&b>a,"Controlador do popup não encontrado no código de produção");
const controller=js.slice(a,b);
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
 try{
  for(const w of [320,375,430,844,1366]){
   const h=w===844?390:w===1366?768:812;
   const page=await browser.newPage();
   await page.setViewport({width:w,height:h,deviceScaleFactor:2,
    isMobile:w!==1366,hasTouch:w!==1366});
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<style>'+css+'</style></head><body><button id="trigger">Editar nome</button>'+
    '<div id="poteAdmOverlay"><section class="pote-adm-shell"><header class="pote-adm-head">'+
    '<h2>Central Administrativa</h2></header><div class="pote-adm-scroll">'+
    '<div style="height:2900px">Licenças, franquias e permissões</div>'+
    '<div id="poteAdmFeedback"></div></div></section>'+html[1]+'</div></body></html>');
   await page.addScriptTag({content:
    'const $=id=>document.getElementById(id); const overlay=$("poteAdmOverlay");'+
    controller+' window.testPopup={status,hideActionPopup};'});
   await page.click("#trigger");
   await page.evaluate(()=>{
    const sc=document.querySelector(".pote-adm-scroll");sc.scrollTop=sc.scrollHeight;
    window.testPopup.status("Nome e proteção da conta atualizados. Histórico de moderação registrado.",false,true);
   });
   const loc=await page.evaluate(()=>{
    const popup=document.querySelector(".pote-adm-action-card");
    const r=popup.getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height,screenW:innerWidth,screenH:innerHeight,
     visible:!document.getElementById("poteAdmActionPopup").hidden,
     text:document.getElementById("poteAdmActionMessage").textContent,
     centerHit:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest(".pote-adm-action-card")!==null};
   });
   assert(loc.visible&&loc.centerHit,`Popup não está acima do conteúdo em ${w}px`);
   assert(loc.x>=0&&loc.y>=0&&loc.x+loc.w<=loc.screenW+1&&loc.y+loc.h<=loc.screenH+1,
    `Popup fora do viewport ${w}: ${JSON.stringify(loc)}`);
   assert(Math.abs(loc.x+loc.w/2-loc.screenW/2)<=4&&
    Math.abs(loc.y+loc.h/2-loc.screenH/2)<=4,
    `Popup não centralizado em ${w}: ${JSON.stringify(loc)}`);
   assert.match(loc.text,/Nome e proteção da conta atualizados/);
   await page.click("#poteAdmActionDismiss");
   assert.equal(await page.$eval("#poteAdmActionPopup",e=>e.hidden),true);
   await page.close();
  }
  console.log("PASS: popup de confirmação visível e centralizado em 320, 375, 430, 844 e 1366px, mesmo após rolagem");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
