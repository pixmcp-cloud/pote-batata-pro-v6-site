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
// Exercise a genuine pointer click, with the target centered clear of fixed bars.
async function tapProduct(page,selector){
  await page.waitForSelector(selector,{visible:true});
  await page.$eval(selector,e=>e.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}));
  await page.waitForFunction(selector=>{
    const e=document.querySelector(selector);if(!e)return false;
    const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return hit&&(hit===e||e.contains(hit));
  },{timeout:5000},selector);
  await page.click(selector);
  await page.waitForSelector("#productDialog[open]",{timeout:5000});
}
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
      assert.equal(await page.$$eval(".product-card",nodes=>nodes.length),11);
      await page.click("#settingsBtn");assert.equal(await page.$eval("#settingsDialog",e=>e.open),true);const manage=await page.$eval('[data-merchant-action="products"]',e=>new URL(e.href).searchParams.get("opcao"));assert.equal(manage,"products");await page.click("#closeSettings");assert.equal(await page.$eval("#settingsDialog",e=>e.open),false);
      assert(await page.$eval("#settingsBtn",e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
      assert.deepEqual(await page.$$eval(".category-button",nodes=>nodes.map(n=>n.textContent)),["Todos","Salgados","Doces","Bebidas"]);
      assert.equal(await page.$$eval(".product-card",nodes=>nodes.some(n=>n.textContent.includes("Combo do Sabor"))),false);
      const officialImages=await page.$$eval(".product-media img",nodes=>nodes.filter(n=>n.getAttribute("src").includes("/assets/recipes/")).map(n=>n.getAttribute("src")));
      assert.equal(officialImages.length,11);
      if(width===375){for(const url of officialImages){const response=await page.evaluate(async url=>(await fetch(url)).ok,url);assert(response,"Foto ausente: "+url);}}
      const hero=await page.$eval("#menuHero",e=>{const r=e.getBoundingClientRect();return {ratio:r.width/r.height,slides:[...e.querySelectorAll(".menu-hero-slide")].map(s=>s.dataset.kind),active:e.querySelector(".is-active").dataset.kind}});
      assert(Math.abs(hero.ratio-16/9)<.03,"capa 16:9");
      assert.equal(hero.slides.length,16);
      assert(hero.slides.every((s,i)=>s===(i%2===0?"title":"food")));
      assert.equal(hero.active,"title");
      await page.waitForFunction(()=>{const i=document.querySelector(".menu-hero-title.is-active img");return i&&i.complete&&i.naturalWidth===512&&i.naturalHeight===288;});
      assert.match(await page.$eval(".menu-hero-title img",e=>e.getAttribute("src")),/cardapio-dourado\.webp/);
      if(width===375){
        await page.click("#heroPause");
        await page.click("#heroNext");
        assert.equal(await page.$eval("#menuHero .is-active",e=>e.dataset.kind),"food");
        assert.equal(await page.$eval("#menuHero",e=>e.classList.contains("is-food")),true);
        await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector(".menu-hero-steam")).opacity)>.9);
        const visual=await page.$eval(".menu-hero-food.is-active .menu-hero-product",e=>({fit:getComputedStyle(e).objectFit,pos:getComputedStyle(e).objectPosition}));
        assert.equal(visual.fit,"cover");assert.equal(visual.pos,"50% 9%");
        await page.waitForFunction(()=>[...document.querySelectorAll(".menu-hero-steam i")].some(e=>Number(getComputedStyle(e).opacity)>.35&&getComputedStyle(e).animationPlayState==="running"));
        const motion=await page.evaluate(async()=>{const e=document.querySelector(".menu-hero-steam i");const first=getComputedStyle(e).transform;await new Promise(r=>setTimeout(r,220));return first!==getComputedStyle(e).transform;});
        assert(motion,"vapor precisa se mover mesmo com carrossel pausado");
        assert(await page.evaluate(async()=>{const r=await fetch("./vapor.svg?v=3");return r.ok&&r.headers.get("content-type").includes("svg");}));

        await page.click("#heroNext");
        assert.equal(await page.$eval("#menuHero .is-active",e=>e.dataset.kind),"title");
        await page.click("#heroPrev");
        assert.equal(await page.$eval("#menuHero .is-active",e=>e.dataset.kind),"food");
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert(overflow<=1,"Rolar horizontalmente em "+width+": "+overflow+"px");
      if(width===375){
        await page.click('.category-button:nth-child(3)');
        assert.equal(await page.$$eval(".product-card",items=>items.length),4);
        await page.type("#searchInput","brigadeiro");
        assert.equal(await page.$$eval(".product-card",items=>items.length),1);
        await page.click(".category-button:first-child");
        await page.$eval("#searchInput",e=>{e.value="";e.dispatchEvent(new Event("input",{bubbles:true}))});
        await tapProduct(page,'button[aria-label="Escolher Carne com Cheddar"]');
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
        assert.equal(await page.$eval("#productDialog",e=>e.open),true);
        await page.click("#confirmProduct");
        assert.match(await page.$eval("#floatingTotal",e=>e.textContent),/86,80/);
        await page.click("#floatingCart");
        assert.equal(await page.$eval("#cartDialog",e=>e.open),true);
        await page.click('input[name="fulfillment"][value="entrega"]');
        assert.equal(await page.$eval("#addressLabel",e=>e.hidden),false);
        assert.match(await page.$eval(".demo-warning",e=>e.textContent),/Nenhum pagamento será cobrado/);
        await page.click("#closeCart");
        await page.waitForSelector("#cartDialog[open]",{hidden:true});
        await tapProduct(page,'button[aria-label="Escolher Sabor Pizza"]');
        assert.equal(await page.$eval("#productFacts",e=>e.open),false);
        assert.equal(await page.$eval("#productIngredients",e=>e.getClientRects().length>0),false);
        await page.click("#productFacts summary");
        assert.equal(await page.$eval("#productFacts",e=>e.open),true);
        assert.equal(await page.$eval("#productIngredients",e=>e.getClientRects().length>0),true);
        const pizzaIngredients=await page.$$eval("#productIngredients li",nodes=>nodes.map(n=>n.textContent));
        assert(pizzaIngredients.includes("Presunto")&&pizzaIngredients.includes("Muçarela")&&pizzaIngredients.includes("Orégano"));
        assert(!pizzaIngredients.includes("Carne desfiada"));
        await page.click("#closeProduct");
        await page.waitForSelector("#productDialog[open]",{hidden:true});
        await tapProduct(page,'button[aria-label="Escolher Refrigerante Lata"]');
        assert.equal(await page.$eval("#productIngredientHeading",e=>e.textContent),"Sabores");
        assert.match(await page.$eval("#productNote",e=>e.placeholder),/gelado/);
        assert.match(await page.$eval("#productFactFormat",e=>e.textContent),/350 ml/);
        await page.click("#addToCart");
        assert.equal(await page.$eval("#productDialog",e=>e.open),true);
        assert.equal(await page.$eval("#productFacts",e=>e.open),true);
        assert.deepEqual(await page.$$eval('input[name="drinkFlavor"]',nodes=>nodes.map(n=>n.value)),["Cola","Guaraná","Laranja","Soda"]);
        await page.click('input[name="drinkFlavor"][value="Guaraná"]');
        assert.equal(await page.$eval('input[name="drinkType"][value="Normal"]',e=>e.checked),true);
        assert.equal(await page.$eval('input[name="drinkType"][value="Zero"]',e=>e.disabled),true);
        assert.deepEqual(await page.$$eval("#drinkTemperature option",nodes=>nodes.map(n=>n.value)),["Gelado","Fora do gelo"]);
        assert.equal(await page.$eval("#drinkTemperature",e=>e.value),"Gelado");
        await page.select("#drinkTemperature","Fora do gelo");
        await page.click("#addToCart");
        await page.click("#confirmProduct");
        await page.click("#floatingCart");
        assert.match(await page.$eval("#cartItems",e=>e.textContent),/Sabor: Guaraná.*Versão: Normal.*Temperatura: Fora do gelo/);
        await page.click("#closeCart");
        await page.waitForSelector("#cartDialog[open]",{hidden:true});
        await tapProduct(page,'button[aria-label="Escolher Refrigerante 600 ml"]');
        assert.match(await page.$eval("#productFactFormat",e=>e.textContent),/600 ml/);
        assert.equal(await page.$eval("#addonFieldset",e=>e.hidden),true);
        await page.click('input[name="drinkFlavor"][value="Cola"]');
        assert.match(await page.$eval("#addPrice",e=>e.textContent),/9,00/);
        await page.click('label.drink-option:has(input[name="drinkType"][value="Zero"])');
        assert.match(await page.$eval("#addPrice",e=>e.textContent),/10,00/);
        await page.click('input[name="drinkFlavor"][value="Soda"]');
        assert.equal(await page.$eval('input[name="drinkType"][value="Zero"]',e=>e.disabled),true);
        await page.click('input[name="drinkFlavor"][value="Cola"]');
        await page.click('label.drink-option:has(input[name="drinkType"][value="Zero"])');
        await page.click("#confirmProduct");
        await page.click("#floatingCart");
        assert.match(await page.$eval("#cartItems",e=>e.textContent),/Refrigerante Cola Zero Açúcar.*Sabor: Cola.*Versão: Zero.*Temperatura: Gelado.*10,00/s);
        await page.click("#closeCart");
        await page.waitForSelector("#cartDialog[open]",{hidden:true});
        await tapProduct(page,'button[aria-label="Escolher Água Mineral"]');
        assert.match(await page.$eval("#addPrice",e=>e.textContent),/4,00/);
        await page.click('label:has(input[name="waterType"][value="Com gás"])');
        assert.match(await page.$eval("#addPrice",e=>e.textContent),/5,00/);
        await page.click("#qtyPlus");assert.match(await page.$eval("#addPrice",e=>e.textContent),/10,00/);
        const before=await page.$eval("#floatingTotal",e=>e.textContent);
        await page.click("#addToCart");await page.click("#closeProduct");
        await page.waitForSelector("#productDialog[open]",{hidden:true});
        assert.equal(await page.$eval("#floatingTotal",e=>e.textContent),before,"X cancela sem modificar a sacola");
        await tapProduct(page,'button[aria-label="Escolher Água Mineral"]');
        await page.click('label:has(input[name="waterType"][value="Com gás"])');
        await page.click("#qtyPlus");await page.click("#confirmProduct");
        await page.waitForSelector("#productDialog[open]",{hidden:true});
        await page.click("#floatingCart");assert.match(await page.$eval("#cartItems",e=>e.textContent),/2x Água Mineral com gás.*10,00/s);
        const removeSel='button[aria-label="Remover Água Mineral com gás"]';
        const remove=await page.$(removeSel);assert(remove);await remove.evaluate(e=>e.scrollIntoView({block:"center"}));
        assert(await remove.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),"Remover deve estar visível e clicável");
        await page.click(removeSel);assert.equal(await page.$(removeSel),null);assert.match(await page.$eval("#total",e=>e.textContent),/103,80/);
        await page.click("#closeCart");
      }
      assert.deepEqual(errs,[],"Erros JS na viewport "+width);
      await page.close();
    }
    // Public menu test is isolated: Firebase SDK and menu document are fixtures;
    // window.open is captured instead of contacting WhatsApp.
    for(const enabled of [true,false]){
      const page=await browser.newPage(),errors=[];
      page.on("pageerror",e=>errors.push(e.message));
      await page.setViewport({width:375,height:800,isMobile:true,hasTouch:true});
      await page.evaluateOnNewDocument(()=>{window.__orderLink=null;window.open=url=>{window.__orderLink=String(url);return null;};});
      const slug=enabled?"qa-comercial":"qa-consulta";
      const data={schemaVersion:1,slug,published:true,title:"Loja QA",subtitle:"Teste isolado",items:[{id:"qa-recipe",title:"Receita QA",description:"Teste",category:"Salgados",priceCents:1250,image:"",addons:[]}],...(enabled?{whatsapp:"5548999951729"}:{})};
      await page.setRequestInterception(true);
      page.on("request",req=>{
        const url=new URL(req.url());
        if(url.pathname.endsWith("/firebase_app.mjs"))return req.respond({status:200,contentType:"text/javascript",body:"export const app={};"});
        if(url.hostname==="www.gstatic.com"&&url.pathname.endsWith("/firebase-firestore.js"))return req.respond({status:200,headers:{"Access-Control-Allow-Origin":"*"},contentType:"text/javascript",body:"export const getFirestore=()=>({});export const doc=(...a)=>a;export const getDoc=async()=>({exists:()=>true,data:()=>("+JSON.stringify(data)+")});"});
        if(url.hostname!=="127.0.0.1")return req.abort();
        return req.continue();
      });
      await page.goto("http://127.0.0.1:"+server.address().port+"/cardapio/?loja="+slug,{waitUntil:"domcontentloaded"});
      await tapProduct(page,'button[aria-label="Escolher Receita QA"]');
      await page.click("#confirmProduct");
      await page.waitForSelector("#productDialog[open]",{hidden:true});
      await page.click("#floatingCart");
      assert.equal(await page.$eval("#copyOrder",e=>e.disabled),!enabled);
      if(enabled){
        await page.type("#customerName","Cliente QA");
        await page.$eval("#copyOrder",e=>e.scrollIntoView({block:"center"}));
        await page.click("#copyOrder");
        const link=new URL(await page.evaluate(()=>window.__orderLink));
        assert.equal(link.hostname,"wa.me");assert.equal(link.pathname,"/5548999951729");
        assert.match(link.searchParams.get("text"),/Receita QA/);
        assert.match(link.searchParams.get("text"),/12,50/);
        assert.match(link.searchParams.get("text"),/Aguardo confirmação/);
      }else assert.equal(await page.evaluate(()=>window.__orderLink),null);
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log("PASS: cardápio público com/sem WhatsApp, fluxo de solicitação no Chrome; nenhum envio externo.");
    console.log("PASS: Cardápio responsive (320/375/430/834/1366); busca, adicionais, carrinho, entrega e nenhum checkout real.");
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
