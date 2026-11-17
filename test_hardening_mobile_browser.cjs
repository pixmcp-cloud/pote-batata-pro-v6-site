const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const puppeteer=require('C:/Users/LIVRESOM/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const root=__dirname;
const expected={data:{recipes:[{id:'r1',name:'Frango'}],ingredients:[{id:'i1'}],orders:[],clients:[],suppliers:[],expenses:[]}};
const src=fs.readFileSync(path.join(root,'firebase_integration.js'),'utf8');
const from=src.indexOf('function verifyBackupFile('),to=src.indexOf('window.POTE_SYNC_GUARD=',from);
assert(from>0&&to>from,'real backup verifier not found');
const verifier=src.slice(from,to);
const syncSrc=fs.readFileSync(path.join(root,'sync_guard.mjs'),'utf8');
const mark=syncSrc.indexOf('export function validateBackup(');
assert(mark>0);
const validator=syncSrc.slice(mark).replace(/^export function validateBackup/,'function validateBackup');
const stableSrc="const stableJson=v=>JSON.stringify((function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sort(v)]));return x})(v));";
const mock="const auth={currentUser:{uid:'acct-mobile'}};"+stableSrc+validator+"\n"+verifier+"\nwindow.verifyBackupFile=verifyBackupFile; window.expected="+JSON.stringify(expected)+";";
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pote-mobile-backup-'));
 const good=path.join(tmp,'backup-acct-mobile.json'),bad=path.join(tmp,'backup-other.json');
 fs.writeFileSync(good,JSON.stringify({backupVersion:1,uid:'acct-mobile',state:expected}));
 fs.writeFileSync(bad,JSON.stringify({backupVersion:1,uid:'wrong-account',state:expected}));
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--disable-web-security','--allow-file-access-from-files']});
 try{
 const page=await browser.newPage();
 await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body><button id="verify">Verificar backup salvo</button><div id="status"></div></body></html>');
 await page.addScriptTag({content:mock});
 await page.evaluate(()=>document.querySelector('#verify').addEventListener('click',()=>{
   window.verifyBackupFile('acct-mobile',window.expected).then(r=>{window.lastResult=r;document.querySelector('#status').textContent=r.ok?'VERIFICADO':'BLOQUEADO';});
 }));
 for(const [filename,shouldAccept] of [[good,true],[bad,false]]){
  await page.evaluate(()=>{window.lastResult=null});
  const promise=page.waitForFileChooser({timeout:8000});
  await page.click('#verify');
  const chooser=await promise;await chooser.accept([filename]);
  await page.waitForFunction(()=>window.lastResult!==null,{timeout:8000});
  const result=await page.evaluate(()=>({result:window.lastResult, status:document.querySelector('#status').textContent,files:document.querySelectorAll('input[type=file]').length,scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.equal(result.result.ok,shouldAccept,JSON.stringify(result));
  assert.equal(result.files,0,'file picker removed after validating');
  assert(result.scroll<=result.width+1,'mobile backup flow overflows');
  console.log('MOBILE_BACKUP',path.basename(filename),result.status,'viewport',result.width);
 }
 await page.setViewport({width:320,height:740,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const narrow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert(narrow.scroll<=narrow.width+1,'320px backup flow overflow');
 // Check the actual generated beta login screen, not only a mocked dialog.
 const appPage=await browser.newPage();
 for(const width of [320,375,390,430,768]){
  await appPage.setViewport({width,height:844,deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
  await appPage.goto(pathToFileURL(path.join(root,'public','index.html')).href,{waitUntil:'domcontentloaded',timeout:12000});
  const layout=await appPage.evaluate(()=>({
    viewport:innerWidth,scroll:document.documentElement.scrollWidth,
    gate:!!document.getElementById('poteAuthGate'),
    meta:document.querySelector('meta[name=viewport]')?.content||'',
    initial:window.POTE_APP?.snapshot()?.data?.orders?.length,
    cash:window.POTE_APP?.snapshot()?.data?.cashSessions?.length,
  }));
  console.log('MOBILE_BETA_LAYOUT',width,JSON.stringify(layout));
  assert(layout.gate,'beta authentication gate must be present at '+width);
  assert(layout.scroll<=width+2,'beta layout horizontal overflow at '+width);
  assert.equal(layout.initial,0,'pré-login não carrega os pedidos da demonstração');
  assert.equal(layout.cash,0,'pré-login inicia sem caixa de demonstração');
 }
 console.log('PASS Chrome mobile: real backup file picker validates actual JSON; mismatched UID blocked; beta responsive at 320/375/390/430/768.');
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
