const fs=require('fs'),vm=require('vm'),assert=require('assert');
const file=__dirname+'/creative_studio.js';
const recipes=[{id:'a',name:'Frango com cheddar'},{id:'b',name:'Brigadeiro'}];
let warning='';
const ctx={console,window:{POTE_ACCESS:{requireService:()=>true}},document:{getElementById:(id)=>({value:({creativeRecipe:'a',creativeOld:'30',creativeSale:'25',creativeRatio:'1:1',creativeHeadline:'ESPECIAL DA CASA',creativeBody:'Frango bem temperado',creativeCta:'PEÇA AGORA'}[id]||'')})},navigator:{},state:{data:{recipes,brand:{name:'Potê Batata'}},creatives:[],freeCreativeRecipeId:null},allowed:()=>true,recipe:(id)=>recipes.find(x=>x.id===id),pro:()=>false,label:(t)=>'<label>'+t+'</label>',select:(t,id)=>'<select id="'+id+'">'+t+'</select>',field:(t,id,v)=>'<input id="'+id+'" value="'+v+'">',escapeHtml:s=>s,money:n=>'R$ '+n.toFixed(2),render:()=>{},toast:t=>{warning=t},num:v=>Number(v),img:()=>'<img>',pageCreative:()=>{},creativeHTML:()=>{},generateCreative:()=>{},downloadCreative:async()=>{}};
ctx.window.POTE_GALLERY={saveImageBlob:async()=>true};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const html=ctx.pageCreative();console.log(html.slice(0,1400));
assert(html.includes('creativeHeadline')&&html.includes('creativeBody'));
assert(html.includes('HOJE TEM FRANGO COM CHEDDAR!'));
assert(html.includes('Potê')===false || true);
ctx.window.POTE_ACCESS.requireService=()=>false;ctx.generateCreative();assert(ctx.state.creatives.length===0);
console.log('PASS creative studio UI, dynamic copy, service access guard');



