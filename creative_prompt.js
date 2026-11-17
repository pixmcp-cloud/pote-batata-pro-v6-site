/* Prompt para IA: gerado 100% no navegador com dados reais do Estúdio. */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const clean=(s,max=170)=>String(s??'').trim().slice(0,max).replace(/[\u0000-\u001f]/g,' ');
const currency=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v).replace(/\u00a0/g,' ');
const sizes={'9:16':'1080 × 1920','1:1':'1080 × 1080','4:5':'1080 × 1350','16:9':'1920 × 1080'};
function source(){
 if(typeof window.POTE_CREATIVE_PROMPT_READ!=='function')return {error:'O Estúdio de Criativos ainda não carregou.'};
 try{return window.POTE_CREATIVE_PROMPT_READ()}catch(err){console.warn('Prompt — erro ao ler a campanha',err);return {error:'Não foi possível ler o produto. Reabra Criativos.'}}
}
function writeStatus(message){
 const text=el('csPromptStatus');if(text)text.textContent=message;
}
function notice(message){if(typeof toast==='function')toast(message)}
const SCENES={
 slate:{
  label:'Pedra escura premium',
  scene:'Coloque o recipiente original sobre uma placa retangular de ardósia preta fosca, levemente elevada sobre uma bancada de estúdio antracite. Fundo seamless cinza-carvão com gradiente discreto, distante e desfocado. Sombra real de contato sob a ardósia, sem ambiente de cozinha.'
 },
 travertine:{
  label:'Pedra clara natural',
  scene:'Coloque o recipiente sobre uma base de travertino bege claro com textura mineral autêntica e bordas delicadas, sobre superfície de estúdio marfim. Fundo areia neutro desfocado, luz dourada suave, cenário editorial gastronômico minimalista.'
 },
 board:{
  label:'Madeira artesanal',
  scene:'Coloque o recipiente sobre uma tábua de madeira nogueira natural, limpa, bem acabada e proporcional ao produto. Mesa de madeira escura fosca e fundo marrom profundo desfocado. Visual de restaurante artesanal premium sem poluição de acessórios.'
 },
 tray:{
  label:'Bandeja preta',
  scene:'Coloque o recipiente sobre uma bandeja circular de metal preto fosco premium, apoiada numa superfície de estúdio neutra. Fundo grafite escuro seamless, bandeja com borda fina, reflexos controlados e sombra de contato convincente.'
 },
 neutral:{
  label:'Pedestal minimalista',
  scene:'Coloque o recipiente sobre um pequeno pedestal cilíndrico bege fosco de fotografia de produto, com proporções naturais. Fundo off-white quente seamless, cenário clean premium e sombra curta suave realista.'
 }
};
const ANGLES={
 threeQuarter:'Reposicione virtualmente a câmera para 35–40 graus acima da mesa, enquadramento três quartos frontal; a comida mostra superfície e volume do recipiente. Simulação realista de uma nova fotografia com lente 50–70 mm, sem deformação da embalagem.',
 low:'Câmera baixa, aproximadamente 20–25 graus acima da mesa, lente 50–70 mm. Mostre a altura da porção e mantenha os ingredientes visíveis na superfície; sem exagerar o tamanho do recipiente.',
 top:'Câmera levemente superior a 50–55 graus, lente 50–70 mm, suficientemente inclinada para mostrar a comida e a lateral do recipiente, sem virar uma foto aérea plana.'
};
const LIGHTS={
 appetizing:'Luz principal softbox grande a 45 graus pela esquerda, balanço de branco quente moderado (aprox. 5000 K), rebatedor suave à direita, recorte discreto atrás. Cores gastronômicas naturais e vivas: milho amarelo realista, bacon dourado, queijo com textura, verdes frescos sem neon. Contraste médio-alto, microtextura fina, brilho controlado, sombra física macia.',
 clean:'Iluminação editorial clara com softbox amplo na diagonal, preenchimento neutro e fundo limpo. Branco balanceado, saturação comedida, contraste natural, alimentos frescos, textura real, sombras de contato e destaques sem estourar.',
 dramatic:'Iluminação editorial dramática controlada, key light quente lateral e rim light fino, fundo escuro elegante, luz de preenchimento suficiente para preservar ingredientes. Pretos profundos sem perder detalhes; cores apetitosas naturais, sem HDR.'
};
function buildPrompt(c,mode){
 const format=clean(c.ratio,12),dims=sizes[format]||'resolução compatível';
 const name=clean(c.name,100),brandName=clean(c.brand.name||'Minha empresa',75);
 const photoOnly=mode==='photo';
 const stage=SCENES[el('csPromptScene')?.value]||SCENES.slate;
 const angle=ANGLES[el('csPromptAngle')?.value]||ANGLES.threeQuarter;
 const light=LIGHTS[el('csPromptLight')?.value]||LIGHTS.appetizing;
 const flavors=(c.ingredients||[]).filter(Boolean).slice(0,4).map(x=>clean(x,45));
 const sceneFacts=flavors.length?'Ingredientes confirmados: '+flavors.join(', ')+'.':'Os ingredientes não estão descritos na ficha: respeite somente o que aparece na foto.';
 const shot= [
  'FOTOGRAFIA DE CAMPANHA GASTRONÔMICA — PRODUÇÃO DE ESTÚDIO',
  '',
  'Use a FOTO DO PRODUTO ANEXADA como referência da comida e do recipiente, NÃO como cenário final. RECONSTRUA UMA NOVA FOTOGRAFIA PUBLICITÁRIA: recorte o produto e SUBSTITUA COMPLETAMENTE a bancada de inox, a mesa e o fundo da foto original por uma plataforma de fotografia profissional.',
  '',
  'PRODUTO: '+name+'. '+sceneFacts,
  'DIREÇÃO DE CENÁRIO OBRIGATÓRIA: '+stage.scene,
  'ÂNGULO E CÂMERA: '+angle,
  'ILUMINAÇÃO E COR: '+light,
  '',
  'COMPOSIÇÃO  '+format+' ('+dims+'): recipiente e alimento como protagonistas, ocupando cerca de 65–75% da área principal, perspectiva tridimensional convincente, contato físico real com a plataforma, fundo desfocado e área de respiro para uma campanha. Mostre textura cremosa, dourado e ingredientes REAIS, sem exageros.',
  'FIDELIDADE: preserve exatamente o tipo de alimento, a porção, os recheios, a distribuição e o recipiente presentes na foto. Pode mudar ângulo, cenário e luz de modo fotográfico plausível; não invente partes ocultas, cobertura nova, ingredientes extras ou recipiente de outro tipo.',
  'NEGATIVOS: NUNCA manter a bancada industrial/cinza, inox do fundo, pia, azulejos ou ambiente de preparo da imagem original. Nada de foto de celular sem tratamento, visão aérea plana, composição de catálogo amador, aparência plástica, render 3D, HDR excessivo, saturação neon, vapor falso, objetos decorativos que pareçam comida ou montagem de duas imagens.',
  'REFERÊNCIA: estética de campanha de restaurante premium com food styling natural, fotografia realista de produto, profundidade de campo moderada. O fundo deve ser claramente DIFERENTE do original.',
  ''
 ];
 if(photoOnly){
  shot.push('MODO FOTOGRAFIA LIMPA (RECOMENDADO): ENTREGUE SOMENTE A FOTO NOVA, SEM QUALQUER TEXTO, PREÇO, LOGOTIPO, WHATSAPP, RÓTULO OU ELEMENTO GRÁFICO. A arte final com marca e preço será feita no editor original para evitar erros de escrita.');
 }else{
  shot.push(
   'MODO ANÚNCIO — DIREÇÃO DE ARTE COM POUCOS TEXTOS:',
   'A fotografia reconstruída deve continuar dominando a peça (mínimo 70% de impacto visual). NÃO coloque parágrafos ou listas de ingredientes na imagem. A descrição abaixo serve de referência editorial, não deve ser impressa na peça.',
   'Marca em uma única linha discreta: '+brandName,
   'Título pequeno no topo: '+clean(c.headline,90),
   'Produto em destaque: '+name,
   c.showPrice?'Preço principal em bloco limpo e legível: '+currency(c.priceAd):'NÃO mostrar nenhum preço.',
   c.showPrice&&c.showOld?'Preço anterior menor e riscado: '+currency(c.priceNormal):'NÃO adicionar preço antigo.',
   c.showCta?'Chamada curta no rodapé: '+clean(c.cta,70):'NÃO incluir CTA.',
   c.showPhone&&c.brand.phone?'Telefone pequeno no rodapé: '+clean(c.brand.phone,45):'NÃO incluir telefone.',
   c.showLogo?'Use logomarca SOMENTE se o arquivo original for enviado separadamente; sem ele escreva o nome da marca.':'NÃO incluir logotipo.',
   'Tipografia elegante, no máximo cinco blocos discretos, margem de segurança e contraste alto. Nunca cobrir o alimento com letras. NÃO repetir o mesmo texto em locais diferentes. NÃO escrever o número do preço em formato incorreto.'
  );
 }
 shot.push(
  '',
  'REFERÊNCIA COMERCIAL: '+clean(c.campaignName,80)+' | '+clean(c.styleName,90)+'. Texto interno da ficha (NÃO imprimir): '+clean(c.description,170),
  'RESULTADO: UMA única imagem realista em '+format+'. Se a IA não conseguir mudar o ângulo mantendo fidelidade ao alimento, conserve a geometria do prato e priorize a nova plataforma, a nova luz e o novo fundo. Não use logotipos inventados.',
  'Envie a FOTO ORIGINAL manualmente junto com este comando; o texto não contém a imagem.'
 );
 return shot.join('\n');
}
async function copyPrompt(text){
 if(!text)return false;
 if(navigator.clipboard&&typeof navigator.clipboard.writeText==='function'){
  try{await navigator.clipboard.writeText(text);return true}catch(err){void err}
 }
 const output=el('csPromptText');
 if(!output)return false;
 let success=false;
 try{output.focus();output.select();success=Boolean(document.execCommand?.('copy'))}catch(_){}
 // Do not leave the textarea blue-selected and scrolled to the end when mobile blocks copy.
 try{output.setSelectionRange?.(0,0);output.scrollTop=0;output.blur?.()}catch(_){}
 return success;
}
function renderPrompt(){
 const c=source();if(c.error){notice(c.error);return null}
 const box=el('csPromptPanel'),out=el('csPromptText');
 if(!box||!out){notice('Abra a aba Criativos novamente.');return null}
 const mode=el('csPromptMode')?.value||'ad';
 const result=buildPrompt(c,mode);
 out.value=result;box.hidden=false;
 return result;
}
window.creativeOpenPrompt=async function(){
 const prompt=renderPrompt();if(!prompt)return false;
 const copied=await copyPrompt(prompt);
 const message=copied?'Prompt copiado. Baixe a foto e anexe-a na IA.':'Prompt gerado. Copie manualmente se o navegador bloquear o acesso.';
 writeStatus(message);notice(message);
 el('csPromptPanel')?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 return true;
};
window.creativeCopyPrompt=async function(){
 const prompt=renderPrompt();if(!prompt)return false;
 const copied=await copyPrompt(prompt);
 writeStatus(copied?'Prompt atualizado e copiado.':'Copie o texto manualmente: a área de transferência foi bloqueada.');
 notice(copied?'Prompt copiado.':'Prompt pronto para copiar.');
 return copied;
};
window.creativeClosePrompt=function(){
 const panel=el('csPromptPanel');if(panel)panel.hidden=true;
};
window.creativeDownloadPhoto=async function(){
 const c=source();if(c.error){notice(c.error);return false}
 const src=c.source;
 if(!src){notice('Este produto não tem foto cadastrada. Anexe uma imagem à receita primeiro.');return false}
 try{
  const image=await new Promise((resolve,reject)=>{
   const img=new Image();
   if(/^https?:\/\//i.test(src))img.crossOrigin='anonymous';
   img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Foto inacessível'));img.src=src;
  });
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,2400/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error('Falha na conversão')),'image/png'));
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='foto-produto-'+clean(String(c.id),55).replace(/[^a-zA-Z0-9_-]/g,'')+'.png';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  writeStatus('Foto original baixada sem retoques. Anexe-a no Gemini junto com o prompt.');
  notice('Foto baixada. Anexe-a à IA para criar a arte.');
  return true;
 }catch(error){
  console.warn('Falha ao baixar imagem original',error);
  notice('Não foi possível baixar esta foto. Abra a ficha do produto e salve a imagem original.');
  return false;
 }
};
const changeControls=new Set([
 'creativeRecipe','creativeRatio','csStyle','csCampaign','csPhotoFocus',
 'creativeOld','creativeSale','creativeHeadline','creativeBody','creativeCta',
 'csPromptScene','csPromptAngle','csPromptLight',
 'csShowPrice','csShowOld','csShowPhone','csShowLogo','csShowCta','csPromptMode'
]);
function onPromptFormChange(event){
 const id=event.target?.id,panel=el('csPromptPanel');
 if(!changeControls.has(id)||!panel||panel.hidden)return;
 const current=source();
 if(current.error){writeStatus(current.error);return}
 const mode=el('csPromptMode')?.value||'ad';
 const output=el('csPromptText');
 if(output){output.value=buildPrompt(current,mode);output.scrollTop=0;}
 writeStatus('Prompt atualizado com o formulário. Toque em Copiar prompt para copiar a nova versão.');
}
document.addEventListener('change',onPromptFormChange);
document.addEventListener('input',onPromptFormChange);
})();
