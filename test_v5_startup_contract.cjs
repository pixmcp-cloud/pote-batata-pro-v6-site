const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=name=>fs.readFileSync(name,"utf8");
const firebaseModule=read("firebase_app.mjs"),main=read("firebase_integration.js"),
 finance=read("operation_integrity.mjs"),builder=read("make_beta.py");
assert(firebaseModule.includes("initializeApp(firebaseConfig)")&&firebaseModule.includes("getApps()"),"Firebase app compartilhado deve ser inicializado");
assert(main.includes('from "./firebase_app.mjs?v=init-20261120"'),"Login deve carregar o app compartilhado");
assert(!main.includes("initializeApp(firebaseConfig)"),"Inicialização duplicada proibida");
assert(finance.includes('from "./v5_store_core.mjs"'),"Operações não podem importar o V2");
for(const name of ["admin_console.js","admin_permissions.js","franchise_sync.js","notifications.js","admin_broadcast.js"]){
 const code=read(name);
 assert(code.includes('from "./firebase_app.mjs?v=init-20261120"'),name+" deve depender do inicializador");
 assert(!code.includes("getApp()"),name+" usa app sem inicialização");
 assert(builder.includes(name+"?v="+(name==="admin_console.js"?"adm-popup-20261121":name==="admin_permissions.js"?"ia-coin-neon-20261125":"firebase-order-v5-20261120")),"Cache desatualizado: "+name);
}
for(const name of ["creative_studio.css","creative_studio.js","voice_ai.js"]){
 assert(builder.includes(name+"?v=ia-coin-neon-20261125"),"Cache desatualizado: "+name);
 assert(fs.existsSync(path.join("public",name)),"Ativo de locução ausente: "+name);
}
assert(read("voice_ai.js").includes('from "./firebase_app.mjs?v=init-20261120"'),"Locução deve usar Firebase compartilhado");
assert(builder.includes("firebase_integration.js?v=moderation-20261121"),"O login deve invalidar cache após moderação por UID");
assert(builder.includes("floating_menu.js?v=dois-icones-20261125"),"A tela de perfil deve invalidar cache após moderação por UID");
const manifest=JSON.parse(read(path.join("assets","brand","manifest.webmanifest")));
assert.equal(manifest.start_url,"/","PWA deve abrir o PDV, nao /assets/brand/");
assert.equal(manifest.scope,"/","PWA deve ser instalada no dominio inteiro");
for(const icon of manifest.icons){
 assert(icon.src.startsWith("/assets/brand/"),"Icone PWA relativo quebra instalacao "+icon.src);
 assert(fs.existsSync("public"+icon.src),"Icone PWA ausente no build: "+icon.src);
}
for(const file of ["firebase_app.mjs","firebase_integration.js","v5_storage.mjs","v5_store_core.mjs"]){
 assert(fs.existsSync(path.join("public",file)),"Módulo ausente no build: "+file);
}
assert(!read("public/operation_integrity.mjs").includes('from "./v2_store_core.mjs"'),
 "Bundle de producao depende de módulo V2 removido");
console.log("PASS: V5 bootstrap, Firebase compartilhado, imports consistentes, manifest PWA e assets verificáveis.");
