const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const sandbox={window:{},Date,JSON,Object,Array,Math,Number,String,Map,Set,console};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("universe_core.js","utf8"),sandbox);
const U=sandbox.window.POTE_UNIVERSES;
assert(U.fields.includes("cashSessions"),"Cash sessions must be isolated");
assert(U.fields.includes("cashMovements"),"Cash movements must be isolated");
assert(U.fields.includes("garimpoOffers"),"Price offers must be isolated");
const state={data:{businessType:"batataria",universeDataVersion:2,businessUniverses:{},
 recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[],
 settings:{},brand:{},businessTemplates:{},
 cashSessions:[{id:"sBatata",status:"open",openingCash:100}],
 cashMovements:[{id:"mBatata",sessionId:"sBatata",kind:"sangria",amount:15}],
 garimpoOffers:[{id:"ofertaBatata",price:9.9}]},creatives:[]};
const copy=x=>JSON.parse(JSON.stringify(x));
const batata=copy({s:state.data.cashSessions,m:state.data.cashMovements,p:state.data.garimpoOffers});
U.switchTo(state,"pizzaria",{}, {skipTemplates:true});
assert.equal(state.data.universeDataVersion,3,"Migrated schema version should advance");
assert.equal(state.data.cashSessions.length,0,"Pizza must not inherit batataria open cash");
assert.equal(state.data.cashMovements.length,0);
assert.equal(state.data.garimpoOffers.length,0);
state.data.cashSessions.push({id:"sPizza",status:"open",openingCash:25});
state.data.cashMovements.push({id:"mPizza",sessionId:"sPizza",amount:3});
state.data.garimpoOffers.push({id:"pizzaOffer"});
U.switchTo(state,"batataria",{}, {skipTemplates:true});
assert.deepEqual(JSON.parse(JSON.stringify(state.data.cashSessions)),batata.s);
assert.deepEqual(JSON.parse(JSON.stringify(state.data.cashMovements)),batata.m);
assert.deepEqual(JSON.parse(JSON.stringify(state.data.garimpoOffers)),batata.p);
U.switchTo(state,"pizzaria",{}, {skipTemplates:true});
assert.equal(state.data.cashSessions[0].id,"sPizza");
assert.equal(state.data.cashMovements[0].sessionId,"sPizza");
assert.equal(state.data.garimpoOffers[0].id,"pizzaOffer");
// Previous v2 archives have no financial keys; restore must create empty arrays.
const legacy={data:{businessType:"pizzaria",universeDataVersion:2,
 businessUniverses:{batataria:{recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],
 expenses:[],settings:{},brand:{},businessTemplates:{}}},
 recipes:[],ingredients:[],orders:[],clients:[],suppliers:[],expenses:[],settings:{},brand:{},
 cashSessions:[{id:"legacyPizza"}],cashMovements:[{id:"legacyMovement"}],
 garimpoOffers:[{id:"legacyOffer"}],businessTemplates:{}},creatives:[]};
U.switchTo(legacy,"batataria",{}, {skipTemplates:true});
assert.equal(legacy.data.cashSessions.length,0,"Legacy archive must not inherit other universe cash");
assert.equal(legacy.data.cashMovements.length,0);
assert.equal(legacy.data.garimpoOffers.length,0);
assert.equal(legacy.data.businessUniverses.pizzaria.cashSessions[0].id,"legacyPizza");
console.log("PASS V3: caixa, movimentos e ofertas permanecem isolados mesmo após migração V2->V3.");
