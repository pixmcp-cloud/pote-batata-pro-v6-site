/* Corte V5: limpeza controlada SOMENTE de documentos operacionais V1/V2 de TESTE.
 * Dry-run por padrao. Requer autorizacao expressa do dono para --apply.
 * NUNCA apaga usuarios, identidade, perfis, licencas, franquias, V5 ou outros projetos.
 * Execucao local: node scripts/v5_cleanup_legacy.cjs [--apply]
 */
'use strict';
const path=require('node:path'),cp=require('node:child_process');
const PROJECT='potobatata-b71f3';
const API='https://firestore.googleapis.com/v1/';
const ROOT='projects/'+PROJECT+'/databases/(default)/documents';
const MAX_USERS=4; // Contas auditadas em 20/11/2026. Abortar se o universo de contas mudar.
const DIRECT=['recipes','ingredients','suppliers','products','clients','orders','inventory','expenses'];
const META=new Set(['main','v2','v2Pulse','v2InventoryGuard']);
const apply=process.argv.includes('--apply');
async function credentials(){
 const npmRoot=cp.execSync('npm root -g',{encoding:'utf8'}).trim();
 const base=path.join(npmRoot,'firebase-tools','lib');
 const cfg=require(path.join(base,'configstore')).configstore;
 const auth=require(path.join(base,'auth'));
 const token=cfg.get('tokens');
 if(!token?.refresh_token)throw Error('Firebase CLI sem sessao autenticada.');
 const fresh=await auth.getAccessToken(token.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
 const value=typeof fresh==='string'?fresh:fresh?.access_token;
 if(!value)throw Error('Token de administracao nao disponivel.');
 return value;
}
async function api(method,url,token){
 for(let attempt=0;attempt<5;attempt++){
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token}});
  if(response.status===404)return null;
  if(response.ok)return method==='DELETE'?true:await response.json();
  if([429,500,502,503,504].includes(response.status)&&attempt<4){
   await new Promise(r=>setTimeout(r,500*Math.pow(2,attempt)));continue;
  }
  const error=await response.text();
  throw Error('Firestore HTTP '+response.status+': '+error.slice(0,240));
 }
 throw Error('Tentativas de API esgotadas.');
}
async function list(collection,token){
 const docs=[];let page='';
 for(let round=0;round<30;round++){
  const suffix='?pageSize=500'+(page?'&pageToken='+encodeURIComponent(page):'');
  const result=await api('GET',API+ROOT+'/'+collection+suffix,token);
  docs.push(...(result?.documents||[]));
  page=result?.nextPageToken||'';
  if(!page)return docs;
 }
 throw Error('Colecao grande demais para limpar automaticamente: '+collection);
}
const allowed=name=>{
 const escaped=name.replace(ROOT+'/','');
 return /^users\/[^/]+\/(?:records\/[^/]+|appState\/(?:main|v2|v2Pulse|v2InventoryGuard)|(?:recipes|ingredients|suppliers|products|clients|orders|inventory|expenses)\/[^/]+)$/.test(escaped);
};
(async()=>{
 const token=await credentials();
 const users=await list('users',token);
 if(users.length!==MAX_USERS)throw Error('Foram encontradas '+users.length+' contas, esperadas '+MAX_USERS+'. Operacao suspensa para proteger novos usuarios.');
 const plan=[],labels=[];
 for(let index=0;index<users.length;index++){
  const uid=users[index].name.split('/').pop();
  const paths=['records','appState',...DIRECT];
  const counts={};
  for(const collection of paths){
   const items=await list('users/'+uid+'/'+collection,token);
   const old=collection==='appState'?items.filter(d=>META.has(d.name.split('/').pop())):items;
   for(const d of old){
    if(!allowed(d.name))throw Error('Caminho fora da whitelist, nao apagar: '+d.name);
    plan.push(d.name);
   }
   if(old.length)counts[collection]=old.length;
  }
  const v5=await list('users/'+uid+'/recordsV5',token);
  labels.push({account:'Conta '+(index+1),old:counts,v5Preserved:v5.length});
 }
 const unique=new Set(plan);
 if(unique.size!==plan.length)throw Error('Plano contem documentos repetidos');
 console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',users:users.length,legacyDocuments:plan.length,accounts:labels,v5Untouched:true}));
 if(!apply){console.log('NENHUMA GRAVACAO. Execute com --apply para autorizar a limpeza final.');return;}
 if(process.env.POTE_V5_CLEANUP_CONFIRM!=='SIM_20261120')throw Error('Confirmacao de ambiente ausente. Nao houve exclusoes.');
 let cursor=0,removed=0;
 const worker=async()=>{while(true){
  const n=cursor++;if(n>=plan.length)return;
  await api('DELETE',API+plan[n],token);removed++;
 }};
 await Promise.all(Array.from({length:8},worker));
 if(removed!==plan.length)throw Error('Exclusoes incompletas: '+removed+'/'+plan.length);
 const remain=[];
 for(const u of users){
  const uid=u.name.split('/').pop();
  for(const collection of ['records','appState',...DIRECT]){
   const docs=await list('users/'+uid+'/'+collection,token);
   const old=collection==='appState'?docs.filter(x=>META.has(x.name.split('/').pop())):docs;
   if(old.length)remain.push({collection,count:old.length});
  }
 }
 if(remain.length)throw Error('Residuos identificados: '+JSON.stringify(remain));
 console.log('V5_CLEANUP_OK excluidos='+removed+' usuarios='+users.length+' perfis_licencas_V5_preservados=true residuos=0');
})().catch(e=>{console.error('V5_CLEANUP_ERROR',e.stack||e);process.exitCode=1});
