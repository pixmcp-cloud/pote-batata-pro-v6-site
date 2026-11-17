const puppeteer=require('C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
(async()=>{
 const b=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
 const page=await b.newPage();await page.setViewport({width:390,height:844});
 await page.setContent('<header class="head"><div class="headin"><div class="brand">POTÊ BATATA</div><button id="poteHomeShortcut" class="home-hero-button">Início</button><button id="poteFloatToggle">☰</button></div></header>');
 await page.addStyleTag({content:'body{margin:0;background:#131b27;color:#fff}.head{width:100%}.headin{display:flex}.brand{padding:8px}.home-hero-button{font-size:10px}#poteFloatToggle{border:1px solid #888;background:#30425b;color:#fff;font-size:23px}'});
 await page.addStyleTag({path:path.join(__dirname,'top_navigation.css')});
 await page.addStyleTag({path:path.join(__dirname,'notifications.css')});
 await page.addScriptTag({path:path.join(__dirname,'top_navigation.js')});
 const result=await page.evaluate(()=>{
 const bar=document.getElementById('poteTopActions'),bell=document.getElementById('poteBell'),menu=document.getElementById('poteFloatToggle');
 const br=bell.getBoundingClientRect(),mr=menu.getBoundingClientRect();
 return {present:!!bell,inside:bell?.closest('#poteTopActions')===bar,adjacent:bell?.closest('#poteNotifications')?.nextElementSibling===menu,
 gap:mr.left-br.right,br:{x:br.x,y:br.y,w:br.width,h:br.height},mr:{x:mr.x,y:mr.y,w:mr.width,h:mr.height},scroll:document.documentElement.scrollWidth,view:innerWidth};
 });
 console.log(result);assert(result.present&&result.inside&&result.adjacent);assert(result.gap>=-2&&result.gap<20);assert(result.br.w>35&&result.scroll<=result.view+2);
 await page.screenshot({path:path.join(__dirname,'test_bell_header.png')});
 console.log('PASS: notification bell visible and directly beside hamburger at 390px');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
