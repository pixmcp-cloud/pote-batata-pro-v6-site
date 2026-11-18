'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
let puppeteer;
for(const pkg of ['puppeteer',process.env.POTE_QA_PUPPETEER,
 'C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer'].filter(Boolean)){
 try{puppeteer=require(pkg);break}catch{}
}
if(!puppeteer)throw Error('Puppeteer not installed');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.POTE_QA_CHROME||
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
 args:['--no-sandbox','--disable-web-security','--allow-file-access-from-files']});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:375,height:812,isMobile:true,hasTouch:true});
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'pote_calc_quantum_99_fullscreen.html')).href,
   {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#calcPlayground')?.dataset.ready==='1');
  async function key(k){await page.click('[data-key="'+k+'"]')}
  async function status(){return page.evaluate(()=>({
   display:document.querySelector('#display').textContent,
   preview:document.querySelector('#calcLiveResult').textContent,
   shown:getComputedStyle(document.querySelector('#calcLiveResult')).visibility!=='hidden',
   expr:document.querySelector('#expression').textContent,
   locations:(()=>{const d=document.querySelector('#display').getBoundingClientRect(),
    p=document.querySelector('#calcLiveResult').getBoundingClientRect(),
    lcd=document.querySelector('.lcd').getBoundingClientRect();
    return {previewBelowNumbers:p.top>=d.bottom-2,insideLCD:p.bottom<=lcd.bottom+2}})()
  }))}

  await key('1');await key('0');await key('+');await key('5');
  let s=await status();
  assert.equal(s.display,'5');assert.equal(s.preview,'= 15');assert(s.shown);
  assert(s.expr.includes('10 + 5'));assert(s.locations.previewBelowNumbers&&s.locations.insideLCD);
  await key('=');s=await status();assert.equal(s.display,'15');
  await key('=');s=await status();assert.equal(s.display,'20');
  await key('=');s=await status();assert.equal(s.display,'25');
  await key('C');await key('2');await key('*');await key('3');
  s=await status();assert.equal(s.preview,'= 6');
  await key('=');await key('=');s=await status();assert.equal(s.display,'18');
  await key('C');await key('2');await key('0');await key('0');await key('+');
  await key('1');await key('0');await key('%');
  s=await status();assert.equal(s.preview,'= 220','Live percentage preview');
  await key('=');s=await status();assert.equal(s.display,'220');
  await key('C');await key('9');await key('/');await key('3');
  s=await status();assert.equal(s.preview,'= 3');
  assert.deepEqual(failures,[],'No calculator JS exception');
  await page.close();

  for(const width of [375,430,834]){
   const p=await browser.newPage();
   await p.setViewport({width,height:680,isMobile:width<600,hasTouch:width<600});
   await p.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>.head{position:fixed;z-index:95;top:0;left:0;right:0;height:150px;background:blue}</style></head>'+
    '<body class="pote-shopping-open"><div class="head">Fixed header</div>'+
    '<section id="poteShoppingListDialog" class="pote-shopping-cover">'+
    '<div class="pote-shopping-dialog"><header><div><small>ESTOQUE</small><h2>Lista de Compras</h2></div>'+
    '<button id="poteShoppingClose">X</button></header><p id="poteShoppingSummary">13 produtos</p>'+
    '<div class="pote-shopping-items">'+Array(20).fill('<article class="pote-shopping-item">Estoque</article>').join('')+
    '</div></div></section></body></html>');
   await p.addStyleTag({content:fs.readFileSync(path.join(__dirname,'franchise_shopping_list.css'),'utf8')});
   const result=await p.evaluate(()=>{
    const button=document.querySelector('#poteShoppingClose');
    const b=button.getBoundingClientRect();
    const centerX=b.left+b.width/2,centerY=b.top+b.height/2;
    const covering=document.elementFromPoint(centerX,centerY);
    const header=document.querySelector('.head');
    return {btnWithinViewport:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,
     uncovered:covering===button,coverZ:getComputedStyle(document.querySelector('.pote-shopping-cover')).zIndex,
     headerZ:getComputedStyle(header).zIndex,buttonHeight:b.height};
   });
   assert(result.btnWithinViewport&&result.uncovered&&result.buttonHeight>=44,
    'Shopping close button hidden at width '+width+': '+JSON.stringify(result));
   await p.close();
  }
  console.log('PASS: live preview + repeat equals + percent and shopping X above fixed bar (375/430/834).');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
