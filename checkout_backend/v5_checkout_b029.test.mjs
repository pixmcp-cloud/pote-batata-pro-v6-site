import '../finance_core.js';
import {compileV5Catalog} from './v5_checkout_catalog_lab.mjs';
import {quoteCheckout} from './checkout_domain.mjs';
import {v5SequenceBaseline,advanceV5Sequence} from './v5_checkout_sequence_lab.mjs';
import {planSharedKitchen} from './v5_shared_kitchen_lab.mjs';
async function run({compile,finance,quote,baseline,advance,shared},log){
 let n=0;const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(JSON.stringify([a,b]));n++};const reject=(fn,code)=>{let e;try{fn()}catch(x){e=x}eq(e?.code,code)};
 const branch={settings:{fee:0,tax:0,packageCost:1,otherCost:0,estimatedMonthlyUnits:100,margin:50},expenses:[{id:"e1",enabled:true,mode:"mensal",amount:100,repeat:1}],ingredients:[{id:"potato",yield:80,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg"}],recipes:[{id:"meal",name:"Batata",items:[{id:"potato",g:400}],pricingMode:"gain",targetGainPct:100}],beverages:[{id:"water",name:"Bebida",sellPrice:5,purchasePrice:2,purchaseQuantity:1}],addons:[{id:"extra",ingredientId:"potato",quantity:40,sellPrice:3}],combos:[{id:"starter",name:"Combo inicial",recipeId:"meal",beverageId:"water",addonIds:["extra"],catalogPreset:"starter-potato-soda",discountType:"percent",discountValue:5},{id:"normal",name:"Combo normal",recipeId:"meal",beverageId:"water",addonIds:["extra"],discountType:"percent",discountValue:10}]};
 const stockMap=[{stockId:"pot",group:"ingredients",itemId:"potato",universe:"batataria",recordKey:"potato",scale:1},{stockId:"drink",group:"beverages",itemId:"water",universe:"batataria",recordKey:"water",scale:1}];
 const cfg={finance,branch,stockMap,recipeIds:["meal"],beverageIds:["water"],addonIds:["extra"],comboIds:["starter","normal"],revision:"rev1",universe:"batataria"};
 const out=compile(cfg);const get=id=>out.products.find(p=>p.id===id);
 eq(get("starter").priceCents,2138);eq(get("normal").priceCents,2050);eq(get("starter").combo.discountCents,112);eq(get("starter").recipe,[{stockId:"pot",units:500},{stockId:"drink",units:1},{stockId:"pot",units:50}]);
 const actor={uid:"buyer1",role:"customer",verified:true,provider:"google.com"},store={...out,id:"shop1",enabled:true,inventory:[{id:"pot",availableUnits:2000},{id:"drink",availableUnits:10}]};
 const q=(productId,extras=[],quantity=1)=>quote(store,actor,{lines:[{productId,quantity,extras}],fulfillment:"pickup",paymentMethod:"pix"},1000000);
 eq(q("starter").totalCents,2138);eq(q("starter",[{id:"extra",quantity:1}]).totalCents,2450);eq(q("starter",[],2).required,[{stockId:"drink",units:2},{stockId:"pot",units:1100}]);eq(q("normal").totalCents,2050);
 const copy=x=>JSON.parse(JSON.stringify(x));const bad=copy(branch);bad.combos[1].discountValue=99;reject(()=>compile({...cfg,branch:bad}),"margin_floor");
 const bad2=copy(branch);bad2.combos[0].discountValue=6;reject(()=>compile({...cfg,branch:bad2}),"combo_not_supported");
 const bad3=copy(branch);bad3.beverages[0].purchasePrice=0;reject(()=>compile({...cfg,branch:bad3}),"unknown_beverage_cost");
 const bad4=copy(branch);bad4.settings.checkoutMinMarginPct=60;reject(()=>compile({...cfg,branch:bad4}),"margin_floor");
 const m={schemaVersion:5,state:{data:{businessType:"batataria",orderSequenceLast:28,businessUniverses:{pizzaria:{orderSequenceLast:7}}}}};eq(baseline(m,"batataria",3),28);eq(baseline(m,"batataria",30),30);eq(advance(m,"batataria",3,29).state.data.orderSequenceLast,29);eq(m.state.data.orderSequenceLast,28);eq(advance(m,"pizzaria",1,8).state.data.businessUniverses.pizzaria.orderSequenceLast,8);reject(()=>advance(m,"batataria",3,30),"sequence_conflict");reject(()=>baseline(m,"batataria",9999999),"sequence_exhausted");reject(()=>baseline(m,"hotdog",1),"sequence_not_ready");
 const i={id:"potato",name:"Batata",measureUnit:"g",stock:1000,purchasePrice:10,purchaseQuantity:1,purchaseUnit:"kg",yield:80,minimum:0};
 const meta={state:{data:{kitchenStock:{mode:"shared",inventory:{"batata|g":{...i}}}}}};
 const rec=(universe,key,id)=>({ownerUid:"owner1",key,updateTime:"v1",data:{record:{universe,group:"ingredients",id,item:{...i,id},rank:1}}});
 const records=[rec("batataria","r1","potato"),rec("pizzaria","r2","pz-potato")],args={ownerUid:"owner1",meta,records,requests:[{link:"batata|g",units:200,scale:1},{link:"batata|g",units:300,scale:1}],listingComplete:true};
 const plan=shared(args);eq(plan.meta.state.data.kitchenStock.inventory["batata|g"].stock,500);eq(plan.updates.map(d=>d.data.record.item.stock),[500,500]);eq(meta.state.data.kitchenStock.inventory["batata|g"].stock,1000);eq(records[0].data.record.item.stock,1000);
 reject(()=>shared({...args,listingComplete:false}),"shared_kitchen_not_ready");reject(()=>shared({...args,requests:[{link:"batata|g",units:1001,scale:1}]}),"insufficient_stock");reject(()=>shared({...args,records:[records[0],{...records[1],ownerUid:"other"}]}),"invalid_stock_mapping");const divergent=copy(records);divergent[1].data.record.item.stock=999;reject(()=>shared({...args,records:divergent}),"shared_kitchen_divergent");reject(()=>shared({...args,records:[...records,rec("pizzaria","r3","dup")]}),"shared_kitchen_divergent");
 log("PASS B02.9",n,"assertivas");
}
await run({compile:compileV5Catalog,finance:globalThis.POTE_FINANCE,quote:quoteCheckout,baseline:v5SequenceBaseline,advance:advanceV5Sequence,shared:planSharedKitchen},console.log);
