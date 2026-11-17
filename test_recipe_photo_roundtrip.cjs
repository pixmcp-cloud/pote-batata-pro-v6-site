const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
let puppeteer;
for (const path of ["puppeteer", process.env.POTE_QA_PUPPETEER, "C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer"].filter(Boolean)) {
  try {puppeteer=require(path);break;} catch {}
}
if(!puppeteer)throw Error("Puppeteer is required for local Android browser QA");

(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--no-sandbox","--allow-file-access-from-files","--disable-web-security"]});
 try{
  for(const width of [375,1280]){
   const page=await browser.newPage();
   await page.setRequestInterception(true);
   page.on("request",req=>req.url().includes("/firebase_integration.js")?req.respond({status:200,contentType:"text/javascript",body:""}):req.continue());
   await page.setViewport({width,height:840,isMobile:width<600,hasTouch:width<600});
   await page.goto(pathToFileURL(path.join(__dirname,"public","index.html")).href,{waitUntil:"domcontentloaded",timeout:25000});
   await page.waitForFunction(()=>!!window.POTE_EXIT&&!!window.POTE_RECIPE_PHOTO&&!!window.POTE_ROUTE_BRIDGE,{timeout:15000});
   await page.evaluate(()=>{
    window.POTE_AUTH={uid:"qa-photo-"+innerWidth,role:"admin",proActive:true};
    window.dispatchEvent(new Event("pote:user-ready"));
    startNewRecipe();
    document.getElementById("builderName").value="Batata recheada foto testada";
    document.getElementById("builderTagline").value="Descrição que deve sobreviver ao cadastro de ingrediente";
    document.getElementById("builderSteps").value="Cozinhar\nRechear\nFotografar";
    document.getElementById("builderName").dispatchEvent(new Event("input",{bubbles:true}));
   });
   const input=await page.$("#builderImageFile");
   assert(input,"Image upload input in new recipe");
   await input.uploadFile(path.join(__dirname,"_qa_photos","original.jpg"));
   await page.waitForFunction(()=>document.getElementById("builderPhotoData")?.value?.startsWith("data:image/"),{timeout:10000});
   const photoOne=await page.evaluate(async()=>{
    const src=document.getElementById("builderPhotoData").value;const img=new Image();img.src=src;await img.decode();
    return {length:src.length,type:src.slice(0,30),width:img.naturalWidth,height:img.naturalHeight,preview:document.getElementById("builderImagePreview").src===src};
   });
   console.log("NEW_RECIPE_IMAGE",width,JSON.stringify(photoOne));
   assert(photoOne.length<110000);assert.equal(photoOne.width,photoOne.height);assert(photoOne.preview);
   await page.evaluate(()=>{
    openBuilderIngredient();
    const update=(id,v)=>{document.getElementById(id).value=v;document.getElementById(id).dispatchEvent(new Event("input",{bubbles:true}))};
    update("newIngName","Insumo foto QA");
    update("newIngPrice","12");
    update("newIngQuantity","1");
    update("newIngYield","100");
    addIngredient();
   });
   await page.waitForFunction(()=>window.POTE_ROUTE_BRIDGE.current().tab==="builder",{timeout:12000});
   const restored=await page.evaluate(()=>({
    photo:document.getElementById("builderPhotoData").value,
    name:document.getElementById("builderName").value,
    tagline:document.getElementById("builderTagline").value,
    selected:document.getElementById("builderIng").selectedOptions[0].textContent,
    steps:document.getElementById("builderSteps").value
   }));
   assert.equal(restored.photo.length,photoOne.length);
   assert.equal(restored.name,"Batata recheada foto testada");
   assert.equal(restored.tagline,"Descrição que deve sobreviver ao cadastro de ingrediente");
   assert.match(restored.selected,/Insumo foto QA/);
   assert.equal(restored.steps,"Cozinhar\nRechear\nFotografar");
   const saved=await page.evaluate(()=>{
    document.getElementById("builderQty").value="120";
    appendBuilderIng();
    saveBuilder();
    const rec=state.data.recipes.find(x=>x.name==="Batata recheada foto testada");
    return {id:rec?.id,url:rec?.imageUrl,tab:state.tab,steps:rec?.steps,items:rec?.items};
   });
   assert(saved.id,"New recipe saved");
   assert.equal(saved.url,restored.photo);
   assert.equal(saved.tab,"recipes");
   console.log("NEW_RECIPE_SAVED",width,saved.id,"photoBytes",Math.round(saved.url.length*3/4),"items",saved.items.length);
   await page.evaluate(id=>editRecipe(id),saved.id);
   const beforeEdit=await page.evaluate(()=>({file:!!document.getElementById("builderImageFile"),photo:document.getElementById("builderPhotoData").value}));
   assert(beforeEdit.file,"Edit recipe has photo picker");
   assert.equal(beforeEdit.photo,saved.url);
   const input2=await page.$("#builderImageFile");
   await input2.uploadFile(path.join(__dirname,"_qa_photos","replacement.jpg"));
   await page.waitForFunction(old=>document.getElementById("builderPhotoData")?.value?.startsWith("data:image/")&&document.getElementById("builderPhotoData").value!==old,{timeout:11000},saved.url);
   const changed=await page.evaluate(()=>{
    const src=document.getElementById("builderPhotoData").value;
    const temp=new Image();temp.src=src;
    return {src,preview:document.getElementById("builderImagePreview").src===src};
   });
   assert(changed.preview);
   await page.evaluate(()=>saveBuilder());
   const final=await page.evaluate(id=>{
    const r=state.data.recipes.find(x=>x.id===id);
    return {url:r?.imageUrl,name:r?.name,items:r?.items,tab:state.tab,screenWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   },saved.id);
   assert(final.url.startsWith("data:image/"));
   assert.notEqual(final.url,saved.url);
   assert.equal(final.name,saved.name||"Batata recheada foto testada");
   assert(final.items.length>=1);
   assert(final.screenWidth<=final.viewport+2);
   console.log("EDIT_RECIPE_IMAGE_UPDATED",width,"bytes",Math.round(final.url.length*3/4),"scroll",final.screenWidth);
   await page.close();
  }
 }finally{await browser.close()}
 console.log("PASS new and edited recipe 1:1 photo / ingredient roundtrip / persistent records");
})().catch(e=>{console.error("RECIPE_PHOTO_QA_FAILED",e.stack);process.exitCode=1});
