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
const DESIGNS={
 impact:{
  name:'CAMPANHA DE IMPACTO OURO / FOOD AD',
  direction:'Direção de arte de propaganda gastronômica de alta conversão: layout vibrante, luxuoso e moderno, preto espresso (#160e0b), dourado âmbar (#e8b955), amarelo de oferta (#ffc52f), toques vermelho queimado (#a5341c), branco limpo para leitura. Fundo marrom-escuro cinematográfico com bokeh quente de restaurante desfocado; tipografia bold, elegante e sem exageros. Evite apresentação de catálogo simples, arte cinza fria, título pequeno ou preço solto sem design.',
  banner:'Faixa de OFERTA com geometria editorial assimétrica em amarelo-dourado e lettering escuro/vermelho, posicionada no terço superior, nítida e sem cobrir o alimento.',
  price:'Selo de oferta preto profundo com contorno dourado fino, à direita no terço superior ou médio, preço antigo PEQUENO e riscado dentro do selo, preço atual ENORME e dourado com alinhamento profissional.',
  cta:'Rodapé com botão/placa de contorno dourado e ícone simples de contato, texto legível e telefone separado. Estética de anúncio de fast casual premium, não cartão genérico.'
 },
 editorial:{
  name:'EDITORIAL GASTRONÔMICO SOFISTICADO',
  direction:'Foto gastronômica premium com acabamento editorial, tipografia refinada, fundos profundos e quentes, uso econômico de dourado, grandes áreas de respiro e hierarquia rigorosa.',
  banner:'Linha de campanha editorial elegante, com destaque equilibrado e tipografia refinada.',
  price:'Selo de preço elegante, leitura imediata, contorno sutil e alinhamento cuidadoso.',
  cta:'Chamada final clara em pequena barra editorial com contato.'
 },
 minimal:{
  name:'MINIMALISMO COMERCIAL PREMIUM',
  direction:'Identidade gráfica clean de alto padrão, fundo neutro com profundidade, produto protagonista e alto contraste de leitura, sem excesso de elementos.',
  banner:'Etiqueta compacta de oferta de aspecto premium.',
  price:'Bloco único de preço, limpo e muito legível.',
  cta:'Chamada minimalista com contraste e margem generosa.'
 }
};
const SCENES={
 campaign:{
  label:'Cenário de campanha quente',
  scene:'Coloque o recipiente original sobre tábua ou pequena plataforma de madeira escura fosca e de alta qualidade. Plano de apoio espresso marrom profundo com textura sutil. Fundo de estúdio quase preto com luzes âmbar/douradas de restaurante fora de foco criando bokeh cinematográfico e profundidade. Evite cinza chapado, cozinha, parede sem graça e aparência de catálogo. Base com sombra real de contato.'
 },
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
 campaign:'Iluminação comercial gastronômica: softbox grande lateral a 45°, fill suave do lado oposto, contraluz dourada muito sutil sobre o alimento e brilho controlado nos queijos. Fundo com bokeh âmbar quente, contraste forte mas natural, balanço de branco quente profissional. Realce texturas apetitosas e cores verdadeiras, sem amarelar o recipiente branco, sem HDR exagerado ou saturação artificial.',
 appetizing:'Luz principal softbox grande a 45 graus pela esquerda, balanço de branco quente moderado (aprox. 5000 K), rebatedor suave à direita, recorte discreto atrás. Cores gastronômicas naturais e vivas: milho amarelo realista, bacon dourado, queijo com textura, verdes frescos sem neon. Contraste médio-alto, microtextura fina, brilho controlado, sombra física macia.',
 clean:'Iluminação editorial clara com softbox amplo na diagonal, preenchimento neutro e fundo limpo. Branco balanceado, saturação comedida, contraste natural, alimentos frescos, textura real, sombras de contato e destaques sem estourar.',
 dramatic:'Iluminação editorial dramática controlada, key light quente lateral e rim light fino, fundo escuro elegante, luz de preenchimento suficiente para preservar ingredientes. Pretos profundos sem perder detalhes; cores apetitosas naturais, sem HDR.'
};
function buildPrompt(c,mode){
 const format=clean(c.ratio,12),dims=sizes[format]||'resolução compatível';
 const name=clean(c.name,100),brandName=clean(c.brand.name||'Minha empresa',75);
 const photoOnly=mode==='photo';
 const stage=SCENES[el('csPromptScene')?.value]||SCENES.campaign;
 const angle=ANGLES[el('csPromptAngle')?.value]||ANGLES.threeQuarter;
 const light=LIGHTS[el('csPromptLight')?.value]||LIGHTS.campaign;
 const design=DESIGNS[el('csPromptDesign')?.value]||DESIGNS.impact;
 const flavors=(c.ingredients||[]).filter(Boolean).slice(0,4).map(x=>clean(x,45));
 const sceneFacts=flavors.length?'Ingredientes confirmados: '+flavors.join(', ')+'.':'Os ingredientes da ficha não estão informados; usar apenas os visíveis na foto de referência.';
 const includeLogo=!!c.showLogo;
 const logoRequirements=includeLogo?[
  'REFERÊNCIA VISUAL 2 — LOGOMARCA ORIGINAL: APLIQUE A LOGOMARCA DA IMAGEM 2 NA ARTE FINAL. Posicione-a no topo esquerdo ou direito, em área de contraste limpo, com margem de segurança e tamanho legível (aproximadamente 12–18% da largura).',
  'PRESERVAÇÃO RIGOROSA DA LOGO: reproduza exatamente como no arquivo de referência — desenho, tipografia, cores, símbolos e proporções intactos. Uma pequena placa neutra discreta atrás dela é permitida para garantir legibilidade. Uma única aplicação da marca, sem duplicação do nome em outro local.',
  'Caso a segunda referência visual não esteja disponível, concentre-se no enquadramento fotográfico sem criar um logotipo fictício.'
 ]:[
  'LOGOMARCA: omitida nesta campanha; mantenha o restante da arte conforme as referências.'
 ];
 const shot=[
  'DIREÇÃO DE ARTE — ANÚNCIO GASTRONÔMICO FOTORREALISTA DE ESTÚDIO',
  '',
  'REFERÊNCIA VISUAL 1 — FOTO DO PRODUTO: utilize a IMAGEM 1 para reproduzir fielmente o alimento, o recipiente, os recheios e a porção. RECONSTRUA UMA NOVA CENA DE ESTÚDIO e SUBSTITUA COMPLETAMENTE a bancada de inox, mesa e fundo da fotografia de referência.',
  'MARCA DO ESTABELECIMENTO: '+brandName+'.',
  'ESTILO VISUAL OBRIGATÓRIO: '+design.name+'. '+design.direction,
  'PRODUTO: '+name+'. '+sceneFacts,
  'CENÁRIO E BASE FÍSICA: '+stage.scene,
  'CÂMERA: '+angle,
  'ILUMINAÇÃO: '+light,
  'FORMATO EXATO: '+format+' (resolução de referência '+dims+' pixels).',
  'Mantenha o alimento e seu recipiente identificáveis; valorize textura, cremosidade e volume com cores naturais. Preserve a geometria e os ingredientes reais. Não acrescente coberturas, molhos, ingredientes, utensílios ou embalagens inexistentes.',
  'Composição de campanha premium: produto hero, plataforma convincente, sombra real de contato, plano de fundo elegante e profundidade de campo moderada. O cenário deve ser nitidamente diferente da cozinha original.',
  ...logoRequirements,
  ''
 ];
 if(photoOnly){
  shot.push(includeLogo?
   'COMPOSIÇÃO FOTOGRÁFICA LIMPA: entregar apenas a nova foto comercial e a logo original da IMAGEM 2 aplicada em canto discreto. Omitir título, descrição, valores, telefone, CTA e quaisquer outros textos.':
   'COMPOSIÇÃO FOTOGRÁFICA LIMPA: entregar somente a nova fotografia de estúdio, sem títulos, descrições, valores, telefone, CTA ou elementos gráficos.');
 }else{
  const desc=clean(c.description,160);
  shot.push(
   'LAYOUT PUBLICITÁRIO COMPLETO — TODOS OS TEXTOS ABAIXO SÃO PARTE DA IMAGEM FINAL:',
   'COMPOSIÇÃO PUBLICITÁRIA 9:16, se formato vertical: (1) topo 5–16%: logomarca original à esquerda e faixa OFERTA DO DIA destacada ao lado; (2) de 17–32%: nome grande do sabor com tipografia marcante e descrição em até duas linhas de bom contraste; (3) canto superior direito, fora da comida: selo especial do preço; (4) centro de 30–83%: fotografia do pote GRANDE, apetitoso, com perspectiva realista, preenchendo 65–78% da largura e ganhando prioridade visual; (5) rodapé 86–97%: CTA e WhatsApp em faixa elegante. Ajuste essas zonas naturalmente sem sobrepor texto ao produto.',
   'ESTRUTURA DE DESIGN: '+design.banner,
   'PREÇO COMO ELEMENTO GRÁFICO: '+design.price,
   'CTA COMO PEÇA GRÁFICA: '+design.cta,
   'FOTOGRAFIA HERO: o produto é a maior atração, mais próximo da câmera do que uma foto simples de catálogo. Pode haver um vapor MUITO discreto e fisicamente plausível apenas se o prato estiver quente, sem esconder a comida. Fundo quente desfocado e iluminação apetitosamente contrastada.',
   'PARA FORMATOS DIFERENTES DE 9:16: reorganize blocos para a proporção escolhida mantendo a mesma ordem de hierarquia e sem reduzir o produto a miniatura.',
   'TÍTULO SUPERIOR EXATO: "'+clean(c.headline,90)+'"',
   'NOME DO SABOR EM DESTAQUE: "'+name+'"',
   'DESCRIÇÃO COMERCIAL OBRIGATÓRIA, legível e sem substituições: "'+desc+'"',
   'Componha a descrição em 1–3 linhas curtas, com contraste elevado, em região de fundo uniforme. Ela DEVE aparecer na arte final, não apenas servir de referência criativa.',
   c.showPrice?'PREÇO PRINCIPAL EXATO E DESTACADO: "'+currency(c.priceAd)+'"':'PREÇO: omitir.',
   c.showPrice&&c.showOld?'PREÇO ANTERIOR EXATO, MENOR E RISCADO: "'+currency(c.priceNormal)+'"':'PREÇO ANTERIOR: omitir.',
   c.showCta?'CHAMADA FINAL EXATA: "'+clean(c.cta,70)+'"':'CHAMADA: omitir.',
   c.showPhone&&c.brand.phone?'CONTATO EXATO, DISCRETO: "'+clean(c.brand.phone,45)+'"':'CONTATO: omitir.',
   'HIERARQUIA: produto e nome do sabor em primeiro plano, preço de oferta em segundo, descrição e CTA bem legíveis; logo no topo sem ocupar espaço excessivo.',
   'Texto comercial em português do Brasil. Renderize caracteres, acentos, moedas, valores e letras exatamente como fornecidos. Não substituir a descrição por lista de ingredientes, nem omitir os campos obrigatórios.',
   'Não transformar a composição em um cartaz só de texto: preserve o produto como protagonista e mantenha margens de segurança para stories.'
  );
 }
 shot.push(
  '',
  'ACABAMENTO: parecer peça criada por agência de marketing gastronômico premium, com fotografia de restaurante real e direção de arte profissional. Não gerar foto simples sobre fundo cinza, layout vazio com letras brancas genéricas, precificação desalinhada, cartaz sem selo de oferta, texturas plásticas ou elementos falsos. Precisão no português e na moeda.',
  'ENTREGA: uma única imagem final, na proporção '+format+', com todos os elementos especificados para o modo selecionado.'
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
window.creativeDownloadLogo=async function(){
 const c=source();if(c.error){notice(c.error);return false}
 const src=c.brand?.logoUrl;
 if(!src){
  notice('Logomarca não cadastrada. Adicione sua logo no Perfil ou anexe o arquivo original diretamente na IA.');
  writeStatus('Não foi encontrada uma logomarca no cadastro. Faça o upload no Perfil ou anexe a imagem original na IA.');
  return false;
 }
 try{
  const image=await new Promise((resolve,reject)=>{
   const img=new Image();
   if(/^https?:\/\//i.test(src))img.crossOrigin='anonymous';
   img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Logomarca inacessível'));
   img.src=src;
  });
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,2400/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  const drawing=canvas.getContext('2d');if(!drawing)throw new Error('Canvas indisponível');
  drawing.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao preparar logo')),'image/png'));
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;
  a.download='logomarca-original-'+clean(c.brand.name||'empresa',48).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'-')+'.png';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  writeStatus('Logomarca original baixada. Envie a foto do produto e a logo como duas imagens à IA.');
  notice('Logo baixada. Anexe a foto e a logo no Gemini.');
  return true;
 }catch(err){
  console.warn('Erro ao exportar logomarca',err);
  notice('Não foi possível baixar a logo. Salve o arquivo original do Perfil ou anexe-o diretamente no Gemini.');
  return false;
 }
};

const changeControls=new Set([
 'creativeRecipe','creativeRatio','csStyle','csCampaign','csPhotoFocus',
 'creativeOld','creativeSale','creativeHeadline','creativeBody','creativeCta',
 'csPromptScene','csPromptAngle','csPromptLight','csPromptDesign',
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
