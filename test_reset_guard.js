const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('public/index.html','utf8');
const start=html.indexOf('resetAll=function(){'),end=html.indexOf('const poteOriginalRender',start);
assert(start>0&&end>start,'beta reset flow not found');
let downloads=0,resets=0,promptAnswer='NÃO',confirmed=true,backupFails=false;
let verification={ok:true,fileName:'backup-validado.json'},verifyCalls=0;
const saved={data:{recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[]}};
const window={
 POTE_AUTH:{uid:'tenant-one'},
 POTE_SYNC_GUARD:{
  blocked:false,
  hasPending:()=>false,
  downloadPending(){downloads++;if(backupFails)throw Error('download unavailable')},
  verifyBackupFile(uid,state){verifyCalls++;assert.equal(uid,'tenant-one');assert.deepEqual(state,saved);return Promise.resolve(verification)}
 },
 POTE_APP:{snapshot:()=>saved,reset(){resets++}},
 confirm:()=>confirmed,prompt:()=>promptAnswer
};
const ctx={window,console:{warn(){}},toast(){}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
async function flush(){await Promise.resolve();await Promise.resolve()}
(async()=>{
 ctx.resetAll();await flush();assert.equal(downloads,1);assert.equal(resets,0,'typed confirmation is mandatory');
 promptAnswer='ZERAR';window.POTE_SYNC_GUARD.blocked=true;
 ctx.resetAll();await flush();assert.equal(resets,0,'sync conflict must prohibit reset');
 window.POTE_SYNC_GUARD.blocked=false;backupFails=true;
 ctx.resetAll();await flush();assert.equal(resets,0,'download error must prohibit reset');
 backupFails=false;confirmed=false;
 ctx.resetAll();await flush();assert.equal(resets,0,'initial user consent mandatory');
 confirmed=true;window.POTE_SYNC_GUARD.hasPending=()=>true;
 ctx.resetAll();await flush();assert.equal(resets,0,'pending backup must block reset');
 window.POTE_SYNC_GUARD.hasPending=()=>false;verification={ok:false,error:'invalid file'};
 ctx.resetAll();await flush();assert.equal(resets,0,'invalid imported backup must block reset');
 verification={ok:true,fileName:'backup-validado.json'};
 const old=window.POTE_APP.snapshot;
 let captures=0;
 window.POTE_APP.snapshot=()=>{captures++;return captures===1?saved:{...saved,test:'changed'}};
 // Verify the selected backup, then reject if the real state changed.
 ctx.resetAll();await flush();assert.equal(resets,0,'state modified during verification must block reset');
 window.POTE_APP.snapshot=old;
 ctx.resetAll();await flush();assert.equal(resets,1,'only a re-opened verified matching backup can permit reset');
 assert(verifyCalls>=4);
 console.log('PASS reset protection: verified backup file, account/pending/change guard, two confirmations and no unverified deletion.');
})().catch(e=>{console.error(e);process.exit(1)});
