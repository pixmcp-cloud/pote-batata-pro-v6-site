import {connectCall,makeConnectPanel} from "./motoboy-connect/connect-client.mjs?v=5";
let panel=null,modal=null;
const token=()=>window.POTE_CONNECT_TOKEN();
function open(){
 if(!window.POTE_APP_READY||!window.POTE_AUTH?.uid||window.POTE_ACCESS?.requireService?.("motoboy")===false)return;
 const uid=window.POTE_AUTH.uid,universe=state.data.businessType||"batataria";
 if(modal?.open)modal.close();modal?.remove();
 modal=document.createElement("dialog");modal.className="pote-order-control-dialog";const title=document.createElement("h2");title.textContent="MOTOBOY CONNECT";const close=document.createElement("button");close.textContent="Fechar ×";close.className="btn line";close.onclick=()=>modal.close();
 const select=document.createElement("select"),email=document.createElement("input"),instructions=document.createElement("textarea"),status=document.createElement("p"),holder=document.createElement("div");email.type="email";email.placeholder="E-mail Google do motoboy";instructions.placeholder="Instruções opcionais (portaria, volumes…)";instructions.maxLength=240;
 const seen=new Set();for(const o of state.data.orders||[]){if(o.source!=="public-checkout"||o.deliveryType!=="Tele-entrega"||o.status!=="em_producao"||!o.checkoutReadyAt||seen.has(o.checkoutId))continue;seen.add(o.checkoutId);const opt=document.createElement("option");opt.value=o.checkoutId;opt.textContent="#P"+String(o.orderNumber).padStart(7,"0")+" · "+o.clientName;select.append(opt)}
 const create=document.createElement("button"),view=document.createElement("button");create.className="btn";view.className="btn line";create.textContent="Gerar convite";view.textContent="Consultar convite e localização";
 const valid=()=>window.POTE_AUTH?.uid===uid&&state.data.businessType===universe&&window.POTE_APP_READY===true;
 async function action(action){if(!valid()||!select.value)return;create.disabled=view.disabled=true;status.textContent="Consultando servidor…";try{const job=await connectCall(await token(),{action,universe,checkoutId:select.value,...(action==="invite"?{email:email.value,instructions:instructions.value}:{})});if(!valid()||!modal.open)return;panel?.close();if(!job){status.textContent="Nenhum convite neste pedido.";return}status.textContent="Convite vinculado à conta Google indicada.";panel=makeConnectPanel({role:"merchant",id:job.id,container:holder,token:()=>{if(!valid())throw Error("Conta alterada.");return token()}})}catch(e){status.textContent=e.message}finally{create.disabled=view.disabled=false}}
 create.onclick=()=>void action("invite");view.onclick=()=>void action("find");select.onchange=()=>{panel?.close();panel=null;status.textContent=""};
 modal.append(title,close,select,email,instructions,create,view,status,holder);document.body.append(modal);modal.addEventListener("close",()=>{panel?.close();panel=null});modal.showModal();if(!seen.size){status.textContent="Conclua o preparo de um pedido online de tele-entrega antes de convidar um motoboy.";create.disabled=view.disabled=true;}
}
window.POTE_MOTOBOY_CONNECT={open};
