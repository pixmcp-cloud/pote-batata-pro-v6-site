const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('make_beta.py','utf8');
const begin=source.indexOf('const poteOriginalRender=render;');
const end=source.indexOf('const poteOriginalGo=go;',begin);
assert(begin>=0&&end>begin);
const fragment=source.slice(begin,end);
const data={recipes:[{id:'1',name:'X'}],orders:[],businessType:'batataria'};
const events=[];
const window={
 POTE_AUTH:{uid:'a'},POTE_APP:{snapshot:()=>({data})},
 dispatchEvent:e=>events.push(e.type),
 POTE_KITCHEN:{capture(){}},POTE_STOCK:{normalizeInventory(){return {invalid:[]}}},
 POTE_DRINKS:{ensure(){}},POTE_BUSINESS:{refresh(){}}
};
let tab='home';
const state={get tab(){return tab},set tab(x){tab=x},data};
const ctx={window,state,Event:class Event{constructor(type){this.type=type}},console,JSON,
 render:()=>{},};
vm.createContext(ctx);
vm.runInContext(fragment,ctx);
ctx.render();assert.equal(events.length,1);
tab='reports';ctx.render();assert.equal(events.length,1,'switching tabs cannot emit data change');
tab='orders';ctx.render();assert.equal(events.length,1,'orders view cannot emit data change');
data.recipes[0].name='Y';ctx.render();assert.equal(events.length,2,'real data change must be signalled');
ctx.render();assert.equal(events.length,2);
window.POTE_AUTH={uid:'b'};ctx.render();assert.equal(events.length,3,'switch accounts must not reuse previous fingerprint');
window.POTE_AUTH=null;ctx.render();assert.equal(events.length,3);
window.POTE_AUTH={uid:'b'};ctx.render();assert.equal(events.length,4,'log out and return triggers a safe refresh');
console.log('PASS F14: render only emits data-change notifications for actual state changes and account transitions.');
