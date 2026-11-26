import {expiryForTerm,resolveLicense,licenseCountdown,LICENSE_TERMS} from "../license_terms.mjs";
import {checkoutEntitlement} from "./v5_checkout_authority_lab.mjs";
import {splitState,combineState,diffState} from "../v5_store_core.mjs";
import {retainedFreeSlots,retainedOriginalAllowed} from "../free_limits.mjs";
function run(lib,log){
 const {expiryForTerm,resolveLicense,licenseCountdown,LICENSE_TERMS,checkoutEntitlement,splitState,combineState,diffState,retainedFreeSlots,retainedOriginalAllowed}=lib;
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=(fn,code)=>{let e;try{fn()}catch(x){e=x}eq(e?.code??e?.message,code)};
 const start=Date.UTC(2026,10,26,15),end=start+168*3600000,trial={kind:"trial",term:"trial7d",status:"active",expiresAt:new Date(end).toISOString()},universe="batataria";
 eq(expiryForTerm("trial7d",new Date(start)).getTime(),end);eq(expiryForTerm("trial24h",new Date(start)).getTime(),start+86400000);eq(LICENSE_TERMS.some(x=>x.id==="trial7d"),true);
 eq(resolveLicense(trial,start).label,"TESTE 7 DIAS");eq(licenseCountdown(trial,start).formatted,"00a 07d 00h 00m 00s");eq(resolveLicense(trial,end-1).active,true);eq(resolveLicense(trial,end).reason,"expired");eq(resolveLicense(trial,end+1).kind,"free");eq(resolveLicense({...trial,status:"revoked"},start).active,false);
 eq(checkoutEntitlement({license:trial},universe,end-1),"trial");reject(()=>checkoutEntitlement({license:trial},universe,end),"license_required");reject(()=>checkoutEntitlement({license:{...trial,term:"unknown"}},universe,start),"license_required");eq(checkoutEntitlement({license:{...trial,expiresAt:{seconds:end/1000}}},universe,start),"trial");
 const initial={data:{businessType:universe,businessUniverses:{},recipes:[{id:"mine1",name:"Original"}],ingredients:[{id:"ing1",name:"Original",stock:500}],suppliers:[{id:"sup1",name:"Original"}],orders:[{id:"order1",price:15}],cashSessions:[],cashMovements:[]}};
 const free=splitState(initial,new Map(),{free:true}),slots=retainedFreeSlots(free.records);
 eq(slots["free~base~recipes"].id,"mine1");
 const promoted=combineState(free.meta,free.records);
 for(let i=2;i<=20;i++){promoted.data.recipes.push({id:"mine"+i,name:"Receita "+i});promoted.data.ingredients.push({id:"ing"+i,name:"Insumo "+i,stock:i});promoted.data.suppliers.push({id:"sup"+i,name:"Fornecedor "+i})}
 promoted.data.orders.push({id:"order2",price:30});
 const pro=splitState(promoted,free.records,{reserveFreeSlots:true}),before=retainedFreeSlots(pro.records);
 eq(before,slots);eq(pro.records.get("free~base~recipes").id,"mine1");
 const restored=combineState(pro.meta,pro.records),downgraded=splitState(restored,pro.records,{free:true}),after=retainedFreeSlots(downgraded.records);
 eq(diffState(pro,downgraded).changes.length,0);eq(restored.data.recipes.length,20);eq(restored.data.ingredients.length,20);eq(restored.data.suppliers.length,20);eq(restored.data.orders.length,2);eq(after,before);
 const allowed=(group,items)=>items.filter(x=>retainedOriginalAllowed(after,{universe,group,id:x.id})).map(x=>x.id);
 eq(allowed("recipes",restored.data.recipes),["mine1"]);eq(allowed("ingredients",restored.data.ingredients),["ing1"]);eq(allowed("suppliers",restored.data.suppliers),["sup1"]);
 eq(retainedOriginalAllowed(after,{universe:"pizzaria",group:"recipes",id:"mine1"}),false);
 const edited=combineState(pro.meta,pro.records);edited.data.recipes.find(x=>x.id==="mine2").name="Alteração";reject(()=>splitState(edited,pro.records,{free:true}),"free/limit");
 const added=combineState(pro.meta,pro.records);added.data.recipes.push({id:"mine21",name:"Nova"});reject(()=>splitState(added,pro.records,{free:true}),"free/limit");
 const renewed=splitState(restored,downgraded.records);eq(diffState(downgraded,renewed).changes.length,0);eq(combineState(renewed.meta,renewed.records).data.recipes.length,20);
 const fresh={data:{businessType:universe,businessUniverses:{},recipes:[{id:"new1"},{id:"new2"}]}};
 const firstTrial=splitState(fresh,new Map(),{reserveFreeSlots:true});eq(retainedFreeSlots(firstTrial.records)["free~base~recipes"].id,"new1");
 const oldPro=splitState(fresh);const oldProTrial=splitState(fresh,oldPro.records,{reserveFreeSlots:true});eq(retainedFreeSlots(oldProTrial.records),{}); // no arbitrary selection of historical originals
 log("PASS B02-G7 downgrade",n,"assertivas");
}
run({expiryForTerm,resolveLicense,licenseCountdown,LICENSE_TERMS,checkoutEntitlement,splitState,combineState,diffState,retainedFreeSlots,retainedOriginalAllowed},console.log);
