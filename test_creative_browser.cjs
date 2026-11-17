const puppeteer=require('C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const path=require('path'),fs=require('fs'),assert=require('assert').strict;
const root=__dirname;
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-web-security']});
 try{
 const page=await browser.newPage();
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html lang="pt-br"><body style="margin:0;background:#f2f2f2;font-family:Arial"><main id="app"></main></body></html>');
 const photoUrl='data:image/webp;base64,'+fs.readFileSync(path.join(root,'assets','recipes','r01.webp')).toString('base64');
 const logoUrl='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets','pote-logo-original.jpg')).toString('base64');
 await page.evaluate((photoUrl,logoUrl)=>{
  window.mockPhoto=photoUrl;window.mockLogo=logoUrl;
  window.state={data:{ingredients:[{id:'frango',name:'Frango'},{id:'requeijao',name:'Requeijão'},{id:'mussarela',name:'Mussarela'}],recipes:[{id:'a',name:'Frango Cremoso',tagline:'O favorito de quem ama requeijão.',items:[{id:'frango'},{id:'requeijao'},{id:'mussarela'}],price:30,imageUrl:''},{id:'b',name:'Brigadeiro',price:25}],brand:{name:'Potê Batata',phone:'48999951729',accent:'#e1b659',logoUrl:window.mockLogo}},creatives:[],freeCreativeRecipeId:null};
  window.pro=()=>false;window.sellPrice=r=>r.id==='a'?34.9:28.9;window.allowed=()=>true;window.recipe=id=>state.data.recipes.find(x=>x.id===id);
  window.escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  window.num=v=>Number(String(v??'').replace(',','.'));
  window.field=(name,id,value,type='text',extra='')=>'<label class="field">'+name+'<input id="'+id+'" type="'+type+'" value="'+escapeHtml(value??'')+'" '+extra+'></label>';
  window.select=(name,id,opts,value)=>'<label class="field">'+name+'<select id="'+id+'">'+opts.map(([k,v])=>'<option value="'+escapeHtml(k)+'" '+(k===value?'selected':'')+'>'+escapeHtml(v)+'</option>').join('')+'</select></label>';
  window.label=t=>'<small>'+escapeHtml(t)+'</small>';
  window.img=r=>'<img alt="produto" src="'+window.mockPhoto+'">';
  window.imageSource=r=>window.mockPhoto;
  window.pageCreative=()=>"";window.creativeHTML=()=>"";window.generateCreative=()=>{};window.downloadCreative=()=>{};window.toast=msg=>{window.lastToast=msg};window.render=()=>{document.getElementById('app').innerHTML=pageCreative()};
  window.POTE_ACCESS={requireService:()=>true};
  window.savedArt=[];
  window.POTE_GALLERY={saveImageBlob:async blob=>{const bitmap=await createImageBitmap(blob);const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});window.lastPngBase64=data;window.savedArt.push([bitmap.width,bitmap.height,blob.size]);bitmap.close();return true}};
 },photoUrl,logoUrl);
 await page.addStyleTag({content:'.box{padding:16px;margin:12px;border-radius:16px}.field{display:flex;flex-direction:column;gap:5px;font-size:13px}.field input,.field select{padding:10px}.actions{display:flex;gap:8px}.btn{padding:10px;border:1px solid #888;border-radius:8px}'});
 await page.addStyleTag({path:path.join(root,'creative_studio.css')});
 await page.addScriptTag({path:path.join(root,'creative_studio.js')});
 await page.evaluate(()=>render());
 assert.equal(await page.$eval('#creativeOld',e=>e.value),'34,90','official price must be filled');
 assert.equal(await page.$eval('#creativeSale',e=>e.value),'34,90','price cannot be fabricated as a discount');
 assert((await page.$eval('#creativeBody',e=>e.value)).toLowerCase().includes('requeijão'),'copy must use recipe ingredient data');
 const labels=await page.$$('#csCampaign option'); assert.equal(labels.length,6);
 const ratio=[['9:16',1080,1920],['1:1',1080,1080],['4:5',1080,1350],['16:9',1920,1080]];
 for(const [i,w,h] of ratio){
  await page.select('#creativeRatio',i);
  await page.click('.creative-studio .actions button:first-child');
  await page.waitForFunction('window.savedArt.length > 0');
  const dims=await page.evaluate(()=>window.savedArt.pop());
  const png=await page.evaluate(()=>window.lastPngBase64);
  fs.writeFileSync(path.join(root,'test_export_'+i.replace(':','x')+'.png'),Buffer.from(png,'base64'));
  assert.deepEqual(dims.slice(0,2),[w,h],'PNG '+i);
  const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth,poster:document.querySelector('.cs-poster').getBoundingClientRect().toJSON()}));
  assert(layout.scroll<=layout.view+2,'horizontal overflow '+i+': '+JSON.stringify(layout));
  await page.$('.cs-poster').then(el=>el.screenshot({path:path.join(root,'test_creative_poster_'+i.replace(':','x')+'.png')}));
  await page.screenshot({path:path.join(root,'test_creative_'+i.replace(':','x')+'.png'),fullPage:false});
  console.log('PASS browser PNG '+i+' '+w+'x'+h+' ('+dims[2]+' bytes) and mobile layout');
 }
 await page.select('#csCampaign','lancamento');
 await page.click('.creative-studio .actions button:nth-child(2)');
 assert.equal(await page.$eval('#creativeHeadline',el=>el.value),'ACABOU DE CHEGAR');
 await page.select('#csStyle','fresh');
 await page.click('.creative-studio .actions button:first-child');
 let campaign=await page.evaluate(()=>state.creatives[0]);
 assert(campaign.style==='fresh'&&campaign.showOld===false);
 await page.evaluate(()=>creativeDiscount(10));
 assert.equal(await page.$eval('#creativeSale',el=>el.value),'31,41');
 await page.click('.creative-studio .actions button:first-child');
 campaign=await page.evaluate(()=>state.creatives[0]);
 assert(campaign.showOld===true&&campaign.old===34.9&&campaign.sale===31.41);
 await page.evaluate(()=>{window.pro=()=>true});
 await page.select('#creativeRecipe','b');
 assert.equal(await page.$eval('#creativeOld',el=>el.value),'28,90');
 assert.equal(await page.$eval('#creativeSale',el=>el.value),'28,90');
  assert.equal(errors.length,0,'page errors: '+errors.join(', '));
 console.log('PASS campaign suggestion, style and visibility toggles; no JS page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL',e);process.exit(1)});

