/* FREE: uma ação/cadastro operacional por grupo em cada universo extra.
   Contas PRO, franquias e ADM não passam por esta validação.
   Fichas e insumos-modelo não contam como cadastros autorais. */
export const FREE_LIMITED_GROUPS=Object.freeze({
 recipes:1,ingredients:1,orders:1,clients:1,suppliers:1,expenses:1,
 purchases:1,losses:1,prepBatches:1,beverages:1,addons:1,combos:1,cashSessions:1
});
const custom=(record)=>{
 const item=record?.item||{};
 if(record?.group==="recipes"||record?.group==="ingredients")
  return !item.templateOrigin&&!item.modelRecipe;
 if(record?.group==="beverages")return !item.catalogPreset;
 if(record?.group==="combos")return !item.catalogPreset;
 return true;
};
const quantity=(records,universe,group)=>{
 let n=0;
 for(const rec of records.values())if(rec.universe===universe&&rec.group===group&&custom(rec))n++;
 return n;
};
/** A operação não exige apagar registros anteriores que já ultrapassavam a quota. */
export function checkFreeUniverseDelta(before,after,universe){
 if(!universe||universe==="batataria")return {ok:true};
 for(const [group,limit] of Object.entries(FREE_LIMITED_GROUPS)){
  const old=quantity(before,universe,group),next=quantity(after,universe,group);
  if(next>limit&&next>old)
   return {ok:false,group,count:next,limit,
    error:"FREE: máximo de "+limit+" registro por funcionalidade neste universo ("+group+")."};
 }
 return {ok:true};
}
