"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
let puppeteer;
for(const name of [process.env.POTE_QA_PUPPETEER,"./qa/mobile/node_modules/puppeteer-core"].filter(Boolean)){
  try { puppeteer=require(name);break; }catch{}
}
if(!puppeteer)throw Error("Puppeteer Core ausente");
const chrome=[process.env.CHROME_BIN,process.env.POTE_QA_CHROME,"/usr/bin/google-chrome","/usr/bin/chromium","C:/Program Files/Google/Chrome/Application/chrome.exe"].find(p=>p&&fs.existsSync(p));
if(!chrome)throw Error("Chrome/Chromium ausente");
const root=path.resolve(__dirname,"public");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  const raw=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  const full=path.resolve(root,"."+raw,(raw.endsWith("/")?"index.html":""));
  if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(full,(error,data)=>{
    if(error){res.writeHead(404).end("not found");return;}
    res.writeHead(200,{"Content-Type":types[path.extname(full)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(data);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
  try{
    for(const width of [320,375,430,834,1366]){
      const page=await browser.newPage();
      await page.setViewport({width,height:width===834?680:800,isMobile:width<600,hasTouch:width<600});
      const errs=[];page.on("pageerror",e=>errs.push(e.message));
      await page.goto("http://127.0.0.1:"+server.address().port+"/cardapio/",{waitUntil:"domcontentloaded"});
      await page.waitForSelector(".product-card",{timeout:10000});
      assert.equal(await page.$$eval(".product-card",nodes=>nodes.length),10);
      assert.deepEqual(await page.$$eval(".category-button",nodes=>nodes.map(n=>n.textContent)),["Todos","Salgados","Doces","Bebidas"]);
      assert.equal(await page.$$eval(".product-card",nodes=>nodes.some(n=>n.textContent.includes("Combo do Sabor"))),false);
      const officialImages=await page.$$eval(".product-media img",nodes=>nodes.filter(n=>n.getAttribute("src").includes("/assets/recipes/")).map(n=>n.getAttribute("src")));
      assert.equal(officialImages.length,10);
      if(width===375){for(const url of officialImages){const response=await page.evaluate(async url=>(await fetch(url)).ok,url);assert(response,"Foto ausente: "+url);}}
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert(overflow<=1,"Rolar horizontalmente em "+width+": "+overflow+"px");
      if(width===375){
        await page.click('.category-button:nth-child(3)');
        assert.equal(await page.$$eval(".product-card",items=>items.length),4);
        await page.type("#searchInput","brigadeiro");
        assert.equal(await page.$$eval(".product-card",items=>items.length),1);
        await page.click(".category-button:first-child");
        await page.$eval("#searchInput",e=>{e.value="";e.dispatchEvent(new Event("input",{bubbles:true}))});
        await page.click('button[aria-label="Escolher Carne com Cheddar"]');
        await page.waitForSelector("#productDialog[open]");
        assert.deepEqual(await page.$$eval("#productIngredients li",nodes=>nodes.map(n=>n.textContent)),["Batata","Carne desfiada","Cheddar"]);
        assert.equal(await page.$eval("#productFacts",e=>e.open),false);
        assert.equal(await page.$eval("#productIngredients",e=>e.getClientRects().length>0),false);
        await page.click("#productFacts summary");
        assert.equal(await page.$eval("#productFacts",e=>e.open),true);
        assert.equal(await page.$eval("#productIngredients",e=>e.getClientRects().length>0),true);
        assert.match(await page.$eval("#productFactFormat",e=>e.textContent),/500 g/);
        assert.match(await page.$eval("#productFacts",e=>e.textContent),/A confirmar com o estabelecimento/);
        await page.click('#addonList input[value="cheddar"]');
        await page.click("#qtyPlus");
        assert.match(await page.$eval("#addPrice",e=>e.textContent),/86,80/);
        await page.click("#addToCart");
        assert.match(await page.$eval("#floatingTotal",e=>e.textContent),/86,80/);
        await page.click("#floatingCart");
        assert.equal(await page.$eval("#cartDialog",e=>e.open),true);
        await page.click('input[name="fulfillment"][value="entrega"]');
        assert.equal(await page.$eval("#addressLabel",e=>e.hidden),false);
        assert.match(await page.$eval(".demo-warning",e=>e.textContent),/Nenhum pagamento será cobrado/);
        await page.click("#closeCart");
        await page.click('button[aria-label="Escolher Sabor Pizza"]');
        await page.waitForSelector("#productDialog[open]");
        assert.equal(await page.$eval("#productFacts",e=>e.open),false);
        assert.equal(await page.$eval("#productIngredients",e=>e.getClientRects().length>0),false);
        await page.click("#productFacts summary");
        assert.equal(await page.$eval("#productFacts",e=>e.open),true);
        assert.equal(await page.$eval("#productIngredients",e=>e.getClientRects().length>0),true);
        const pizzaIngredients=await page.$$eval("#productIngredients li",nodes=>nodes.map(n=>n.textContent));
        assert(pizzaIngredients.includes("Presunto")&&pizzaIngredients.includes("Muçarela")&&pizzaIngredients.includes("Orégano"));
        assert(!pizzaIngredients.includes("Carne desfiada"));
        await page.click("#closeProduct");
      }
      assert.deepEqual(errs,[],"Erros JS na viewport "+width);
      await page.close();
    }
    console.log("PASS: Cardápio responsive (320/375/430/834/1366); busca, adicionais, carrinho, entrega e nenhum checkout real.");
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
