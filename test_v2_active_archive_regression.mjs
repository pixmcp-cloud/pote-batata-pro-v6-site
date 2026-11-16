import assert from "node:assert/strict";
import {combineState,splitState,recordId,diffState} from "./v2_store_core.mjs";
import {buildFranchiseCatalog,canPublishFranchiseCatalog,canPublishMatrixSource} from "./franchise_catalog.mjs";
function makeRecord(universe,group,id,item,rank=0){return {universe,group,id,item,rank}}
const add=(map,rec)=>map.set(recordId(rec.universe,rec.group,rec.id),rec);
const map=new Map();
const ingredients=[{id:"batata",name:"Batata",measureUnit:"g",yield:83},
 {id:"frango",name:"Frango",measureUnit:"g",yield:100}];
for(const [index,i] of ingredients.entries())add(map,makeRecord("batataria","ingredients",i.id,i,index));
add(map,makeRecord("batataria","recipes","r1",{
 id:"r1",name:"Batata com Frango",items:[{id:"batata",g:450},{id:"frango",g:100}],
 steps:["Cozinhar e servir"],templateOrigin:"batataria"
}));
add(map,makeRecord("pastelaria","ingredients","massa",{
 id:"massa",name:"Massa pastel",measureUnit:"g",yield:100}));
add(map,makeRecord("pastelaria","recipes","p1",{
 id:"p1",name:"Pastel",items:[{id:"massa",g:100}],steps:["Fritar"],templateOrigin:"pastelaria"
}));
// Reprodução do erro que atingiu a conta real: a lista archived contém o
// próprio universo ativo com fichas esvaziadas pelo codec V2.
const meta={data:{
 businessType:"batataria",universeDataVersion:3,brand:{name:"Potê Batata"},
 recipes:[],ingredients:[],orders:[],clients:[],expenses:[],settings:{},
 businessUniverses:{
  pastelaria:{recipes:[],ingredients:[],orders:[],brand:{name:"Pastelaria"},settings:{}},
  batataria:{recipes:[],ingredients:[],orders:[],brand:{name:"Batataria arquivada"},settings:{}}
 }}};
const original=structuredClone(meta);
const restored=combineState(meta,map);
assert.equal(restored.data.recipes.length,1,
 "O universo ativo precisa receber registros V2 mesmo com arquivo homônimo");
assert.equal(restored.data.ingredients.length,2);
assert.equal(restored.data.recipes[0].name,"Batata com Frango");
assert.equal(restored.data.brand.name,"Potê Batata","Identidade do universo ativo preservada");
assert.equal(restored.data.businessUniverses.pastelaria.recipes.length,1,
 "Universos inativos seguem separados");
assert.equal(restored.data.businessUniverses.pastelaria.ingredients.length,1);
assert.equal(restored.data.businessUniverses.batataria.recipes.length,0,
 "Arquivo homônimo pode ser mantido sem sobrescrever lista ativa");
assert.equal(original.data.recipes.length,0,"Não mutar parâmetros");
assert(canPublishMatrixSource(restored));
const catalog=buildFranchiseCatalog(restored);
assert.equal(catalog.recipes.length,1);
assert.equal(catalog.ingredients.length,2);
assert(canPublishFranchiseCatalog(catalog).ok,"Catálogo não pode ser falsamente vazio");
const before={meta:original,records:map};
const after=splitState(restored,map);
const changes=diffState(before,after);
assert(changes.changes.every(x=>x.kind==="meta"||x.after!==null),
 "Nenhum registro anterior pode ser apagado ao corrigir a leitura");
assert.equal(after.records.size,map.size);
assert(!Object.hasOwn(after.meta.data.businessUniverses,"batataria"),
 "Escrita futura remove apenas o arquivo homônimo redundante");
for(const [key,rec] of map)assert.deepEqual(after.records.get(key),rec,
 "Nenhum item, quantidade ou posição alterada: "+key);
const switched=structuredClone(restored);
switched.data.businessType="pastelaria";
const afterSwitch=combineState({...meta,data:{...meta.data,businessType:"pastelaria",
 businessUniverses:{batataria:{recipes:[],ingredients:[],brand:{name:"Batata"},settings:{}}}}},map);
assert.equal(afterSwitch.data.recipes.length,1,"Universo Pastelaria também carrega seus registros");
assert.equal(afterSwitch.data.businessUniverses.batataria.recipes.length,1);
console.log("PASS: V2 preenche ramo ADM ativo, não apaga registros, publica catálogo e preserva Pastelaria.");
