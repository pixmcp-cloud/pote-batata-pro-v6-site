/* F02: transaction-scoped cost resolution for complex recipes.
 * Preview only. Approval, stock reservation and checkout remain gated until
 * every component type has a validated inventory contract.
 */
import {OperationalError,recordPath} from "./domain.mjs";
import {complexRecipeComponentLines,authoritativeComponentCost,minimumApprovedPriceCents} from "./component_cost.mjs";
const groupFor={ingredient:"ingredients",packaging:"packaging",addon:"addons",beverage:"beverages"};
const reject=()=>{throw new OperationalError("Ficha de componente incompleta ou incompatível",409,"cost_review_required")};
export async function transactionComplexCostPreview(tx,uid,universe,recipe){
 if(!tx||typeof tx.get!=="function"||typeof uid!=="string"||typeof universe!=="string")reject();
 const lines=complexRecipeComponentLines(recipe);
 const paths=lines.map(({kind,id})=>recordPath(uid,universe,groupFor[kind],id));
 const documents=await Promise.all(paths.map(path=>tx.get(path)));
 // Existing V2 accounts store packaging in ingredients, with category
 // "Embalagem" and measureUnit "un". Prefer a dedicated packaging record.
 // Only if ABSENT may the server use the verified legacy physical record.
 const legacy=await Promise.all(lines.map(({kind,id},i)=>
  kind==="packaging"&&!documents[i]?
   tx.get(recordPath(uid,universe,"ingredients",id)):Promise.resolve(null)));
 const resolved=new Map();
 for(let i=0;i<lines.length;i++){
  const {kind,id}=lines[i];
  const dedicated=documents[i]?.data?.record;
  const fallback=!dedicated&&kind==="packaging"?legacy[i]?.data?.record:null;
  const legacyValid=fallback?.group==="ingredients"&&
   fallback.universe===universe&&fallback.id===id&&
   fallback.item?.category==="Embalagem"&&fallback.item?.measureUnit==="un";
  const rec=dedicated||(legacyValid?fallback:null);
  if(legacyValid&&lines.some(line=>line.kind==="ingredient"&&line.id===id))
   reject();
  if(!rec||rec.id!==id||rec.universe!==universe||
     rec.group!==(legacyValid?"ingredients":groupFor[kind])||
     !rec.item||rec.item.archived===true)reject();
  resolved.set(kind+":"+id,{kind,id,item:rec.item,
   archived:rec.item.archived,costEstimateMode:rec.item.costEstimateMode,
   hasUnknownCosts:rec.item.hasUnknownCosts});
 }
 const cost=authoritativeComponentCost(lines,(kind,id)=>resolved.get(kind+":"+id));
 const minimum=Number(recipe.targetGainPct??recipe.serverMinimumGainPct??100);
 return Object.freeze({lines,cost,minimumPriceCents:minimumApprovedPriceCents(cost.materialCostCents,minimum)});
}
