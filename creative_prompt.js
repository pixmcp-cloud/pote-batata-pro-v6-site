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
function buildPrompt(c,mode){
 const ingredients=c.ingredients?.length?c.ingredients.map(x=>clean(x,35)).join(', '):'Não informados; não invente ingredientes.';
 const brandName=clean(c.brand.name||'Marca não cadastrada',80);
 const format=clean(c.ratio,12),dims=sizes[format]||'proporção personalizada';
 const photoOnly=mode==='photo';
 const photoFocus=c.photoFocus==='food'?
  'Close da comida: destacar cobertura, recheio e texturas reais. Se existir logomarca antiga visível na embalagem, prefira enquadrá-la para fora sem falsificar a foto.':
  c.photoFocus==='center'?'Produto centralizado com equilíbrio entre alimento e fundo.':'Manter o enquadramento natural da fotografia.';
 const textLines=photoOnly?
  ['SEM TEXTO: não incluir título, nome, preços, CTA, telefone, letras, ícones comerciais ou logotipos. Entregar apenas uma fotografia publicitária limpa; o texto será composto depois no editor.']:
  [
   'TEXTO OBRIGATÓRIO E LITERAL NA ARTE (português do Brasil):',
   'Nome da marca: '+brandName,
   'Título: '+clean(c.headline,90),
   'Produto: '+clean(c.name,100),
   'Descrição: '+clean(c.description,170),
   c.showPrice?'Preço atual: '+currency(c.priceAd):'Não mostrar valores nem etiquetas de preço.',
   c.showPrice&&c.showOld?'Preço anterior, menor e riscado: '+currency(c.priceNormal):'Não mostrar preço antigo nem simular descontos.',
   c.showCta?'Chamada para ação: '+clean(c.cta,80):'Não incluir chamada para ação.',
   c.showPhone&&c.brand.phone?'Telefone/WhatsApp: '+clean(c.brand.phone,50):'Não mostrar telefone.',
   c.showLogo?'Caso o arquivo original da logomarca seja enviado como SEGUNDA imagem, usar somente essa logomarca, sem redesenhar. Caso não tenha sido enviada, usar apenas o nome da marca escrito.':'Não usar logotipo gráfico.',
   'Hierarquia clara: fotografia > nome do produto > preço (se houver) > descrição > chamada. Tipografia comercial legível e margens seguras.',
   'Não escrever textos extras, nomes fictícios, promoções não informadas ou palavras aleatórias.'
  ];
 return [
  'DIREÇÃO DE ARTE PROFISSIONAL — CAMPANHA GASTRONÔMICA',
  '',
  'TAREFA: crie UMA imagem publicitária usando a FOTO REAL DO PRODUTO ANEXADA pelo usuário. A foto é a referência visual obrigatória. Não substitua por produto genérico.',
  '',
  'BRIEFING:',
  'Marca: '+brandName,
  'Produto: '+clean(c.name,100),
  'Campanha: '+clean(c.campaignName,70),
  'Descrição aprovada: '+clean(c.description,170),
  'Ingredientes documentados na ficha: '+ingredients,
  'Formato EXATO: '+format+' ('+dims+' pixels como resolução de referência).',
  'Identidade e direção visual: '+clean(c.styleName,80)+'. Fotografia gastronômica fotorrealista, luz de estúdio suave, textura real, sombras naturais, acabamento editorial sofisticado e composição com alto apelo comercial.',
  '',
  'FIDELIDADE INEGOCIÁVEL:',
  '- Manter o mesmo produto, porção, embalagem, tipo de preparo e ingredientes que aparecem na fotografia. Não inventar coberturas, molhos, utensílios, sabores ou marcas.',
  '- Valorizar os detalhes da comida por enquadramento, profundidade, luz e contraste sem alterar a identidade do produto.',
  '- '+photoFocus,
  '- Não gerar desenho, produto plástico, estética de videogame ou aparência genérica de IA.',
  '- Não fazer montagem com duas fotos, moldura de celular, selo de IA, assinatura ou marca d’água.',
  '',
  ...textLines,
  '',
  'RESULTADO:',
  'Uma única arte para divulgação comercial nas redes sociais. Layout limpo, contraste elegante, produto valorizado e proporção '+format+'.',
  'Se não conseguir reproduzir preço e texto com precisão, gere a versão fotográfica limpa em vez de publicar informação errada.',
  'Não invente ingredientes, preços, telefones ou depoimentos. Não altere o logotipo do negócio.',
  '',
  'OBSERVAÇÃO: a foto não vem embutida neste prompt. O usuário deve ANEXAR a foto original manualmente na IA escolhida.'
 ].join('\n');
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
