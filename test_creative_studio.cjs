const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const controls={
 creativeRecipe:{value:'a'},creativeOld:{value:'34,90'},creativeSale:{value:'34,90'},creativeRatio:{value:'9:16'},
 creativeHeadline:{value:'OFERTA DO DIA'},creativeBody:{value:'Frango, requeijão e mussarela na composição deste sabor.'},
 creativeCta:{value:'PEÇA AGORA'},csCampaign:{value:'oferta'},csStyle:{value:'premium'},
 csPhotoFocus:{value:'food'},csShowPrice:{checked:true},csShowOld:{checked:false},csShowPhone:{checked:true},csShowLogo:{checked:true},csShowCta:{checked:true},
 csCurrentPrice:{textContent:''},csPriceHint:{textContent:''}
};
const recipes=[
 {id:'a',name:'Frango Cremoso',tagline:'O favorito de quem ama requeijão.',items:[{id:'frango'},{id:'requeijao'},{id:'mussarela'}]},
 {id:'b',name:'Chocolate com morango',tagline:'Um clássico doce.',items:[{id:'chocolate'},{id:'morango'}]}
];
let warning='',rendered=0,saved=0,access=true,isFree=true,changed=null,persisted=0;
const context={
 console,window:{POTE_ACCESS:{requireService:()=>access},POTE_GALLERY:{saveImageBlob:async()=>true}},
 document:{getElementById:id=>controls[id]||null,addEventListener:(name,callback)=>{if(name==='change')changed=callback},
  createElement:tag=>{
   if(tag!=='canvas')return {click:()=>{},remove:()=>{},set href(v){},set download(v){}};
   const gradient={addColorStop(){}};
   const ctx={fillRect(){},beginPath(){},rect(){},clip(){},drawImage(){},restore(){},save(){},arc(){},fill(){},
     createLinearGradient:()=>gradient,measureText:t=>({width:String(t).length*10}),fillText(){},roundRect(){}};
   return {getContext:()=>ctx,toBlob:callback=>callback({size:42})};
  },body:{appendChild(){}}},
 navigator:{clipboard:{writeText:async()=>{}}},state:{data:{recipes,ingredients:[
  {id:'frango',name:'Frango'},{id:'requeijao',name:'Requeijão'},{id:'mussarela',name:'Mussarela'},
  {id:'chocolate',name:'Chocolate'},{id:'morango',name:'Morango'}
 ],brand:{name:'Potê Batata',phone:'48999999999'}},creatives:[],freeCreativeRecipeId:null},
 recipe:id=>recipes.find(r=>r.id===id),sellPrice:r=>r.id==='a'?34.9:28.9,
 allowed:()=>true,pro:()=>!isFree,
 label:s=>'<label>'+s+'</label>',
 select:(label,id)=>'<select id="'+id+'">'+label+'</select>',
 field:(label,id,value)=>'<input id="'+id+'" value="'+value+'">',
 escapeHtml:s=>String(s).replaceAll('<','&lt;'),money:n=>'R$ '+Number(n).toFixed(2),
 render:()=>{rendered++},persist:()=>{persisted++},toast:s=>{warning=s},
 img:()=>'<img>',imageSource:()=>'',Image:function(){},pageCreative:()=>{},creativeHTML:()=>{},generateCreative:()=>{},downloadCreative:async()=>{}
};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/creative_studio.js','utf8'),context);
let html=context.pageCreative();
assert(html.includes('value="34,90"'),'price must be from official sellPrice');
assert(html.includes('O favorito de quem ama requeijão'),'the recipe tagline must take priority over generic ingredient lists');
for(const id of ['csCampaign','csStyle','csPhotoFocus','creativeRecipe','creativeOld','creativeSale','creativeHeadline','creativeBody','creativeCta','csShowPrice','csShowOld','csShowPhone','csShowLogo','csShowCta'])assert(html.includes('id="'+id+'"'),id);
assert(html.includes('Plano Free'));
assert.equal((html.match(/id="csVoiceStudio"/g)||[]).length,1,'card de voz único');
assert(html.indexOf('id="csVoiceStudio"')>html.indexOf('cs-preview-title'),'card de voz após prévia');
assert(html.includes('Gerar Voz com IA'),'rótulo solicitado');
assert(html.trim().endsWith('</section>'),'card encerra a sessão');
assert(changed,'delegated change listener');
access=false;context.generateCreative();assert.equal(context.state.creatives.length,0);
access=true;controls.creativeOld.value='34,90';controls.creativeSale.value='34,90';controls.csShowOld.checked=true;
context.generateCreative();assert.equal(context.state.creatives.length,0);assert(warning.includes('preço anterior'));
controls.csShowOld.checked=false;context.generateCreative();
assert.equal(context.state.creatives[0].sale,34.9);
assert.equal(context.state.creatives[0].showOld,false);
assert.equal(context.state.freeCreativeRecipeId,'a');
assert.equal(persisted,1);
assert(context.creativeHTML(context.state.creatives[0]).includes('Frango Cremoso'));
context.window.creativeDiscount(10);
assert.equal(controls.creativeSale.value,'31,41');
assert.equal(controls.csShowOld.checked,true);
context.generateCreative();assert.equal(context.state.creatives[0].sale,31.41);
controls.creativeSale.value='24,90';
context.generateCreative();
assert.equal(context.state.creatives[0].sale,24.9,'regression: 34,90 vs 24,90 must validate');
assert.equal(context.state.creatives[0].old,34.9);
controls.creativeRecipe.value='b';changed({target:{id:'creativeRecipe'}});
assert.equal(controls.creativeOld.value,'28,90');
assert.equal(controls.creativeSale.value,'28,90');
assert(controls.creativeBody.value.includes('Um clássico doce'),'campaign must use the actual recipe tagline');
context.generateCreative();assert.equal(context.state.creatives[0].id,'a','FREE lock');
isFree=false;controls.csShowOld.checked=false;controls.csCampaign.value='lancamento';changed({target:{id:'csCampaign'}});
context.generateCreative();assert.equal(context.state.creatives[0].id,'b');
assert.equal(context.state.creatives[0].campaign,'lancamento');
assert.equal(context.state.creatives[0].sale,28.9);
controls.csShowPrice.checked=false;controls.creativeSale.value='';context.generateCreative();
assert.equal(context.state.creatives[0].showPrice,false);
// Regression from Milho & Bacon: salt and potato base must not become ad copy.
context.state.data.ingredients.push(
 {id:'batata',name:'Batata inglesa'},
 {id:'sal',name:'Sal e temperos secos'},
 {id:'milho',name:'Milho verde'},
 {id:'bacon',name:'Bacon crocante'}
);
recipes.push({id:'c',name:'Milho & Bacon',tagline:'Doce do milho, crocante do bacon.',items:[
 {id:'batata',g:205},{id:'sal',g:3},{id:'milho',g:90},{id:'bacon',g:65}
]});
controls.creativeRecipe.value='c';
changed({target:{id:'creativeRecipe'}});
assert(controls.creativeBody.value==='Doce do milho, crocante do bacon.','preserve chef tagline without generic ingredient list');
const milho=context.window.POTE_CREATIVE_PROMPT_READ();
assert(milho.ingredients.includes('Milho verde')&&milho.ingredients.includes('Bacon crocante'));
assert(!milho.ingredients.some(x=>/sal|batata/i.test(x)),'exclude base and seasonings from sales highlights');
console.log('PASS: Milho & Bacon description and highlighted ingredients without salt/batata');
console.log('PASS: official price 34,90 and 28,90, ingredients, promo -10%, local decimal, Free/Pro, visibility, validations');

const iaSource=fs.readFileSync(__dirname+'/voice_ai.js','utf8');
const iaCss=fs.readFileSync(__dirname+'/creative_studio.css','utf8');
assert(iaSource.includes('Carteira <span>IA COIN</span>'));
assert(iaSource.includes('[[5,990],[10,1790],[25,3990],[50,6990],[75,9490],[100,11990]]'),'preserve approved six packages');
assert(iaSource.includes('iauWalletArt')&&iaSource.includes('iau-coin-art'));
assert(iaSource.includes('FREE não usa IA')&&iaSource.includes('u(\'iauContent\').hidden=!allowed'));
assert(iaCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
assert(html.includes('Comprar IA COIN'));
console.log('PASS IA COIN: approved branding, fixed package prices, wallet layout and FREE gate');

assert(iaSource.includes('iauAdminCredit')&&iaSource.includes('showCredit(pack[0],pack[1]);'));
assert(iaSource.includes('await api.addOwnWalletPackage(selected.amount,selected.eventId,selected.uid,selected.quantity)'));
assert(iaSource.includes('creditBusy||!selected')&&iaSource.includes('crypto.randomUUID()'));
console.log('PASS: confirmação ADM e bloqueio de cliques duplicados');

assert(iaSource.includes('iauCreditMinus')&&iaSource.includes('iauCreditPlus')&&iaSource.includes('brl(s.cents*q)')&&iaSource.includes('q*s.amount'));

assert(html.includes('aria-controls="poteVoiceConsole"')&&!html.includes('id="csVoiceForm"'),'CTA points to independent dialog');
assert(iaSource.includes("voiceConsole.showModal();invalidate()")&&iaSource.indexOf("voiceConsole.showModal();invalidate()")<iaSource.indexOf("if(!endpoint()){studioStatus"),"Editor opens before provider availability check");
for(const marker of ['pvSliders','pvLanguage','pvModel','pvBoost','pvTiers','pvImport','pvWallet','pvOutputHint','csVoiceDownload','voiceSettings:settings()','...opts','JSON.stringify(q.opts)'])assert(iaSource.includes(marker),'Voice Studio: '+marker);
assert(iaCss.includes('#poteVoiceConsole{position:fixed;inset:0'),'Full-screen dedicated editor');
console.log('PASS: Voice Studio opens independently; advanced settings bound to quote');

;(async function checkVoiceStudio(){
 const vm=require('node:vm'),nodes=new Map(),events=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,value:id==='csVoiceDuration'?'15':id==='pvModel'?'eleven_flash_v2_5':id==='pvLanguage'?'pt':'',checked:true,hidden:false,disabled:false,open:false,textContent:'',innerHTML:'',setAttribute(){},removeAttribute(){},replaceChildren(){},querySelectorAll(){return []},addEventListener(k,fn){events.set(id+':'+k,fn)},showModal(){this.open=true},close(){this.open=false},pause(){}});
  return nodes.get(id);
 };
 const user={uid:'qa-admin',email:'pixmcp@gmail.com'},win={POTE_AUTH:{uid:user.uid,role:'admin'},addEventListener(){}};
 const docMock={getElementById:node,createElement:tag=>node('created-'+tag),body:{append(){}}};
 const prefix=iaSource.slice(0,iaSource.indexOf('window.POTE_VOICE_AI={open,shop,history};')).replace(/^import .*;\s*$/gm,'');
 vm.runInNewContext(prefix+'\nwindow.qa={open,settings,options,applyPreset,invalidate,voiceConsole};',{app:{},getAuth:()=>({currentUser:user}),getFirestore:()=>({}),getDoc:async()=>({exists:()=>true,data:()=>({balance:1000})}),doc:()=>({}),document:docMock,window:win,Option:function(t,v){this.text=t;this.value=v},URL:{revokeObjectURL(){}},console});
 await win.qa.open();
 assert.equal(win.qa.voiceConsole.open,true,'CTA opens dedicated modal even without endpoint');
 assert.equal(node('csVoiceForm').hidden,false);
 assert.equal(node('csVoicePrice').disabled,true,'No provider means no quote');
 assert.equal(node('csVoiceGenerate').disabled,true,'No provider means no debit');
 assert.match(node('pvStatus').textContent,/Modo preparação/);
 assert.match(node('pvBalance').textContent,/1[.,]?000/);
 win.qa.applyPreset({speed:1.05,style:.25});
 assert.equal(win.qa.settings().speed,1.05);
 node('csVoiceDuration').value='75';win.qa.invalidate();
 assert.equal(node('pvCost').textContent,'5 IA COIN');
 assert.equal(node('csVoiceText').maxLength,750);
 console.log('PASS Voice Studio runtime: opens offline safely, real balance, adjustable settings and fixed tariff');
})().catch(e=>{console.error(e);process.exitCode=1;});
