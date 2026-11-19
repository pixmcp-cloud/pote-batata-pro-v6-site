import assert from "node:assert/strict";
import {stableJson,matchesRemote,nextRevision,jsonBytes,MAX_APPSTATE_BYTES,pendingKey,validateBackup,makePending,pendingMatchesLoadedState,inspectPendingAgainstCloud} from "./sync_guard.mjs";
const data={state:{data:{orders:[{id:"o1",price:29}],ingredients:[]},mode:"free"},syncRevision:2};
const same={state:{mode:"free",data:{ingredients:[],orders:[{price:29,id:"o1"}]}}};
assert.equal(stableJson(data.state),stableJson(same.state),"Order of Firestore map keys must not trigger a conflict");
assert(matchesRemote(same.state,stableJson(data.state)));
assert(!matchesRemote({...same.state,data:{...same.state.data,orders:[{id:"o2",price:50}]}},stableJson(data.state)));
const reservedKey=JSON.parse('{"__proto__":{"flag":true},"amount":10}');
assert.equal(stableJson(reservedKey),'{"__proto__":{"flag":true},"amount":10}');
assert(!matchesRemote(reservedKey,stableJson({amount:10})));
assert.equal(nextRevision(0),1);
assert.equal(nextRevision(5),6);
assert.equal(nextRevision(-1),1);
assert(jsonBytes("á")==2);
assert(jsonBytes({x:1})>0);
assert(MAX_APPSTATE_BYTES<1048576);
assert.equal(pendingKey("user-a"),"pote-sync-pending-v1:user-a");
const base={data:{orders:[{id:"o1"}],ingredients:[{id:"i1"}],recipes:[],clients:[],suppliers:[],expenses:[]}};
assert.equal(validateBackup(base).ok,true);
assert.equal(validateBackup({data:{...base.data,orders:[{id:"o1"},{id:"o1"}]}}).ok,false);
assert.equal(validateBackup({data:{...base.data,orders:null}}).ok,false);
assert.equal(makePending("abc",base,"conflict").reason,"conflict");
assert.equal(pendingMatchesLoadedState(makePending("abc",base), "abc", structuredClone(base)),true,"Backup idêntico ao estado remoto não deve bloquear operações");
assert.equal(pendingMatchesLoadedState(makePending("abc",base), "outro", base),false,"Outra conta não pode liberar o backup");
assert.equal(pendingMatchesLoadedState(makePending("abc",base), "abc", {...base,data:{...base.data,orders:[{id:"outro"}]}}),false,"Backup diferente deve permanecer bloqueado");

const uiOnly={...base,mode:"adm",tab:"orders",expansion:{panel:true}};
const cloudUi={...base,mode:"free",tab:"pdv",expansion:{}};
const uiReport=inspectPendingAgainstCloud(makePending("abc",uiOnly,"navegacao"),"abc",cloudUi,{v2:true});
assert.equal(uiReport.kind,"navigation-only");
assert.equal(uiReport.safeToRelease,true,"Navigation-only backup should not prevent sales");
assert.equal(inspectPendingAgainstCloud(makePending("abc",uiOnly),"abc",cloudUi,{v2:false}).safeToRelease,false,
 "V1 must never ignore navigation fields");
const unsavedOrder={...uiOnly,data:{...base.data,orders:[{id:"pending-order"}]}};
const orderReport=inspectPendingAgainstCloud(makePending("abc",unsavedOrder),"abc",cloudUi,{v2:true});
assert.equal(orderReport.kind,"business-different");
assert.equal(orderReport.safeToRelease,false);
assert.match(orderReport.details.join(" " ),/Pedidos/);
const unsavedStock={...uiOnly,data:{...base.data,ingredients:[{id:"i1",stock:123}]}};
const stockReport=inspectPendingAgainstCloud(makePending("abc",unsavedStock),"abc",cloudUi,{v2:true});
assert.equal(stockReport.safeToRelease,false);
assert.match(stockReport.details.join(" "),/Ingredientes/);
assert.equal(inspectPendingAgainstCloud(makePending("other",uiOnly),"abc",cloudUi).safeToRelease,false);


const noticesA={...base,data:{...base.data,notificationCenter:{version:1,read:{
 "broadcast:local":"2026-11-19T00:00:00.000Z",
 "broadcast:both":"2026-11-19T00:01:00.000Z"}}}};
const noticesCloud={...base,data:{...base.data,notificationCenter:{version:1,read:{
 "broadcast:cloud":"2026-11-19T00:02:00.000Z",
 "broadcast:both":"2026-11-19T00:03:00.000Z"}}}};
const noticeReport=inspectPendingAgainstCloud(makePending("abc",noticesA,"sync/conflict"),
 "abc",noticesCloud,{v2:true});
assert.equal(noticeReport.kind,"notification-read-only");
assert.equal(noticeReport.safeToRelease,false,"Pending local receipts need persistence before release");
assert.equal(noticeReport.needsNotificationMerge,true);
assert.equal(Object.keys(noticeReport.mergedNotificationCenter.read).length,3);
assert.equal(noticeReport.mergedNotificationCenter.read["broadcast:both"],
 "2026-11-19T00:03:00.000Z","Prefer newer cloud mark for the same notification");
assert.equal(inspectPendingAgainstCloud(makePending("abc",noticesA),"abc",noticesCloud,{v2:false}).safeToRelease,false);
const noticeAlreadySynced={...noticesCloud,data:{...noticesCloud.data,notificationCenter:{
 version:1,read:{...noticesCloud.data.notificationCenter.read,...noticesA.data.notificationCenter.read}}}};
const already=inspectPendingAgainstCloud(makePending("abc",noticesA),
 "abc",noticeAlreadySynced,{v2:true});
assert.equal(already.safeToRelease,true,"Superset of local receipts needs no new write");
assert.equal(already.needsNotificationMerge,false);
const financeChanged={...noticesA,data:{...noticesA.data,
 orders:[{id:"order-with-money",price:21.9,qty:1}]}};
assert.equal(inspectPendingAgainstCloud(makePending("abc",financeChanged),
 "abc",noticesCloud,{v2:true}).safeToRelease,false,"Order mismatch cannot use notice exemption");
const stockChanged={...noticesA,data:{...noticesA.data,
 ingredients:[{id:"i1",stock:999}]}};
assert.equal(inspectPendingAgainstCloud(makePending("abc",stockChanged),
 "abc",noticesCloud,{v2:true}).safeToRelease,false,"Stock mismatch cannot use notice exemption");
const cashChanged={...noticesA,data:{...noticesA.data,
 cashMovements:[{id:"withdraw-1",amount:30,kind:"sangria"}]}};
assert.equal(inspectPendingAgainstCloud(makePending("abc",cashChanged),
 "abc",noticesCloud,{v2:true}).safeToRelease,false,"Cash mismatch cannot use notice exemption");
const malformedNotices={...noticesA,data:{...noticesA.data,notificationCenter:{
 version:2,read:{"broadcast:local":"2026-11-19T00:00:00.000Z"}}}};
assert.equal(inspectPendingAgainstCloud(makePending("abc",malformedNotices),
 "abc",noticesCloud,{v2:true}).safeToRelease,false,"Unknown schema cannot be ignored");
assert.equal(inspectPendingAgainstCloud(makePending("wrong-account",noticesA),
 "abc",noticesCloud,{v2:true}).safeToRelease,false,"UID isolation is mandatory");

console.log("PASS: fingerprints estáveis, conflitos, revisões, limite de documento, backups e filas por conta.");
