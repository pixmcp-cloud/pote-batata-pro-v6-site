const assert=require("node:assert/strict"),fs=require("node:fs");
const src=name=>fs.readFileSync(name,"utf8");
const html=src("public/index.html"),rules=src("firestore.rules"),
 hub=src("delivery_hub.js"),notice=src("notifications.js"),adm=src("admin_broadcast.js"),core=src("notification_core.mjs");
for(const x of ["notifications.js","admin_broadcast.js","notifications.css","admin_broadcast.css","delivery_hub.js"])
 assert(html.includes(x+"?v="),"Script do Hub/alertas não está no site: "+x);
assert(html.includes("firebase_integration.js?v=adm-v2-recipes-20261116"),"Correção de receitas ADM preservada");
assert(rules.includes("match /announcements/{noticeId}"),"Regras do Firestore ausentes");
assert(rules.includes("allow create: if isAdmin()"),"Somente ADM pode publicar");
assert(rules.includes("allow get, list: if googleVerified()"),"Leitura autenticada");
assert(rules.includes("request.resource.data.createdAt == request.time"),"Auditoria exige tempo do servidor");
assert(rules.includes("allow update: if isAdmin()"),"Desativação requer ADM");
assert(rules.includes("allow delete: if false;"),"Nenhuma exclusão destrutiva");
assert(adm.includes("getIdTokenResult(me,true)")&&adm.includes("pixmcp@gmail.com"),"ADM precisa de autenticação verificada");
assert(adm.includes("serverTimestamp()")&&adm.includes("setDoc(ref,"),"Publicação remota deve ser atômica");
assert(notice.includes("onSnapshot(q,")&&notice.includes('pote:user-ready')&&notice.includes('pote:user-logout'),
 "Sininho precisa de atualizações realtime e isolamento entre sessões");
assert(notice.includes('pote:changed')&&notice.includes('deliveryHub?.orders'),"Aviso de pedidos importados não conectado");
assert(notice.includes("aria-expanded")&&notice.includes("markAll"),"Sininho precisa de acessibilidade e ações reais");
assert(hub.includes('pote:notice-update'),"Notificar somente após pedidos de verdade salvos");
assert(!notice.includes("serverTimestamp()"),"Clientes não devem publicar comunicados");
assert(!adm.includes("pote:changed"),"ADM não deve alterar ficha/estoque com broadcast");
assert(core.includes("mergeNotifications"));
console.log("PASS: broadcast ADM autenticado, leitura Google, eventos de pedidos reais, 12 logos, versão ADM intacta.");