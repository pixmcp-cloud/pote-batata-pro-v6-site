const assert=require("node:assert/strict"),fs=require("node:fs");
const text=fs.readFileSync("cardapio/cardapio.js","utf8");
const manifest=JSON.parse(fs.readFileSync("recipe_image_manifest.json","utf8"));
const expected={"carne-cheddar":"carne-cheddar",pizza:"r22",hotdog:"r21",estrogonofe:"r05",ninho:"ninho-nutella",brigadeiro:"brigadeiro","chocolate-morango":"morango-preto","chocolate-morango-branco":"morango-branco"};
for(const [id,key] of Object.entries(expected)){
 const line=text.split("\n").find(l=>l.includes('id:"'+id+'"'));
 assert(line&&line.includes('image:"../'+manifest[key].slice(2)+'"'),id);
 assert(fs.existsSync(manifest[key]),key);
}
for(const id of ["pizza","hotdog"]){const line=text.split("\n").find(l=>l.includes('id:"'+id+'"'));assert(line&&!line.includes("unsplash"));const match=line.match(/image:"\.\.\/([^"]+)"/);assert(match&&fs.existsSync(match[1]),id);}
console.log("PASS: oito fotos oficiais, sabores correspondentes e arquivos locais.");