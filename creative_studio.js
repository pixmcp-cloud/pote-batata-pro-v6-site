/* Potê Batata Pro — estúdio comercial offline, sem serviços pagos. */
(function(){
'use strict';
const FORMATS={'1:1':[1080,1080],'9:16':[1080,1920],'4:5':[1080,1350],'16:9':[1920,1080]};
const CAMPAIGNS={
 oferta:{label:'Oferta do dia',headline:'OFERTA ESPECIAL',cta:'PEÇA AGORA PELO WHATSAPP',discount:true},
 lancamento:{label:'Lançamento',headline:'NOVIDADE NO CARDÁPIO',cta:'VENHA EXPERIMENTAR',discount:false},
 sabor:{label:'Destaque do sabor',headline:'UM SABOR PRA CHAMAR DE SEU',cta:'FAÇA SEU PEDIDO',discount:false},
 combo:{label:'Combo',headline:'COMBO PRA COMPARTILHAR',cta:'MONTE O SEU PEDIDO',discount:false},
 story:{label:'Story rápido',headline:'BATEU A FOME?',cta:'CHAMA NO WHATSAPP',discount:false},
 especial:{label:'Data especial',headline:'HOJE É DIA DE SABOR',cta:'GARANTA O SEU',discount:false}
};
const STYLES={premium:'Preto e dourado',fresh:'Verde e creme',clean:'Minimalista claro'};
const $=id=>document.getElementById(id);
const safe=(v,n=160)=>String(v??'').trim().slice(0,n);
const escape=s=>escapeHtml(String(s??''));
const checked=id=>!!$(id)?.checked;
const has=(id)=>$(id)!=null;
const input=(id,fallback='',max=160)=>safe($(id)?.value||fallback,max);
const price=(id)=>num($(id)?.value);
const flag=(c,k,defaultValue=true)=>typeof c[k]==='boolean'?c[k]:defaultValue;
function palette(c){
 if(c.style==='fresh')return {bg:'#102d26',ink:'#fff9e9',accent:'#c4e0b5',muted:'#d7e5d6',overlay:'#102d26'};
 if(c.style==='clean')return {bg:'#f7f0e3',ink:'#20241c',accent:'#397555',muted:'#48534a',overlay:'#f7f0e3'};
 return {bg:'#15120f',ink:'#fff7e9',accent:'#eebf6a',muted:'#e5d4b9',overlay:'#15120f'};
}
function ingredients(r){
 const text=[r?.description,r?.subtitle,r?.ingredientsText].filter(x=>typeof x==='string'&&x.trim()).join(' ');
 return safe(text,130);
}
function pitch(r,campaign='oferta'){
 const n=safe(r?.name||'Seu sabor',70),s=n.toLocaleLowerCase('pt-BR');
 let body=ingredients(r);
 if(!body){
  if(/frango/.test(s))body='Frango bem temperado em uma combinação feita para conquistar.';
  else if(/carne|costela|bovina/.test(s))body='Sabor marcante em uma combinação especial.';
  else if(/cheddar|queijo/.test(s))body='Uma escolha irresistível para quem ama queijo.';
  else if(/pizza|calabresa/.test(s))body='O sabor de um clássico em uma experiência diferente.';
  else if(/chocolate|brigadeiro|nutella|ninho|morango/.test(s))body='Uma opção especial para adoçar o seu dia.';
  else if(/cachorro.quente|hot dog/.test(s))body='O clássico que todo mundo gosta, em uma nova versão.';
  else body='Um sabor especial para deixar sua pausa mais gostosa.';
 }
 const meta=CAMPAIGNS[campaign]||CAMPAIGNS.oferta;
 return {headline:meta.headline,body,cta:meta.cta,name:n};
}
function getSuggestedPrice(r){
 try{
  const n=Number(r?.price??r?.sellPrice??r?.salePrice??0);
  return Number.isFinite(n)&&n>0?n:0;
 }catch(_){return 0}
}
function getActive(){
 const all=state.creatives||[];
 return all[0]||null;
}
function eCheck(labelText,id,isChecked){
 return '<label class="cs-toggle"><input type="checkbox" id="'+id+'" '+(isChecked?'checked':'')+'><span>'+escape(labelText)+'</span></label>';
}
function optionSelect(labelText,id,options,value){return select(labelText,id,options,value)}
function page(){
 const recipes=state.data.recipes.filter(allowed),opts=recipes.map(r=>[r.id,r.name]);
 const current=getActive(),chosen=state.freeCreativeRecipeId||current?.id||opts[0]?.[0]||'',r=recipe(chosen);
 const campaign=current?.campaign||'oferta',p=pitch(r,campaign),old=current?.id===chosen?current.old:getSuggestedPrice(r);
 const sale=current?.id===chosen?current.sale:(old>0?Math.round(old*.85*100)/100:0);
 const use=current?.id===chosen?current:p;
 const control=eCheck('Mostrar preço', 'csShowPrice',flag(current||{},'showPrice',true))+
  eCheck('Mostrar preço anterior', 'csShowOld',flag(current||{},'showOld',campaign==='oferta'))+
  eCheck('Mostrar telefone', 'csShowPhone',flag(current||{},'showPhone',true))+
  eCheck('Mostrar logotipo', 'csShowLogo',flag(current||{},'showLogo',true))+
  eCheck('Mostrar chamada para ação', 'csShowCta',flag(current||{},'showCta',true));
 return '<section class="box creative-studio"><h2>Estúdio de criativos premium</h2>'+
 '<p>Campanhas reais com foto cadastrada, textos personalizados e edição gratuita no navegador.</p>'+
 (!pro()?label('Plano Free: um produto; edições e exportações ilimitadas para ele'):'')+
 '<div class="cs-grid">'+
 optionSelect('Produto / sabor','creativeRecipe',opts,chosen)+
 optionSelect('Campanha','csCampaign',Object.entries(CAMPAIGNS).map(([k,v])=>[k,v.label]),campaign)+
 optionSelect('Visual','csStyle',Object.entries(STYLES),current?.style||'premium')+
 optionSelect('Formato','creativeRatio',[['1:1','Quadrado 1080×1080'],['9:16','Story 1080×1920'],['4:5','Feed 1080×1350'],['16:9','Horizontal 1920×1080']],current?.ratio||'9:16')+
 field('Preço normal de venda (R$)','creativeOld',old>0?String(old):'','text','inputmode="decimal"')+
 field('Preço do anúncio (R$)','creativeSale',sale>0?String(sale):'','text','inputmode="decimal"')+
 field('Título da campanha','creativeHeadline',use.headline,'text','maxlength="90"')+
 field('Descrição do sabor','creativeBody',use.body,'text','maxlength="160"')+
 field('Chamada de compra','creativeCta',use.cta,'text','maxlength="70"')+
 '</div><fieldset class="cs-options"><legend>Elementos do anúncio</legend>'+control+'</fieldset>'+
 '<div class="actions"><button class="btn" type="button" onclick="generateCreative()">Gerar / Atualizar arte</button>'+
 '<button class="btn line" type="button" onclick="creativeAutoCopy()">Sugerir texto</button>'+
 '<button class="btn line" type="button" onclick="window.POTE_GALLERY?.open()">Galeria (42 horas)</button>'+
 (current?'<button class="btn line" type="button" onclick="downloadCreative()">Baixar PNG</button><button class="btn line" type="button" onclick="copyCreativeCaption()">Copiar legenda</button>':'')+
 '</div><p class="help">Textos comerciais são sugestões. Não anuncie ingredientes, peso, ofertas ou preços não confirmados. Criativos não alteram preços no PDV. Sem custo obrigatório de IA.</p></section>'+
 '<section class="box cs-preview"><h3>Prévia do anúncio</h3>'+(current?card(current):'<p class="empt">Escolha uma campanha e gere sua primeira arte.</p>')+'</section>';
}
function card(c){
 const brand=state.data.brand||{},r=recipe(c.id),p=palette(c);
 const old=flag(c,'showOld')&&c.old>c.sale?'<s>De '+money(c.old)+'</s>':'';
 const amount=flag(c,'showPrice')?'<strong class="cs-price">'+money(c.sale)+'</strong>':'';
 const phone=flag(c,'showPhone')&&brand.phone?'<small>'+escape(brand.phone)+'</small>':'';
 const name=escape(brand.name||'Minha empresa');
 const image=r?img(r):'<span>Foto não cadastrada</span>';
 return '<div class="cs-poster cs-'+escape(c.style||'premium')+'" style="aspect-ratio:'+({'9:16':'9/16','4:5':'4/5','16:9':'16/9'}[c.ratio]||'1/1')+';--cs-bg:'+p.bg+';--cs-ink:'+p.ink+';--cs-accent:'+p.accent+'">'+
 '<div class="cs-photo">'+image+'</div><div class="cs-content">'+
 '<small class="cs-brand">'+(flag(c,'showLogo')&&brand.logoUrl?'<img class="cs-logo" src="'+escape(brand.logoUrl)+'" alt="" aria-hidden="true">':'')+name+'</small><strong class="cs-heading">'+escape(c.headline||c.name)+'</strong>'+
 '<strong class="cs-name">'+escape(c.name)+'</strong><p class="cs-description">'+escape(c.body||'')+'</p>'+
 '<div class="cs-prices">'+old+amount+'</div>'+
 (flag(c,'showCta')?'<strong class="cs-cta">'+escape(c.cta||'PEÇA AGORA')+'</strong>':'')+
 phone+'</div></div><div class="cs-caption"><h4>Legenda para publicar</h4><p>'+escape(caption(c)).replace(/\n/g,'<br>')+'</p></div>';
}
function caption(c){
 const b=state.data.brand||{};
 return [c.headline,c.name,c.body,flag(c,'showPrice')?(flag(c,'showOld')&&c.old>c.sale?'De '+money(c.old)+' por '+money(c.sale):'Por '+money(c.sale)):null,
 flag(c,'showCta')?c.cta:null,flag(c,'showPhone')?b.phone:null,b.instagram?'Instagram: '+b.instagram:null,b.name].filter(Boolean).join('\n');
}
function autoCopy(){
 const r=recipe($('creativeRecipe')?.value),campaign=$('csCampaign')?.value||'oferta';
 const p=pitch(r,campaign);
 [['creativeHeadline',p.headline],['creativeBody',p.body],['creativeCta',p.cta]].forEach(([id,value])=>{const control=$(id);if(control)control.value=value});
 toast('Texto sugerido. Revise as informações antes de publicar.');
}
function generate(){
 if(window.POTE_ACCESS?.requireService?.('creatives')===false)return;
 const id=$('creativeRecipe')?.value,r=recipe(id);
 if(!r||!allowed(r)){toast('Produto não liberado para criativos.');return}
 if(!pro()&&state.freeCreativeRecipeId&&state.freeCreativeRecipeId!==id){toast('O plano Free permite reeditar somente o primeiro produto escolhido.');return}
 const old=price('creativeOld'),sale=price('creativeSale'),showPrice=checked('csShowPrice'),showOld=checked('csShowOld');
 if(showPrice&&(!Number.isFinite(sale)||sale<=0)){toast('Informe um preço válido para o anúncio.');return}
 if(showPrice&&showOld&&(!Number.isFinite(old)||old<=sale)){toast('O preço anterior deve ser maior que o preço do anúncio.');return}
 const campaign=$('csCampaign')?.value||'oferta',base=pitch(r,campaign);
 const c={id,name:r.name,campaign,style:$('csStyle')?.value||'premium',ratio:$('creativeRatio')?.value||'9:16',
 old:Number.isFinite(old)&&old>0?old:0,sale:Number.isFinite(sale)&&sale>0?sale:0,
 headline:input('creativeHeadline',base.headline,90),body:input('creativeBody',base.body,160),cta:input('creativeCta',base.cta,70),
 showPrice,showOld,showPhone:checked('csShowPhone'),showLogo:checked('csShowLogo'),showCta:checked('csShowCta'),freeUse:!pro()};
 if(!FORMATS[c.ratio]||!STYLES[c.style]||!CAMPAIGNS[c.campaign]){toast('Selecione um modelo válido.');return}
 state.creatives=[c];
 if(!pro()){state.freeCreativeRecipeId=id;state.freeCreativeCount=1}
 render();
 toast('Arte preparada. Salvando na galeria...');
 void exportPng({galleryOnly:true});
}
function loadImage(src){return new Promise(resolve=>{if(!src)return resolve(null);const pic=new Image();pic.onload=()=>resolve(pic);pic.onerror=()=>resolve(null);pic.src=src})}
function cover(ctx,img,x,y,w,h){
 const scale=Math.max(w/img.width,h/img.height),iw=img.width*scale,ih=img.height*scale;
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);ctx.restore();
}
function fit(ctx,text,x,y,maxW,sz,min=19){
 let size=sz;while(size>min){ctx.font='800 '+size+'px system-ui,Arial';if(ctx.measureText(text).width<=maxW)break;size-=2}
 ctx.fillText(text,x,y);
}
function wrap(ctx,text,x,y,maxW,sz,maxLines=2,step=1.24){
 const words=safe(text,180).split(/\s+/),lines=[];let line='';
 ctx.font='800 '+sz+'px system-ui,Arial';
 for(const word of words){const candidate=line?line+' '+word:word;if(line&&ctx.measureText(candidate).width>maxW){lines.push(line);line=word}else line=candidate}
 if(line)lines.push(line);
 for(let i=0;i<Math.min(lines.length,maxLines);i++)fit(ctx,lines[i],x,y+i*sz*step,maxW,sz);
 return Math.min(lines.length,maxLines);
}
function rounded(ctx,x,y,w,h,r){
 ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
}
async function exportPng(options={}){
 const c=getActive();if(!c){toast('Gere a arte antes de exportar.');return}
 const [w,h]=FORMATS[c.ratio]||FORMATS['9:16'],brand=state.data.brand||{},r=recipe(c.id),p=palette(c);
 const horizontal=c.ratio==='16:9';
 try{
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas indisponível');
  ctx.fillStyle=p.bg;ctx.fillRect(0,0,w,h);
  const photo=await loadImage(r?imageSource(r):''),photoW=horizontal?Math.floor(w*.53):w;
  const photoH=horizontal?h:Math.floor(h*(c.ratio==='1:1'?.41:c.ratio==='4:5'?.45:.49));
  if(photo)cover(ctx,photo,0,0,photoW,photoH);
  else {ctx.fillStyle=c.style==='clean'?'#d5cbb9':'#3a2a1f';ctx.fillRect(0,0,photoW,photoH);ctx.fillStyle=p.ink;ctx.textAlign='center';ctx.font='32px Arial';ctx.fillText('Adicione a foto do produto',photoW/2,photoH/2)}
  if(!horizontal){const fade=ctx.createLinearGradient(0,photoH-145,0,photoH+20);fade.addColorStop(0,p.bg+'00');fade.addColorStop(1,p.bg);ctx.fillStyle=fade;ctx.fillRect(0,photoH-145,w,165)}
  const tx=horizontal?Math.round(w*.765):w/2,maxW=horizontal?790:w-120;
  const logo=c.showLogo?await loadImage(brand.logoUrl||''):null;
  ctx.fillStyle=c.style==='clean'?'#ffffffed':'#15130fdc';rounded(ctx,26,25,Math.min(horizontal?960:w-52,w-52),122,20);ctx.fill();
  if(logo){ctx.save();ctx.beginPath();ctx.arc(89,86,46,0,Math.PI*2);ctx.clip();cover(ctx,logo,43,40,92,92);ctx.restore()}
  ctx.textAlign='left';ctx.fillStyle=c.style==='clean'?'#222920':'#fff9e8';
  fit(ctx,safe(brand.name||'Minha empresa',55).toUpperCase(),logo?162:63,104,logo?770:900,45,24);
  ctx.textAlign='center';
  const top=horizontal?255:photoH+64;
  ctx.fillStyle=p.accent;wrap(ctx,c.headline,tx,top,maxW,horizontal?48:43,2);
  ctx.fillStyle=p.ink;wrap(ctx,c.name,tx,top+(horizontal?155:118),maxW,horizontal?59:56,2);
  ctx.fillStyle=p.muted;wrap(ctx,c.body,tx,top+(horizontal?310:260),maxW,horizontal?32:31,3,1.3);
  const priceY=horizontal?822:Math.round(h*.855);
  if(c.showPrice){
   if(c.showOld&&c.old>c.sale){ctx.fillStyle=p.muted;fit(ctx,'DE '+money(c.old),tx,priceY-126,maxW,35,23)}
   ctx.fillStyle=p.accent;fit(ctx,money(c.sale),tx,priceY,maxW,horizontal?107:108,50);
  }
  let footer=priceY+(c.showPrice?72:-52);
  if(c.showCta){ctx.fillStyle=p.ink;fit(ctx,c.cta||'PEÇA AGORA',tx,footer,maxW,28,19);footer+=51}
  if(c.showPhone&&brand.phone){ctx.fillStyle=p.muted;fit(ctx,safe(brand.phone,35),tx,Math.min(h-20,footer),maxW,25,17)}
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Falha ao exportar PNG')),'image/png'));
  if(options.galleryOnly){
   if(typeof window.POTE_GALLERY?.saveImageBlob==='function'){
    const saved=await window.POTE_GALLERY.saveImageBlob(blob,{title:c.name,source:'Criativos'});
    toast(saved?'Arte salva na galeria por 42 horas.':'Arte gerada, mas a galeria não confirmou o salvamento.');
   }else toast('Arte criada. Galeria indisponível; utilize Baixar PNG.');
   return;
  }
  const link=URL.createObjectURL(blob),a=document.createElement('a');a.href=link;a.download='criativo-'+String(c.id).replace(/[^a-z0-9_-]/gi,'')+'-'+c.ratio.replace(':','x')+'.png';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(link),4000);toast('PNG '+w+' × '+h+' gerado.');
 }catch(error){console.error('Creative Studio',error);toast('Falha ao gerar PNG. Confira a foto cadastrada.')}
}
window.copyCreativeCaption=async function(){
 const c=getActive();if(!c){toast('Gere a arte primeiro.');return}
 try{await navigator.clipboard.writeText(caption(c));toast('Legenda copiada.')}catch(_){toast('Não foi possível copiar. Selecione o texto na prévia.')}
};
window.creativeAutoCopy=autoCopy;
pageCreative=page;
creativeHTML=card;
generateCreative=generate;
downloadCreative=exportPng;
})();
