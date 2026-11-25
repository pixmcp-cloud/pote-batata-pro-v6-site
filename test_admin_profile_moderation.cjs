'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const admin=fs.readFileSync('admin_console.js','utf8');
const profile=fs.readFileSync('firebase_integration.js','utf8');
const menu=fs.readFileSync('floating_menu.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const builder=fs.readFileSync('make_beta.py','utf8');
for(const marker of [
 'id="poteAdmModerationName"','id="poteAdmNameLocked"',
 'id="poteAdmModerationReason"','id="poteAdmModerationSave"',
 'id="poteAdmProfileAudit"','await assertAdmin()',
 'await runTransaction(db,async transaction=>','transaction.update(ref,{displayName:name,nameLocked:locked',
 'transaction.set(event,{action:"moderate_name"',
 'selection!==uid','overlay.hidden','moderationSelectionUid=null'
])assert(admin.includes(marker),'Admin deve apresentar autenticação, UI e transação atômica: '+marker);
assert(profile.includes('nameLocked:Boolean(documentData?.nameLocked)'));
assert(profile.includes('if(locked&&displayName!==window.POTE_ACCOUNT_PROFILE?.displayName)'));
assert(menu.includes('poteProfileNameProtection'));
assert(menu.includes("readOnly=locked"));
assert(rules.includes("match /profileAudit/{eventId}"));
assert(rules.includes("getAfter(/databases/$(database)/documents/users/$(request.resource.data.targetUid))"));
assert(rules.includes("!resource.data.get('nameLocked', false)"));
for(const file of ['firebase_integration.js','floating_menu.js','admin_console.js','admin_console.css'])
 assert(builder.includes(file+'?v='+(file.startsWith('admin_console')?'adm-popup-20261121':file==='floating_menu.js'?'ia-universe-20261125':'moderation-20261121')),'Invalidar cache: '+file);
const code=admin.slice(admin.indexOf('function validModeratedName(value){'),admin.indexOf('async function changeProfileModeration(){'));
assert(code.includes('function validModeratedName('));
const validate=vm.runInNewContext(code+';validModeratedName');
assert.equal(validate('  Negócio    Exemplo  '),'Negócio Exemplo');
assert.equal(validate('Nome Seguro'),'Nome Seguro');
for(const name of ['', 'X', ' A ', 'Invisível\u200b!', 'Bidi\u202eTeste', 'A'.repeat(66), 'Nome\u0000Ruim'])
 assert.throws(()=>validate(name),'Rejeitar nome inválido: '+JSON.stringify(name));
console.log('PASS: moderação ADM, autorização, formato de nome, bloqueio, histórico e cache versionado');
