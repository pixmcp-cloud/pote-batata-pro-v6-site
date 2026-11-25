/* Potê Batata Pro — Estúdio de Criativos (offline, sem APIs pagas).
   A fonte do preço é a função oficial de precificação sellPrice(recipe,'direto').
   Nenhum preço promocional ou ingrediente é inventado. */
(function(){
'use strict';
const FORMATS={'1:1':[1080,1080],'9:16':[1080,1920],'4:5':[1080,1350],'16:9':[1920,1080]};
const CAMPAIGNS={
 oferta:{label:'Oferta do dia',headline:'OFERTA DO DIA',cta:'PEÇA PELO WHATSAPP'},
 lancamento:{label:'Lançamento',headline:'ACABOU DE CHEGAR',cta:'EXPERIMENTE ESSA NOVIDADE'},
 sabor:{label:'Destaque do sabor',headline:'O SABOR DA VEZ',cta:'FAÇA SEU PEDIDO'},
 combo:{label:'Combo',headline:'MOMENTO COMBO',cta:'MONTE SEU PEDIDO'},
 story:{label:'Story rápido',headline:'BATEU A FOME?',cta:'CHAMA NO WHATSAPP'},
 especial:{label:'Data especial',headline:'HOJE MERECE UM SABOR ESPECIAL',cta:'GARANTA O SEU'}
};
const STYLES={premium:'Noite dourada',fresh:'Verde sofisticado',clean:'Editorial claro'};
const PHOTO_FOCUS={food:'Close no sabor',center:'Centralizado',full:'Enquadramento normal'};
const $=id=>document.getElementById(id);
const safe=(v,max=160)=>String(v??'').trim().slice(0,max);
const esc=v=>escapeHtml(String(v??''));
const chosen=(id,d='')=>$(id)?.value??d;
const flag=(c,key,def=true)=>typeof c?.[key]==='boolean'?c[key]:def;
const amount=n=>Number.isFinite(n)?n:0;
const formPrice=n=>n>0?n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
function parseMoney(v){
 if(typeof v==='number')return Number.isFinite(v)?v:NaN;
 let s=String(v??'').trim().replace(/[^\d,.-]/g,'');
 if(!s)return NaN;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0){
  if(comma>dot)s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/,/g,'');
 }else if(comma>=0)s=s.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
 const n=Number(s);return Number.isFinite(n)?n:NaN;
}
function productPrice(r){
 if(!r)return 0;
 // Official pricing calculation used in the app's Recipes, PDV and Price screens.
 if(typeof sellPrice==='function'){
  try{const n=Number(sellPrice(r,'direto'));if(Number.isFinite(n)&&n>0)return n}catch(e){console.warn('Preço da ficha indisponível',e)}
 }
 const candidates=[r.sellPrice,r.precoVenda,r.sellingPrice,r.salePrice,r.price,r.preco,r.pricing?.sale,r.pricing?.sellPrice];
 for(const v of candidates){const n=parseMoney(v);if(n>0)return n}
 return 0;
}
function getRecipe(id){return typeof recipe==='function'?recipe(id):state.data.recipes.find(x=>String(x.id)===String(id))}
function catalog(){return (state.data.recipes||[]).filter(r=>typeof allowed==='function'?allowed(r):true)}
function featuredIngredients(r){
 const refs=(r?.items||r?.ingredients||[]),inventory=state.data.ingredients||[];
 const excluded=/^(?:batata(?:\s|$)|sal(?:\s|$)|tempero(?:\s|$)|água(?:\s|$)|agua(?:\s|$)|óleo(?:\s|$)|oleo(?:\s|$)|leite(?:\s|$)|manteiga(?:\s|$)|azeite(?:\s|$)|pimenta(?:\s|$)|açúcar(?:\s|$)|acucar(?:\s|$))/i;
 const seen=new Set();
 return refs.map(it=>{
  if(typeof it==='string')return inventory.find(i=>String(i.id)===String(it))?.name||it;
  const entry=inventory.find(i=>String(i.id)===String(it?.id||it?.ingredientId));
  return String(entry?.name||it?.name||'');
 }).map(x=>safe(x,40).replace(/\s*\(.*?\)\s*/g,'').trim())
  .filter(x=>{const k=x.toLocaleLowerCase('pt-BR');if(!k||excluded.test(k)||seen.has(k))return false;seen.add(k);return true})
  .slice(0,4);
}
function ingredientsPhrase(names){
 if(names.length===1)return names[0];
 if(names.length===2)return names[0]+' e '+names[1];
 return names.slice(0,-1).join(', ')+' e '+names[names.length-1];
}
function descriptionFor(r){
 const name=safe(r?.name||'Nosso sabor',70),n=name.toLocaleLowerCase('pt-BR'),parts=featuredIngredients(r);
 const tagline=safe(r?.tagline||r?.description||'',110).replace(/[.!?]+$/,'').trim();
 // The chef's own tagline wins: never append a shopping-list of salt, starch and
 // generic seasonings to a well-written headline.
 if(tagline&&tagline.length>=12)return safe(tagline+'.',160);
 if(parts.length>=2){
  const names=parts.slice(0,3),phrase=ingredientsPhrase(names);
  return safe('O encontro de '+phrase+' em uma combinação cheia de sabor.',160);
 }
 if(parts.length===1)return safe('Uma combinação com '+parts[0]+', feita para surpreender.',160);
 if(tagline)return safe(tagline+'.',160);
 if(/milho/.test(n)&&/bacon/.test(n))return 'O toque doce do milho com a crocância do bacon.';
 if(/morango/.test(n)&&/chocolate/.test(n))return 'Chocolate e morango juntos em uma sobremesa especial.';
 if(/frango/.test(n))return 'Frango em uma receita que merece a próxima colherada.';
 return 'Descubra o sabor de '+name+'.';
}
function copyFor(r,campaign='oferta'){
 const data=CAMPAIGNS[campaign]||CAMPAIGNS.oferta;
 const name=safe(r?.name||'NOSSO SABOR',70),head=data.headline;
 return {headline:head,body:descriptionFor(r),cta:data.cta,name};
}
function color(c){
 if(c.style==='fresh')return {bg:'#102c24',ink:'#fff9eb',accent:'#bfe5b6',muted:'#e2eadc',shade:'#0c211c'};
 if(c.style==='clean')return {bg:'#f2e9d9',ink:'#263329',accent:'#2b7252',muted:'#485c4c',shade:'#efe4d0'};
 return {bg:'#110f10',ink:'#fff5e4',accent:'#f4c773',muted:'#e1d0bc',shade:'#151013'};
}
function getActive(){return state.creatives?.[0]||null}
function boxCheck(text,id,yes){
 return '<label class="cs-toggle"><input type="checkbox" id="'+id+'" '+(yes?'checked':'')+'><span>'+esc(text)+'</span></label>';
}
function notify(msg){if(typeof toast==='function')toast(msg)}
function page(){
 const all=catalog(),opts=all.map(r=>[r.id,r.name]),existing=getActive();
 const locked=typeof pro==='function'&&!pro()&&state.freeCreativeRecipeId;
 const id=locked||existing?.id||opts[0]?.[0]||'';
 const r=getRecipe(id),current=existing?.id===id?existing:null;
 const campaign=current?.campaign||'oferta',p=copyFor(r,campaign);
 const base=productPrice(r),standard=base>0?base:(current?.old||0);
 const priceChanged=!!current&&base>0&&Math.abs(current.old-base)>.009;
 const sale=current?(priceChanged&&Math.abs(current.sale-current.old)<.009?base:current.sale):base;
 const showOld=flag(current,'showOld',false)&&standard>sale;
 const showPrice=flag(current,'showPrice',true);
 const actions='<div class="actions cs-actionbar"><button class="btn" type="button" onclick="generateCreative()">Gerar arte</button>'+
  '<button class="btn line" type="button" onclick="creativeAutoCopy()">Novo texto sugerido</button>'+
  '<button class="btn line cs-prompt-button" type="button" onclick="creativeOpenPrompt()">✦ Prompt para IA grátis</button>'+
  '<button class="btn line" type="button" onclick="window.POTE_GALLERY?.open()">Galeria · 42 horas</button>'+
  (existing?'<button class="btn line" type="button" onclick="downloadCreative()">Baixar PNG</button><button class="btn line" type="button" onclick="copyCreativeCaption()">Copiar legenda</button>':'')+'</div>';
 const idSelected=esc(id);
 return '<section class="box creative-studio">'+
 '<div class="cs-section-title"><div><small>ESTÚDIO DE CAMPANHAS</small><h2>Faça o sabor vender pela imagem.</h2><p>Fotos reais, texto da receita e preço da precificação. Sem gerar custo de IA.</p></div><span class="cs-label">ESTÚDIO PRO</span></div>'+
 (!pro()?'<p class="cs-note">Plano Free: um produto, com alterações e downloads ilimitados.</p>':'')+
 '<div class="cs-grid">'+
 select('Produto / sabor','creativeRecipe',opts,id)+
 select('Tipo de campanha','csCampaign',Object.entries(CAMPAIGNS).map(([k,v])=>[k,v.label]),campaign)+
 select('Identidade da campanha','csStyle',Object.entries(STYLES),current?.style||'premium')+
 select('Formato da arte','creativeRatio',[['9:16','Stories 1080 × 1920'],['1:1','Feed quadrado 1080 × 1080'],['4:5','Feed vertical 1080 × 1350'],['16:9','Horizontal 1920 × 1080']],current?.ratio||'9:16')+
 select('Enquadramento da foto','csPhotoFocus',Object.entries(PHOTO_FOCUS),current?.photoFocus||'food')+
 field('Preço atual do produto (R$)','creativeOld',formPrice(standard),'text','inputmode="decimal" autocomplete="off"')+
 field('Preço para divulgar (R$)','creativeSale',formPrice(sale),'text','inputmode="decimal" autocomplete="off"')+
 '</div><div class="cs-pricing-tools"><p><strong>Preço oficial:</strong> <span id="csCurrentPrice">'+(base>0?money(base):'Não disponível')+'</span> · venda direta <small>(calculado da ficha)</small></p>'+
 '<div class="cs-discount"><button type="button" onclick="creativeDiscount(5)">−5%</button><button type="button" onclick="creativeDiscount(10)">−10%</button><button type="button" onclick="creativeDiscount(15)">−15%</button><button type="button" onclick="creativeDiscount(0)">Sem desconto</button></div></div>'+
 '<div class="cs-grid">'+
 field('Título da campanha','creativeHeadline',current?.headline||p.headline,'text','maxlength="90"')+
 field('Descrição exclusiva do sabor','creativeBody',current?.body||p.body,'text','maxlength="160"')+
 field('Chamada para compra','creativeCta',current?.cta||p.cta,'text','maxlength="70"')+
 '</div>'+
 '<fieldset class="cs-options"><legend>O que aparece na arte?</legend>'+
 boxCheck('Exibir preço','csShowPrice',showPrice)+
 boxCheck('Mostrar preço anterior','csShowOld',showOld)+
 boxCheck('Telefone / WhatsApp','csShowPhone',flag(current,'showPhone',true))+
 boxCheck('Logo da empresa','csShowLogo',flag(current,'showLogo',true))+
 boxCheck('Chamada para ação','csShowCta',flag(current,'showCta',true))+
 '</fieldset><p class="cs-price-hint" id="csPriceHint" aria-live="polite">Para anunciar desconto, escolha um percentual ou preencha um preço menor que o preço atual.</p>'+
 actions+
 '<section class="box cs-voice-studio" id="csVoiceStudio"><div class="cs-voice-heading"><div class="cs-voice-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></div><div><small>ESTÚDIO DE ÁUDIO · IA PREMIUM</small><h3>Locução profissional</h3><p>Transforme sua campanha em um anúncio falado.</p></div></div>'+
 '<div class="cs-voice-state" id="csVoiceState" role="status">Acesso controlado pelo ADM. Consulte sua autorização.</div><div class="cs-voice-quota" id="csVoiceQuota" hidden><div class="cs-voice-kicker">COTA MENSAL DA SUA FRANQUIA</div><div class="cs-voice-metrics"><div><small>Limite individual</small><strong id="csVoiceLimit">—</strong></div><div><small>Disponível</small><strong id="csVoiceRemaining">—</strong></div><div><small>Consumido / reservado</small><strong id="csVoiceUsed">—</strong></div></div><progress id="csVoiceProgress" max="1" value="0" aria-label="Consumo da cota individual"></progress><p id="csVoiceShare"></p></div>'+
 '<button type="button" class="btn line" onclick="window.POTE_VOICE_AI?.open()">Consultar acesso e gerar locução</button>'+
 '<div id="csVoiceForm" hidden><label class="cs-voice-field">Texto da locução<textarea id="csVoiceText" maxlength="777" rows="5"></textarea></label><small id="csVoiceChars">0 / 777 caracteres</small><label class="cs-voice-field">Voz<select id="csVoiceSelect"></select></label><p id="csVoiceQuote" aria-live="polite"></p><div class="actions"><button type="button" class="btn line" id="csVoicePrice">Calcular créditos</button><button type="button" class="btn" id="csVoiceGenerate" disabled>Confirmar e gerar MP3</button></div><audio id="csVoiceAudio" controls hidden></audio><a id="csVoiceDownload" class="btn line" download="locucao-pdv.mp3" hidden>Baixar locução</a></div></section>'+
 '<section id="csPromptPanel" class="cs-prompt-panel" hidden aria-label="Prompt publicitário para IA">'+
 '<div class="cs-prompt-head"><div><small>CAMINHO GRATUITO</small><h3>Crie sua arte com outra IA</h3></div><button type="button" class="cs-prompt-close" aria-label="Fechar" onclick="creativeClosePrompt()">×</button></div>'+
 '<p>Para produzir sua campanha com a sua marca, envie <strong>DUAS IMAGENS à IA</strong>: a foto real do produto e a logomarca original. O prompt pedirá para colocar a logo na arte, sem redesenhá-la.</p>'+
 '<div class="cs-prompt-steps"><span><b>1</b> Baixe a foto do produto</span><span><b>2</b> Baixe a logo da empresa</span><span><b>3</b> No Gemini, anexe as duas imagens e cole o prompt</span></div>'+
 select('Resultado para IA','csPromptMode',[['ad','Anúncio completo: foto, logo, descrição e preço'],['photo','Somente foto de estúdio + logo (sem descrição)']],'ad')+
 select('Direção visual da campanha','csPromptDesign',[
 ['impact','Impacto comercial · ouro e alto contraste (padrão)'],
 ['editorial','Editorial gastronômico sofisticado'],
 ['minimal','Minimalista premium']
 ],'impact')+
 select('Cenário e plataforma','csPromptScene',[
 ['campaign','Mesa escura + bokeh dourado (padrão)'],
 ['slate','Pedra preta + estúdio premium'],
 ['travertine','Pedra clara + luz quente'],
 ['board','Tábua de madeira + estilo artesanal'],
 ['tray','Bandeja preta + fundo editorial'],
 ['neutral','Pedestal bege + fundo minimalista']
 ],'campaign')+
 select('Ângulo da câmera','csPromptAngle',[
 ['threeQuarter','3/4 a 35° (recomendado)'],
 ['low','Ângulo baixo a 20°'],
 ['top','Levemente superior a 55°']
 ],'threeQuarter')+
 select('Cores e iluminação','csPromptLight',[
 ['campaign','Dourado comercial: intenso e natural'],
 ['appetizing','Quente natural, apetitoso'],
 ['clean','Luz clara de estúdio'],
 ['dramatic','Editorial dramático']
 ],'campaign')+
 '<p class="cs-prompt-tip"><strong>Padrão de campanha:</strong> fundo café escuro com luz âmbar, faixa promocional dourada, produto em tamanho grande e preço em selo de alto contraste. A IA aplica a logo original e somente os textos cadastrados. Use <strong>Somente foto</strong> para obter a cena sem elementos comerciais.</p>'+
 '<label class="cs-prompt-label" for="csPromptText">Prompt preparado para copiar</label>'+
 '<textarea id="csPromptText" rows="13" readonly spellcheck="false"></textarea>'+
 '<p id="csPromptStatus" class="cs-prompt-status" role="status" aria-live="polite"></p>'+
 '<div class="cs-prompt-actions"><button class="btn" type="button" onclick="creativeCopyPrompt()">Copiar prompt</button>'+
 '<button class="btn line" type="button" onclick="creativeDownloadPhoto()">Baixar foto original</button>'+
 '<button class="btn line" type="button" onclick="creativeDownloadLogo()">Baixar logomarca</button>'+
 '<a class="btn line" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">Abrir Gemini</a></div>'+
 '<small class="cs-prompt-help">Anexe a foto COMO PRIMEIRA IMAGEM e a logo COMO SEGUNDA IMAGEM. Depois cole o prompt. A logo precisa ser legível, com proporção e cores originais. Nenhum arquivo é enviado automaticamente. O Gemini pode impor limites gratuitos.</small>'+
 '</section>'+
 '<p class="help">O preço promocional não altera a precificação nem o PDV. Confira a oferta antes de compartilhar. Ingredientes descritos são extraídos da ficha cadastrada.</p>'+
 '</section><section class="box cs-preview"><div class="cs-preview-title"><div><small>PRÉVIA DA CAMPANHA</small><h3>O anúncio que seu cliente verá</h3></div></div>'+
 (existing?card(existing):'<div class="cs-placeholder"><strong>Seu anúncio começa aqui</strong><p>Escolha o produto e clique em Gerar arte. A foto original será usada no resultado.</p></div>')+
 '</section>';
}
function headlineBadge(c){return (CAMPAIGNS[c.campaign]||CAMPAIGNS.oferta).label.toLocaleUpperCase('pt-BR')}
function card(c){
 const b=state.data.brand||{},r=getRecipe(c.id),p=color(c);
 const old=flag(c,'showOld',false)&&c.old>c.sale&&flag(c,'showPrice',true)?'<s>DE '+money(c.old)+'</s>':'';
 const saved=c.old>c.sale&&flag(c,'showOld',false)?'<span class="cs-saving">ECONOMIZE '+money(c.old-c.sale)+'</span>':'';
 const logo=flag(c,'showLogo')&&b.logoUrl?'<img class="cs-logo" src="'+esc(b.logoUrl)+'" alt="">':'';
 const brand=esc(b.name||'Minha empresa');
 const image=r?img(r):'';
 return '<div class="cs-poster cs-'+esc(c.style||'premium')+'" style="--cs-bg:'+p.bg+';--cs-ink:'+p.ink+';--cs-accent:'+p.accent+';aspect-ratio:'+({'9:16':'9/16','4:5':'4/5','16:9':'16/9'}[c.ratio]||'1/1')+'">'+
 '<div class="cs-photo cs-focus-'+esc(c.photoFocus||'food')+'">'+image+'</div><div class="cs-shadow"></div>'+
 '<div class="cs-brand">'+logo+'<span>'+brand+'</span></div>'+
 '<div class="cs-story"><span class="cs-eyebrow">'+esc(c.headline||headlineBadge(c))+'</span>'+
 '<h3>'+esc(c.name)+'</h3><p>'+esc(c.body||'')+'</p>'+
 '<div class="cs-price-area">'+old+(flag(c,'showPrice')?'<strong>'+money(c.sale)+'</strong>':'')+saved+'</div>'+
 (flag(c,'showCta')?'<div class="cs-cta">'+esc(c.cta||'FAÇA SEU PEDIDO')+'</div>':'')+
 (flag(c,'showPhone')&&b.phone?'<small class="cs-phone">'+esc(b.phone)+'</small>':'')+
 '</div></div><div class="cs-caption"><strong>Legenda pronta para compartilhar</strong><p>'+esc(caption(c)).replace(/\n/g,'<br>')+'</p></div>';
}
function caption(c){
 const b=state.data.brand||{};
 return [c.headline,c.name,c.body,flag(c,'showPrice')?
  (flag(c,'showOld')&&c.old>c.sale?'De '+money(c.old)+' por '+money(c.sale):'Por '+money(c.sale)):null,
  flag(c,'showCta')?c.cta:null,flag(c,'showPhone')?b.phone:null,
  b.instagram?'Instagram: '+b.instagram:null,b.name].filter(Boolean).join('\n');
}
function fillPriceForRecipe(){
 const r=getRecipe(chosen('creativeRecipe')),base=productPrice(r);
 if($('creativeOld'))$('creativeOld').value=formPrice(base);
 if($('creativeSale'))$('creativeSale').value=formPrice(base);
 if($('csShowOld'))$('csShowOld').checked=false;
 if($('csCurrentPrice'))$('csCurrentPrice').textContent=base>0?money(base):'Não disponível';
 if($('csPriceHint'))$('csPriceHint').textContent=base>0?'Preço oficial preenchido. Nenhum desconto aplicado automaticamente.':'Produto sem preço calculável. Revise a ficha de precificação.';
}
function refreshCopy(){
 const r=getRecipe(chosen('creativeRecipe')),p=copyFor(r,chosen('csCampaign','oferta'));
 for(const [id,v] of [['creativeHeadline',p.headline],['creativeBody',p.body],['creativeCta',p.cta]])
  if($(id))$(id).value=v;
}
function discount(n){
 const base=parseMoney(chosen('creativeOld'));
 if(!(base>0)){notify('Informe ou calcule o preço normal da receita.');return}
 const promotional=Math.round(base*(1-n/100)*100)/100;
 if($('creativeSale'))$('creativeSale').value=formPrice(promotional);
 if($('csShowOld'))$('csShowOld').checked=n>0;
 if($('csPriceHint'))$('csPriceHint').textContent=n>0?'Desconto de '+n+'% aplicado somente neste anúncio.':'Preço normal restaurado. Sem desconto.';
}
function generate(){
 if(window.POTE_ACCESS?.requireService?.('creatives')===false)return;
 const id=chosen('creativeRecipe'),r=getRecipe(id);
 if(!r||(typeof allowed==='function'&&!allowed(r))){notify('Produto não liberado para criativos.');return}
 if(!pro()&&state.freeCreativeRecipeId&&state.freeCreativeRecipeId!==id){notify('O plano Free permite reeditar apenas o primeiro produto.');return}
 const priceNormal=parseMoney(chosen('creativeOld')),priceAd=parseMoney(chosen('creativeSale'));
 const showPrice=!!$('csShowPrice')?.checked,showOld=!!$('csShowOld')?.checked;
 if(showPrice&&(!(priceAd>0)||!Number.isFinite(priceAd))){notify('Informe um preço de anúncio válido.');return}
 if(showPrice&&showOld&&(!(priceNormal>priceAd))){notify('Para mostrar o preço anterior, o preço do anúncio precisa ser menor.');return}
 const campaign=chosen('csCampaign','oferta'),style=chosen('csStyle','premium'),ratio=chosen('creativeRatio','9:16'),photoFocus=chosen('csPhotoFocus','food');
 if(!CAMPAIGNS[campaign]||!STYLES[style]||!FORMATS[ratio]||!PHOTO_FOCUS[photoFocus]){notify('Escolha uma campanha, estilo e formato válidos.');return}
 const suggested=copyFor(r,campaign);
 const c={id,name:r.name,campaign,style,ratio,photoFocus,old:amount(priceNormal),sale:amount(priceAd),
  headline:safe(chosen('creativeHeadline',suggested.headline)||suggested.headline,90),
  body:safe(chosen('creativeBody',suggested.body)||suggested.body,160),
  cta:safe(chosen('creativeCta',suggested.cta)||suggested.cta,70),
  showPrice,showOld,showPhone:!!$('csShowPhone')?.checked,showLogo:!!$('csShowLogo')?.checked,showCta:!!$('csShowCta')?.checked,
  freeUse:!pro()};
 state.creatives=[c];
 if(!pro()){state.freeCreativeRecipeId=id;state.freeCreativeCount=1}
 if(typeof persist==='function')persist();
 render();
 notify('Anúncio criado. Salvando na galeria.');
 void exportPng({galleryOnly:true});
}
function loadImage(src){
 return new Promise(resolve=>{
  if(!src)return resolve(null);
  const im=new Image();
  if(/^https?:\/\//i.test(src))im.crossOrigin='anonymous';
  im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;
 });
}
function cover(ctx,im,x,y,w,h,focus='full'){
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 if(focus==='food'){
  // Close-up of the prepared food, avoiding unrelated lettering on packaging.
  let sh=im.height*.52,sw=sh*w/h;
  if(sw>im.width){sw=im.width;sh=sw*h/w}
  ctx.drawImage(im,(im.width-sw)/2,0,sw,sh,x,y,w,h);
 }else{
  const scale=Math.max(w/im.width,h/im.height),iw=im.width*scale,ih=im.height*scale;
  const yShift=focus==='center'?Math.min(0,(h-ih)/2):0;
  ctx.drawImage(im,x+(w-iw)/2,y+yShift,iw,ih);
 }
 ctx.restore();
}
function round(ctx,x,y,w,h,r){
 ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
}
function fit(ctx,s,x,y,maxW,size,min=17){
 let n=size;const text=safe(s,160);
 while(n>min){ctx.font='900 '+n+'px system-ui,Arial';if(ctx.measureText(text).width<=maxW)break;n-=2}
 ctx.font='900 '+n+'px system-ui,Arial';ctx.fillText(text,x,y);
}
function wrapped(ctx,text,x,y,maxW,size,maxLines=2,spacing=1.2){
 const words=safe(text,175).split(/\s+/);
 let n=size,lines=[];
 do{
  lines=[];let line='';
  ctx.font='800 '+n+'px system-ui,Arial';
  for(const word of words){const next=line?line+' '+word:word;
   if(line&&ctx.measureText(next).width>maxW){lines.push(line);line=word}else line=next;
  }
  if(line)lines.push(line);
  if(lines.length<=maxLines||n<=18)break;n-=2;
 }while(true);
 const visible=lines.slice(0,maxLines);if(lines.length>maxLines&&visible.length)visible[visible.length-1]=visible[visible.length-1].slice(0,65)+'…';
 visible.forEach((line,i)=>fit(ctx,line,x,y+i*n*spacing,maxW,n,17));
 return visible.length;
}
async function exportPng(options={}){
 const c=getActive();if(!c){notify('Gere a arte primeiro.');return}
 const [w,h]=FORMATS[c.ratio]||FORMATS['9:16'],brand=state.data.brand||{},p=color(c);
 const isWide=c.ratio==='16:9',isSquare=c.ratio==='1:1',isFeed=c.ratio==='4:5';
 try{
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponível');
  ctx.fillStyle=p.bg;ctx.fillRect(0,0,w,h);
  const photo=await loadImage(typeof imageSource==='function'?imageSource(getRecipe(c.id)):'');
  const ph=isWide?h:Math.round(h*(isSquare?.57:isFeed?.57:.65)),pw=isWide?Math.floor(w*.62):w;
  if(photo)cover(ctx,photo,0,0,pw,ph,c.photoFocus||'food');
  else{
   ctx.fillStyle='#3d3730';ctx.fillRect(0,0,pw,ph);
   ctx.fillStyle='#fff2d4';ctx.font='30px system-ui';ctx.textAlign='center';
   ctx.fillText('Foto do produto não cadastrada',pw/2,ph/2);
  }
  if(isWide){
   const fade=ctx.createLinearGradient(w*.38,0,w*.66,0);
   fade.addColorStop(0,p.shade+'00');fade.addColorStop(1,p.bg);
   ctx.fillStyle=fade;ctx.fillRect(w*.38,0,w*.35,h);
  }else{
   const fade=ctx.createLinearGradient(0,ph-260,0,ph+160);
   fade.addColorStop(0,p.shade+'00');fade.addColorStop(1,p.bg);
   ctx.fillStyle=fade;ctx.fillRect(0,ph-260,w,420);
  }
  const logo=flag(c,'showLogo')?await loadImage(brand.logoUrl):null;
  const brandW=Math.min(w-80,isWide?980:1000);
  ctx.save();ctx.fillStyle='#0c1111d9';round(ctx,38,38,brandW,117,25);ctx.fill();ctx.restore();
  if(logo){ctx.save();ctx.beginPath();ctx.arc(104,96,43,0,Math.PI*2);ctx.clip();cover(ctx,logo,61,53,86,86);ctx.restore()}
  ctx.textAlign='left';ctx.fillStyle='#fff7e5';
  fit(ctx,(brand.name||'Minha empresa').toLocaleUpperCase('pt-BR'),logo?166:73,114,brandW-(logo?165:66),43,24);
  const cx=isWide?Math.floor(w*.79):Math.floor(w/2);
  const maxW=isWide?705:w-112;
  const y0=isWide?305:isSquare?586:isFeed?758:1190;
  ctx.textAlign='center';
  ctx.fillStyle=p.accent;fit(ctx,c.headline||headlineBadge(c),cx,y0,maxW,isWide?29:31,18);
  ctx.fillStyle=p.ink;
  wrapped(ctx,c.name,cx,y0+(isWide?92:83),maxW,isWide?70:isSquare?62:72,2,1.13);
  ctx.fillStyle=p.muted;
  wrapped(ctx,c.body,cx,y0+(isWide?223:isSquare?184:isFeed?199:218),maxW,isWide?28:isSquare?27:31,isSquare?2:3,1.17);
  const priceY=isWide?811:isSquare?934:isFeed?1165:1692;
  if(flag(c,'showPrice')){
   if(flag(c,'showOld')&&c.old>c.sale){ctx.fillStyle=p.muted;fit(ctx,'DE '+money(c.old),cx,priceY-119,maxW,37,22)}
   ctx.fillStyle=p.accent;fit(ctx,money(c.sale),cx,priceY,maxW,isWide?102:isSquare?90:115,52);
  }
  let ctaY=flag(c,'showPrice')?priceY+(isSquare?70:85):priceY-70;
  if(flag(c,'showCta')){
   const buttonW=Math.min(maxW,700),buttonH=isSquare?49:66;
   ctx.fillStyle=p.accent;round(ctx,cx-buttonW/2,ctaY-buttonH*.73,buttonW,buttonH,buttonH/2);ctx.fill();
   ctx.fillStyle=p.bg;fit(ctx,c.cta||'FAÇA SEU PEDIDO',cx,ctaY-4,buttonW-35,isSquare?24:28,17);
   ctaY+=isSquare?40:60;
  }
  if(flag(c,'showPhone')&&brand.phone){
   ctx.fillStyle=p.muted;fit(ctx,String(brand.phone),cx,Math.min(h-18,ctaY),maxW,24,17);
  }
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG indisponível')),'image/png'));
  if(options.galleryOnly){
   const save=window.POTE_GALLERY?.saveImageBlob;
   if(typeof save==='function'){
    const result=await save(blob,{title:c.name,source:'Criativos'});
    notify(result?'Arte salva na galeria por 42 horas.':'Arte criada, mas a galeria não confirmou o salvamento.');
   }else notify('Arte criada. Para salvar, use Baixar PNG.');
   return;
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='arte-'+safe(String(c.id),50).replace(/[^a-zA-Z0-9_-]/g,'')+'-'+c.ratio.replace(':','x')+'.png';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  notify('Arte PNG '+w+' × '+h+' exportada.');
 }catch(error){console.error('Creative Studio',error);notify('Não foi possível exportar a imagem. Confira a foto cadastrada.')}
}
window.POTE_CREATIVE_PROMPT_READ=function(){
 const id=chosen('creativeRecipe'),r=getRecipe(id);
 if(!r||(typeof allowed==='function'&&!allowed(r)))return {error:'Selecione um produto liberado no cardápio.'};
 if(typeof pro==='function'&&!pro()&&state.freeCreativeRecipeId&&state.freeCreativeRecipeId!==id)return {error:'O plano Free permite criar conteúdo apenas para o produto liberado.'};
 const ratio=chosen('creativeRatio','9:16'),campaign=chosen('csCampaign','oferta'),style=chosen('csStyle','premium');
 if(!FORMATS[ratio]||!CAMPAIGNS[campaign]||!STYLES[style])return {error:'Selecione formato e campanha válidos.'};
 const priceNormal=parseMoney(chosen('creativeOld')),priceAd=parseMoney(chosen('creativeSale'));
 const showPrice=!!$('csShowPrice')?.checked,showOld=!!$('csShowOld')?.checked;
 if(showPrice&&!(priceAd>0))return {error:'Verifique o preço do anúncio. O prompt não pode inventar valores.'};
 if(showPrice&&showOld&&!(priceNormal>priceAd))return {error:'O preço anterior deve ser maior que o preço do anúncio.'};
 const suggested=copyFor(r,campaign),brand=state.data.brand||{};
 return {id:r.id,name:r.name,ingredients:featuredIngredients(r),
  brand:{name:brand.name||'',phone:brand.phone||'',instagram:brand.instagram||'',hasLogo:!!brand.logoUrl,logoUrl:brand.logoUrl||''},
  ratio,campaignName:CAMPAIGNS[campaign].label,styleName:STYLES[style],
  headline:safe(chosen('creativeHeadline')||suggested.headline,90),
  description:safe(chosen('creativeBody')||suggested.body,160),
  cta:safe(chosen('creativeCta')||suggested.cta,70),
  priceNormal:amount(priceNormal),priceAd:amount(priceAd),showPrice,showOld,
  showPhone:!!$('csShowPhone')?.checked,showLogo:!!$('csShowLogo')?.checked,showCta:!!$('csShowCta')?.checked,
  photoFocus:chosen('csPhotoFocus','food'),
  source:typeof imageSource==='function'?imageSource(r):''};
};
window.copyCreativeCaption=async()=>{
 const c=getActive();if(!c){notify('Gere a arte primeiro.');return}
 try{await navigator.clipboard.writeText(caption(c));notify('Legenda copiada.')}
 catch{notify('Não foi possível copiar. Use a legenda exibida abaixo da prévia.')}
};
window.creativeDiscount=discount;
window.creativeAutoCopy=()=>{refreshCopy();notify('Texto sugerido da receita preenchido.');};
document.addEventListener('change',event=>{
 if(event.target?.id==='creativeRecipe'){fillPriceForRecipe();refreshCopy();}
 if(event.target?.id==='csCampaign'){refreshCopy();}
});
pageCreative=page;
creativeHTML=card;
generateCreative=generate;
downloadCreative=exportPng;
})();
