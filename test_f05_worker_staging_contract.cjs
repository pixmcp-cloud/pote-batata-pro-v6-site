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
assert.match(worker,/metaPath="users\/".*?\/appState\/v5/);
assert.match(worker,/\/appState\/v5InventoryGuard/);
assert.match(worker,/\/appState\/v5Pulse/);
assert.match(worker,/schemaVersion!==5/);
assert.match(worker,/\/v1\/inventory\/adjust/);
assert.match(worker,/const canaryPermitted=/);
assert.match(worker,/list\.includes\(uid\)/);
assert.match(worker,/if\(!canaryPermitted\(env,user\.uid\)\)/);
assert.equal((worker.match(/if\(!canaryPermitted\(env,user\.uid\)\)/g)||[]).length,2,"Produção e perdas devem exigir canário");
assert.match(domain,/\/recordsV5\//);
assert.doesNotMatch(worker,/\/appState\/v2/);
assert.doesNotMatch(domain,/\/records\//);
assert.match(logic,/stockUnit/);
assert.match(bridge,/V5 Firestore reload/);
console.log("PASS F05 V5: caminhos, perdas, ponte desativada e Worker fail-closed.");
