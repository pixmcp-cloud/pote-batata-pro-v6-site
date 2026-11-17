/* Hub de Delivery: importação supervisionada e operações MaisDelivery em sandbox.
   O painel ADM aceita credenciais somente na sessão de homologação, sem persisti-las.
   Nenhuma integração é executada sem confirmação explícita do administrador.
   O fluxo de pedidos utiliza newOrder() existente para reservas/baixas seguras. */
import {CHANNELS,EXAMPLE,parseImport,stageOrders,ensureHub,suggestRecipes,validChannel} from "./delivery_hub_core.mjs";
import {renderMaisDelivery,sendMaisDelivery} from "./maisdelivery_ui.mjs";
(function(){
"use strict";
if(window.POTE_DELIVERY_HUB)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=x=>(Number(x)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const labels={batataria:"Batataria",pizzaria:"Pizzaria",hamburgueria:"Hamburgueria",hotdog:"Hot Dog",lancheria:"Lancheria",pastelaria:"Pastelaria"};
const f=(msg)=>typeof toast==="function"?toast(msg):alert(msg);
let channel="cardapioai",preview=null,pending=null,lastError="";
const active=()=>state?.data?.businessType||"batataria";
const snapshot=()=>state?.data||{};
const hub=()=>ensureHub(state);
const pro=()=>window.POTE_AUTH?.role==="admin"||window.POTE_AUTH?.proActive;
const options=()=>Object.entries(labels).map(([id,label])=>({id,label,branch:id===active()?state.data:state.data.businessUniverses?.[id]}));
const valid=()=>Boolean(window.POTE_AUTH?.uid);
function blocked(){if(window.POTE_SYNC_GUARD?.blocked){f("Conflito de sincronização: corrija-o antes de importar.");return true}return false}
function canWrite(){
 if(!valid()){f("Entre com sua conta Google para salvar pedidos.");return false}
 if(blocked())return false;
 if(window.POTE_ACCESS?.requireService?.("deliveryhub")===false)return false;
 return true;
}
const channelSelect=(selected)=>CHANNELS.map(p=>'<option value="'+p.id+'" '+(p.id===selected?"selected":"")+'>'+esc(p.name)+'</option>').join("");
const platformCard=p=>{
 const testing=p.id==="maisdelivery";
 const admin=window.POTE_AUTH?.role==="admin";
 return '<article class="hub-platform" data-channel="'+esc(p.id)+'" data-api-status="'+(testing?"testing":"soon")+'">'+
 '<div class="hub-platform-identity"><span class="hub-platform-logo"><img alt="Logo '+esc(p.name)+'" loading="lazy" src="./assets/integrations/'+esc(p.id)+'.png?v=logos-20261116" onerror="this.hidden=true;this.parentNode.classList.add(\'brand-missing\')">'+
 '<span class="hub-logo-fallback" aria-hidden="true">'+esc(p.name.slice(0,2).toUpperCase())+'</span></span>'+
 '<strong>'+esc(p.name)+'</strong></div>'+
 '<div class="hub-connection-state '+(testing?"hub-status-testing":"hub-status-soon")+'">'+
 (testing?"Em teste · sandbox":"Em breve")+'</div>'+
 '<p>'+(testing?"API em homologação. Ainda não conectado a uma loja real.": "Integração automática em desenvolvimento.")+'</p>'+
 '<div class="hub-card-actions">'+
 (testing?(admin?'<button class="btn mini" type="button" onclick="POTE_DELIVERY_HUB.openMaisDelivery()">Abrir testes</button>':
 '<button class="btn mini line" type="button" disabled title="Testes de API restritos à administração">Em teste</button>'):
 '<button class="btn mini line" type="button" disabled>Em breve</button>')+
 '<a href="'+esc(p.doc)+'" target="_blank" rel="noopener noreferrer" class="btn mini line">Documentação oficial</a></div>'+
 '<small class="hub-partner-note">Identificação visual não indica parceria ou conexão automática ativa. Importação manual de JSON disponível abaixo.</small></article>';
};
function inboxItem(row,orderIndex,item,index){
 const branchOpts=options().flatMap(x=>{
  const items=(x.branch?.recipes||[]).filter(r=>!r.franchiseLocked&&r.id&&r.name);
  if(!items.length)return [];
  return ['<optgroup label="'+esc(x.label)+'">'+items.map(r=>{
   const v=x.id+"::"+r.id;
   const score=suggestRecipes(item,[r])[0]?.score||0;
   return '<option value="'+esc(v)+'" data-score="'+score+'">'+esc(x.label+' · '+r.name)+(score>=100?' ✓ Nome igual':'')+'</option>';
  }).join("")+'</optgroup>'];
 }).join("");
 const linked=row.localLinks?.[String(index)];
 const status=row.status==="cancelled";
 return '<div class="hub-product"><div><strong>'+esc(item.name)+'</strong><small>'+
  esc(item.qty)+' × '+(item.unitPrice===null?"Preço não informado":money(item.unitPrice))+
  (item.modifiers.length?' · '+esc(item.modifiers.length)+' adicional(is)':'')+
  '</small></div><div class="hub-product-tools">'+
  (linked?'<span class="hub-done">✓ Registrado #'+esc(String(linked.localOrderId).slice(-7))+'</span>':
  status?'<span class="hub-locked">Cancelado na origem · não registrar</span>':
  '<select id="hubMap-'+orderIndex+'-'+index+'" aria-label="Associar '+esc(item.name)+' à receita">'+
   '<option value="">Selecione a receita e o universo</option>'+branchOpts+'</select>'+
   '<button type="button" class="btn mini" onclick="POTE_DELIVERY_HUB.prepare('+orderIndex+','+index+')">Preparar pedido local</button>')+'</div></div>';
}
function inboxCard(row,i){
 const provider=CHANNELS.find(x=>x.id===row.provider)?.name||row.provider;
 return '<article class="hub-order"><header><div><strong>'+esc(provider)+' · #'+esc(row.externalId)+'</strong>'+
  '<small>'+esc(row.name)+' · '+esc(row.storeId)+'</small></div>'+
  '<span class="'+(row.status==="cancelled"?"hub-warning":"hub-neutral")+'">'+esc(row.status==="cancelled"?"Cancelado":row.status==="delivered"?"Entregue na origem":row.status==="preparing"?"Em preparo na origem":"Recebido")+'</span></header>'+
  '<p><b>Total informado:</b> '+money(row.total)+' · <b>Taxa de entrega:</b> '+money(row.deliveryFee)+
  ' · <b>Modalidade:</b> '+esc(row.kind==="pickup"?"Retirada":"Entrega")+
  (row.address?' · '+esc(row.address):"")+'</p>'+
  '<div class="hub-items">'+row.items.map((item,j)=>inboxItem(row,i,item,j)).join("")+'</div>'+
  '<p class="hub-hint">'+(row.approved?"Todos os itens já vinculados a pedidos locais.":'Importado para conferência. Sem baixa de estoque, venda ou pagamento automático.')+'</p></article>';
}
function previewPanel(){
 if(!preview)return '<p class="hub-hint">Nenhum arquivo analisado nesta sessão.</p>';
 return '<div class="hub-preview"><strong>Prévia: '+preview.rows.length+' pedido(s) válido(s)</strong>'+
 (preview.errors.length?'<div class="notice red">'+preview.errors.map(esc).join(" · ")+'</div>':"")+
 preview.rows.slice(0,8).map(x=>'<div class="hub-preview-line"><span>'+esc(x.externalId)+
 ' · '+esc(x.name)+' · '+x.items.length+' item(ns)</span><b>'+money(x.total)+'</b></div>').join("")+
 '<p class="hub-hint">Prévia não cria pedidos, baixa estoque ou registra vendas.</p>'+
 '<button class="btn" type="button" onclick="POTE_DELIVERY_HUB.commit()">Confirmar entrada na fila</button></div>';
}
function renderPage(){
 const data=hub();
 const selected=CHANNELS.find(x=>x.id===channel)||CHANNELS[0];
 return '<section class="hub-page"><header class="hub-hero"><small>GESTÃO MULTICANAL · ACESSO PRIVADO DA CONTA GOOGLE</small>'+
 '<h2>🔌 Hub de Delivery</h2><p>Importe pedidos para conferência, evite duplicações e associe cada item a uma receita. '+
 'Nenhum canal é conectado automaticamente, e nenhum pedido entra em produção sem conferência.</p>'+
 '<div class="hub-numbers"><div><strong>'+CHANNELS.length+'</strong><small>Plataformas documentadas</small></div>'+
 '<div><strong>'+data.orders.length+'</strong><small>Pedidos na fila</small></div><div><strong>'+data.orders.filter(r=>r.approved).length+'</strong><small>Conferidos</small></div></div></header>'+
 '<h3>1. Plataformas de delivery · status das APIs</h3><div class="hub-platforms">'+CHANNELS.map(platformCard).join("")+'</div>'+renderMaisDelivery()+
 '<h3>2. Importação manual de pedidos</h3><section class="hub-box"><p>O MaisDelivery está em homologação. As outras APIs automáticas estão em breve. '+
 'Por enquanto, importe um JSON exportado ou recebido legitimamente da sua loja. Nunca cole tokens, senhas ou chaves.</p>'+
 '<div class="hub-inputs"><label>Plataforma<select id="hubProvider" onchange="POTE_DELIVERY_HUB.select(this.value)">'+channelSelect(selected.id)+'</select></label>'+
 '<label>ID da loja (não é uma senha)<input id="hubStore" value="'+esc(data.storeAliases[selected.id]||"")+'" placeholder="Ex.: minha-loja-01" maxlength="100" autocomplete="off"></label>'+
 '<label>Arquivo de pedido (.json)<input type="file" id="hubFile" accept=".json,application/json" onchange="POTE_DELIVERY_HUB.loadFile(this)"></label></div>'+
 '<label class="hub-json-label">Ou cole o conteúdo JSON<textarea id="hubJson" rows="5" placeholder="Cole um pedido JSON, sem credenciais" spellcheck="false"></textarea></label>'+
 '<div class="hub-actions"><button class="btn" onclick="POTE_DELIVERY_HUB.analyze()">Analisar JSON</button>'+
 '<button class="btn line" onclick="POTE_DELIVERY_HUB.example()">Carregar exemplo (sem salvar)</button>'+
 '<a href="'+esc(selected.doc)+'" target="_blank" rel="noopener noreferrer" class="btn line">Manual de integração</a></div>'+
 '<p class="hub-hint"><b>'+esc(selected.name)+':</b> '+esc(selected.access)+'. '+
 (["cardapioai","olaclick","opendelivery"].includes(selected.parser)?
 'Adaptador de importação implementado.':'Importação genérica disponível quando os campos do pedido estiverem completos.')+
 '</p><div id="hubAnalysis">'+previewPanel()+'</div></section>'+
 '<h3>3. Caixa de entrada e associação de receitas</h3>'+
 '<p class="hub-hint">Os itens importados não movimentam estoque nem financeiro. Use “Preparar pedido local” e confirme pela tela de Pedidos. '+
 'Se um pedido possui vários sabores, cada item deverá ser registrado separadamente e identificado com o mesmo número externo.</p>'+
 '<div class="hub-orders">'+(data.orders.length?data.orders.slice().map(inboxCard).reverse().join(""):'<section class="hub-box"><p>Nenhum pedido externo registrado nesta conta.</p></section>')+'</div>'+
 '<section class="hub-box"><h3>Segurança da integração</h3><p>Chaves, tokens OAuth, assinaturas HMAC, webhooks e rotinas automáticas '+
 'só poderão ser ativados em um servidor protegido, depois de autorização do estabelecimento e homologação do canal.</p>'+
 '<p class="hub-hint">O Hub está em modo manual supervisionado. FREE permite até um pedido externo de demonstração por conta; '+
 'os demais recursos de importação exigem licença PRO/ADM. Os registros pertencem somente à conta autenticada.</p></section></section>';
}
function render(){return renderPage()}
function select(id){
 if(!validChannel(id))return;
 channel=id;preview=null;
 if(state.tab==="deliveryhub")renderApp();
}
function openMaisDelivery(){
 if(window.POTE_AUTH?.role!=="admin"){f("Testes da API MaisDelivery disponíveis apenas para a administração.");return false}
 const panel=$("mdSandboxPanel");
 if(!panel){f("Abra o Hub de Delivery para configurar o teste.");return false}
 panel.scrollIntoView?.({behavior:"smooth",block:"start"});
 return true;
}
function renderApp(){if(typeof window.render==="function")window.render()}
function example(){
 const provider=CHANNELS.find(x=>x.id===channel);
 const sample=EXAMPLE[provider?.parser]||EXAMPLE[channel]||EXAMPLE.cardapioai;
 if($("hubJson"))$("hubJson").value=JSON.stringify(sample,null,2);
 if($("hubStore")&&!$("hubStore").value)$("hubStore").value="demo-store";
 preview=null;f("Exemplo carregado somente no campo de texto. Não será enviado ao estoque ou aos pedidos.");
}
async function loadFile(input){
 const file=input?.files?.[0];
 if(!file)return;
 if(file.size>250000){f("Arquivo acima do limite de 250 KB.");return}
 if(!/\.json$/i.test(file.name)&&file.type!=="application/json"){f("Selecione um arquivo JSON.");return}
 try{$("hubJson").value=await file.text();f("Arquivo lido. Clique em Analisar JSON.");}
 catch(e){f("Não foi possível ler o arquivo.");}
}
function analyze(){
 const value=$("hubJson")?.value||"";
 if(!value.trim()){f("Insira o JSON do pedido.");return}
 if(value.length>250000){f("JSON muito grande (limite de 250 KB).");return}
 if(!validChannel(channel)){f("Selecione uma plataforma válida.");return}
 const store=$("hubStore")?.value?.trim()||"";
 try{
  preview=parseImport(channel,value,{storeAlias:store});
  if(!preview.rows.length){f("Não há pedidos válidos neste conteúdo. Confira o formato e o ID da loja.");}
  else f(preview.rows.length+" pedido(s) analisados. Confirme antes de salvar.");
  renderPreviewOnly();
 }catch(e){preview=null;lastError=String(e.message);f("JSON inválido: "+lastError.slice(0,180));renderPreviewOnly();}
}
function renderPreviewOnly(){
 const page=$("hubAnalysis");
 if(page){page.innerHTML=previewPanel();return}
 // A página inteira é redesenhada, preservando o JSON digitado.
 const typed=$("hubJson")?.value||"",alias=$("hubStore")?.value||"";
 renderApp();
 if($("hubJson"))$("hubJson").value=typed;
 if($("hubStore"))$("hubStore").value=alias;
}
function commit(){
 if(!preview?.rows?.length){f("Analise os pedidos primeiro.");return}
 if(!canWrite())return;
 const alias=$("hubStore")?.value?.trim()||"";
 const h=hub();
 if(alias)h.storeAliases[channel]=alias.slice(0,100);
 if(preview.rows.some(x=>x.externalId.startsWith("DEMO-"))){
  f("Pedidos DEMO são apenas exemplos de formato e não podem ser gravados. Importe pedidos reais da sua própria loja.");return;
 }
 const answer=confirm("Adicionar "+preview.rows.length+" pedido(s) externos à fila desta conta? Nenhuma venda ou estoque será alterado.");
 if(!answer)return;
 try{
  const info=stageOrders(h,preview.rows,{free:!pro()});
  preview=null;persist();window.dispatchEvent(new Event("pote:notice-update"));renderApp();
  f(info.imported+" novo(s), "+info.duplicates+" duplicado(s) ignorado(s).");
 }catch(e){f(String(e.message))}
}
function localExists(row,index){
 const references=[{orders:state.data.orders},...Object.values(state.data.businessUniverses||{})];
 return references.some(x=>(x?.orders||[]).some(o=>
  o.externalHubKey===row.key&&Number(o.externalHubItemIndex)===index));
}
function prepare(ri,ii){
 if(!canWrite())return;
 const h=hub(),row=h.orders[ri],item=row?.items?.[ii];
 if(!row||!item||row.localLinks?.[String(ii)])return f("Item já registrado ou não encontrado.");
 if(row.status==="cancelled")return f("Pedido cancelado na plataforma. Revise com a loja.");
 if(localExists(row,ii))return f("Item externo já vinculado a um pedido local.");
 const raw=$("hubMap-"+ri+"-"+ii)?.value||"",sep=raw.indexOf("::");
 if(sep<0)return f("Selecione uma receita e seu universo.");
 const universe=raw.slice(0,sep),recipeId=raw.slice(sep+2);
 if(!labels[universe])return f("Universo desconhecido.");
 if(window.POTE_ACCESS?.allowsUniverse?.(universe)===false)return f("Universo bloqueado para esta conta.");
 if(universe!==active()){
  const to=window.POTE_BUSINESS?.choose;
  if(!to)return f("Abra Negócio e selecione o universo antes de prosseguir.");
  to(universe);
  if(active()!==universe)return f("A troca de universo não foi concluída.");
 }
 const target=state.data.recipes.find(x=>x.id===recipeId);
 if(!target)return f("Receita não encontrada neste universo. Selecione novamente.");
 pending={key:row.key,index:ii,universe,recipeId,qty:item.qty,
   total:item.unitPrice,channel:row.provider,externalId:row.externalId};
 go("orders");
 const control=$("orderItem");if(!control)return f("Tela de pedidos ainda não está pronta.");
 control.value="recipe:"+recipeId;
 if(typeof updateOrderSuggestedPrice==="function")updateOrderSuggestedPrice();
 if($("orderQty"))$("orderQty").value=String(item.qty);
 if(item.unitPrice!==null&&$("orderPrice"))$("orderPrice").value=String(item.unitPrice);
 if($("orderChannel"))$("orderChannel").value="marketplace";
 if($("orderHasDelivery"))$("orderHasDelivery").value=row.kind==="delivery"?"sim":"nao";
 if($("orderDelivery"))$("orderDelivery").value=String(ii===0?row.deliveryFee:0);
 if($("orderAddress"))$("orderAddress").value=row.address;
 if($("orderNote")){
  const extras=item.modifiers.length?" | Adicionais na origem: "+item.modifiers.map(x=>x.name+" x"+x.qty).join(", "):"";
  $("orderNote").value=("[DELIVERY "+row.provider+" #"+row.externalId+"; item "+(ii+1)+"/"+row.items.length+"] "+
  row.note+" | "+item.notes+extras).trim().slice(0,720);
 }
 if(typeof window.POTE_PAYMENT?.sync==="function")window.POTE_PAYMENT.sync();
 f("Pedido preenchido para conferência. Revise preço, adicionais, pagamento e estoque antes de clicar Registrar.");
}
function beforeRegister(data,recipeId,qty,price){
 if(!pending)return true;
 const row=hub().orders.find(x=>x.key===pending.key);
 if(!row||!row.items[pending.index]){pending=null;f("Pedido da fila não encontrado.");return false}
 if(active()!==pending.universe||recipeId!=="recipe:"+pending.recipeId){f("A receita selecionada não corresponde à associação do Hub.");return false}
 if(row.localLinks?.[String(pending.index)]||localExists(row,pending.index)){
  f("Este item já foi registrado e não pode ser lançado novamente.");pending=null;return false;
 }
 if(row.status==="cancelled"){f("O pedido foi cancelado na origem. Registre manualmente apenas após conciliar.");return false}
 const item=row.items[pending.index];
 const changed=Number(qty)!==Number(item.qty)||item.unitPrice!==null&&Math.abs(Number(price)-item.unitPrice)>0.009;
 if(changed&&!confirm("Quantidade ou preço alterados em relação ao pedido externo. Confirma o valor revisado?"))return false;
 if(item.modifiers?.length&&!confirm("Há adicionais no pedido externo. Confirme que os insumos e valores foram revisados manualmente. Continuar?"))return false;
 return true;
}
function onRegistered(order){
 if(!pending)return;
 const row=hub().orders.find(x=>x.key===pending.key);
 if(!row||row.localLinks?.[String(pending.index)]){pending=null;return}
 order.externalHubKey=row.key;order.externalHubItemIndex=pending.index;order.externalProvider=row.provider;
 order.externalOrderId=row.externalId;order.externalStoreId=row.storeId;order.externalSource="manual-reviewed";
 order.externalReportedTotal=row.total;order.externalReportedDeliveryFee=row.deliveryFee;
 order.externalAccountingNeedsReview=true;
 row.localLinks[String(pending.index)]={localOrderId:order.id,universe:active(),at:new Date().toISOString()};
 row.approved=Object.keys(row.localLinks).length===row.items.length;
 pending=null;
}
window.POTE_DELIVERY_HUB={render,select,openMaisDelivery,example,loadFile,analyze,commit,prepare,beforeRegister,onRegistered,maisDeliverySend:sendMaisDelivery,
 get status(){return {selected:channel,pending:pending?.key||null,count:hub().orders.length}},get channels(){return CHANNELS}};
})();