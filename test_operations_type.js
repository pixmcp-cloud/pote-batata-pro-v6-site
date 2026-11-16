const fs=require('node:fs'), assert=require('node:assert/strict');
const css=fs.readFileSync('visual_refresh.css','utf8');
const source=fs.readFileSync('source/pote_app_base.html','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const marker='/* Central de Operações: nomes BRANCOS, sem contorno, centralizados na parte inferior. */';
assert(css.includes(marker),'CSS inferior não encontrado');
const final=css.slice(css.lastIndexOf(marker));
assert(final.includes('justify-content:flex-end!important'),'Nomes devem estar embaixo');
assert(final.includes('align-items:center!important'),'Nomes devem ficar centralizados horizontalmente');
assert(final.includes('text-align:center!important'),'Texto precisa ficar alinhado ao centro horizontal');
assert(final.includes('letter-spacing:.025em!important'),'Espaçamento leve precisa ser mantido');
assert(final.includes('-webkit-text-stroke:0!important'),'Contorno deve ser eliminado');
assert(final.includes('content:none!important'),'Pseudo-contorno deve ser desligado');
assert(!css.includes('content:attr(data-outline)'),'Camada duplicada deve ser realmente removida do CSS');
assert(!source.includes('data-outline'),'Duplicação do texto deve ser removida da Home');
assert(source.includes('<strong>${label}</strong>'),'O título normal deve permanecer');
assert(final.includes('font-size:clamp(17px,4.8vw,21px)!important'),'Texto deve se adaptar ao celular');
assert(html.includes('visual_refresh.css?v=glass-icons-20261116'),'Cache novo não conectado');
for(const [key,asset,label] of [['losses','perdas','Perdas'],['reports','financeiro','Financeiro']]){
 assert(source.includes(`['${key}','${asset}','${label}']`),`Card ${label} deve usar a imagem correta`);
 const image=fs.readFileSync(`assets/operations/${asset}.webp`);
 assert.equal(image.toString('ascii',0,4),'RIFF',`Imagem WebP ausente ou inválida: ${label}`);
 assert(image.length>1000,`Imagem ${label} está vazia`);
}
assert(!source.includes("['losses','financeiro','Perdas']"),'Perdas não pode usar ícone do Financeiro');
assert(!source.includes("['garimpo','financeiro','Garimpo']"),'Garimpo não pode usar ícone do Financeiro');
assert(source.includes("['suppliers','fornecedor','Fornecedores & Compras']"),"Fornecedores e Compras devem usar um card");
assert(!source.includes("['garimpo','garimpo','Radar de Preço']"),"Radar foi reunido com Fornecedores");
assert(source.includes("['motoboy','motoboy','MOTOBOY']"),"Motoboy deve ocupar o espaço liberado");
assert(source.includes('motoboy.svg?v=moto-20261116'),"Motoboy precisa da imagem exclusiva");
assert(fs.readFileSync("supplier_directory.js","utf8").includes("Abrir Radar de Preços"),
 "Radar deve continuar acessível pelo card de Fornecedores");
const moto=fs.readFileSync("assets/operations/motoboy.svg","utf8");
assert(moto.includes("<svg")&&moto.includes("</svg>")&&moto.includes("linearGradient"),
 "Imagem do Motoboy ausente ou sem acabamento 3D");

console.log('PASS: cards unificados de Fornecedores e Compras, Motoboy 3D, Radar acessível, tipografia preservada.');
