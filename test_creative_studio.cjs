const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const control={
 creativeRecipe:{value:'a'},creativeOld:{value:'30'},creativeSale:{value:'25'},creativeRatio:{value:'9:16'},
 creativeHeadline:{value:'OFERTA ESPECIAL'},creativeBody:{value:'Frango com cheddar preparado na hora.'},
 creativeCta:{value:'PEÇA AGORA'},csCampaign:{value:'oferta'},csStyle:{value:'premium'},
 csShowPrice:{checked:true},csShowOld:{checked:true},csShowPhone:{checked:true},csShowLogo:{checked:true},csShowCta:{checked:true}
};
const recipes=[{id:'a',name:'Frango com cheddar'},{id:'b',name:'Chocolate com morango'}];
let toastLog=[],rendered=0,allowedService=true,free=true;
const context={
 console,window:{POTE_ACCESS:{requireService:()=>allowedService},POTE_GALLERY:{saveImageBlob:async()=>true}},
 document:{getElementById:id=>control[id]||null,createElement:tag=>{
  if(tag!=='canvas')return {click:()=>{},remove:()=>{},set href(v){},set download(v){}};
  const gradient={addColorStop(){}};
  const context2d={fillRect(){},beginPath(){},rect(){},clip(){},drawImage(){},restore(){},save(){},arc(){},fill(){},
    createLinearGradient:()=>gradient,measureText:txt=>({width:String(txt).length*10}),fillText(){},roundRect(){}};
  return {width:0,height:0,getContext:()=>context2d,toBlob:callback=>callback({size:12})};
},body:{appendChild(){}}},
 navigator:{clipboard:{writeText:async()=>{}}},
 state:{data:{recipes,brand:{name:'Potê Batata',phone:'48999999999'}},creatives:[],freeCreativeRecipeId:null},
 allowed:()=>true,recipe:id=>recipes.find(x=>x.id===id),pro:()=>!free,
 label:s=>'<label>'+s+'</label>',
 select:(label,id)=>'<select id="'+id+'">'+label+'</select>',
 field:(label,id,value)=>'<input id="'+id+'" value="'+value+'">',
 escapeHtml:s=>String(s).replaceAll('<','&lt;'),money:n=>'R$ '+Number(n).toFixed(2),
 render:()=>{rendered++},toast:s=>toastLog.push(s),num:s=>Number(String(s).replace(',','.')),
 img:()=>'<img>',imageSource:()=>'',Image:function(){},pageCreative:()=>{},creativeHTML:()=>{},generateCreative:()=>{},downloadCreative:async()=>{}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/creative_studio.js','utf8'),context);
const ui=context.pageCreative();
for(const id of ['csCampaign','csStyle','creativeRecipe','creativeHeadline','creativeBody','creativeCta','csShowPrice','csShowOld','csShowPhone','csShowLogo','csShowCta'])assert(ui.includes('id="'+id+'"'),id);
assert(ui.includes('Plano Free'));
allowedService=false;context.generateCreative();assert.equal(context.state.creatives.length,0);
allowedService=true;control.creativeOld.value='20';control.creativeSale.value='25';context.generateCreative();assert.equal(context.state.creatives.length,0);
control.creativeOld.value='30';context.generateCreative();
assert.equal(context.state.creatives[0].headline,'OFERTA ESPECIAL');
assert.equal(context.state.freeCreativeRecipeId,'a');
assert.equal(rendered,1);
assert(context.creativeHTML(context.state.creatives[0]).includes('Frango com cheddar'));
control.creativeRecipe.value='b';context.generateCreative();assert.equal(context.state.creatives[0].id,'a');
free=false;control.csShowOld.checked=false;control.csCampaign.value='lancamento';context.generateCreative();
assert.equal(context.state.creatives[0].campaign,'lancamento');
assert.equal(context.state.creatives[0].id,'b');
control.csShowPrice.checked=false;control.csShowOld.checked=false;control.creativeSale.value='0';context.generateCreative();
assert.equal(context.state.creatives[0].showPrice,false);
assert(context.pageCreative().includes('creativeRatio'));
console.log('PASS creative premium: UI controls, access, pricing, FREE lock, PRO options, no-price campaigns');
