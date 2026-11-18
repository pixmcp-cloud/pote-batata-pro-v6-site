const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const calls={save:0,render:0,sync:0,download:0,warning:[],events:0};
const records=new Map();
const state={data:{businessType:"batataria",
 ingredients:[
 {id:"batata",name:"Batata",minimum:2500,stock:8000,measureUnit:"g"},
 {id:"embalagem",name:"Pote",minimum:20,stock:100,measureUnit:"un"},
 {id:"cebola",name:"Cebola",minimum:0,stock:300,measureUnit:"g"},
 {id:"temperos",name:"Temperos",minimum:0,stock:0,measureUnit:"g"}],
 beverages:[{id:"cola",name:"Refrigerante",minimum:10,stock:40}],
 recipes:[{id:"r1",items:[{id:"batata",g:250},{id:"cebola",g:40},
 {id:"temperos",g:5}],packagingIngredientIds:["embalagem"]}],
 addons:[],stockMovements:[]}};
const window={POTE_AUTH:{uid:"admin-qa",role:"admin",email:"pixmcp@gmail.com"},
 POTE_APP_READY:true,POTE_STOCK:{},POTE_SYNC_GUARD:{blocked:false,
 hasPending:()=>false,downloadPending(){calls.download++},
 showRecovery(){calls.sync++}},dispatchEvent(){calls.events++}};
const ctx={window,state,Number,String,Date,Math,Map,Set,JSON,
 navigator:{onLine:true},localStorage:{getItem:k=>records.get(k)||null,
 setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},
 confirm:()=>true,alert:x=>calls.warning.push(x),toast:()=>{},
 persist:()=>calls.save++,render:()=>calls.render++,uid:()=>String(calls.save)+"-"+Math.random(),
 Event:class{constructor(type){this.type=type;}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("stock_ui.js","utf8"),ctx);
const ui=window.POTE_STOCK_UI;
assert(ui.criticalStockPermitted());
assert.equal(ui.criticalStockTarget({minimum:2500,stock:8000,measureUnit:"g"}),250);
assert.equal(ui.criticalStockTarget({minimum:20,stock:100,measureUnit:"un"}),2);
assert.equal(ui.criticalStockTarget({minimum:0,stock:0,measureUnit:"g"},5),0.5);
assert.equal(ui.criticalStock10Apply(),true);
assert.deepEqual(state.data.ingredients.map(x=>x.stock),[250,2,4,0.5]);
assert.deepEqual(state.data.beverages.map(x=>x.stock),[1]);
assert.equal(state.data.stockMovements.length,5);
assert.equal(calls.download,1);
assert.equal(calls.save,1);
assert.equal(calls.events,1);
assert.equal(ui.criticalStock10Apply(),false,"Do not overwrite original backup");
assert.match(calls.warning.at(-1),/backup dos saldos anteriores/);
assert.equal(ui.criticalStock10Restore(),true);
assert.deepEqual(state.data.ingredients.map(x=>x.stock),[8000,100,300,0]);
assert.deepEqual(state.data.beverages.map(x=>x.stock),[40]);
assert.equal(state.data.stockMovements.length,10);
assert.equal(calls.save,2);
assert.equal(calls.events,2);
assert.equal(ui.criticalStock10Apply(),true);
state.data.ingredients[0].stock=400;
assert.equal(ui.criticalStock10Restore(),false,
 "Restoration blocked if a stock entry was adjusted after the test");
assert.equal(state.data.ingredients[0].stock,400);
window.POTE_SYNC_GUARD.blocked=true;
assert.equal(ui.criticalStock10Apply(),false);
assert.equal(calls.sync,1);
window.POTE_SYNC_GUARD.blocked=false;
window.POTE_AUTH.email="another-shop@example.invalid";
assert.equal(ui.criticalStock10Restore(),false,"Other tenants must never access backup");
console.log("PASS admin-only stock 10%, all ingredients/packaging/beverages, reversible, conflicts gated, no double backup");
