const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let message='',copied='',downloads=0,changes={},clipboardEnabled=true;
const controls={
 csPromptPanel:{hidden:true,scrollIntoView(){}},
 csPromptText:{value:'',focus(){},select(){}},
 csPromptStatus:{textContent:''},
 csPromptMode:{value:'ad'}
};
let config={
 id:'r01',name:'Frango Cremoso',ingredients:['Frango','Requeijão','Mussarela'],
 brand:{name:'Potê Batata',phone:'48999951729',instagram:'@potebatata',hasLogo:true,logoUrl:'data:image/png;base64,AAAA'},
 ratio:'9:16',campaignName:'Oferta do dia',styleName:'Noite dourada',
 headline:'OFERTA DO DIA',description:'Com frango, requeijão e mussarela.',
 cta:'PEÇA PELO WHATSAPP',priceNormal:34.90,priceAd:24.90,
 showPrice:true,showOld:true,showPhone:true,showLogo:true,showCta:true,
 photoFocus:'food',source:'data:image/png;base64,AAAA'
};
const context={
 console,
 window:{POTE_CREATIVE_PROMPT_READ:()=>config},
 document:{
  getElementById:id=>controls[id]||null,
  addEventListener:(key,cb)=>{changes[key]=cb},
  execCommand:()=>false,
  createElement:(tag)=>{
   if(tag==='canvas')return {width:0,height:0,getContext:()=>({drawImage(){}}),toBlob:cb=>cb({size:123})};
   if(tag==='a')return {click(){downloads++},remove(){}};
   return {};
  },
  body:{appendChild(){}}
 },
 navigator:{clipboard:{writeText:async text=>{if(!clipboardEnabled)throw Error('blocked');copied=text}}},
 URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
 Image:class {constructor(){this.width=500;this.height=300}set src(_) {this.onload?.()}},
 setTimeout:()=>{},
 toast:s=>{message=s}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/creative_prompt.js','utf8'),context);
assert(fs.readFileSync(__dirname+'/creative_studio.js','utf8').includes('onclick="creativeOpenPrompt()"'),'button must exist in studio');
(async()=>{
 assert.equal(await context.window.creativeOpenPrompt(),true);
 assert.equal(controls.csPromptPanel.hidden,false);
 assert(copied.includes('Frango Cremoso'));
 assert(copied.includes('Requeijão')&&copied.includes('Mussarela'));
 assert(copied.includes('R$ 24,90')&&copied.includes('R$ 34,90'));
 assert(copied.includes('Potê Batata')&&copied.includes('48999951729'));
 assert(copied.includes('9:16')&&copied.includes('1080 × 1920'));
 assert(copied.includes('FOTO DO PRODUTO')&&copied.includes('IMAGEM 1'));
 assert(copied.includes('CENÁRIO E BASE FÍSICA'));
 assert(copied.includes('SUBSTITUA COMPLETAMENTE'));
 assert(copied.includes('ardósia preta fosca'));
 assert(copied.includes('35–40 graus'));
 assert(copied.includes('Luz principal softbox'));
 assert(copied.includes('bancada de inox'));
 assert(!copied.includes('Manter o mesmo produto, porção, embalagem'));
 assert(!copied.includes('Sal e temperos secos'));

 assert(copied.includes('APLIQUE A LOGOMARCA DA IMAGEM 2')&&copied.includes('PRESERVAÇÃO RIGOROSA DA LOGO'));
 assert(copied.includes('DESCRIÇÃO COMERCIAL OBRIGATÓRIA')&&copied.includes('Com frango, requeijão e mussarela.'));
 for(const banned of ['Envie a FOTO ORIGINAL','o usuário deverá','cole este prompt','Não use logotipos inventados','Texto interno da ficha (NÃO imprimir)'])assert(!copied.includes(banned),'customer-facing or contradictory instruction: '+banned);
 controls.csPromptMode.value='photo';
 changes.change({target:{id:'csPromptMode'}});
 assert(controls.csPromptText.value.includes('Omitir título, descrição')&&controls.csPromptText.value.includes('IMAGEM 2'));
 assert(!controls.csPromptText.value.includes('Preço atual:'));
 assert.equal(await context.window.creativeCopyPrompt(),true);
 assert(copied.includes('Omitir título, descrição')&&copied.includes('IMAGEM 2'));
 config={...config,name:'Chocolate com morango',ingredients:['Chocolate','Morango'],priceNormal:29.90,priceAd:29.90,showOld:false};
 controls.csPromptMode.value='ad';
 assert.equal(await context.window.creativeCopyPrompt(),true);
 assert(copied.includes('Chocolate com morango'));
 assert(!copied.includes('Frango Cremoso'));
 assert(copied.includes('R$ 29,90'));
 assert(!copied.includes('R$ 34,90'));
 config={...config,showPrice:false,showPhone:false,brand:{name:'Minha marca',phone:'',instagram:'',hasLogo:false}};
 assert.equal(await context.window.creativeCopyPrompt(),true);
 assert(copied.includes('PREÇO: omitir.'));
 assert(!copied.includes('PREÇO PRINCIPAL EXATO E DESTACADO'));
 assert(!copied.includes('CONTATO EXATO, DISCRETO: "48'));
 assert.equal(await context.window.creativeDownloadPhoto(),true);
 assert.equal(downloads,1);
 config={...config,brand:{...config.brand,logoUrl:'data:image/png;base64,AAAA'}};
 assert.equal(await context.window.creativeDownloadLogo(),true);
 assert.equal(downloads,2,'logo must download as a separate file');
 const missing=config;config={...config,brand:{...config.brand,logoUrl:''}};
 assert.equal(await context.window.creativeDownloadLogo(),false);
 assert(message.includes('Logomarca não cadastrada'));
 config=missing;
 const previous=config;config={error:'Preço inválido'};
 assert.equal(await context.window.creativeOpenPrompt(),false);
 assert.equal(message,'Preço inválido');
 config=previous;
 clipboardEnabled=false;
 assert.equal(await context.window.creativeCopyPrompt(),false);
 assert(controls.csPromptStatus.textContent.includes('manualmente'));
 context.window.creativeClosePrompt();
 assert.equal(controls.csPromptPanel.hidden,true);
 console.log('PASS: prompt uses live campaign, real ingredients/prices, photo-only, free copy fallback, photo export, no fabricated prices');
})().catch(err=>{console.error(err);process.exit(1)});

