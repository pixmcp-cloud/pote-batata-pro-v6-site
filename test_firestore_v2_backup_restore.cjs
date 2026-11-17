const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { mkdtemp, readFile, rm, rmdir, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { initializeEmulator, sdk } = require('./qa/firestore/environment.cjs');

function sourceSection(filename, first, following) {
  const source = readFileSync(path.join(__dirname, filename), 'utf8');
  const start = source.indexOf(first);
  const end = source.indexOf(following, start);
  assert(start >= 0 && end > start, `Função ${first} ausente em ${filename}`);
  return source.slice(start, end);
}

function backupPage(uid, state) {
  const downloads = [];
  const confirmations = [];
  const notices = [];
  let downloadBlob;
  let renderCount = 0;
  const context = vm.createContext({
    state, Blob, TextEncoder,
    active: { uid },
    existingPending: () => null,
    safeState: () => structuredClone(state),
    window: { POTE_AUTH: { uid }, POTE_SYNC_GUARD: { blocked: false } },
    URL: {
      createObjectURL(blob) { downloadBlob = blob; return 'blob:backup-test'; },
      revokeObjectURL() {},
    },
    document: {
      body: { appendChild() {} },
      createElement() {
        return { click() { downloads.push({ blob: downloadBlob, name: this.download }); }, remove() {} };
      },
    },
    setTimeout: callback => callback(),
    confirm(message) { confirmations.push(message); return true; },
    render() { renderCount++; },
    toast(message) { notices.push(message); },
  });
  const exportSource = sourceSection('firebase_integration.js', 'function downloadPending(', 'function verifyBackupFile(');
  const validateSource = sourceSection('source/pote_app_base.html', 'function validateImportData(', 'function uid(');
  const importSource = sourceSection('source/pote_app_base.html', 'async function importData(', 'function resetAll(');
  vm.runInContext([exportSource, validateSource, importSource].join('\n'), context);
  context.window.POTE_SYNC_GUARD.downloadPending = context.downloadPending;
  return { context, downloads, confirmations, notices, get renderCount() { return renderCount; } };
}

async function saveAndReadBackup({ name, blob }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pote-backup-restore-'));
  const filename = path.join(directory, 'backup.json');
  try {
    await writeFile(filename, await blob.text(), 'utf8');
    return new File([await readFile(filename)], name, { type: 'application/json' });
  } finally {
    await rm(filename, { force: true });
    await rmdir(directory);
  }
}

test('restaura um JSON exportado pelo aplicativo na mesma conta do Firestore V2', { timeout: 45000 }, async t => {
  const { createV2Store } = await import('./v2_storage.mjs');
  const { createMockState } = await import('./v2_store_core.mjs');
  const { validateBackup } = await import('./sync_guard.mjs');
  const environment = await initializeEmulator();
  const stores = [];
  t.after(async () => {
    for (const store of stores) store.dispose();
    await environment.cleanup();
  });

  const uid = `restore-test-${randomUUID()}`;
  const email = 'backup-test@example.com';
  const identity = { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  // Simulate the authenticated browser. V2 Free record IDs depend on POTE_AUTH.
  global.window = { POTE_AUTH: { uid, proActive: false } };
  t.after(() => { delete global.window; });
  const db = environment.authenticatedContext(uid, identity).firestore();
  await sdk.setDoc(sdk.doc(db, 'users', uid), { email, displayName: 'Conta de teste do backup' });

  const empty = () => ({ ...createMockState({ businessType: 'batataria' }), creatives: [], audit: [] });
  function openSession() {
    let state = empty();
    const store = createV2Store({
      uid, db: environment.authenticatedContext(uid, identity).firestore(), sdk,
      fresh: () => { state = empty(); },
      snapshot: () => structuredClone(state),
      apply: value => { state = value; },
    });
    stores.push(store);
    return { store, get state() { return state; } };
  }

  const source = openSession();
  await source.store.load();
  Object.assign(source.state.data, {
    brand: { name: 'Cozinha de teste' }, settings: { margin: 55 },
    recipes: [{ id: 'frango', name: 'Batata recheada de frango' }],
    ingredients: [{ id: 'batata', stock: 5500, measureUnit: 'g' }],
    orders: [{ id: 'pedido-original', recipeId: 'frango', qty: 2, status: 'recebido', price: 25.50 }],
    businessUniverses: { pastelaria: { ingredients: [{ id: 'massa', stock: 1300, measureUnit: 'g' }] } },
  });
  source.state.creatives.push({ id: 'campanha', name: 'Fim de semana' });
  source.state.audit.push({ id: 'evento-teste', action: 'pedido-recebido' });
  const originalSaved = await source.store.save();
  assert.equal(originalSaved.ok, true, JSON.stringify(originalSaved));

  const restoredSession = openSession();
  await restoredSession.store.load();
  const original = structuredClone(restoredSession.state);
  const page = backupPage(uid, restoredSession.state);
  page.context.downloadPending();
  const file = await saveAndReadBackup(page.downloads[0]);
  const backup = JSON.parse(await file.text());
  assert.equal(backup.backupVersion, 1);
  assert.equal(backup.uid, uid);
  assert.equal(validateBackup(backup.state).ok, true);
  assert.deepEqual(backup.state, original);

  Object.assign(restoredSession.state, empty());
  restoredSession.state.data.orders.push({ id: 'pedido-temporario', qty: 1, status: 'criado', price: 10 });
  const changed = await restoredSession.store.save();
  assert.equal(changed.ok, true, JSON.stringify(changed));
  const resetReadback = openSession();
  await resetReadback.store.load();
  assert.equal(resetReadback.state.data.ingredients.length, 0);
  assert.deepEqual(resetReadback.state.data.orders.map(order => order.id), ['pedido-temporario']);
  assert.deepEqual(resetReadback.state.data.businessUniverses, {});

  await page.context.importData(file);
  assert.equal(page.confirmations.length, 1);
  assert.equal(page.renderCount, 1, page.notices.join('\n'));
  assert.equal(page.downloads.length, 2);
  const replaced = JSON.parse(await page.downloads[1].blob.text());
  assert.equal(replaced.state.data.orders[0].id, 'pedido-temporario');
  const restored = await restoredSession.store.save();
  assert.equal(restored.ok, true, JSON.stringify(restored));

  const readback = openSession();
  await readback.store.load();
  assert.deepEqual(readback.state, original);
  const repeated = await restoredSession.store.save();
  assert.equal(repeated.unchanged, true);
});
