// V5: Smoke test no Chrome real, emulando 320px, Android, landscape e desktop.
// Nao faz login nem grava no Firestore de producao.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const path=require('node:path'),cp=require('node:child_process');
const chrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pote-v5-chrome-'));
const child=cp.spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check',
 '--disable-gpu','--disable-background-networking','--remote-debugging-port=0',
 '--user-data-dir='+temp,'about:blank'],{stdio:'ignore',windowsHide:true});
let ws;
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function connect(){
 let port=0;
 for(let i=0;i<75;i++){
  try{const file=fs.readFileSync(path.join(temp,'DevToolsActivePort'),'utf8');
   port=Number(file.trim().split(/\r?\n/)[0]);if(port)break;}catch(e){}
  await sleep(200);
 }
 if(!port)throw Error('Chrome CDP indisponivel');
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
 const tab=targets.find(t=>t.type==='page');
 if(!tab)throw Error('Nenhuma aba para teste');
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad;});
 return ws;
}
const pending=new Map();let seq=0,exceptions=[],failedRequests=[];
function receive(event){
 const packet=JSON.parse(event.data);
 if(packet.id!=null){const p=pending.get(packet.id);if(!p)return;pending.delete(packet.id);
  packet.error?p.reject(Error(JSON.stringify(packet.error))):p.resolve(packet.result);return;}
 if(packet.method==='Runtime.exceptionThrown')
  exceptions.push(packet.params?.exceptionDetails?.text||'Excecao JS');
 if(packet.method==='Network.loadingFailed'){
  const e=packet.params?.errorText||'erro de rede';
  if(!/ERR_ABORTED/.test(e))failedRequests.push(e);
 }
}
function call(method,params={}){
 const id=++seq;
 return new Promise((resolve,reject)=>{
  pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params}));
  setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('CDP timeout '+method));}},15000);
 });
}
async function evaluate(expression){
 const data=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(data.exceptionDetails)throw Error('DOM eval: '+data.exceptionDetails.text);
 return data.result?.value;
}
async function main(){
 await connect();ws.addEventListener('message',receive);
 await Promise.all([call('Page.enable'),call('Runtime.enable'),call('Network.enable')]);
 const results=[];
 for(const screen of [
   {name:'Android estreito',width:320,height:568,mobile:true},
   {name:'Android padrao',width:375,height:812,mobile:true},
   {name:'Android grande',width:412,height:915,mobile:true},
   {name:'Android paisagem',width:834,height:375,mobile:true},
   {name:'Desktop',width:1366,height:768,mobile:false}
 ]){
  await call('Emulation.setDeviceMetricsOverride',{width:screen.width,height:screen.height,
   deviceScaleFactor:screen.mobile?3:1,mobile:screen.mobile});
  await call('Emulation.setTouchEmulationEnabled',{enabled:screen.mobile,maxTouchPoints:5});
  await call('Page.navigate',{url:'https://pdv.livresom.com/?qa='+screen.width+'x'+screen.height});
  for(let tick=0;tick<35;tick++){
   await sleep(250);
   const ready=await evaluate('document.readyState');
   if(ready==='complete'&&tick>=7)break;
  }
  const info=await evaluate(`(()=>({
   url:location.href,ready:document.readyState,
   viewport:window.innerWidth,body:document.body?.scrollWidth||0,
   doc:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
   gateExists:!!document.querySelector('#poteAuthGate'),
   gateVisible:!!document.querySelector('#poteAuthGate')&&!document.querySelector('#poteAuthGate').hidden,
   loginVisible:(()=>{const b=document.querySelector('#poteGoogleLogin');if(!b)return false;
    const r=b.getBoundingClientRect();return r.width>90&&r.height>25&&r.left>=0&&r.right<=innerWidth+1;})(),
   loginDisabled:!!document.querySelector('#poteGoogleLogin')?.disabled,
   loginText:document.querySelector('#poteLoginMessage')?.textContent||'',
   moduleLoaded:performance.getEntriesByType('resource').some(x=>x.name.includes('firebase_integration.js')),
   storageLoaded:performance.getEntriesByType('resource').some(x=>x.name.includes('v5_storage.mjs')),
   legacyStorageLoaded:performance.getEntriesByType('resource').some(x=>x.name.includes('v2_storage.mjs')),
   title:document.title
  }))()`);
  assert(info.gateExists&&info.gateVisible,'Sem protecao Google em '+screen.name);
  assert(info.loginVisible,'Botao Google inacessivel em '+screen.name);
  assert(info.moduleLoaded&&info.storageLoaded,'Bibliotecas V5 nao chegaram em '+screen.name);
  assert(!info.legacyStorageLoaded,'Browser baixou armazenamento V2 antigo');
  results.push({screen:screen.name,viewport:screen.width,docWidth:info.doc,
   overflow:info.doc>info.viewport+2,loginVisible:info.loginVisible,
   loginText:info.loginText,authGate:info.gateVisible});
 }
 console.log(JSON.stringify({status:'PASS',screens:results,exceptions:exceptions.slice(0,8),
  networkErrors:failedRequests.slice(0,8),jsExceptionCount:exceptions.length,
  networkErrorCount:failedRequests.length}));
}
main().catch(e=>{console.error('V5_BROWSER_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>{
 try{ws?.close();}catch(e){}
 try{child.kill();}catch(e){}
 await sleep(150);
 try{fs.rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:250})}catch(e){}
});
