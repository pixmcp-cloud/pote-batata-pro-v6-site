/* Estúdio de criativos: conteúdo comercial offline, isolado da operação e do PDV. */
(function(){
"use strict";
const FORMATS={"1:1":[1080,1080],"9:16":[1080,1920],"4:5":[1080,1350],"16:9":[1920,1080]};
const clean=(v,max=160)=>String(v??"").trim().slice(0,max);
function pitch(r){
 const name=clean(r?.name||"Seu sabor",70), s=name.toLocaleLowerCase("pt-BR");
 let body="Um sabor especial para deixar sua pausa mais gostosa.";
 if(/frango/.test(s))body="Frango bem temperado em uma combinação feita para conquistar.";
 else if(/carne|costela|bovina/.test(s))body="Sabor marcante para quem aprecia um bom recheio.";
 else if(/cheddar|queijo/.test(s))body="Uma escolha irresistível para quem ama queijo.";
 else if(/pizza|calabresa/.test(s))body="O sabor de um clássico em uma experiência diferente.";
 else if(/chocolate|brigadeiro|nutella|ninho|morango/.test(s))body="Uma opção especial para adoçar o seu dia.";
 else if(/cachorro.quente|hot dog/.test(s))body="O clássico que todo mundo gosta, em uma nova versão.";
 return {headline:"HOJE TEM "+name.toLocaleUpperCase("pt-BR")+"!",body,cta:"PEÇA AGORA PELO WHATSAPP"};
}
const item=(id)=>document.getElementById(id);
const val=(id,d,max)=>clean(item(id)?.value||d,max);
function card(c){
 const brand=state.data.brand||{},r=recipe(c.id);
 return '<div class="creative" style="max-width:490px;margin:auto;aspect-ratio:'+({'9:16':'9/16','4:5':'4/5','16:9':'16/9'}[c.ratio]||'1/1')+'"><div class="image">'+(r?img(r):'')+'</div><div class="deal" style="gap:9px"><small>'+escapeHtml(brand.name||'Sua empresa')+'</small><strong style="font-size:clamp(17px,3vw,27px)">'+escapeHtml(c.headline||c.name)+'</strong><span style="color:#f3ddbb;font-size:clamp(12px,2vw,17px)">'+escapeHtml(c.body||'')+'</span><strong>'+escapeHtml(c.name)+'</strong><s>De '+money(c.old)+'</s><strong>'+money(c.sale)+'</strong><small>'+escapeHtml(c.cta||'PEÇA AGORA')+'</small></div></div><p style="white-space:pre-line;font-size:14px">'+escapeHtml(caption(c))+'</p><div class="actions"><button class="btn line" onclick="downloadCreative()">Baixar PNG</button><button class="btn line" onclick="copyCreativeCaption()">Copiar legenda</button></div>';
}
function caption(c){
 return [c.headline,c.name,c.body,'De '+money(c.old)+' por '+money(c.sale)+'.',c.cta,state.data.brand?.name||''].filter(Boolean).join('\n');
}
function page(){
 const available=state.data.recipes.filter(allowed),opts=available.map(r=>[r.id,r.name]);
 const first=state.freeCreativeRecipeId||opts[0]?.[0]||'',r=recipe(first),suggestion=pitch(r);
 const c=state.creatives?.[0],active=c?.id===first?c:suggestion;
 return '<style>.creative-studio .fields{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.creative-studio .fields input{min-width:0}.creative-studio .help{line-height:1.5}.creative-studio .actions{margin-top:16px}</style><div class="box creative-studio"><h2>🎨 Estúdio de criativos</h2><p>Anúncios com foto original, campanha personalizada e textos editáveis. PNG de alta resolução sem custo de IA.</p>'+
 (!pro()?label('Free: um produto, revisões e downloads ilimitados'):'')+
 '<div class="fields">'+select('Sabor','creativeRecipe',opts,first)+
 field('Preço normal de venda (R$)','creativeOld',c?.id===first?String(c.old):'30','text','inputmode="decimal"')+
 field('Preço promocional (R$)','creativeSale',c?.id===first?String(c.sale):'25','text','inputmode="decimal"')+
 select('Formato','creativeRatio',[['1:1','Quadrado 1080×1080'],['9:16','Story 1080×1920'],['4:5','Feed 1080×1350'],['16:9','Horizontal 1920×1080']],c?.ratio||'1:1')+
 field('Título do anúncio','creativeHeadline',active.headline,'text','maxlength="90"')+
 field('Descrição do sabor','creativeBody',active.body,'text','maxlength="160"')+
 field('Chamada para ação','creativeCta',active.cta,'text','maxlength="70"')+
 '</div><div class="actions"><button class="btn" onclick="generateCreative()">Gerar / Atualizar anúncio</button><button class="btn line" type="button" onclick="window.POTE_GALLERY?.open()">Galeria · 42 horas</button>'+
 (c?'<button class="btn line" onclick="downloadCreative()">Baixar PNG</button><button class="btn line" onclick="copyCreativeCaption()">Copiar legenda</button>':'')+
 '</div><p class="help">Os textos são sugestões baseadas no nome do sabor, não garantem ingredientes específicos. Confirme a receita e os preços. A promoção não altera o caixa.</p></div>'+
 '<div class="box" id="creativeResult"><h3>Prévia do anúncio</h3>'+(c?card(c):'<div class="empt">Selecione o produto e gere seu anúncio.</div>')+'</div>';
}
function generate(){
 if(window.POTE_ACCESS?.requireService?.("creatives")===false)return;
 const id=item('creativeRecipe')?.value,r=recipe(id);
 if(!r||!allowed(r)){toast('Receita não liberada para criativos.');return}
 if(!pro()&&state.freeCreativeRecipeId&&state.freeCreativeRecipeId!==id){toast('Seu anúncio Free está vinculado a outro produto.');return}
 const old=num(item('creativeOld')?.value),sale=num(item('creativeSale')?.value);
 if(!Number.isFinite(old)||!Number.isFinite(sale)||old<=0||sale<=0||sale>=old){toast('Preço promocional deve ser inferior ao preço normal de venda.');return}
 const p=pitch(r);
 state.creatives=[{id,name:r.name,old,sale,ratio:item('creativeRatio').value,
 headline:val('creativeHeadline',p.headline,90),body:val('creativeBody',p.body,160),cta:val('creativeCta',p.cta,70),freeUse:!pro()}];
 if(!pro()){state.freeCreativeRecipeId=id;state.freeCreativeCount=1}
 render();toast('Anúncio criado. Salvando na galeria...');void exportPng({galleryOnly:true});
}
function loadImageSafe(src){return new Promise(resolve=>{if(!src)return resolve(null);const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src})}
function fitted(ctx,s,x,y,maxW,fontSize,minSize=21){
 let font=fontSize;do{ctx.font='800 '+font+'px Arial,sans-serif';if(ctx.measureText(s).width<=maxW||font<=minSize)break;font-=2}while(true);
 ctx.fillText(s,x,y);
}
function lines(ctx,text,x,y,maxW,fontSize,maxLines=2){
 const words=String(text||'').split(/\s+/),ls=[];let line='';
 ctx.font='800 '+fontSize+'px Arial';
 for(const word of words){const n=line?line+' '+word:word;if(line&&ctx.measureText(n).width>maxW){ls.push(line);line=word}else line=n}if(line)ls.push(line);
 ls.slice(0,maxLines).forEach((t,i)=>fitted(ctx,t,x,y+i*fontSize*1.2,maxW,fontSize));
}
async function exportPng(options={}){
 const c=state.creatives?.[0];if(!c){toast('Gere uma arte primeiro.');return}
 const dims=FORMATS[c.ratio]||FORMATS['1:1'],w=dims[0],h=dims[1],land=c.ratio==='16:9',brand=state.data.brand||{};
 try{
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponível');
  const accent=/^#[0-9a-f]{6}$/i.test(brand.accent||'')?brand.accent:'#eab258';
  ctx.fillStyle='#17120d';ctx.fillRect(0,0,w,h);
  const photo=await loadImageSafe(imageSource(recipe(c.id))),pw=land?Math.round(w*.54):w,ph=land?h:Math.round(h*(c.ratio==='1:1'?.38:c.ratio==='4:5'?.48:.54));
  if(photo){
   const scale=Math.max(pw/photo.width,ph/photo.height),iw=photo.width*scale,ih=photo.height*scale;
   ctx.save();ctx.beginPath();ctx.rect(0,0,pw,ph);ctx.clip();ctx.drawImage(photo,(pw-iw)/2,(ph-ih)/2,iw,ih);ctx.restore();
  }else{ctx.fillStyle='#473020';ctx.fillRect(0,0,pw,ph);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='40px Arial';ctx.fillText('Foto não cadastrada',pw/2,ph/2)}
  const x=land?Math.round(w*.76):w/2,width=land?780:w-100,top=land?140:ph+60;
  ctx.fillStyle='#211810e8';ctx.fillRect(25,25,Math.min(w-50,land?990:1030),112);
  const logo=await loadImageSafe(brand.logoUrl||'');
  if(logo){ctx.save();ctx.beginPath();ctx.arc(87,81,45,0,Math.PI*2);ctx.clip();ctx.drawImage(logo,42,36,90,90);ctx.restore()}
  ctx.textAlign='left';ctx.fillStyle='#fff8ed';fitted(ctx,clean(brand.name||'Minha empresa',55).toLocaleUpperCase('pt-BR'),logo?158:60,101,logo?810:910,48,22);
  ctx.textAlign='center';ctx.fillStyle=accent;lines(ctx,c.headline||'PROMOÇÃO DO DIA',x,top,width,land?48:46,2);
  ctx.fillStyle='#fff8ed';lines(ctx,c.name,x,top+(land?140:108),width,land?57:53,2);
  ctx.fillStyle='#e8d1b2';lines(ctx,c.body||'',x,top+(land?275:215),width,land?32:31,3);
  const priceY=land?730:Math.round(h*.86),oldY=priceY-128;
  ctx.fillStyle='#cbb7a1';fitted(ctx,'DE '+money(c.old),x,oldY,width,36,24);
  ctx.fillStyle=accent;fitted(ctx,money(c.sale),x,priceY,width,land?114:110,51);
  ctx.fillStyle='#fff8ed';fitted(ctx,c.cta||'PEÇA PELO WHATSAPP',x,Math.min(h-50,priceY+90),width,land?31:28,18);
  if(brand.phone){ctx.fillStyle='#e1c6a7';fitted(ctx,clean(brand.phone,35),x,Math.min(h-20,priceY+140),width,23,16)}
  const blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(Error('PNG indisponível')),'image/png'));
  if(options.galleryOnly){const saved=await window.POTE_GALLERY?.saveImageBlob(blob,{title:c.name,source:'Criativos'});toast(saved?'Arte salva na galeria por 42 horas!':'Arte criada, mas não foi possível salvar na galeria.');return}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='criativo-'+c.id+'-'+c.ratio.replace(':','x')+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('PNG exportado: '+w+'×'+h);
 }catch(error){console.error('Creative Studio:',error);toast('Falha ao exportar. Verifique a foto do produto.')}
}
window.copyCreativeCaption=function(){const c=state.creatives?.[0];if(!c){toast('Gere uma arte primeiro.');return}navigator.clipboard?.writeText(caption(c)).then(()=>toast('Legenda copiada!')).catch(()=>toast('Não foi possível copiar a legenda.'))};
pageCreative=page;
creativeHTML=card;
generateCreative=generate;
downloadCreative=exportPng;
})();

