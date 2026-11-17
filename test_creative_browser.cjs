const puppeteer=require('C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const path=require('path'),assert=require('assert').strict;
const root=__dirname;
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-web-security']});
 try{
 const page=await browser.newPage();
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html lang="pt-br"><body style="margin:0;background:#f2f2f2;font-family:Arial"><main id="app"></main></body></html>');
 await page.evaluate(()=>{
  window.state={data:{recipes:[{id:'a',name:'Frango com cheddar',price:30,imageUrl:''},{id:'b',name:'Brigadeiro',price:25}],brand:{name:'Potê Batata',phone:'48999951729',accent:'#e1b659'}},creatives:[],freeCreativeRecipeId:null};
  window.pro=()=>false;window.allowed=()=>true;window.recipe=id=>state.data.recipes.find(x=>x.id===id);
  window.escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  window.num=v=>Number(String(v??'').replace(',','.'));
  window.field=(name,id,value,type='text',extra='')=>'<label class="field">'+name+'<input id="'+id+'" type="'+type+'" value="'+escapeHtml(value??'')+'" '+extra+'></label>';
  window.select=(name,id,opts,value)=>'<label class="field">'+name+'<select id="'+id+'">'+opts.map(([k,v])=>'<option value="'+escapeHtml(k)+'" '+(k===value?'selected':'')+'>'+escapeHtml(v)+'</option>').join('')+'</select></label>';
  window.label=t=>'<small>'+escapeHtml(t)+'</small>';
  window.img=r=>'<img alt="produto" src="data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#b48148"/><circle cx="300" cy="280" r="190" fill="#f5db9f"/></svg>')+'">';
  window.imageSource=r=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#b48148"/><circle cx="300" cy="280" r="190" fill="#f5db9f"/></svg>');
  window.pageCreative=()=>"";window.creativeHTML=()=>"";window.generateCreative=()=>{};window.downloadCreative=()=>{};window.toast=msg=>{window.lastToast=msg};window.render=()=>{document.getElementById('app').innerHTML=pageCreative()};
  window.POTE_ACCESS={requireService:()=>true};
  window.savedArt=[];
  window.POTE_GALLERY={saveImageBlob:async blob=>{const bitmap=await createImageBitmap(blob);window.savedArt.push([bitmap.width,bitmap.height,blob.size]);bitmap.close();return true}};
 });
 await page.addStyleTag({content:'.box{padding:16px;margin:12px;border-radius:16px}.field{display:flex;flex-direction:column;gap:5px;font-size:13px}.field input,.field select{padding:10px}.actions{display:flex;gap:8px}.btn{padding:10px;border:1px solid #888;border-radius:8px}'});
 await page.addStyleTag({path:path.join(root,'creative_studio.css')});
 await page.addScriptTag({path:path.join(root,'creative_studio.js')});
 await page.evaluate(()=>render());
 const labels=await page.$$('#csCampaign option'); assert.equal(labels.length,6);
 const ratio=[['9:16',1080,1920],['1:1',1080,1080],['4:5',1080,1350],['16:9',1920,1080]];
 for(const [i,w,h] of ratio){
  await page.select('#creativeRatio',i);
  await page.click('.creative-studio .actions button:first-child');
  await page.waitForFunction('window.savedArt.length > 0');
  const dims=await page.evaluate(()=>window.savedArt.pop());
  assert.deepEqual(dims.slice(0,2),[w,h],'PNG '+i);
  const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth,poster:document.querySelector('.cs-poster').getBoundingClientRect().toJSON()}));
  assert(layout.scroll<=layout.view+2,'horizontal overflow '+i+': '+JSON.stringify(layout));
  await page.screenshot({path:path.join(root,'test_creative_'+i.replace(':','x')+'.png'),fullPage:false});
  console.log('PASS browser PNG '+i+' '+w+'x'+h+' ('+dims[2]+' bytes) and mobile layout');
 }
 await page.select('#csCampaign','lancamento');
 await page.click('.creative-studio .actions button:nth-child(2)');
 assert.equal(await page.$eval('#creativeHeadline',el=>el.value),'NOVIDADE NO CARDÁPIO');
 await page.select('#csStyle','fresh');
 await page.click('#csShowOld');
 await page.click('.creative-studio .actions button:first-child');
 const campaign=await page.evaluate(()=>state.creatives[0]);
 assert(campaign.style==='fresh'&&campaign.showOld===false);
 assert.equal(errors.length,0,'page errors: '+errors.join(', '));
 console.log('PASS campaign suggestion, style and visibility toggles; no JS page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL',e);process.exit(1)});

