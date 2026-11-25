/* Central Motoboy — dados privados por conta, acessíveis nos seis universos. */
import {MODELS,round,effectiveKm,tripAmount,courierStatement,normalizedPhone,canAssign,deliveryCount} from "./motoboy_core.mjs?v=2";
import {DEFAULT_DELIVERY_POLICY,validateDeliveryPolicy,quoteDelivery} from "./workers/antifraud/src/delivery_pricing.mjs?v=1";
(function(){
"use strict";
if(window.POTE_MOTOBOY)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const n=v=>{let raw=String(v??"").trim().replace(/R\$\s*/gi,"").replace(/\s+/g,"");
 if(raw.includes(","))raw=raw.replace(/\./g,"").replace(",",".");
 const x=Number(raw);return Number.isFinite(x)?x:NaN};
const today=()=>new Date().toISOString().slice(0,10);
const ident=prefix=>prefix+"-"+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
function data(){return state.data.kitchenLogistics??(state.data.kitchenLogistics={couriers:[],trips:[],settlements:[]})}
const couriers=()=>data().couriers;
const trips=()=>data().trips;
const settlements=()=>data().settlements;
const master=()=>window.POTE_AUTH?.role==="admin";
const premium=()=>window.POTE_AUTH?.proActive||master()||state.mode!=="free";
function changed(){persist();render()}
function alerts(message){if(typeof toast==="function")toast(message);else alert(message)}
function accountOrders(){
 const result=[],seen=new Set(),branches={...(state.data.businessUniverses||{})};
 branches[state.data.businessType||"batataria"]=state.data;
 for(const [universe,branch] of Object.entries(branches)){
  for(const o of branch?.orders||[]){
   if(!o.id||["cancelado","cancelled"].includes(String(o.status||"").toLowerCase()))continue;
   const key=universe+"/"+o.id;
   if(seen.has(key))continue;seen.add(key);
   result.push({id:o.id,universe,order:o});
  }
 }
 return result;
}
function courier(id){return couriers().find(x=>x.id===id)}
function orderRef(ref){return accountOrders().find(x=>x.id===ref.id&&x.universe===ref.universe)?.order}
function ready(service="motoboy"){
 if(window.POTE_ACCESS?.requireService?.(service)===false)return false;
 if(window.POTE_SYNC_GUARD?.blocked){alerts("Há conflito de sincronização. Resolva antes de alterar entregas.");return false}
 return true;
}
function field(id,label,value="",type="text"){
 return '<label>'+esc(label)+'<input id="'+esc(id)+'" type="'+esc(type)+'" value="'+esc(value)+'" autocomplete="off"></label>';
}
function deliveryPolicy(){
 try{return validateDeliveryPolicy(state.data.settings?.deliveryPolicy??DEFAULT_DELIVERY_POLICY)}
 catch{return validateDeliveryPolicy(DEFAULT_DELIVERY_POLICY)}
}
const brlInput=cents=>(cents/100).toFixed(2).replace(".",",");
function feeInput(id,label,value){
 return '<label>'+esc(label)+'<input id="'+esc(id)+'" inputmode="decimal" value="'+esc(value)+'" autocomplete="off"></label>';
}
function zoneRow(row){
 return '<div class="moto-zone" data-zone-id="'+esc(row.id)+'"><label>Bairro<input data-zone-name maxlength="80" value="'+esc(row.name)+'"></label><label>Frete fixo (R$)<input data-zone-fee inputmode="decimal" value="'+esc(brlInput(row.feeCents))+'"></label><label class="moto-zone-check"><input type="checkbox" data-zone-enabled '+(row.enabled?'checked':'')+'> Atender</label><button type="button" class="btn mini danger" onclick="this.closest(\'.moto-zone\').remove()">Remover</button></div>';
}
function deliveryForm(){
 const p=deliveryPolicy();
 return '<details class="moto-new" open><summary>🚚 Frete cobrado do cliente · '+esc((state.data.businessType||"batataria").toUpperCase())+'</summary>'+
 '<p class="moto-note">Configuração por ramo. Não altera a remuneração dos motoboys nem ativa o checkout. A rota e o bairro precisam ser verificados pelo servidor antes da cobrança automática.</p>'+
 '<div class="moto-fields"><label>Modalidade<select id="motoFeeMode">'+[["hybrid","Híbrido · bairro prevalece"],["distance","Por km"],["fixed","Somente bairros cadastrados"]].map(([id,label])=>'<option value="'+id+'" '+(p.mode===id?'selected':'')+'>'+label+'</option>').join("")+'</select></label>'+
 field("motoFeeCity","Cidade atendida",state.data.settings?.deliveryCity||"")+field("motoFeeUF","UF (ex.: SC)",state.data.settings?.deliveryUF||"")+
 feeInput("motoFeeKm","R$ por km",brlInput(p.perKmCents))+feeInput("motoFeeMin","Taxa mínima por km (R$)",brlInput(p.minFeeCents))+
 feeInput("motoFeeMax","Distância máxima (km, opcional)",p.maxDistanceMeters===null?"":String(p.maxDistanceMeters/1000).replace(".",","))+
 feeInput("motoFeeFree","Frete grátis a partir de (R$, opcional)",p.freeAboveCents===null?"":brlInput(p.freeAboveCents))+
 feeInput("motoFeeCost","Custo previsto por entrega (R$)",brlInput(Math.round((Number(state.data.settings?.deliveryCostPerOrder)||0)*100)))+
 '</div><label class="moto-zone-check"><input type="checkbox" id="motoFeeEnabled" '+(p.enabled?'checked':'')+'> Habilitar política de entrega neste ramo</label>'+
 '<h3>Bairros e tarifas</h3><div id="motoFeeZones">'+p.neighborhoods.map(zoneRow).join("")+'</div>'+
 '<div class="actions"><button type="button" class="btn line" onclick="POTE_MOTOBOY.addZone()">+ Cadastrar bairro</button><button type="button" class="btn" onclick="POTE_MOTOBOY.saveDelivery()">Salvar frete</button></div>'+
 '<p class="moto-note">A taxa fixa prevalece no modo híbrido. Desmarque Atender para bloquear um bairro. O custo previsto será substituído pelo rateio real da viagem, não somado a ele.</p></details>';
}
function addZone(){
 if(!ready())return;
 const holder=$("motoFeeZones");if(!holder)return;
 if(holder.querySelectorAll(".moto-zone").length>=100)return alerts("Limite de 100 bairros por ramo.");
 holder.insertAdjacentHTML("beforeend",zoneRow({id:ident("zone"),name:"",feeCents:0,enabled:true}));
 holder.lastElementChild?.querySelector("[data-zone-name]")?.focus();
}
function decimal(raw,scale,optional=false){
 const text=String(raw??"").trim();
 if(!text&&optional)return null;
 if(!/^\d+(?:[.,]\d{1,3})?$/.test(text))throw Error("Informe valores numéricos válidos.");
 const v=Number(text.replace(",","."));
 const result=Math.round(v*scale);
 if(!Number.isSafeInteger(result)||Math.abs(v*scale-result)>1e-6)throw Error("Precisão inválida.");
 return result;
}
function saveDelivery(){
 if(!ready())return;
 try{
  const val=id=>$(id)?.value;
  const neighborhoods=[...($("motoFeeZones")?.querySelectorAll(".moto-zone")||[])].map(row=>({
   id:row.dataset.zoneId,name:row.querySelector("[data-zone-name]").value,
   feeCents:decimal(row.querySelector("[data-zone-fee]").value,100),enabled:row.querySelector("[data-zone-enabled]").checked
  }));
  const next=validateDeliveryPolicy({enabled:$("motoFeeEnabled")?.checked===true,mode:val("motoFeeMode"),
   perKmCents:decimal(val("motoFeeKm"),100),minFeeCents:decimal(val("motoFeeMin"),100),
   maxDistanceMeters:decimal(val("motoFeeMax"),1000,true),freeAboveCents:decimal(val("motoFeeFree"),100,true),neighborhoods});
  const city=String(val("motoFeeCity")||"").trim(),uf=String(val("motoFeeUF")||"").trim().toUpperCase();
  if(next.enabled&&(!city||city.length>80||! /^[A-Z]{2}$/.test(uf)))throw Error("Informe cidade e UF atendidas.");
  const cost=decimal(val("motoFeeCost"),100);
  if(cost>10000000)throw Error("Custo de entrega fora do limite.");
  const settings=state.data.settings??(state.data.settings={});
  settings.deliveryPolicy=next;settings.deliveryCity=city;settings.deliveryUF=uf;settings.deliveryCostPerOrder=cost/100;
  changed();alerts("Configuração de frete salva no ramo atual. Checkout automático ainda em homologação.");
 }catch(error){alerts(error.message)}
}
function courierForm(){
 if(!premium()&&couriers().length>=1)return '<p class="moto-note">🔒 FREE: 1 motoboy cadastrado. PRO libera múltiplos.</p>';
 return '<details class="moto-new"><summary>+ Cadastrar motoboy</summary><div class="moto-fields">'+
 field("motoName","Nome completo")+field("motoPhone","Telefone / WhatsApp")+
 field("motoPix","Chave PIX")+field("motoNotes","Observações")+
 '<label>Modelo de pagamento<select id="motoModel">'+[
 ["delivery","Valor fixo por entrega"],["kilometer","Por quilômetro"],
 ["daily","Diária"],["hybrid","Entrega + adicional por km"]
 ].map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join("")+'</select></label>'+
 field("motoRateDelivery","R$ por entrega","0")+
 field("motoRateKm","R$ por km","0")+
 field("motoRateDay","Diária R$","0")+
 '</div><button class="btn" onclick="POTE_MOTOBOY.saveCourier()">Salvar motoboy</button>'+
 '<p class="moto-note">Valores são regras de remuneração, não pagamentos realizados. Não há transferência PIX automática.</p></details>';
}
function tripForm(){
 const list=couriers().filter(c=>c.active!==false),available=accountOrders().filter(o=>
  (o.order.clientAddress||Number(o.order.deliveryFee)>0||o.order.channel==="delivery")&&canAssign(o,trips()));
 if(!list.length)return '<p class="moto-note">Cadastre um motoboy para programar viagens.</p>';
 if(!premium()&&trips().length>=1)return '<p class="moto-note">🔒 FREE: apenas 1 viagem de teste por conta.</p>';
 return '<details class="moto-new"><summary>+ Registrar uma viagem / agrupar pedidos</summary>'+
 '<div class="moto-fields"><label>Motoboy<select id="motoTripCourier">'+list.map(c=>
 '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("")+'</select></label>'+
 field("motoTripKm","Distância informada (km)","0","text")+
 '<label>Medida da distância<select id="motoTripDistance"><option value="actual">Total realmente percorrido</option>'+
 '<option value="oneWayReturn">Somente ida — considerar volta igual</option></select></label>'+
 field("motoTripDate","Data da viagem",today(),"date")+
 field("motoTripNote","Observação da viagem")+'</div>'+
 '<p class="moto-note">Uma viagem pode levar vários pedidos. A quantidade de viagens não é multiplicada pelo número de entregas.</p>'+
 '<div class="moto-order-choices">'+(available.length?available.map(o=>
 '<label><input type="checkbox" name="motoOrderChoice" value="'+esc(o.universe+"/"+o.id)+'">'+
 '<span><strong>'+esc(o.universe.toUpperCase())+' · #'+esc(o.id.slice(-6))+'</strong><small>'+
 esc(o.order.clientName||o.order.name||"Pedido")+' — '+esc(o.order.clientAddress||"endereço não informado")+
 '</small></span></label>').join(""):'<p>Não há pedidos para entrega sem viagem atribuída. Use a tela de Pedidos para cadastrá-los.</p>')+
 '</div><button class="btn" onclick="POTE_MOTOBOY.createTrip()">Registrar viagem</button></details>';
}
function stats(){
 return couriers().map(c=>({courier:c,statement:courierStatement(c,trips(),settlements())}));
}
function wa(c){
 const phone=normalizedPhone(c.phone);
 return phone?"https://wa.me/"+phone+"?text="+encodeURIComponent("Olá, "+c.name+"! Vamos confirmar suas entregas?"):"";
}
function riderCards(){
 return stats().map(({courier:c,statement:s})=>{
  const link=wa(c);
  return '<article class="moto-rider"><header><strong>'+esc(c.name)+'</strong><span>'+
   esc({delivery:"Fixo/entrega",kilometer:"Quilometragem",daily:"Diária",hybrid:"Entrega + km"}[c.paymentModel])+
   '</span></header><p>'+esc(c.phone||"Telefone não cadastrado")+
   (c.notes?'<br><small>'+esc(c.notes)+'</small>':"")+'</p>'+
   '<div class="moto-row"><span>'+s.trips+' viagens · '+s.orders+' entregas · '+s.km+' km</span>'+
   '<b>A pagar: '+money(s.balance)+'</b></div>'+
   '<div class="actions">'+(link?'<a class="btn mini" target="_blank" rel="noopener noreferrer" href="'+esc(link)+'">WhatsApp</a>':"")+
   (c.pixKey?'<button class="btn mini line" type="button" data-id="'+esc(c.id)+'" onclick="POTE_MOTOBOY.copyPix(this.dataset.id)">Copiar PIX</button>':"")+
   (s.balance>0?'<button class="btn mini line" type="button" data-id="'+esc(c.id)+'" onclick="POTE_MOTOBOY.settle(this.dataset.id)">Registrar acerto</button>':"")+
   '</div><small class="moto-hint">Devido '+money(s.due)+' · pago '+money(s.paid)+
   (s.overpaid>0?' · pago a mais '+money(s.overpaid):"")+'</small></article>';
 }).join("")||'<p class="moto-note">Nenhum motoboy cadastrado nesta conta.</p>';
}
function tripCards(){
 return trips().slice().reverse().map(t=>{
  const c=courier(t.courierId),amount=c?tripAmount(c,t):0,refs=t.orderRefs||[];
  return '<article class="moto-trip"><div class="moto-row"><strong>Viagem '+esc(t.id.slice(-7))+
   '</strong><span>'+esc(t.at?.slice(0,10)||"")+' · '+esc(t.status==="delivered"?"Entregue":t.status==="cancelled"?"Cancelada":"Pendente")+'</span></div>'+
   '<div>'+esc(c?.name||"Motoboy removido")+' · '+deliveryCount(t)+' entrega(s) · '+effectiveKm(t).toLocaleString("pt-BR")+
   ' km · '+money(amount)+'</div>'+
   (t.note?'<small>'+esc(t.note)+'</small>':"")+
   '<div class="actions">'+(t.status==="planned"?'<button class="btn mini" data-id="'+esc(t.id)+'" onclick="POTE_MOTOBOY.deliver(this.dataset.id)">Confirmar entrega</button>'+
   '<button class="btn mini danger" data-id="'+esc(t.id)+'" onclick="POTE_MOTOBOY.cancel(this.dataset.id)">Cancelar viagem</button>':"")+
   (t.status==="delivered"&&c?.paymentModel!=="daily"&&!t.costAllocated?'<button class="btn mini line" data-id="'+esc(t.id)+'" onclick="POTE_MOTOBOY.allocate(this.dataset.id)">Ratear custo nos pedidos</button>':"")+
   '</div></article>';
 }).join("")||'<p class="moto-note">Nenhuma viagem registrada nesta conta.</p>';
}
function renderPage(){
 const riders=stats(),sum=riders.reduce((a,x)=>({trips:a.trips+x.statement.trips,orders:a.orders+x.statement.orders,
  km:a.km+x.statement.km,balance:a.balance+x.statement.balance}),{trips:0,orders:0,km:0,balance:0});
 return '<section class="moto-page"><div class="moto-header"><small>LOGÍSTICA MULTIUNIVERSO · PRIVADA DA CONTA</small>'+
 '<h2>🏍️ Central MOTOBOY</h2><p>Uma cozinha, entregas de Batataria, Pastelaria, Pizzaria e outros ramos. '+
 'Cadastro, viagens, quilometragem e acertos — sem serviços externos pagos.</p></div>'+
 '<div class="moto-stats">'+[['Viagens',sum.trips],['Entregas',sum.orders],['Quilometragem',round(sum.km)+" km"],['Saldo a pagar',money(sum.balance)]].map(([k,v])=>
 '<div><small>'+k+'</small><strong>'+esc(v)+'</strong></div>').join("")+'</div>'+
 deliveryForm()+courierForm()+tripForm()+'<h3>Entregadores e acertos</h3><div class="moto-riders">'+riderCards()+'</div>'+
 '<h3>Viagens e histórico</h3><div class="moto-trips">'+tripCards()+'</div>'+
 '<p class="moto-note">Valores previstos. Acertos são lançamentos de controle e nunca realizam pagamentos reais. Taxa cobrada do cliente e remuneração do motoboy são valores diferentes.</p></section>';
}
function saveCourier(){
 if(!ready())return;
 if(!premium()&&couriers().length>=1)return alerts("🔒 FREE: limite de um motoboy por conta.");
 const name=String($("motoName")?.value||"").trim().slice(0,110),
 phone=String($("motoPhone")?.value||"").trim(),pix=String($("motoPix")?.value||"").trim().slice(0,150),
 model=$("motoModel")?.value;
 if(!name||!MODELS.includes(model))return alerts("Informe nome e modelo de pagamento.");
 if(phone&&!normalizedPhone(phone))return alerts("Número inválido. Informe DDD e telefone.");
 const rd=n($("motoRateDelivery")?.value),rk=n($("motoRateKm")?.value),ry=n($("motoRateDay")?.value);
 if([rd,rk,ry].some(x=>!Number.isFinite(x)||x<0))return alerts("Valores de pagamento inválidos.");
 couriers().push({id:ident("courier"),name,phone,pixKey:pix,paymentModel:model,
  rateDelivery:rd,rateKm:rk,rateDay:ry,notes:String($("motoNotes")?.value||"").trim().slice(0,700),active:true,
  createdAt:new Date().toISOString()});
 changed();alerts("Motoboy cadastrado com sucesso.");
}
function createTrip(){
 if(!ready())return;
 if(!premium()&&trips().length>=1)return alerts("🔒 FREE: uma viagem de demonstração por conta.");
 const courierId=$("motoTripCourier")?.value;
 if(!courier(courierId))return alerts("Selecione um motoboy válido.");
 const km=n($("motoTripKm")?.value);
 if(!Number.isFinite(km)||km<0||km>2000)return alerts("Informe distância válida em km.");
 const refs=[...document.querySelectorAll('input[name="motoOrderChoice"]:checked')].map(input=>{
  const raw=String(input.value||""),index=raw.indexOf("/");
  return {universe:raw.slice(0,index),id:raw.slice(index+1)};
 });
 if(!refs.length)return alerts("Selecione pelo menos um pedido para a viagem.");
 const current=accountOrders();
 if(refs.some(ref=>!current.some(o=>o.id===ref.id&&o.universe===ref.universe&&canAssign(o,trips()))))
  return alerts("Pedido inexistente ou já atribuído a outra viagem.");
 // One online checkout may contain multiple kitchen rows. Assign all of
 // them together so the courier is paid for one destination, not each item.
 const selected=new Map(refs.map(ref=>[ref.universe+"/"+ref.id,ref]));
 for(const ref of refs){
  const order=current.find(o=>o.id===ref.id&&o.universe===ref.universe)?.order;
  if(order?.source!=="public-checkout"||!order.checkoutId)continue;
  for(const o of current.filter(x=>x.universe===ref.universe&&x.order.source==="public-checkout"&&x.order.checkoutId===order.checkoutId)){
   if(!canAssign(o,trips()))return alerts("Pedido online já atribuído a outra viagem.");
   selected.set(o.universe+"/"+o.id,{universe:o.universe,id:o.id,checkoutId:order.checkoutId});
  }
 }
 const grouped=[...selected.values()];
 const at=String($("motoTripDate")?.value||today());
 if(!/^\d{4}-\d\d-\d\d$/.test(at))return alerts("Data inválida.");
 trips().push({id:ident("trip"),courierId,at,orderRefs:grouped,km,
  distanceMode:$("motoTripDistance")?.value==="oneWayReturn"?"oneWayReturn":"actual",
  note:String($("motoTripNote")?.value||"").trim().slice(0,700),status:"planned",createdAt:new Date().toISOString()});
 changed();alerts("Viagem registrada. O mesmo trajeto pode conter vários pedidos.");
}
function deliver(id){
 if(!ready())return;
 const t=trips().find(x=>x.id===id&&x.status==="planned");if(!t)return;
 if(!confirm("Confirmar a entrega desta viagem? O registro será usado no cálculo do acerto."))return;
 t.status="delivered";t.deliveredAt=new Date().toISOString();
 for(const ref of t.orderRefs||[]){const order=orderRef(ref);if(order){
  order.motoboyTripId=t.id;order.motoboyCourierId=t.courierId;
 }}
 changed();alerts("Viagem concluída e vinculada aos pedidos.");
}
function cancel(id){
 if(!ready())return;
 const t=trips().find(x=>x.id===id&&x.status==="planned");if(!t)return;
 if(!confirm("Cancelar viagem ainda não concluída? Nenhum pedido será apagado."))return;
 t.status="cancelled";t.cancelledAt=new Date().toISOString();
 changed();
}
function allocate(id){
 if(!ready())return;
 const trip=trips().find(x=>x.id===id&&x.status==="delivered"&&!x.costAllocated);
 const c=courier(trip?.courierId);
 if(!trip||!c||c.paymentModel==="daily")return alerts("Diárias são acertadas pelo dia, não por pedido.");
 const rows=(trip.orderRefs||[]).map(orderRef).filter(Boolean);
 if(!rows.length)return alerts("Pedidos históricos não foram encontrados. Custo preservado.");
 const total=tripAmount(c,trip);
 if(!confirm("Ratear "+money(total)+" entre "+rows.length+" pedidos? O custo de entrega anterior será preservado para auditoria e substituído no cálculo de lucro."))return;
 if(rows.some(order=>order.motoboyCostRef&&order.motoboyCostRef!==trip.id))
  return alerts("Pedido já possui outro rateio de motoboy; revise manualmente.");
 const single=round(total/rows.length);
 for(let i=0;i<rows.length;i++){
  const order=rows[i],cost=i===rows.length-1?round(total-single*(rows.length-1)):single;
  if(!order.motoboyCostRef)order.deliveryCostBeforeMotoboy=Number(order.deliveryCost)||0;
  order.deliveryCost=cost;order.motoboyCostRef=trip.id;
 }
 trip.costAllocated=true;trip.allocatedAmount=total;trip.allocatedAt=new Date().toISOString();
 changed();alerts("Custo rateado sem duplicar o valor nos pedidos.");
}
function settle(id){
 if(!ready())return;
 const c=courier(id);if(!c)return;
 const s=courierStatement(c,trips(),settlements());
 if(!s.balance)return alerts("Não há saldo pendente.");
 const raw=prompt("Valor do acerto com "+c.name+" (máximo "+money(s.balance)+"). Isso NÃO envia PIX.",s.balance.toFixed(2).replace(".",","));
 if(raw===null)return;
 const amount=n(raw);
 if(!Number.isFinite(amount)||amount<=0||amount>s.balance+.001)return alerts("Valor inválido ou maior que o saldo.");
 if(!confirm("Registrar "+money(amount)+" como valor já pago a "+c.name+"?"))return;
 settlements().push({id:ident("settlement"),courierId:id,amount:round(amount),at:new Date().toISOString(),method:"manual",note:"Acerto informado pelo operador"});
 changed();alerts("Acerto registrado. Nenhum PIX foi enviado.");
}
async function copyPix(id){
 const c=courier(id);if(!c?.pixKey)return;
 try{if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");await navigator.clipboard.writeText(c.pixKey);alerts("Chave PIX copiada.");}
 catch(e){window.prompt("Copie a chave PIX:",c.pixKey)}
}
window.POTE_MOTOBOY={render:renderPage,saveCourier,createTrip,deliver,cancel,allocate,settle,copyPix,
 accountOrders,stats,addZone,saveDelivery,deliveryPolicy,refresh:()=>{if(state.tab==="motoboy")render()}};
})();