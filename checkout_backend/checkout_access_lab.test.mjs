import {publicCatalog,authorizeCheckoutRoute} from "./checkout_access_lab.mjs";
function run(publicCatalog,authorize,log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=(fn,code)=>{let e;try{fn()}catch(x){e=x}eq(e?.code,code)};
 const store={ownerUid:"owner1",online:"shop1",counter:"counter1"},identity={uid:"buyer1",provider:"google.com",emailVerified:true},owner={...identity,uid:store.ownerUid};
 const m={lab:true,enabled:true,channel:"online",storeId:"shop1",revision:"rev1",ownerUid:"private",stockMap:[{recordKey:"private"}],deliveryEnabled:true,deliveryFeeCents:500,products:[{id:"meal",title:"Batata",available:true,priceCents:1450,recipe:[{stockId:"secret"}],costCents:800,extras:[{id:"extra",title:"Extra",priceCents:300,recipe:["secret"]}]},{id:"hidden",available:false}]};
 eq(publicCatalog(m),{storeId:"shop1",revision:"rev1",products:[{id:"meal",title:"Batata",priceCents:1450,extras:[{id:"extra",title:"Extra",priceCents:300}]}],deliveryEnabled:true,deliveryFeeCents:500});
 eq(publicCatalog({...m,deliveryEnabled:false}).deliveryFeeCents,0);
 reject(()=>publicCatalog({...m,channel:"counter"}),"store_unavailable");reject(()=>publicCatalog({...m,enabled:false}),"store_unavailable");reject(()=>publicCatalog({...m,deliveryFeeCents:-1}),"invalid_catalog");
 const call=(route,body={storeId:store.online},extra={})=>authorize({surface:"customer",route,identity,body,store,...extra});
 for(const route of ["quote","submitSaved","recoverSubmit","status"])eq(call(route),{uid:"buyer1"});
 for(const route of ["openCash","closeCash","moveCash","adjustStock","transition","snapshot","submit"])reject(()=>call(route),"forbidden");
 reject(()=>call("quote",{storeId:store.counter}),"forbidden");reject(()=>call("quote",{storeId:"other"}),"forbidden");
 reject(()=>call("quote",{storeId:store.online,role:"merchant"}),"invalid_request");
 reject(()=>call("quote",undefined,{identity:{...identity,emailVerified:false}}),"login_required");
 reject(()=>call("quote",undefined,{identity:{...identity,provider:"password"}}),"login_required");
 reject(()=>call("snapshot",{}, {surface:"merchant"}),"forbidden");
 const merchant=(route,body={})=>call(route,body,{surface:"merchant",identity:owner});
 eq(merchant("snapshot"),{uid:"owner1"});eq(merchant("openCash"),{uid:"owner1"});eq(merchant("transition",{storeId:store.online}),{uid:"owner1"});eq(merchant("quote",{storeId:store.counter}),{uid:"owner1"});
 reject(()=>merchant("transition",{storeId:"other"}),"forbidden");reject(()=>merchant("quote",{storeId:store.online}),"forbidden");reject(()=>merchant("openCash",{storeId:"shop1"}),"invalid_request");reject(()=>merchant("adjustStock",{storeId:"other"}),"forbidden");
 log("PASS B02-G2 access",n,"assertivas");
}
run(publicCatalog,authorizeCheckoutRoute,console.log);
