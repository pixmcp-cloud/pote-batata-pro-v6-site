import test from "node:test";
import assert from "node:assert/strict";
import {transactionComplexCostPreview} from "../src/complex_cost_preview.mjs";
import {recordPath} from "../src/domain.mjs";
const uid="f02-preview",universe="qa";
const records=[["ingredients","potato","g",10,1,"kg"],["packaging","pot","un",20,10,"un"],["addons","bacon","g",50,1,"kg"],["beverages","juice","un",30,10,"un"]];
const docs=new Map(records.map(([group,id,measureUnit,purchasePrice,purchaseQuantity,purchaseUnit])=>[recordPath(uid,universe,group,id),{data:{record:{group,id,universe,item:{measureUnit,purchasePrice,purchaseQuantity,purchaseUnit}}}}]));
const recipe={items:[{id:"potato",g:250}],packagingItems:[{id:"pot",quantity:1}],addons:[{id:"bacon",quantity:2,unit:"g"}],beverages:[{id:"juice",quantity:1}],targetGainPct:100};
test("F02 complex cost preview reads all components from same transaction",async()=>{
 const read=[];const tx={async get(path){read.push(path);return docs.get(path)}};
 const result=await transactionComplexCostPreview(tx,uid,universe,recipe);
 assert.equal(read.length,4);
 assert.equal(result.cost.materialCostCents,760);
 assert.equal(result.minimumPriceCents,1520);
});
test("F02 complex preview rejects missing, mismatched and estimated components",async()=>{
 const first=recordPath(uid,universe,"ingredients","potato");
 for(const replacement of [undefined,{data:{record:{group:"beverages",id:"potato",universe,item:{}}}},{data:{record:{...docs.get(first).data.record,item:{...docs.get(first).data.record.item,hasUnknownCosts:true}}}}]){
  const tx={async get(path){return path===first?replacement:docs.get(path)}};
  await assert.rejects(transactionComplexCostPreview(tx,uid,universe,recipe));
 }
});
