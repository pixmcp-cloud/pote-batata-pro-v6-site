/* F02: authoritative component-cost calculation. This module does not grant
 * price approvals. Catalog and order flows must integrate it transactionally
 * before complex recipes can be sold through the Worker.
 */
import {OperationalError} from "./domain.mjs";
import {costUnit} from "./order_create.mjs";
const reject=(message)=>{throw new OperationalError(message,409,"cost_review_required")};
const kinds=new Set(["ingredient","packaging","addon","beverage"]);
const positive=(value,label)=>{
 if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>1000000)
  reject(label+" inválido");
 return value;
};
export function authoritativeComponentCost(lines,resolve){
 if(!Array.isArray(lines)||lines.length===0||lines.length>128||
  typeof resolve!=="function")reject("Lista de componentes inválida");
 let total=0;
 const details=[];
 for(const line of lines){
  if(!line||typeof line!=="object"||Array.isArray(line)||
   !kinds.has(line.kind)||typeof line.id!=="string"||
   !/^[a-zA-Z0-9_.:-]{1,180}$/.test(line.id))
   reject("Componente desconhecido");
  const quantity=positive(line.quantity,"Quantidade");
  const document=resolve(line.kind,line.id);
  if(!document||document.id!==line.id||document.kind!==line.kind||
   document.archived===true||document.costEstimateMode==="estimated"||
   document.hasUnknownCosts===true)reject("Ficha de custo ausente ou estimada");
  const item=document.item;
  if(!item||typeof item!=="object"||Array.isArray(item))
   reject("Ficha de custo ausente");
  const expectedUnit=line.kind==="beverage"?"un":line.kind==="packaging"?"un":null;
  const unit=line.unit;
  if(!["g","ml","un"].includes(unit)||expectedUnit&&unit!==expectedUnit||
   item.measureUnit!==unit)reject("Unidade do componente incompatível");
  const yieldPct=item.yield===undefined?100:positive(item.yield,"Rendimento");
  if(yieldPct>100)reject("Rendimento acima de 100%");
  const unitCost=costUnit(item);
  if(!Number.isFinite(unitCost)||unitCost<=0)
   reject("Custo unitário desconhecido");
  const cost=quantity*unitCost/(yieldPct/100);
  if(!Number.isFinite(cost)||cost<=0||cost>1e9)
   reject("Custo calculado inválido");
  total+=cost;
  details.push(Object.freeze({kind:line.kind,id:line.id,quantity,unit,
   costCents:Math.ceil(cost*100-1e-9)}));
 }
 if(!Number.isFinite(total)||total<=0||total>1e9)
  reject("Custo total inválido");
 return Object.freeze({materialCostCents:Math.ceil(total*100-1e-9),
  details:Object.freeze(details)});
}
// F02 complex catalog preflight: normalize explicit server-stored component lines.
// This helper does not authorize checkout or bypass assertSimpleRecipeScope.
// Unsupported combo nesting and unknown shapes fail closed.
export function complexRecipeComponentLines(recipe){
 if(!recipe||typeof recipe!=="object"||Array.isArray(recipe))
  reject("Receita complexa inválida");
 const supported=[
  ["items","ingredient","g"],
  ["packagingItems","packaging","un"],
  ["addons","addon",null],
  ["beverages","beverage","un"]
 ];
 const unsupported=["comboIds","comboItems","includedAddonIds",
  "packagingIngredientIds","addonIds","extraIds","beverageIds",
  "selectedAddons","extras","priceIncludesExtras"];
 for(const key of unsupported){
  const value=recipe[key];
  if(value!==undefined&&value!==null&&value!==false&&
   (!Array.isArray(value)||value.length>0))reject("Componente sem contrato homologado: "+key);
 }
 const lines=[];
 for(const [field,kind,defaultUnit] of supported){
  const group=recipe[field];
  if(group===undefined)continue;
  if(!Array.isArray(group)||group.length>64)reject("Lista inválida: "+field);
  for(const entry of group){
   if(!entry||typeof entry!=="object"||Array.isArray(entry)||
    Object.keys(entry).some(k=>!["id","g","quantity","unit"].includes(k)))
    reject("Componente inválido: "+field);
   const quantity=entry.quantity??entry.g;
   if(entry.quantity!==undefined&&entry.g!==undefined)
    reject("Quantidade ambígua: "+field);
   lines.push({kind,id:entry.id,quantity,unit:entry.unit??defaultUnit});
  }
 }
 if(!lines.some(x=>x.kind==="ingredient")||lines.length>128)
  reject("Receita sem ingredientes ou com componentes demais");
 return Object.freeze(lines.map(line=>Object.freeze(line)));
}
export function minimumApprovedPriceCents(materialCostCents,minimumGainPct){
 if(!Number.isSafeInteger(materialCostCents)||materialCostCents<1||
  materialCostCents>1e11||typeof minimumGainPct!=="number"||
  !Number.isFinite(minimumGainPct)||minimumGainPct<0||minimumGainPct>500)
  reject("Custo ou ganho mínimo inválido");
 return Math.ceil(materialCostCents*(1+minimumGainPct/100)-1e-9);
}
