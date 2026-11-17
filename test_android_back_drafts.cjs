const assert=require('node:assert/strict');
const path=require('node:path');const {pathToFileURL}=require('node:url');
let puppeteer;
for (const path of ["puppeteer", process.env.POTE_QA_PUPPETEER, "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)) {
  try {puppeteer=require(path);break;} catch {}
}
if(!puppeteer)throw Error("Puppeteer is required for local Android browser QA");

(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--allow-file-access-from-files','--disable-web-security']});
 try{
  for(const width of [375,430]){
   const p=await browser.newPage();
   // Test the authenticated UI in isolation: Firebase login is not available via file://.
   await p.setRequestInterception(true);
   p.on('request',req=>req.url().includes('/firebase_integration.js')?req.respond({status:200,contentType:'text/javascript',body:''}):req.continue());
   await p.setViewport({width,height:820,deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(pathToFileURL(path.join(__dirname,'public/index.html')).href,{waitUntil:'domcontentloaded',timeout:25000});
   await p.waitForFunction(()=>!!window.POTE_EXIT && !!window.POTE_ROUTE_BRIDGE,{timeout:15000});
   const startup=await p.evaluate(()=>{
    window.POTE_AUTH={uid:'qa-android-375',role:'admin',proActive:true};
    window.dispatchEvent(new Event('pote:user-ready'));
    go('builder');
    const set=(id,v)=>{const e=document.getElementById(id);if(!e)throw Error('Missing '+id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
    set('builderName','Batata TESTE sem perder rascunho');
    set('builderTagline','Texto de descrição preservado');
    set('builderSteps','Passo um: preparar o recheio.\\nPasso dois: finalizar.');
    window.POTE_ROUTE_BRIDGE.restoreDraftItems([{id:'qa-existing-ingredient',g:150}]);
    return {route:window.POTE_EXIT.getActiveRoute(),name:document.getElementById('builderName')?.value,steps:document.getElementById('builderSteps')?.value,items:document.getElementById('builderItems')?.textContent?.slice(0,140),errors:document.getElementById('poteLoginMessage')?.textContent};
   });
   console.log('START',width,JSON.stringify(startup));assert.equal(startup.route.tab,'builder');assert.equal(startup.name,'Batata TESTE sem perder rascunho');
   const ingredient=await p.evaluate(()=>{
    openBuilderIngredient();
    return {route:window.POTE_EXIT.getActiveRoute(),banner:!!document.getElementById('poteResumeRecipe'),field:!!document.getElementById('newIngName')};
   });
   console.log('INGREDIENT',width,JSON.stringify(ingredient));
   assert.equal(ingredient.route.tab,'ingredients');assert.equal(ingredient.banner,true);assert.equal(ingredient.field,true);
   await p.evaluate(()=>{
    const set=(id,v)=>{const e=document.getElementById(id);if(!e)throw Error('Missing '+id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
    set('newIngName','Ingrediente QA Android');
    set('newIngPrice','15.5');set('newIngQuantity','1');set('newIngYield','100');
    addIngredient();
   });
   await p.waitForFunction(()=>window.POTE_EXIT?.getActiveRoute()?.tab==='builder',{timeout:10000});
   const returned=await p.evaluate(()=>{
    const route=window.POTE_EXIT.getActiveRoute();
    const select=document.getElementById('builderIng');
    return {route,
     name:document.getElementById('builderName')?.value,
     tagline:document.getElementById('builderTagline')?.value,
     steps:document.getElementById('builderSteps')?.value,
     selected:select?.selectedOptions?.[0]?.textContent,
     items:document.getElementById('builderItems')?.textContent,
     scroll:document.documentElement.scrollWidth,width:innerWidth,
     exitShown:document.getElementById('poteExitConfirm')?.hidden===false
    };
   });
   console.log('RETURNED',width,JSON.stringify(returned));
   assert.equal(returned.name,'Batata TESTE sem perder rascunho');
   assert.equal(returned.tagline,'Texto de descrição preservado');
   assert.equal(returned.steps,'Passo um: preparar o recheio.\\nPasso dois: finalizar.');
   assert.match(returned.selected,/Ingrediente QA Android/);
   assert.match(returned.items,/qa-existing-ingredient/i);
   assert.equal(returned.exitShown,false);
   assert(returned.scroll<=returned.width+2,'Mobile horizontal overflow');
   const historyBefore=await p.evaluate(()=>({length:history.length,state:history.state,logged:!!window.POTE_AUTH?.uid,armed:window.POTE_EXIT.isArmed()}));
   console.log('HISTORY_BEFORE',width,JSON.stringify(historyBefore));
   await p.evaluate(()=>history.back());
   await new Promise(r=>setTimeout(r,1500));
   const historyAfter=await p.evaluate(()=>({length:history.length,state:history.state,logged:!!window.POTE_AUTH?.uid,armed:window.POTE_EXIT.isArmed(),route:window.POTE_EXIT.getActiveRoute(),current:window.POTE_ROUTE_BRIDGE.current()}));
   console.log('HISTORY_AFTER',width,JSON.stringify(historyAfter));
   assert.equal(historyAfter.route.tab,'home');
   const home=await p.evaluate(()=>({route:window.POTE_EXIT.getActiveRoute(),exitShown:document.getElementById('poteExitConfirm')?.hidden===false}));
   console.log('BACK_HOME',width,JSON.stringify(home));assert.equal(home.exitShown,false);
   await p.evaluate(()=>history.back());
   await p.waitForFunction(()=>document.getElementById('poteExitConfirm')?.hidden===false,{timeout:12000});
   console.log('EXIT_ONLY_AT_ROOT',width,'PASS');
   await p.close();
   if(errors.length){console.log('BROWSER_PAGE_ERRORS',width,errors.slice(0,6))}
  }
 }finally{await browser.close()}
 console.log('PASS Android back / recipe draft / ingredient roundtrip');
})().catch(e=>{console.error('ANDROID_BACK_DRAFT_FAILED',e.stack);process.exitCode=1});
