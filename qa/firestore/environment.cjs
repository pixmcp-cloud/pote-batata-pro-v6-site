const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const dependencyPath = path.join(__dirname, 'node_modules', '@firebase', 'rules-unit-testing');
const offlineTooling = 'C:/Users/LIVRESOM/Documents/GitHub/_POTE_OFFLINE_TEST_TOOLS';
const useOfflineTooling = process.platform === 'win32' && !fs.existsSync(dependencyPath) && fs.existsSync(offlineTooling);
const localTooling = useOfflineTooling ? offlineTooling : __dirname;
const requireTool = createRequire(path.resolve(process.env.POTE_RULES_TOOLING || localTooling, 'package.json'));
const { initializeTestEnvironment, assertSucceeds, assertFails } = requireTool('@firebase/rules-unit-testing');
const sdk = requireTool('firebase/firestore');

function readConfig(filename) {
  return JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
}

function initializeEmulator({ hardened = false, cutover = false } = {}) {
  const config = readConfig(cutover ? 'firebase.worker_cutover.qa.json' : hardened ? 'firebase.hardened.qa.json' : 'firebase.emulator.qa.json');
  const rulesFile = config.firestore.rules;
  if (!hardened && !cutover && rulesFile !== readConfig('firebase.json').firestore.rules) {
    throw new Error('O emulador deve testar o arquivo de regras configurado em firebase.json.');
  }

  const defaults = config.emulators.firestore;
  const endpoint = process.env.FIRESTORE_EMULATOR_HOST || `${defaults.host}:${defaults.port}`;
  const match = /^(127\.0\.0\.1|localhost):(\d{1,5})$/.exec(endpoint);
  const port = Number(match?.[2]);
  if (!match || port < 1 || port > 65535) {
    throw new Error('FIRESTORE_EMULATOR_HOST deve apontar para o emulador local, com uma porta válida.');
  }

  const projectId = 'demo-pote-hardening';
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) {
    throw new Error(`Os testes exigem o projeto ${projectId}.`);
  }

  const rules = fs.readFileSync(path.join(root, rulesFile), 'utf8');
  return initializeTestEnvironment({ projectId, firestore: { host: match[1], port, rules } });
}

module.exports = { initializeEmulator, assertSucceeds, assertFails, sdk };
