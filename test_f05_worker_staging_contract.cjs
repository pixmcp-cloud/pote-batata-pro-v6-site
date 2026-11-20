/* Contract checked on every GitHub Pages/Hosting build.
 * F05 cannot be accidentally activated before auth secrets and Firestore cutover.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const integration=read("firebase_integration.js"),
      worker=read("workers/antifraud/src/index.mjs"),
      domain=read("workers/antifraud/src/domain.mjs"),
      logic=read("workers/antifraud/src/stock_loss.mjs"),
      bridge=read("worker_bridge.mjs");
for(const file of ["workers/antifraud/wrangler.toml","workers/antifraud/wrangler.private.toml"])
 assert.match(read(file),/^ENABLE_WRITES\s*=\s*"false"/m,
  "Worker staging NUNCA ativa gravações sem revisão explícita");
assert.match(integration,/const CLOUD_WORKER_ACTIVE=false;/);
assert.match(integration,/const F05_INVENTORY_WORKER_ACTIVE=false;/);
assert.match(integration,/inventoryEndpoint:"https:\/\/pote-batata-guard-staging\.pixmcp\.workers\.dev"/);
assert.match(integration,/enabled:\(\)=>CLOUD_WORKER_ACTIVE===true&&rawUserAccessPolicy\?\.workerAuthoritative===true/);
assert.match(integration,/inventoryEnabled:\(\)=>F05_INVENTORY_WORKER_ACTIVE===true&&rawUserAccessPolicy\?\.workerAuthoritative===true/);
assert.match(bridge,/const flagOn=flag=>/);
assert.match(bridge,/if\(!orderGate\(\)\)throw error\("Permissão do Worker revogada/);

assert.match(worker,/metaPath="users\/".*?\/appState\/v5/);
assert.match(worker,/\/appState\/v5InventoryGuard/);
assert.match(worker,/\/appState\/v5Pulse/);
assert.match(worker,/schemaVersion!==5/);
assert.match(worker,/\/v1\/inventory\/adjust/);
assert.match(worker,/const canaryPermitted=/);
assert.match(worker,/policy\.workerAuthoritative!==true/);
const f05Rules=read("firestore.f05-cutover.qa.rules");
assert.match(f05Rules,/function workerCutover\(userId\)/);
assert.match(f05Rules,/cutoverOrderInputsUnchanged/);
assert.match(f05Rules,/cutoverCreateAllowed\(userId, record\)/);
assert.match(f05Rules,/cutoverUpdateAllowed\(userId, record, oldRecord\)/);
assert.match(f05Rules,/cutoverDeleteAllowed\(userId,resource\.data\.record\)/);
assert.equal(JSON.parse(read("firebase.json")).firestore.rules,"firestore.rules",
 "NUNCA publicar regras candidatas F05 antes do corte homologado");

assert.match(worker,/list\.includes\(uid\)/);
assert.match(worker,/if\(!canaryPermitted\(env,user\.uid\)\)/);
assert.equal((worker.match(/if\(!canaryPermitted\(env,user\.uid\)\)/g)||[]).length,2,"Produção e perdas devem exigir canário");
assert.match(domain,/\/recordsV5\//);
assert.doesNotMatch(worker,/\/appState\/v2/);
assert.doesNotMatch(domain,/\/records\//);
assert.match(logic,/stockUnit/);
assert.match(read("workers/antifraud/src/firestore.mjs"),/documents:batchGet/);
assert.match(worker,/for\(let attempt=0;attempt<4;attempt\+\+\)/);
const adminPermissions=read("admin_permissions.js");
assert.match(adminPermissions,/\[\`accessPolicy\.\$\{listKind\}\`\]:policy\[listKind\]/,
 "Painel ADM não pode apagar workerAuthoritative ao editar permissões");
assert.doesNotMatch(adminPermissions,/updateDoc\(ref,\{accessPolicy:policy/,
 "Sobrescrever accessPolicy completo revoga a autorização canário por acidente");
// Etapa 9: compra de estoque sempre pelo Worker no canário, sem segunda
// mutação local ou fallback de edição física quando o servidor estiver off.
assert.match(worker,/planStockPurchase\(/);
assert.match(worker,/planStockRecount\(/);
assert.match(read("workers/antifraud/src/stock_recount.mjs"),/export function planStockRecount/);
assert.match(bridge,/async function recountStock\(/);
assert.match(read("stock_update_modal.js"),/POTE_WORKER\.recountStock\(/);
assert.match(read("workers/antifraud/src/stock_recount.mjs"),/stock_conflict/);

assert.match(read("workers/antifraud/src/stock_purchase.mjs"),/export function planStockPurchase/);
assert.match(bridge,/async function purchaseStock\(/);
assert.match(bridge,/get inventoryEnabled\(\)/);
assert.match(read("stock_ui.js"),/POTE_WORKER\.purchaseStock\(/);
assert.match(read("stock_ext.js"),/POTE_WORKER\.purchaseStock\(/);
assert.match(read("stock_update_modal.js"),/POTE_WORKER\.purchaseStock\(/);
for(const source of ["stock_ui.js","stock_ext.js","stock_update_modal.js"]){
 assert.match(read(source),/workerAuthoritative===true/,
  "Compras canário devem exigir política remota: "+source);
}
assert.match(bridge,/V5 Firestore reload/);
console.log("PASS F05 V5: caminhos, perdas, ponte desativada e Worker fail-closed.");
