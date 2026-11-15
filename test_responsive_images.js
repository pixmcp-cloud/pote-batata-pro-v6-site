const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8');
const css=fs.readFileSync('image_responsive.css','utf8');
assert(html.includes('<div class="recipe-detail-photo">'),'Falta o contêiner adaptável na ficha técnica');
assert(!html.includes('<div style="max-height:270px;overflow:hidden;border-radius:15px">'),'Corte da imagem antiga ainda está presente');
assert(html.includes('image_responsive.css?v=fit-20261115'),'A folha responsiva não foi conectada');
for(const selector of ['.recipe-detail-photo img','.card .photo img','.creative .image img']){
 assert(css.includes(selector),'Falta regra responsiva para '+selector);
}
assert(css.includes('object-fit:contain!important'),'A imagem deve ser exibida completa, sem recorte');
assert(!css.includes('.ops-icon img'),'As imagens artísticas dos botões da Central não podem perder o full-bleed');
console.log('PASS: fotos das receitas, catálogo e criativos preservam proporção e se ajustam à tela.');
