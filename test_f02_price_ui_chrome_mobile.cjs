const assert=require("node:assert/strict");
const fs=require("node:fs");
const puppeteer=require(process.env.POTE_QA_PUPPETEER||
 "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const html=fs.readFileSync("source/pote_app_base.html","utf8");
const fn=html.match(/async function approveRecipeServerPrice\(id\)\{[\s\S]*?\n\}/);
assert(fn,"Price approval function missing from recipe page");
assert(html.includes('id="poteApproveServerPrice"'),"Price button missing");
assert(html.includes("window.POTE_WORKER?.enabled===true?"),"Worker gate missing from HTML");
(async()=>{
 const browser=await puppeteer.launch({headless:true,
  executablePath:process.env.POTE_QA_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--no-sandbox"]});
 try{
 for(const width of [375,430]){
  const page=await browser.newPage();
  await page.setViewport({width,height:812,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><button id="poteApproveServerPrice" type="button">Homologar preço no servidor</button></body></html>');
  await page.evaluate(code=>{
   window.__qa={calls:[],rendered:0,toast:[],confirm:true};
   window.POTE_WORKER={enabled:false,approvePrice:async(...args)=>{
    window.__qa.calls.push(args);
    return {revision:2,recipeId:args[0],salePriceCents:args[2]};
   }};
   window.POTE_AUTH={proActive:true};
   window.state={data:{businessType:"batataria"}};
   window.pro=()=>true;
   window.recipe=id=>({id,name:"Batata QA",unavailable:false});
   window.allowed=()=>true;
   window.sellPrice=()=>29.9;
   window.money=n=>"R$ "+n.toFixed(2);
   window.toast=msg=>window.__qa.toast.push(String(msg));
   window.render=()=>{window.__qa.rendered++};
   window.confirm=()=>window.__qa.confirm;
   (0,eval)(code);
   document.querySelector("#poteApproveServerPrice").onclick=()=>approveRecipeServerPrice("recipe-qa");
  },fn[0]);
  assert.equal(await page.evaluate(()=>approveRecipeServerPrice("recipe-qa")),false);
  assert.equal(await page.evaluate(()=>window.__qa.calls.length),0);
  await page.evaluate(()=>window.POTE_WORKER.enabled=true);
  await page.click("#poteApproveServerPrice");
  await page.waitForFunction(()=>window.__qa.rendered===1);
  const success=await page.evaluate(()=>({
   calls:window.__qa.calls,rendered:window.__qa.rendered,
   disabled:document.querySelector("#poteApproveServerPrice").disabled
  }));
  assert.deepEqual(success.calls[0],["recipe-qa","batataria",2990]);
  assert.equal(success.disabled,false);
  await page.evaluate(()=>window.POTE_AUTH.proActive=false);
  await page.click("#poteApproveServerPrice");
  assert.equal(await page.evaluate(()=>window.__qa.calls.length),1);
  await page.evaluate(()=>{
   window.POTE_AUTH.proActive=true;
   window.POTE_WORKER.approvePrice=async()=>{throw Error("423")};
  });
  await page.click("#poteApproveServerPrice");
  await page.waitForFunction(()=>window.__qa.toast.some(x=>x.includes("423")));
  assert.equal(await page.evaluate(()=>window.__qa.rendered),1);
  assert.equal(await page.evaluate(()=>document.querySelector("#poteApproveServerPrice").disabled),false);
  await page.evaluate(()=>window.__qa.confirm=false);
  await page.click("#poteApproveServerPrice");
  assert.equal(await page.evaluate(()=>window.__qa.rendered),1);
  console.log("PASS F02 CHROME MOBILE",width,"Worker gate, approval 2990, PRO, 423 fail-closed, cancel");
  await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
