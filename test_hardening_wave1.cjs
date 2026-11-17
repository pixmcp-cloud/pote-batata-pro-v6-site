const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('source/pote_app_base.html','utf8');
function part(from,to){
 const a=src.indexOf(from),b=src.indexOf(to,a+from.length);
 assert(a>=0&&b>a,'missing source anchor '+from);
 return src.slice(a,b);
}
const functions=part('function parseBRNumber(v)','function commercialDate(')
 +part('function paymentSettled(order)','function setMode(')
 +part('function operationReady(){','function canOperate(');
const data={
 orders:[
 {id:'pending-pix',status:'entregue',paymentStatus:'Informado',price:100,qty:1,deliveryFee:10,deliveryCost:6,profit:30},
 {id:'paid-cash',status:'entregue',paymentStatus:'Pago em dinheiro',price:50,qty:2,deliveryFee:0,deliveryCost:0,profit:20},
 {id:'cancelled',status:'cancelado',paymentStatus:'pago',price:999,qty:1,profit:900},
 {id:'not-paid',status:'entregue',paymentStatus:'nao_pago',price:25,qty:1,profit:5}
 ]
};
const window={POTE_LOSSES:{totals:()=>({cost:5,uncollected:25,count:1})},POTE_AUTH:{uid:'tenant-1'},POTE_APP_READY:true,
 POTE_MODULE_HEALTH:{safeToOperate:true},POTE_SYNC_GUARD:{blocked:false}};
const context={window,state:{data},navigator:{onLine:true},Number,String,Intl,Math,Date,toast:()=>{},console};
vm.createContext(context);vm.runInContext(functions,context);
for(const [raw,value] of [['1.234,56',1234.56],['R$ 1.234,56',1234.56],['12,50',12.5],['1,234.56',1234.56],['-3,75',-3.75],['1.234',1.234]])
 assert.equal(context.parseBRNumber(raw),value,raw);
for(const raw of ['12,3,4','1.2.3','R$ abc',''])assert(Number.isNaN(context.parseBRNumber(raw)),raw);
const t=context.totals();
assert.equal(t.sales,210);assert.equal(t.receivedRevenue,100);
assert.equal(t.pendingRevenue,110);assert.equal(t.profit,35);
assert.equal(t.receivedCount,1);assert.equal(t.pendingCount,1);
assert.equal(t.registeredProfitEstimate,69);
assert.equal(context.paymentSettled({status:'entregue',paymentStatus:'confirmado'}),true);
assert.equal(context.paymentSettled({status:'entregue',paymentStatus:'Pendente'}),false);
assert.equal(context.operationReady(),true);
window.POTE_MODULE_HEALTH=null;window.POTE_HEALTH=null;
assert.equal(context.operationReady(),false,'must fail closed with missing essential health');
window.POTE_HEALTH={scan:()=>{window.POTE_MODULE_HEALTH={safeToOperate:true}}};
assert.equal(context.operationReady(),true,'must re-check healthy critical modules');
const migrate=part('if(!state.pricingPreset100V1){','function persist(){');
const legacy={pricingPreset100V1:false,data:{recipes:[
 {id:'legacy-custom',pricingMode:'margin',targetGainPct:150},
 {id:'legacy-empty'},
 {id:'legacy-gain',pricingMode:'gain',targetGainPct:175}
]}};
vm.runInNewContext('var state=JSON.parse(input);'+migrate+';result=state',{input:JSON.stringify(legacy),result:null});
const c={input:JSON.stringify(legacy),result:null};vm.runInNewContext('var state=JSON.parse(input);'+migrate+';result=state',c);
assert.equal(c.result.data.recipes[0].targetGainPct,150);
assert.equal(c.result.data.recipes[0].pricingMode,'margin');
assert.equal(c.result.data.recipes[1].targetGainPct,100);
assert.equal(c.result.data.recipes[1].pricingMode,'gain');
assert.equal(c.result.data.recipes[2].targetGainPct,175);
assert.equal(c.result.pricingPreset100V1,true);
assert(fs.readFileSync('delivery_hub.js','utf8').includes('pote:user-logout'));
console.log('PASS hardening wave 1: paid/pending accounting, BR currency, legacy recipe migration, strict module readiness, delivery logout.');
