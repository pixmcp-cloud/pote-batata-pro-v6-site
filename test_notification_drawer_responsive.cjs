const puppeteer=require('C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  for(const width of [320,360,375,390,430,768]){
   const page=await browser.newPage(); await page.setViewport({width,height:740,deviceScaleFactor:1});
   await page.setContent('<header class="head"><div class="headin"><div class="brand">POTÊ BATATA</div><button id="poteHomeShortcut" class="home-hero-button">Início</button><button id="poteFloatToggle">☰</button></div></header>');
   await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0;background:#131b27;color:#fff}.head{width:100%}.headin{display:flex}.brand{padding:8px}.home-hero-button{font-size:10px}#poteFloatToggle{border:1px solid #888;background:#30425b;color:#fff;font-size:23px}'});
   await page.addStyleTag({path:path.join(__dirname,'notifications.css')});
   await page.addStyleTag({path:path.join(__dirname,'top_navigation.css')});
   await page.addScriptTag({path:path.join(__dirname,'top_navigation.js')});
   await page.click('#poteBell');
   const bounds=await page.evaluate(()=>{
    const d=document.querySelector('#poteNoticeDrawer'),r=d.getBoundingClientRect();
    return {hidden:d.hidden,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,viewport:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,position:getComputedStyle(d).position};
   });
   assert.equal(bounds.hidden,false);
   assert(bounds.left>=-0.5,'left overflow '+width+': '+JSON.stringify(bounds));
   assert(bounds.right<=width+0.5,'right overflow '+width+': '+JSON.stringify(bounds));
   assert(bounds.bottom<=bounds.height+1,'vertical overflow '+width+': '+JSON.stringify(bounds));
   assert(bounds.scroll<=width+1,'horizontal scroll '+width+': '+JSON.stringify(bounds));
   await page.click('#poteNoticeClose');
   assert.equal(await page.$eval('#poteNoticeDrawer',e=>e.hidden),true);
   console.log('PASS responsive notice drawer',width,'px',Math.round(bounds.left),Math.round(bounds.right),bounds.position);
   if(width===375)await page.screenshot({path:path.join(__dirname,'test_notification_drawer_mobile.png')});
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
