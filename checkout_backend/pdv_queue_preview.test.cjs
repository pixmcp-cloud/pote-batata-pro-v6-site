const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const puppeteer=require("../qa/mobile/node_modules/puppeteer-core");
const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>p&&fs.existsSync(p));if(!chrome)throw Error("Chrome ausente");
const root=__dirname;const server=http.createServer((req,res)=>{const name=new URL(req.url,"http://localhost").pathname.slice(1);if(!/^[a-z_]+\.(html|mjs)$/.test(name)){res.writeHead(404).end();return}fs.readFile(path.join(root,name),(e,data)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{"Content-Type":name.endsWith(".html")?"text/html; charset=utf-8":"text/javascript; charset=utf-8"}).end(data)})});
(async()=>{await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;try{
 browser=await puppeteer.launch({headless:true,executablePath:chrome,args:["--no-sandbox","--disable-dev-shm-usage"]});
 for(const width of [320,375,834,1366]){
  const page=await browser.newPage(),errors=[],external=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))external.push(r.url())});
  await page.setViewport({width,height:800,isMobile:width<600,hasTouch:width<600});await page.goto("http://127.0.0.1:"+server.address().port+"/pdv_queue_preview.html");await page.waitForSelector('[data-action="prepare"]');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const tap=async action=>{await page.click('[data-action="'+action+'"]')};
  await tap("prepare");await page.waitForSelector('[data-action="ready"]');await tap("ready");await page.waitForSelector('[data-action="dispatch"]');await tap("dispatch");await page.waitForSelector('[data-action="deliver"]');await tap("deliver");
  await page.waitForFunction(()=>document.querySelector("#queue").textContent.includes("Entregue"));assert.match(await page.$eval("#queue",e=>e.textContent),/Pagamento pendente/);
  await page.click("#close-shift");await page.type('input[aria-label="Referência do recebimento"]',"PIX de teste");await tap("confirm_payment");await page.waitForFunction(()=>document.querySelector("#feedback").textContent.includes("Abra um turno"));
  await page.click("#new-shift");await tap("confirm_payment");await page.waitForFunction(()=>document.querySelector("#queue").textContent.includes("Recebido"));
  assert.match(await page.$eval("#cash",e=>e.textContent),/43,50/);await page.click("#close-shift");
  const btn=await page.$$("article button");assert.equal(btn.length,1);await btn[0].click();await page.waitForSelector("#receipt:not([hidden])");
  assert.match(await page.$eval("#receipt-text",e=>e.textContent),/Tempo total: \d\d:\d\d:\d\d/);assert.match(await page.$eval("#receipt-text",e=>e.textContent),/Confirmado pelo lojista/);
  await page.emulateMediaType("print");assert.equal(await page.$eval("header",e=>getComputedStyle(e).display),"none");assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await page.close();
 }
 console.log("PASS B02.4 navegador: 4 larguras, fila, recebimento, turno fechado e comprovante; sem requisições externas.");
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
