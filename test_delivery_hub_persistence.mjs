import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {splitState,combineState} from "./v2_store_core.mjs";
import {ensureHub,normalizeOrder,stageOrders} from "./delivery_hub_core.mjs";
const g={window:{},Date,Math,JSON,Map,Set,String,Array,Number};
vm.createContext(g);vm.runInContext(readFileSync("universe_core.js","utf8"),g);
const U=g.window.POTE_UNIVERSES;
const seed={data:{businessType:"batataria",businessUniverses:{},
 recipes:[{id:"r1",name:"Batata",items:[]}],ingredients:[],orders:[],clients:[],suppliers:[],
 expenses:[],settings:{},brand:{name:"Potê"}}};
const row=normalizeOrder("cardapioai",{numeroPedido:"ORDER-991",nomeCliente:"Ana",produtos:[{nome:"Pastel Carne",quantidade:1,valor:25}]},{storeAlias:"loja-1"});
stageOrders(ensureHub(seed),[row]);
U.switchTo(seed,"pastelaria",{}, {skipTemplates:true});
assert.equal(seed.data.deliveryHub.orders.length,1,"Troca de ramo não deve apagar fila externa");
U.switchTo(seed,"batataria",{}, {skipTemplates:true});
assert.equal(seed.data.deliveryHub.orders.length,1);
const separated=splitState(seed);
assert.equal(separated.meta.data.deliveryHub.orders.length,1,"Fila deve ficar nos metadados V2, não em ramo separado");
const rebuilt=combineState(separated.meta,separated.records);
assert.equal(rebuilt.data.deliveryHub.orders[0].externalId,"ORDER-991");
assert.equal(rebuilt.data.recipes[0].id,"r1");
assert(!separated.records.size||[...separated.records.values()].every(r=>r.universe!=="deliveryhub"),"V2 não deve vazar dados para um universo fictício");
const other={data:{businessType:"batataria",businessUniverses:{},recipes:[],orders:[],ingredients:[],clients:[],suppliers:[],expenses:[],settings:{},brand:{}}};
assert.equal(ensureHub(other).orders.length,0,"Conta independente não pode herdar fila de pedidos de outra conta");
console.log("PASS: Hub persiste no Firestore V2 e acompanha 6 universos, sem herdar dados de outras contas.");
