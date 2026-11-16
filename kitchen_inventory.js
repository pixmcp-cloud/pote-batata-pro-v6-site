/* Estoque por cozinha, privado da conta: modo compartilhado ou separado.
   Modo existente sem configuração permanece separado até conciliação explícita.
   Compartilhamento replica saldo entre universos, nunca entre UIDs distintos. */
(function(){
"use strict";
if(window.POTE_KITCHEN)return;
const copy=v=>JSON.parse(JSON.stringify(v));
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalize=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const fields=["stock","purchasePrice","price","purchaseQuantity","purchaseUnit","yield","minimum"];
const observed=new Map();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const branch=state=>state?.data?.businessType||"batataria";
const key=item=>item.kitchenLink||normalize(item.name)+"|"+String(item.measureUnit||"g").toLowerCase();
const snapshot=item=>Object.fromEntries(fields.map(f=>[f,item[f]??null]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const getStore=state=>state?.data?.kitchenStock;
const mode=state=>getStore(state)?.mode==="shared"?"shared":"separate";
function branchItems(state){
 const list=[],active=branch(state),all={...(state?.data?.businessUniverses||{})};
 all[active]=state.data;
 for(const [universe,data] of Object.entries(all)){
  if(!data||!Array.isArray(data.ingredients))continue;
  for(const item of data.ingredients){if(!item||item.archived||!item.id)continue;
   list.push({universe,item,kind:key(item)});
  }
 }
 return list;
}
function conflicts(state){
 const byKey=new Map();
 for(const row of branchItems(state)){
  if(!byKey.has(row.kind))byKey.set(row.kind,[]);
  byKey.get(row.kind).push(row);
 }
 const problem=[];
 for(const [k,rows] of byKey){
  const positives=rows.filter(r=>num(r.item.stock)>0);
  if(positives.length>1)problem.push({name:k,count:positives.length,
   stocks:positives.map(r=>r.universe+":"+num(r.item.stock))});
 }
 return problem;
}
function initShared(state){
 const conflict=conflicts(state);
 if(conflict.length)return {ok:false,conflicts:conflict,error:"Há saldos positivos do mesmo insumo em vários universos. Confira antes de compartilhar; não somaremos nem apagaremos nada."};
 const merged={};
 for(const row of branchItems(state)){
  const current=merged[row.kind],candidate=snapshot(row.item);
  if(!current||num(candidate.stock)>0||num(current.purchasePrice)<=0&&num(candidate.purchasePrice)>0)
   merged[row.kind]=candidate;
 }
 return {ok:true,inventory:merged};
}
function project(state){
 if(mode(state)!=="shared")return false;
 const inv=getStore(state).inventory??(getStore(state).inventory={});
 for(const item of state.data.ingredients||[]){
  if(!item?.id)continue;
  const k=key(item),cache=branch(state)+":"+item.id;
  if(!inv[k])inv[k]=snapshot(item);
  for(const f of fields)if(inv[k][f]!=null)item[f]=inv[k][f];
  observed.set(cache,snapshot(item));
 }
 return true;
}
function capture(state){
 if(mode(state)!=="shared")return false;
 const inv=getStore(state).inventory??(getStore(state).inventory={});
 const count=new Map();
 for(const item of state.data.ingredients||[])if(item?.id)count.set(key(item),(count.get(key(item))||0)+1);
 let changed=false;
 for(const item of state.data.ingredients||[]){
  if(!item?.id||count.get(key(item))!==1)continue;
  const k=key(item),cache=branch(state)+":"+item.id,current=snapshot(item),prev=observed.get(cache);
  if(!inv[k]){inv[k]=current;changed=true}
  else if(prev&&!same(prev,current)){
   // Only user-modified fields are updated: stale rows cannot clobber the kitchen.
   for(const f of fields)if(!same(prev[f],current[f]))inv[k][f]=current[f];
   changed=true;
  }else if(!prev){
   // New records adopt the kitchen's balance, preventing phantom stock on import.
   for(const f of fields)if(inv[k][f]!=null)item[f]=inv[k][f];
  }
  observed.set(cache,snapshot(item));
 }
 return changed;
}
function setMode(target){
 if(!["shared","separate"].includes(target))return;
 if(window.POTE_SYNC_GUARD?.blocked)return alert("Conflito de sincronização. Exporte o backup e resolva antes.");
 const kitchen=state.data.kitchenStock??(state.data.kitchenStock={mode:"separate",inventory:{}});
 if(mode(state)===target)return;
 if(target==="shared"){
  const result=initShared(state);
  if(!result.ok){alert(result.error+"\n\n"+result.conflicts.slice(0,8).map(x=>x.name+" — "+x.stocks.join(", ")).join("\n"));return}
  if(!confirm("Ativar estoque compartilhado apenas entre os universos DESTA conta? Os saldos históricos serão preservados e insumos equivalentes com saldo duplicado são bloqueados."))return;
  kitchen.mode="shared";kitchen.inventory=result.inventory;kitchen.enabledAt=new Date().toISOString();
  observed.clear();project(state);persist();render();
  if(typeof toast==="function")toast("Estoque compartilhado entre os universos desta conta.");
 }else{
  const positives=Object.values(kitchen.inventory||{}).filter(x=>num(x.stock)>0).length;
  if(positives){alert("Existem "+positives+" insumos com saldo positivo. Para separar a cozinha é necessário distribuir fisicamente as quantidades entre os ramos; nenhum estoque foi duplicado.");return}
  if(!confirm("Separar estoques? As quantidades estão zeradas e nenhum saldo físico será duplicado."))return;
  kitchen.mode="separate";observed.clear();persist();render();
 }
}
function templates(){
 const seen=new Map(),add=item=>{
  if(!item?.name)return;
  const k=key(item);
  if(!seen.has(k))seen.set(k,{name:item.name,measureUnit:item.measureUnit||"g",
   purchaseUnit:item.purchaseUnit||((item.measureUnit==="ml")?"L":(item.measureUnit==="un")?"un":"kg"),
   category:item.category||"Insumo"});
 };
 for(const t of Object.values(window.POTE_UNIVERSE_TEMPLATES||{}))
  if(Array.isArray(t?.ingredients))t.ingredients.forEach(add);
 (window.POTE_SEED?.ingredients||[]).forEach(add);
 return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
}
function catalogHtml(){
 const current=new Set((state.data.ingredients||[]).map(key)),items=templates().filter(i=>!current.has(key(i)));
 const free=window.POTE_AUTH?.uid&&!window.POTE_AUTH?.proActive;
 const used=num(state.data.kitchenStock?.freeCatalogImports);
 return '<details class="stock-box kitchen-catalog"><summary>📚 Catálogo rápido de ingredientes · selecionar vários</summary>'+
 '<p>Escolha todos os ingredientes necessários de uma vez. Serão adicionados com estoque e preço reais zerados. Nunca são importadas compras ou saldos de outras contas.</p>'+
 (free&&used>=1?'<div class="notice">🔒 Plano FREE: importação do catálogo já utilizada nesta conta.</div>':
 '<label>Buscar ingredientes<input id="kitchenCatalogSearch" type="search" placeholder="Digite para filtrar" oninput="POTE_KITCHEN.filterCatalog(this.value)"></label>'+
 '<div class="kitchen-catalog-items">'+items.map((i,n)=>
 '<label data-catalog-name="'+esc(normalize(i.name))+'"><input type="checkbox" name="kitchenCatalogItem" value="'+n+'"> '+
 esc(i.name)+' <small>('+esc(i.measureUnit)+')</small></label>').join("")+'</div>'+
 '<button type="button" class="btn" onclick="POTE_KITCHEN.importCatalog()">Adicionar ingredientes selecionados</button>')+
 '</details>';
}
function importCatalog(){
 if(window.POTE_ACCESS?.requireService?.("ingredients")===false)return;
 if(window.POTE_SYNC_GUARD?.blocked)return alert("Estoque não disponível durante conflito de sincronização.");
 const free=window.POTE_AUTH?.uid&&!window.POTE_AUTH?.proActive;
 state.data.kitchenStock??={mode:"separate",inventory:{}};
 if(free&&num(state.data.kitchenStock.freeCatalogImports)>=1)return alert("Limite FREE: uma importação em lote por conta.");
 const current=new Set((state.data.ingredients||[]).map(key)),available=templates().filter(i=>!current.has(key(i)));
 const selected=[...document.querySelectorAll('input[name="kitchenCatalogItem"]:checked')]
  .map(x=>available[Number(x.value)]).filter(Boolean);
 if(!selected.length)return alert("Selecione pelo menos um ingrediente.");
 if(!confirm("Adicionar "+selected.length+" insumo(s) selecionados com saldo físico e custo zero?"))return;
 let added=0;
 for(const template of selected){
  if(current.has(key(template)))continue;current.add(key(template));
  const id="catalog-"+normalize(template.name).replace(/\s+/g,"-")+"-"+template.measureUnit.toLowerCase();
  if(state.data.ingredients.some(i=>i.id===id))continue;
  state.data.ingredients.push({id,name:template.name,category:template.category,
   measureUnit:template.measureUnit,purchaseUnit:template.purchaseUnit,
   purchaseQuantity:1,price:0,purchasePrice:0,stock:0,minimum:0,yield:100,
   source:"Selecionado no catálogo; informe preço e quantidade reais",templateOrigin:"catalog",imageUrl:""});
  added++;
 }
 if(free&&added)state.data.kitchenStock.freeCatalogImports=1;
 if(mode(state)==="shared")project(state);
 persist();render();if(typeof toast==="function")toast(added+" ingredientes adicionados, estoque inicial 0.");
}
function filterCatalog(term){
 const q=normalize(term);
 for(const el of document.querySelectorAll("[data-catalog-name]"))
  el.hidden=!!q&&!el.dataset.catalogName.includes(q);
}
function demoOne(){
 const r=(state.data.recipes||[]).find(r=>r.items?.length>0);
 if(!r)return alert("Selecione primeiro um universo com receitas.");
 const listing=r.items.map(x=>{
  const ing=(state.data.ingredients||[]).find(i=>i.id===x.id);
  return (ing?.name||x.id)+": "+x.g+" "+(ing?.measureUnit||"g");
 });
 alert("SIMULAÇÃO para 1 unidade de "+r.name+"\n\n"+listing.join("\n")+
  "\n\nNenhum estoque ou custo real foi alterado.");
}
function renderPanel(){
 const m=mode(state),all=Object.keys(getStore(state)?.inventory||{}).length;
 return '<section class="stock-box kitchen-panel"><div class="stock-section-head"><div><small>ESTOQUE DA SUA COZINHA</small><h2>Estoque compartilhado ou separado?</h2></div>'+
 '<span>'+esc(m==="shared"?"🔗 Compartilhado por conta":"📦 Separado por universo")+'</span></div>'+
 '<p>Este estoque pertence exclusivamente ao seu login. Outros e-mails, inclusive franquias, NUNCA acessam seus saldos. A união de insumos é feita por nome e unidade idênticos.</p>'+
 '<div class="actions"><button class="btn '+(m==="shared"?"":"line")+'" type="button" onclick="POTE_KITCHEN.setMode(\'shared\')">🔗 Compartilhar nesta cozinha</button>'+
 '<button class="btn '+(m==="separate"?"":"line")+'" type="button" onclick="POTE_KITCHEN.setMode(\'separate\')">📦 Separar por universo</button>'+
 '<button class="btn line" type="button" onclick="POTE_KITCHEN.demoOne()">🧪 Simular ingredientes para 1 lanche</button></div>'+
 '<p><small>'+all+' referência(s) de insumo no estoque da cozinha. Saldos históricos múltiplos exigem conciliação antes de compartilhar. A simulação nunca lança estoque fictício.</small></p>'+
 '</section>'+catalogHtml();
}
window.POTE_KITCHEN={mode,project,capture,setMode,renderPanel,importCatalog,filterCatalog,demoOne,
 key,conflicts,inspect:state=>({mode:mode(state),entries:Object.keys(getStore(state)?.inventory||{}).length,
  issues:conflicts(state).length})};
})();