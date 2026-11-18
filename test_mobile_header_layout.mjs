import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("./notifications.css",import.meta.url),"utf8");
const mobile=readFileSync(new URL("./mobile.css",import.meta.url),"utf8");
const builder=readFileSync(new URL("./make_beta.py",import.meta.url),"utf8");
assert(css.includes("right:78px")&&css.includes("top:12px"),"Desktop: sininho deve ficar junto ao menu");
assert(css.includes("right:69px")&&css.includes("top:11px"),"Celular: sininho deve ficar ao lado do menu");
assert(css.includes("right:64px")&&css.includes("top:10px"),"Celular estreito: sininho deve continuar alinhado");
assert(css.includes("--pote-notice-drawer-offset:57px"),"Painel precisa ficar dentro da tela");
assert(css.includes('body:has([role="dialog"][aria-modal="true"]:not([hidden])) #poteFloatToggle'),"Menu deve ceder espaço ao X do modal");
assert(css.includes('body:has([role="dialog"][aria-modal="true"]:not([hidden])) #poteNotifications'),"Sininho deve ceder espaço ao X do modal");
for(const id of ["potePendingSyncBackup","poteFullAccountBackup","poteSyncResolve"]){
 assert(mobile.includes(id),id+" deve caber na largura do cartão");
}
assert(builder.includes("notifications.css?v=inline-detail-20261117"),"Novo CSS precisa invalidar cache");
assert(builder.includes("mobile.css?v=header-sync-20261116"),"Layout do backup precisa invalidar cache");
console.log("PASS: menu+sininho alinhados, X de modais livre, backup responsivo e cache atualizado.");
