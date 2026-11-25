/* Permissões de serviços e universos. Ausência de bloqueio = FREE acessível.
   O Firestore contém a política do usuário, editável somente pelo ADM. */
(function(){
"use strict";
const universeIds=["batataria","pizzaria","hamburgueria","hotdog","lancheria","pastelaria"];
const services=[
 ["recipes","Receitas"],["ingredients","Ingredientes"],["orders","Vendas e pedidos"],
 ["clients","Clientes"],["suppliers","Fornecedores"],["expenses","Despesas"],
 ["stock","Compras e estoque"],["losses","Perdas"],["pricing","Precificação"],
 ["creatives","Criativos"],["reports","Relatórios"],["motoboy","Motoboy"],["deliveryhub","Hub de Delivery"]
];
const tabs={recipes:"recipes",builder:"recipes",ingredients:"ingredients",orders:"orders",
 clients:"clients",suppliers:"suppliers",expenses:"expenses",losses:"losses",
 garimpo:"suppliers",pricing:"pricing",creative:"creatives",reports:"reports",
 combos:"stock",vitrine:"orders",motoboy:"motoboy",deliveryhub:"deliveryhub"};
const admin=()=>window.POTE_AUTH?.role==="admin";
const active=()=>typeof state==="undefined"?"batataria":state.data?.businessType||"batataria";
const cleanList=(items)=>Array.isArray(items)?items.filter(x=>typeof x==="string"):[];
function policy(){return window.POTE_AUTH?.accessPolicy||{}}
const FREE_TYPES=universeIds.filter(type=>type!=="lancheria");
function freeChoice(){
 const auth=window.POTE_AUTH;if(!auth?.uid)return null;
 if(FREE_TYPES.includes(auth.serverFreeUniverse))return auth.serverFreeUniverse;
 if(FREE_TYPES.includes(auth.freeUniverse))return auth.freeUniverse;
 try{const stored=localStorage.getItem("pote-free-segment-bridge:"+auth.uid);if(FREE_TYPES.includes(stored))return stored;}catch{}
 const data=typeof state==="undefined"?null:state.data;
 const current=data?.businessType;
 if(FREE_TYPES.includes(current)&&(data.businessTemplates?.[current]||["recipes","ingredients","orders","clients","beverages"].some(key=>data[key]?.length)))return current;
 return null;
}
function rememberChoice(type){const auth=window.POTE_AUTH;if(!auth?.uid||admin()||auth.proActive||auth.franchiseActive||!FREE_TYPES.includes(type))return;auth.freeUniverse=freeChoice()||type;try{localStorage.setItem("pote-free-segment-bridge:"+auth.uid,auth.freeUniverse)}catch{}}
function requiresChoice(){const auth=window.POTE_AUTH;if(!auth?.uid||admin()||auth.proActive||auth.franchiseActive)return false;const chosen=freeChoice();return (Boolean(window.POTE_SEGMENT_API)&&!FREE_TYPES.includes(auth.serverFreeUniverse))||!chosen||typeof state!=="undefined"&&state.data?.businessType!==chosen;}
function allowsUniverse(type){
 if(!universeIds.includes(type))return false;
 if(admin())return true;
 if(window.POTE_AUTH?.franchiseActive)return type==="batataria";
 if(cleanList(policy().blockedUniverses).includes(type))return false;
 if(window.POTE_AUTH?.proActive)return true;
 const chosen=freeChoice();return FREE_TYPES.includes(type)&&(!chosen||chosen===type);
}
function allowsService(type,service){
 if(admin())return true;
 if(!allowsUniverse(type))return false;
 if(!admin()&&!window.POTE_AUTH?.proActive&&!window.POTE_AUTH?.franchiseActive&&window.POTE_SEGMENT_API&&!FREE_TYPES.includes(window.POTE_AUTH?.serverFreeUniverse))return false;
 return !cleanList(policy().blockedServices).includes(type+":"+service);
}
function requireService(service,type=active()){
 if(allowsService(type,service))return true;
 if(typeof toast==="function")toast("🔒 Serviço bloqueado pelo administrador nesta conta.");
 else alert("Serviço bloqueado pelo administrador nesta conta.");
 return false;
}
function requireTab(tab){
 const service=tabs[tab];
 if(tab==="home"||tab==="business"||tab==="settings"||tab==="admin"||tab==="brand"||tab==="gallery")return true;
 return requireService(service||"recipes");
}
function groupService(group){
 if(["recipeVersions","recipeTrash"].includes(group))return "recipes";
 if(["stockMovements","purchases","prepBatches","beverages","addons","combos"].includes(group))return "stock";
 if(["cashSessions","cashMovements"].includes(group))return "orders";
 return group;
}
window.POTE_ACCESS={universeIds,services,policy,freeChoice,rememberChoice,requiresChoice,allowsUniverse,allowsService,requireService,requireTab,groupService};
window.addEventListener("pote:access-updated",()=>{
 window.POTE_BUSINESS?.refreshAccess?.();
 if((requiresChoice()||!allowsUniverse(active()))&&typeof window.POTE_BUSINESS?.open==="function")
  window.POTE_BUSINESS.open();
});
})();
