import assert from "node:assert/strict";
import {prepareLegacyMigration,inspectLegacyBackup} from "./legacy_migration_v2.mjs";
const legacy={data:{businessType:"batataria",businessUniverses:{
 pizzaria:{recipes:[{id:"p1",name:"Pizza"}],ingredients:[{id:"pi",stock:100}]}
},recipes:[{id:"r1",name:"Batata"}],ingredients:[{id:"i1",stock:500}],
orders:[{id:"o1",status:"recebido"}],clients:[{id:"c1"}],suppliers:[],
settings:{baseCost:1},brand:{name:"Minha Batataria"}}};
const before=JSON.stringify(legacy);
const p=await prepareLegacyMigration(legacy);
assert.equal(p.recordCount,6);
assert.equal(p.preview.ok,true);
assert.equal(JSON.stringify(legacy),before,"V1 preserved");
assert(inspectLegacyBackup({backupVersion:1,uid:"u",state:legacy},"u",legacy));
assert(!inspectLegacyBackup({backupVersion:1,uid:"another",state:legacy},"u",legacy));
assert(!inspectLegacyBackup({backupVersion:1,uid:"u",state:{data:{orders:[]}}},"u",legacy));
assert.equal((await prepareLegacyMigration(legacy)).fingerprint,p.fingerprint);
await assert.rejects(()=>prepareLegacyMigration({...legacy,data:{...legacy.data,orders:[{id:"x"},{id:"x"}]}}),/duplicado/);
// Historico anterior aos limites FREE precisa migrar inteiro, sem criar vendas ficticias.
const legacyFree={data:{businessType:"batataria",businessUniverses:{},
 recipes:[{id:"old-recipe-1"},{id:"old-recipe-2"}],
 ingredients:[{id:"old-potato",stock:2000}],
 orders:[{id:"old-order",status:"cancelado"}],
 cashSessions:[{id:"cash-1",status:"closed",closedAt:"2026-11-17T18:00:00Z",closedSummary:{sales:20}}],
 cashMovements:[{id:"cash-movement-1",kind:"reembolso",amount:20}],
 recipeVersions:[{id:"version-1"}],
 recipeTrash:[{id:"trash-1"}],
 checklist:[{id:"list-1"}],
 brand:{name:"Historico Free"},settings:{}}};
const historical=await prepareLegacyMigration(legacyFree,{free:false});
assert(historical.preview.ok);
assert.equal(historical.recordCount,9);
assert.equal(historical.normalized.records.size,9);
assert.equal(legacyFree.data.recipes.length,2);
const tagged=historical.preview.documents.map(x=>x.collection);
for(const group of ["cashSessions","cashMovements","recipeVersions","recipeTrash","checklist"])
 assert(tagged.includes(group),"Cannot omit legacy group "+group);
const malformedClosed=JSON.parse(JSON.stringify(legacyFree));
malformedClosed.data.cashSessions=[{id:"historical-closed",status:"closed",closedAt:"2026-11-17T18:00:00Z"}];
await assert.rejects(()=>prepareLegacyMigration(malformedClosed,{free:false}),/sem resumo\/data compatíveis/);
console.log("PASS F10 preview: V1 original, 19 groups, Free history, invalid closed shifts rejected before migration.");