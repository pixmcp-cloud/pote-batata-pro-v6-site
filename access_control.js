/* Permissões de serviços e universos. Ausência de bloqueio = FREE acessível.
   O Firestore contém a política do usuário, editável somente pelo ADM. */
(function(){
"use strict";
const universeIds=["batataria","pizzaria","hamburgueria","hotdog","lancheria","pastelaria"];
const services=[
 ["recipes","Receitas"],["ingredients","Ingredientes"],["orders","Vendas e pedidos"],
 ["clients","Clientes"],["suppliers","Fornecedores"],["expenses","Despesas"],
 ["stock","Compras e estoque"],["losses","Perdas"],["pricing","Precificação"],
 ["creatives","Criativos"],["reports","Relatórios"]
];
const tabs={recipes:"recipes",builder:"recipes",ingredients:"ingredients",orders:"orders",
 clients:"clients",suppliers:"suppliers",expenses:"expenses",losses:"losses",
 garimpo:"suppliers",pricing:"pricing",creative:"creatives",reports:"reports",
 combos:"stock",vitrine:"orders"};
const admin=()=>window.POTE_AUTH?.role==="admin";
const active=()=>typeof state==="undefined"?"batataria":state.data?.businessType||"batataria";
const cleanList=(items)=>Array.isArray(items)?items.filter(x=>typeof x==="string"):[];
function policy(){return window.POTE_AUTH?.accessPolicy||{}}
function allowsUniverse(type){
 if(!universeIds.includes(type))return false;
 if(admin())return true;
 if(window.POTE_AUTH?.franchiseActive)return type==="batataria";
 return !cleanList(policy().blockedUniverses).includes(type);
}
function allowsService(type,service){
 if(admin())return true;
 if(!allowsUniverse(type))return false;
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
window.POTE_ACCESS={universeIds,services,policy,allowsUniverse,allowsService,requireService,requireTab,groupService};
window.addEventListener("pote:access-updated",()=>{
 window.POTE_BUSINESS?.refreshAccess?.();
 if(!allowsUniverse(active())&&typeof window.POTE_BUSINESS?.open==="function")
  window.POTE_BUSINESS.open();
});
})();
