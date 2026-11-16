import assert from "node:assert/strict";
import {previewMigration} from "./migration_preview.mjs";
const legacy={data:{
 businessType:"batataria",
 businessUniverses:{pizzaria:{recipes:[{id:"r-pizza",name:"Pizza"}],orders:[{id:"p1"}]}},
 recipes:[{id:"r-batata",name:"Batata"}],ingredients:[{id:"i1",stock:2000}],
 orders:[{id:"o1",status:"recebido"}],clients:[{id:"c1"}],
 suppliers:[],expenses:[]
}};
const original=JSON.stringify(legacy);
const result=previewMigration(legacy);
assert(result.ok,JSON.stringify(result.errors));
assert.equal(result.sourcePreserved,true);
assert.equal(result.documents.length,6);
assert.equal(result.counts["batataria/orders"],1);
assert.equal(result.counts["pizzaria/orders"],1);
assert(result.documents.some(d=>d.path==="businessUniverses/pizzaria/orders/p1"));
assert.equal(JSON.stringify(legacy),original,"Preview must not mutate active or archived universes");
assert.equal(previewMigration({data:{orders:[{id:"1"},{id:"1"}]}}).ok,false,"Duplicate IDs must block migration");
assert.equal(previewMigration({data:{orders:[{price:0}]}}).ok,false,"Missing IDs must block migration");
assert.equal(previewMigration({state:{data:{orders:"invalid"}}}).ok,false,"Malformed collection must block migration");
assert.equal(previewMigration(null).ok,false);
console.log("PASS: prévia V2 somente leitura, todos os universos, verificações de IDs e nenhuma alteração de dados.");
