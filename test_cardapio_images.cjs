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
for(const [id,file] of [["refrigerante","refrigerante-lata.webp"],["agua","agua-mineral.webp"]]){const line=text.split("\n").find(l=>l.includes('id:"'+id+'"'));assert(line&&line.includes('image:"../assets/recipes/'+file+'"'),id);const bytes=fs.readFileSync("assets/recipes/"+file);assert.equal(bytes.toString("ascii",0,4),"RIFF");assert.equal(bytes.toString("ascii",8,12),"WEBP");}
const refri600=fs.readFileSync("assets/recipes/refrigerante-600.webp");assert.equal(refri600.toString("ascii",0,4),"RIFF");assert.equal(refri600.toString("ascii",8,12),"WEBP");assert(text.includes('image:"../assets/recipes/refrigerante-600.webp"'));console.log("PASS: artes locais de refrigerante lata, 600 ml e água");
