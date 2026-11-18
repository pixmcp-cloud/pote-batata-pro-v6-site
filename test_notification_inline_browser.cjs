const fs=require("node:fs"),assert=require("node:assert/strict");
const path=require("node:path");
let puppeteer;
for(const name of ["puppeteer",process.env.POTE_QA_PUPPETEER,"C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)){
 try{puppeteer=require(name);break}catch{}
}
if(!puppeteer)throw Error("Puppeteer required for browser QA");
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--no-sandbox"]});
 try{
  for(const width of [375,430,1280]){
   const page=await browser.newPage();
   const pageErrors=[];page.on("pageerror",error=>pageErrors.push(error.message));
   await page.setViewport({width,height:820,isMobile:width<600,hasTouch:width<600,deviceScaleFactor:1});
   await page.setContent('<!DOCTYPE html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#060e19;color:white"><nav id="poteTopActions" style="height:72px;display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:10px 22px;background:#0a1524"><button id="poteFloatToggle" type="button">Menu</button></nav><main style="padding:30px"><h1>PDV Potê Batata</h1></main></body></html>');
   await page.addStyleTag({path:path.join(__dirname,"notifications.css")});
   await page.evaluate(()=>{
    window.POTE_AUTH={uid:"qa-browser",role:"free"};
    window.state={data:{notificationCenter:{read:{}},deliveryHub:{orders:[]}}};
    window.getApp=()=>({});
    window.getAuth=()=>({currentUser:{uid:"qa-browser"}});
    window.getFirestore=()=>({});
    window.collection=()=>({});
    window.query=()=>({});
    window.orderBy=()=>({});
    window.limit=()=>({});
    window.onSnapshot=(_query,callback)=>{window.__injectNotification=callback;return ()=>{}};
    window.persist=()=>window.dispatchEvent(new Event("pote:changed"));
   });
   const core=fs.readFileSync(path.join(__dirname,"notification_core.mjs"),"utf8").replace(/^export /gm,"");
   const view=fs.readFileSync(path.join(__dirname,"notifications.js"),"utf8").replace(/^import .*;\s*$/gm,"");
   await page.addScriptTag({content:core+"\n"+view});
   await page.evaluate(()=>{
    window.__injectNotification({docs:[{id:"test-msg",data:()=>({
      active:true,title:"Teste",body:"essa é uma mensagem de teste\n\nSegundo parágrafo preservado.",
      url:"https://pdv.livresom.com/login",type:"info",createdAt:{seconds:1794959880}
    })}]});
    window.POTE_NOTIFY.open();
   });
   const before=page.url();
   await page.click('button[data-notice-detail="broadcast:test-msg"]');
   const opened=await page.evaluate(()=>{
    const d=document.getElementById("poteNoticeDetail"),drawer=document.getElementById("poteNoticeDrawer"),r=drawer.getBoundingClientRect();
    return {detail:d.hidden===false,text:d.textContent,location:location.href,
      listHidden:document.getElementById("poteNoticeList").hidden,
      containsLink:!!d.querySelector('a[target="_blank"]'),
      bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};
   });
   console.log("MESSAGE_OPENED",width,JSON.stringify(opened));
   assert.equal(opened.location,before,"Opening message must not navigate to login");
   assert.match(opened.text,/essa é uma mensagem de teste/);
   assert.match(opened.text,/Segundo parágrafo preservado/);
   assert(opened.listHidden);
   assert(opened.containsLink,"Optional URL must be clearly separate");
   assert(opened.scrollWidth<=width+2,"Mobile horizontal overflow");
   assert(opened.bounds.left>=-1&&opened.bounds.right<=width+1,"Notification drawer must stay on screen");
   if(width===375)await page.screenshot({path:path.join(__dirname,"_qa_notification_detail_mobile.png")});
   await page.click("#poteNoticeBack");
   const restored=await page.evaluate(()=>({detailHidden:document.getElementById("poteNoticeDetail").hidden,listHidden:document.getElementById("poteNoticeList").hidden,url:location.href,unread:window.POTE_NOTIFY.unread}));
   assert(restored.detailHidden&&!restored.listHidden&&restored.url===before&&restored.unread===0);
   await page.click('button[data-notice-detail="broadcast:test-msg"]');
   await page.keyboard.press("Escape");
   const escape=await page.$eval("#poteNoticeDetail",element=>element.hidden);
   assert(escape,"Esc should return to notification list");
   assert.deepEqual(pageErrors,[],"Unexpected browser script errors");
   console.log("PASS_IN_BROWSER",width,"no-login-redirect, detail and back preserved");
   await page.close();
  }
 }finally{await browser.close()}
})().catch(error=>{console.error("INLINE_MESSAGE_BROWSER_QA_FAILED",error.stack);process.exitCode=1});
