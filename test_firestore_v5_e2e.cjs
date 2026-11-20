/* Emulação E2E com usuários Google autenticados, Firestore Emulator e V5 real.
 * Nenhum acesso ao banco oficial. Nenhuma chave de usuário real.
 * Dois dispositivos: concorrência, pedidos, produção, PDV, cancelamento, offline.
 */
'use strict';
const assert=require('node:assert/strict');
const {initializeEmulator,assertFails,sdk}=require('./qa/firestore/environment.cjs');
const {openCash,calculateCash,confirmPaymentOnSaleCompletion,
 paymentConfirmed,closeCash}=require('./pdv_cash_core.mjs');
const cp=x=>JSON.parse(JSON.stringify(x));
const empty=()=>({data:{businessType:'batataria',businessUniverses:{},orderSequenceLast:0,
 recipes:[],ingredients:[],orders:[],beverages:[],cashSessions:[],cashMovements:[],
 stockMovements:[],purchases:[],losses:[],clients:[],suppliers:[],expenses:[],
 settings:{usePackagingStock:false},brand:{name:'Emulação V5'}}});
let env;const actors=[];
const stat={checks:0,accounts:3,sessions:0,orders:0,conflicts:0,
 production:0,cancellations:0,offlines:0,recoveries:0};
const check=(condition,message)=>{assert.ok(condition,message);stat.checks++};
const success=(result,label)=>{check(result.ok===true||typeof result.created==='boolean',label+' '+JSON.stringify(result));return result};
(async()=>{
 const {createV5Store}=await import('./v5_storage.mjs');
 env=await initializeEmulator({hardened:process.env.POTE_HARDENED_RULES==='1'});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await Promise.all([
   sdk.setDoc(sdk.doc(db,'users','qa-company-1'),{email:'company1@example.test',
    license:{kind:'lifetime',term:'lifetime',status:'active'}}),
   sdk.setDoc(sdk.doc(db,'users','qa-company-2'),{email:'company2@example.test',
    license:{kind:'lifetime',term:'lifetime',status:'active'}}),
   sdk.setDoc(sdk.doc(db,'users','qa-free'),{email:'free@example.test'}),
   sdk.setDoc(sdk.doc(db,'users','qa-race-new'),{email:'race@example.test',
    license:{kind:'lifetime',term:'lifetime',status:'active'}})
  ]);
 });
 const login=(uid,email)=>{
  let state=empty(),blocked=false;
  const authDb=env.authenticatedContext(uid,{email,email_verified:true,
   firebase:{sign_in_provider:'google.com'}}).firestore();
  const simulatedSdk={...sdk,runTransaction(...args){
   if(blocked){const e=new Error('Simulador: conexão temporariamente indisponível');
    e.code='unavailable';return Promise.reject(e)}
   return sdk.runTransaction(...args);
  }};
  const store=createV5Store({uid,db:authDb,sdk:simulatedSdk,
   fresh:()=>{state=empty()},snapshot:()=>cp(state),apply:data=>{state=cp(data)}});
  const actor={store,db:authDb,mutate:cb=>cb(state),read:()=>cp(state),
   disconnect:()=>{blocked=true},reconnect:()=>{blocked=false}};
  actors.push(actor);stat.sessions++;
  return actor;
 };
 const a=login('qa-company-1','company1@example.test');
 const b=login('qa-company-1','company1@example.test');
 const other=login('qa-company-2','company2@example.test');
 const free=login('qa-free','free@example.test');
 console.log('QA_STAGE: inicializar primeira conta Pro');
 await a.store.load();
 console.log('QA_STAGE: abrir segunda sessao Pro');
 await b.store.load();
 console.log('QA_STAGE: inicializar outra empresa');
 await other.store.load();
 console.log('QA_STAGE: inicializar conta Free');
 await free.store.load();
 check(a.read().data.orders.length===0&&b.read().data.orders.length===0,
  'Login novo deve carregar pedidos vazios');
 check(other.read().data.orders.length===0&&free.read().data.orders.length===0,
  'Contas separadas devem iniciar sem histórico alheio');
 // Compra inicial e abertura de caixa em uma das duas sessões.
 a.mutate(s=>{
  s.data.ingredients.push({id:'batata',name:'Batata',stock:2000,
   measureUnit:'g',purchaseQuantity:1,purchaseUnit:'kg',purchasePrice:6,yield:100});
  s.data.recipes.push({id:'receita',name:'Batata assada',
   items:[{id:'batata',g:500}],targetGainPct:100});
 });
 success(await a.store.save(),'Estoque inicial');
 success(await b.store.refresh(),'Segundo dispositivo recebe estoque');
 a.mutate(s=>openCash(s.data,{id:'cash-1',openingCash:100,operator:'QA',
  at:'2026-11-20T10:00:00.000Z'}));
 success(await a.store.save(),'Abrir caixa');
 success(await b.store.refresh(),'Segundo dispositivo vê caixa');
 check(b.read().data.cashSessions.filter(x=>x.status==='open').length===1,
  'Sessão de caixa deve estar visível apenas na empresa');
 // Dois aparelhos tentam usar o MESMO sequencial vitalício, e apenas um pode vencer.
 const newOrder=(actor,id)=>{
  actor.mutate(s=>{
   s.data.orderSequenceLast=1;
   s.data.orders.unshift({id,orderNumber:1,qty:1,price:25,deliveryFee:0,
    recipeId:'receita',status:'recebido',items:[{id:'batata',g:500,yieldPct:100}],
    beverageItems:[],paymentMethod:'Pix',paymentStatus:'Informado',
    cashSessionId:'cash-1'});
  });
 };
 newOrder(a,'order-a');newOrder(b,'order-b');
 const racing=await Promise.all([a.store.save(),b.store.save()]);
 const wins=racing.filter(r=>r.ok),losses=racing.filter(r=>!r.ok);
 check(wins.length===1&&losses.length===1,'Duas vendas simultâneas não podem ocupar #P0000001 duas vezes: '+JSON.stringify(racing));
 stat.conflicts++;
 const winning=wins[0]===racing[0]?a:b;
 const loser=winning===a?b:a;
 const canonical=login('qa-company-1','company1@example.test');
 success(await canonical.store.load(),'Consulta independente após corrida');
 const saved=canonical.read();
 check(saved.data.orders.length===1&&saved.data.orderSequenceLast===1,
  'A empresa deve ter exatamente um primeiro pedido');
 check(saved.data.orders[0].orderNumber===1,'Sequência deve ser #P0000001');
 stat.orders++;
 // Produção: baixa de 500g e movimento obrigatório no mesmo commit.
 canonical.mutate(s=>{
  const order=s.data.orders[0];
  order.status='em_producao';order.stockDeducted=true;
  s.data.ingredients[0].stock=1500;
  s.data.stockMovements.unshift({id:'m1',ingredientId:'batata',quantity:-500,
   previousStock:2000,afterStock:1500,reason:'Produção',referenceId:order.id});
 });
 success(await canonical.store.save(),'Produção com baixa atômica');
 stat.production++;
 check(canonical.read().data.ingredients[0].stock===1500,
  'Produção deve descontar exatamente 500g');
 // Finalização Pix: sem duplo lançamento no caixa.
 canonical.mutate(s=>{
  s.data.orders[0].status='entregue';
  const payment=confirmPaymentOnSaleCompletion(s.data,{
   orderId:s.data.orders[0].id,operator:'QA',at:'2026-11-20T11:00:00.000Z'});
  check(payment.recorded===true,'Conclusão de venda deve confirmar Pix');
  const duplicate=confirmPaymentOnSaleCompletion(s.data,{
   orderId:s.data.orders[0].id,operator:'QA'});
  check(duplicate.recorded===false,'Pagamento duplicado deve ser rejeitado');
 });
 success(await canonical.store.save(),'Conclusão e pagamento');
 check(paymentConfirmed(canonical.read().data.orders[0]),'Pix deve constar confirmado');
 check(calculateCash(canonical.read().data,'cash-1').confirmedByMethod.pix===25,
  'PDV deve incluir R$25 em Pix');
 check(calculateCash(canonical.read().data,'cash-1').expectedCash===100,
  'Pix não pode somar ao saldo em dinheiro');
 // Cancelamento após produzir: evento de perda, nunca devolver estoque consumido.
 canonical.mutate(s=>{
  const order=s.data.orders[0];order.status='cancelado';
  order.stockReturnDeclined=true;order.lossEventId='loss-1';
  s.data.losses.push({id:'loss-1',orderId:order.id,type:'order',
   reason:'Cancelamento após produção',amount:25,at:'2026-11-20T11:10:00.000Z'});
 });
 success(await canonical.store.save(),'Cancelamento após produção registra prejuízo');
 stat.cancellations++;
 check(canonical.read().data.ingredients[0].stock===1500,
  'Cancelamento após produção não deve repor 500g');
 const cashReport=calculateCash(canonical.read().data,'cash-1');
 canonical.mutate(s=>closeCash(s.data,{countedCash:100,operator:'QA'}));
 success(await canonical.store.save(),'Fechamento de caixa');
 check(calculateCash(canonical.read().data,'cash-1').expectedCash===cashReport.expectedCash,
  'Fechamento deve preservar valor histórico');
 check(canonical.read().data.cashSessions[0].status==='closed',
  'Caixa deve encerrar');
 const newTurn=login('qa-company-1','company1@example.test');
 success(await newTurn.store.load(),'Nova sessão após fechamento');
 newTurn.mutate(s=>openCash(s.data,{id:'cash-2',openingCash:40,operator:'QA'}));
 success(await newTurn.store.save(),'Abrir novo turno sem travar caixa antigo');
 check(newTurn.read().data.cashSessions.filter(x=>x.status==='open').length===1,
  'Um único caixa deve permanecer aberto');
 // Isolamento: outro usuário pode usar exatamente os mesmos IDs e sequencial.
 other.mutate(s=>{
  s.data.orderSequenceLast=1;
  s.data.orders.push({id:'order-a',orderNumber:1,status:'recebido',qty:1,
   price:20,paymentMethod:'Pix',paymentStatus:'Informado',items:[]});
 });
 success(await other.store.save(),'Pedido independente de outra empresa');
 check(other.read().data.orders.length===1,'A outra empresa salva seus dados próprios');
 const otherDb=other.db;
 await assertFails(sdk.getDoc(sdk.doc(otherDb,'users','qa-company-1',
  'appState','v5')));
 stat.checks++;
 const freshFree=free.read();
 check(freshFree.data.orders.length===0&&freshFree.data.cashSessions.length===0,
  'FREE não recebe pedidos ou caixa de outras contas');
 // FREE não pode criar um PDV financeiro.
 free.mutate(s=>openCash(s.data,{id:'cash-free',openingCash:0,operator:'QA'}));
 const denied=await free.store.save();
 check(!denied.ok,'FREE não deve criar caixa PRO: '+JSON.stringify(denied));
 free.store.dispose();
 const freeAgain=login('qa-free','free@example.test');
 success(await freeAgain.store.load(),'FREE reinicia sem registros bloqueados');
 check(freeAgain.read().data.cashSessions.length===0,
  'Tentativa recusada não deve deixar caixa fantasma no servidor');
 // Queda de conexão seguida de retomada sem duplicar cadastro.
 const device=login('qa-company-2','company2@example.test');
 success(await device.store.load(),'Sessão de rede degradada');
 device.mutate(s=>s.data.suppliers.push({id:'supplier1',name:'Fornecedor QA'}));
 device.disconnect();
 const offlineSave=await device.store.save();
 check(offlineSave.ok===false&&offlineSave.code==='unavailable',
  'Offline deve recusar operação sem marcar salva: '+JSON.stringify(offlineSave));
 stat.offlines++;
 device.reconnect();
 success(await device.store.save(),'Reconexão deve recuperar alteração pendente');
 stat.recoveries++;
 const verify=login('qa-company-2','company2@example.test');
 success(await verify.store.load(),'Verificar reconexão no Firestore');
 check(verify.read().data.suppliers.length===1,
  'Reconexão não pode duplicar fornecedor');
 // Releitura após concorrência deve reproduzir saldos e caixa.
 const final=login('qa-company-1','company1@example.test');
 success(await final.store.load(),'Releitura final independente');
 check(final.read().data.orders.length===1&&final.read().data.ingredients[0].stock===1500,
  'Pedido e saldo devem persistir');
 check(final.read().data.cashSessions.filter(x=>x.status==='closed').length===1&&
  final.read().data.cashSessions.filter(x=>x.status==='open').length===1,
  'Caixas antigo encerrado e novo aberto no teste');
 // Abertura simultânea de uma conta inédita: todos os navegadores
 // devem carregar V5 sem exigir reiniciar a tela ou enfraquecer as regras.
 const parallel=Array.from({length:5},()=>login('qa-race-new','race@example.test'));
 const boot=await Promise.allSettled(parallel.map(actor=>actor.store.load()));
 check(boot.every(x=>x.status==='fulfilled'&&
   typeof x.value?.created==='boolean'),
   'Cinco logins simultâneos em conta inédita falharam: '+
   JSON.stringify(boot.map(x=>x.status==='rejected'?
    {status:x.status,code:x.reason?.code,message:x.reason?.message}:x.value)));
 check(parallel.every(x=>x.read().data.orders.length===0),
   'Novas sessões concorrentes não podem misturar pedidos de outra conta');
 stat.parallelFirstLogins=boot.length;
 console.log('PASS_V5_AUTH_E2E '+JSON.stringify(stat));
})().catch(e=>{console.error('FAIL_V5_AUTH_E2E',e.stack||e);process.exitCode=1})
.finally(async()=>{actors.forEach(x=>x.store.dispose());if(env)await env.cleanup()});
