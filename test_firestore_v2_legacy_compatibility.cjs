const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { initializeEmulator, sdk } = require('./qa/firestore/environment.cjs');

const { collection, doc, getDocFromServer, getDocsFromServer, setDoc, Timestamp } = sdk;
const universe = 'pizzaria';

function legacyRecord(group, item, rank = 0) {
  const key = Buffer.from(JSON.stringify([universe, group, item.id])).toString('base64url');
  return [key, { record: { universe, group, id: item.id, item, rank }, updatedAt: Timestamp.fromMillis(1000) }];
}

function financialHistory() {
  return [
    legacyRecord('cashSessions', {
      id: 'caixa-fechado', status: 'closed', closedAt: '2026-11-15T19:00:00.000Z',
      countedCash: 75, closedSummary: { expectedCash: 75 },
    }),
    legacyRecord('cashMovements', {
      id: 'suprimento-antigo', sessionId: 'caixa-fechado', kind: 'suprimento', amount: 25,
    }),
  ];
}

test('contas existentes mantêm os dados V2 quando passam pelas regras candidatas', { timeout: 45000 }, async t => {
  const { createMockState } = await import('./v2_store_core.mjs');
  const { createV2Store } = await import('./v2_storage.mjs');
  const environment = await initializeEmulator({ hardened: true });
  const originalWindow = globalThis.window;
  const sessions = [];
  t.after(async () => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    for (const store of sessions) store.dispose();
    await environment.cleanup();
  });

  function empty() {
    return createMockState({ businessType: universe });
  }

  async function seed(name, records, license) {
    const uid = `${name}-${randomUUID()}`;
    const email = `${name}@example.com`;
    const timestamp = Timestamp.fromMillis(1000);
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', uid), license ? { email, license } : { email });
      await setDoc(doc(db, 'users', uid, 'appState', 'v2'), { schemaVersion: 2, state: empty(), updatedAt: timestamp });
      await setDoc(doc(db, 'users', uid, 'appState', 'v2InventoryGuard'), { revision: 4, updatedAt: timestamp });
      await setDoc(doc(db, 'users', uid, 'appState', 'v2Pulse'), { eventId: 'historico', origin: 'cliente-antigo', updatedAt: timestamp });
      for (const [key, value] of records) {
        await setDoc(doc(db, 'users', uid, 'records', key), value);
      }
    });
    return { uid, email };
  }

  function actor({ uid, email }) {
    const identity = { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } };
    const db = environment.authenticatedContext(uid, identity).firestore();
    globalThis.window = { POTE_AUTH: { uid, proActive: false } };
    let state = empty();
    const store = createV2Store({
      uid, db, sdk,
      fresh: () => { state = empty(); },
      snapshot: () => structuredClone(state),
      apply: value => { state = value; },
    });
    sessions.push(store);
    return { uid, db, store, get state() { return state; } };
  }

  async function readCloud({ uid, db }) {
    const [records, ...metadata] = await Promise.all([
      getDocsFromServer(collection(db, 'users', uid, 'records')),
      ...['v2', 'v2InventoryGuard', 'v2Pulse'].map(id => getDocFromServer(doc(db, 'users', uid, 'appState', id))),
    ]);
    return {
      records: Object.fromEntries(records.docs.map(record => [record.id, record.data()])),
      metadata: Object.fromEntries(metadata.map(document => [document.id, document.data()])),
    };
  }

  await t.test('uma conta exclusivamente V1 mantém o histórico e não recebe um V2 vazio', async () => {
    const uid = `somente-v1-${randomUUID()}`;
    const email = 'somente-v1@example.com';
    const state = empty();
    state.data.orders.push({ id: 'pedido-v1', qty: 2, status: 'entregue' });
    const original = { state, updatedAt: Timestamp.fromMillis(1000) };
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', uid), { email });
      await setDoc(doc(db, 'users', uid, 'appState', 'main'), original);
    });
    const client = actor({ uid, email });
    await assert.rejects(client.store.load(), /conta tem dados no formato anterior/);
    const legacy = await getDocFromServer(doc(client.db, 'users', uid, 'appState', 'main'));
    assert.deepEqual(legacy.data(), original);
    const untouched = await readCloud(client);
    assert.deepEqual(untouched.records, {});
    assert.deepEqual(untouched.metadata, { v2: undefined, v2InventoryGuard: undefined, v2Pulse: undefined });
  });

  await t.test('Free dentro da cota edita e migra um registro sem mover o histórico do caixa', async () => {
    const personal = legacyRecord('recipes', { id: 'receita-propria', name: 'Receita antiga' }, 10);
    const model = legacyRecord('recipes', { id: 'pz-01', name: 'Modelo antigo' }, 20);
    const finance = financialHistory();
    const account = await seed('free-dentro-da-cota', [personal, model, ...finance]);
    const client = actor(account);
    const loaded = await client.store.load();
    assert.equal(loaded.created, false);
    assert.deepEqual(client.state.data.recipes.map(recipe => recipe.id), ['receita-propria', 'pz-01']);
    assert.equal(client.state.data.cashSessions[0].countedCash, 75);
    assert.equal(client.state.data.cashMovements[0].amount, 25);

    const before = await readCloud(client);
    client.state.data.recipes[0].name = 'Receita atualizada';
    const result = await client.store.save();
    const after = await readCloud(client);
    for (const [key] of finance) assert.deepEqual(after.records[key], before.records[key]);
    assert.deepEqual(after.records[model[0]], before.records[model[0]], 'O modelo inalterado mantém a chave antiga');
    assert.equal(result.ok, true, `A edição dentro da cota deve persistir: ${JSON.stringify(result)}`);
    assert.equal(after.records[personal[0]], undefined);
    assert.equal(after.records['free~extra~recipes'].record.item.name, 'Receita atualizada');
    assert.equal(Object.keys(after.records).length, Object.keys(before.records).length);

    const reopened = actor(account);
    await reopened.store.load();
    assert.deepEqual(reopened.state.data.recipes.map(recipe => recipe.id), ['receita-propria', 'pz-01']);
    assert.equal(reopened.state.data.recipes[0].name, 'Receita atualizada');

    reopened.state.data.recipes[1].name = 'Modelo atualizado';
    const modelResult = await reopened.store.save();
    assert.equal(modelResult.ok, true, `A edição do modelo legado deve persistir: ${JSON.stringify(modelResult)}`);
    const migrated = await readCloud(reopened);
    assert.equal(migrated.records[model[0]], undefined);
    assert.equal(migrated.records['model~pizzaria~recipes~pz-01'].record.item.name, 'Modelo atualizado');
    assert.deepEqual(migrated.records['free~extra~recipes'], after.records['free~extra~recipes']);
    for (const [key] of finance) assert.deepEqual(migrated.records[key], before.records[key]);
  });

  await t.test('Pro expirado acima da cota mantém o histórico e pode salvar configurações', async () => {
    const recipes = [
      legacyRecord('recipes', { id: 'primeira', name: 'Receita um' }, 10),
      legacyRecord('recipes', { id: 'segunda', name: 'Receita dois' }, 20),
    ];
    const expired = { status: 'active', kind: 'pro', expiresAt: Timestamp.fromMillis(1000) };
    const account = await seed('pro-expirado', [...recipes, ...financialHistory()], expired);
    const client = actor(account);
    const loaded = await client.store.load();
    assert.equal(loaded.created, false);
    assert.deepEqual(client.state.data.recipes.map(recipe => recipe.id), ['primeira', 'segunda']);
    const before = await readCloud(client);

    client.state.data.recipes.push({ id: 'terceira', name: 'Nova receita' });
    const result = await client.store.save();
    assert.equal(result.ok, false);
    assert.equal(result.code, 'free/limit');
    assert.deepEqual(await readCloud(client), before);

    const settingsClient = actor(account);
    await settingsClient.store.load();
    assert.deepEqual(settingsClient.state.data.recipes.map(recipe => recipe.id), ['primeira', 'segunda']);
    assert.equal(settingsClient.state.data.cashSessions[0].status, 'closed');
    assert.equal(settingsClient.state.data.cashMovements[0].amount, 25);
    settingsClient.state.data.settings.margin = 55;
    const settingsResult = await settingsClient.store.save();
    assert.equal(settingsResult.ok, true, `Configurações independentes devem persistir: ${JSON.stringify(settingsResult)}`);

    const after = await readCloud(settingsClient);
    assert.deepEqual(after.records, before.records);
    assert.deepEqual(after.metadata.v2InventoryGuard, before.metadata.v2InventoryGuard);
    assert.equal(after.metadata.v2.state.data.settings.margin, 55);
  });
});
