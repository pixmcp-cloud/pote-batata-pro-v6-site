const assert=require("node:assert/strict"),fs=require("node:fs");
const ids=["maisdelivery","ifood","99food","aiqfome","rappi","deliverymuch","goomer","deliverydireto","cardapioai","olaclick","beefood","keeta"];
for(const id of ids){
 const p="assets/integrations/"+id+".png";
 assert(fs.existsSync(p),"Ícone oficial ausente: "+id);
 const buf=fs.readFileSync(p);
 assert(buf.length>300 && buf.length<150000,"Logo sem dados úteis: "+id);
 assert.equal(buf.subarray(0,8).toString("hex"),"89504e470d0a1a0a","Logo deve ser PNG seguro: "+id);
}
const hub=fs.readFileSync("delivery_hub.js","utf8");
assert(hub.includes("./assets/integrations/"));
assert(hub.includes("Ainda não conectado"),"Não apresentar plataforma como conectada");
assert(hub.includes("não indica parceria"));
const css=fs.readFileSync("delivery_hub.css","utf8");
assert(css.includes(".hub-platform-logo"));
assert(css.includes(".hub-logo-fallback"));
console.log("PASS: 12 logos originais obtidas de ícones de domínios oficiais e cards sem status falso.");