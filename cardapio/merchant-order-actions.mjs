// Candidate PDV actions: no direct Firestore/local inventory mutation.
import {CHECKOUT_ENDPOINT} from "./checkout-config.mjs";
import {createCheckoutApi,getOrderAuth} from "./checkout-api.mjs";
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
const btn=text=>{const b=el("button",text);b.type="button";b.className="btn mini";return b};
export async function openMerchantOrder({order,ownerUid,onChanged,notify}){
 if(!CHECKOUT_ENDPOINT||!order?.publicCheckoutV6){notify("Pedidos online ainda estão em homologação.");return;}
 const {auth}=await getOrderAuth();
 if(!ownerUid||auth.currentUser?.uid!==ownerUid){notify("Sessão da loja não confirmada.");return;}
 const api=createCheckoutApi({token:()=>auth.currentUser?.getIdToken()}),id=order.publicCheckoutId;
 const panel=el("dialog"),body=el("section"),heading=el("h2","Gerenciar pedido online"),status=el("p"),actions=el("div");
 panel.className="public-menu-dialog";body.className="public-menu-shell";actions.className="actions";
 const close=btn("Fechar");close.onclick=()=>panel.close();body.append(heading,status,actions,close);panel.append(body);document.body.append(panel);
 let busy=false,alive=true;panel.addEventListener("close",()=>{alive=false;panel.remove()},{once:true});panel.showModal();
 async function send(route,data){
  if(busy||!alive||auth.currentUser?.uid!==ownerUid)return;busy=true;actions.querySelectorAll("button").forEach(b=>b.disabled=true);
  try{const result=await api.request(route,{id,operationId:crypto.randomUUID(),...data});if(!result.ok)throw Error("not confirmed");
   notify("Operação confirmada pelo servidor.");await onChanged?.();if(alive)await load();
  }catch(e){status.textContent="Operação não confirmada: "+(e.code||"verifique a conexão e atualize o pedido.");}
  finally{busy=false;if(alive)actions.querySelectorAll("button").forEach(b=>b.disabled=false);}
 }
 function add(text,fn){const b=btn(text);b.onclick=fn;actions.append(b);return b;}
 async function load(){
  const v=await api.request("orders/read",{id});if(!alive)return;
  status.textContent=v.code+" • "+v.label+" • "+(v.paymentStatus==="confirmed"?"Pago":"Pagamento pendente");
  actions.replaceChildren();
  const transition=next=>()=>void send("orders/transition",{next});
  if(v.status==="recebido")add("Iniciar preparo",transition("em_producao"));
  if(v.status==="em_producao")add("Finalizar preparo",transition("finalizado"));
  if(v.status==="finalizado"&&v.fulfillment==="retirada")add("Confirmar retirada",transition("entregue"));
  if(v.fulfillment==="entrega"&&!["saiu_entrega","entregue","cancelado"].includes(v.status)){
   const email=el("input");email.type="email";email.placeholder="E-mail Google do motoboy";email.maxLength=254;actions.append(email);
   const invitation=el("input");invitation.readOnly=true;invitation.hidden=true;invitation.setAttribute("aria-label","Link privado de convite");actions.append(invitation);
   const generate=add("Gerar convite privado (30 min)",async()=>{if(busy||!email.value.trim()||!email.checkValidity()||auth.currentUser?.uid!==ownerUid)return;busy=true;generate.disabled=true;
    try{const result=await api.request("orders/invite",{id,email:email.value.trim()});if(!alive||auth.currentUser?.uid!==ownerUid)return;if(!result.ok||!/^[a-f0-9]{64}$/.test(result.token||""))throw Error("invalid invite");
     const url=new URL("./entrega.html?pedido="+encodeURIComponent(id),import.meta.url);url.hash="convite="+result.token;invitation.value=url.href;invitation.hidden=false;invitation.select();
     try{await navigator.clipboard.writeText(url.href);notify("Convite copiado. Envie apenas ao motoboy indicado.");}catch{notify("Convite gerado. Copie o link e envie apenas ao motoboy indicado.");}
    }catch{if(alive)status.textContent="Não foi possível gerar o convite.";}finally{busy=false;generate.disabled=false;}});
   add("Atualizar vínculo do motoboy",()=>void load().catch(()=>notify("Não foi possível atualizar.")));
   const input=el("input");input.placeholder="UID Google do motoboy já vinculado";input.maxLength=128;actions.append(input);
   add(v.courierAssigned?"Alterar motoboy":"Atribuir motoboy",()=>{if(input.value.trim())void send("orders/assign",{courierUid:input.value.trim()});});
  }
  if(v.fulfillment==="entrega"&&v.courierAssigned&&["finalizado","saiu_entrega"].includes(v.status)){
   const link=el("a","Abrir área do motoboy");link.href=new URL("./entrega.html?pedido="+encodeURIComponent(id),import.meta.url).href;link.target="_blank";link.rel="noopener noreferrer";actions.append(link);
   if(v.status==="finalizado")add("Confirmar saída",transition("saiu_entrega"));
   if(v.status==="saiu_entrega")add("Confirmar entrega com código",()=>{const deliveryCode=prompt("Código de 4 dígitos informado pelo cliente após receber o pedido:");if(/^\d{4}$/.test(deliveryCode||""))void send("orders/transition",{next:"entregue",deliveryCode});});
  }
  if(v.status!=="cancelado"&&v.paymentStatus!=="confirmed"){
   const input=el("input");input.placeholder="Referência do recebimento conferido";input.maxLength=120;actions.append(input);
   add("Confirmar recebimento no caixa",()=>{if(input.value.trim()&&confirm("Você conferiu o recebimento real deste pedido?"))void send("orders/confirm-payment",{reference:input.value.trim()});});
  }
  if(!["entregue","cancelado"].includes(v.status)&&v.paymentStatus!=="confirmed"){
   add("Cancelar e liberar/devolver estoque",()=>{if(confirm("Cancelar pedido e liberar/devolver insumos?"))void send("orders/transition",{next:"cancelado",decision:"return"});});
   if(v.status!=="recebido")add("Cancelar com perda",()=>{if(confirm("Registrar perda física neste pedido?"))void send("orders/transition",{next:"cancelado",decision:"loss"});});
  }
 }
 try{await load()}catch{status.textContent="Não foi possível consultar o pedido autorizado."}
}
