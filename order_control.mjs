import {groupOnlineOrders,duration,STEPS} from "./order_control_core.mjs?v=1";
const head=document.querySelector(".head");
if(head&&!window.POTE_ORDER_CONTROL){
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const button=node("button","pote-order-control-button");button.id="poteOrderControl";button.type="button";button.hidden=true;button.setAttribute("aria-haspopup","dialog");
 const title=node("span","pote-order-control-title","📋 CONTROLE DE PEDIDOS");const count=node("strong","pote-order-control-count","0 ativos");button.append(title,count);
 head.append(button);
 const modal=node("dialog","pote-order-control-dialog");modal.id="poteOrderControlDialog";modal.setAttribute("aria-labelledby","poteOrderControlTitle");
 const top=node("header","pote-order-control-top");const heading=node("h2","","Controle de pedidos online");heading.id="poteOrderControlTitle";const close=node("button","btn line","Fechar ×");close.type="button";close.onclick=()=>modal.close();top.append(heading,close);
 const summary=node("div","pote-order-control-summary"),notice=node("p","pote-order-control-notice"),list=node("div","pote-order-control-list");notice.setAttribute("role","status");modal.append(top,summary,notice,list);document.body.append(modal);
 let fingerprint="",session="",busy=false;
 const context=()=>{const uid=window.POTE_AUTH?.uid,universe=state.data?.businessType||"batataria";return {uid,universe,key:uid+"|"+universe,allowed:!!uid&&window.POTE_APP_READY===true&&window.POTE_ACCESS?.allowsService?.(universe,"orders")===true}};
 const groups=()=>groupOnlineOrders(state.data?.orders||[]);
 const available=()=>window.POTE_WORKER?.enabled===true&&!window.POTE_SYNC_GUARD?.blocked&&navigator.onLine!==false;
 function refresh(){
  const ctx=context();
  button.hidden=!ctx.allowed;
  if(session&&session!==ctx.key&&modal.open)modal.close();
  session=ctx.key;
  if(!ctx.allowed){if(modal.open)modal.close();list.replaceChildren();summary.replaceChildren();notice.textContent="";fingerprint="";return}
  const rows=groups();
  count.textContent=rows.length+" "+(rows.length===1?"ativo":"ativos");
  button.classList.toggle("has-new",rows.some(r=>r.status==="recebido"));
  if(!modal.open)return;
  const ready=available(),sig=JSON.stringify([ctx.key,rows,ready,busy]);
  if(sig!==fingerprint){
   fingerprint=sig;summary.replaceChildren();
   for(const [key,step] of Object.entries(STEPS)){const chip=node("span","pote-order-control-chip",step.label+" · "+rows.filter(r=>r.status===key).length);chip.style.setProperty("--stage",step.color);summary.append(chip)}
   notice.textContent=busy?"Confirmando com o servidor…":ready?"Selecione a próxima etapa do pedido.":"Somente consulta: servidor de pedidos ou sincronização indisponível.";
   list.replaceChildren();
   if(!rows.length)list.append(node("p","pote-order-control-empty","Nenhum pedido online em andamento neste ramo."));
   for(const row of rows){
    const article=node("article","pote-order-control-card");article.style.setProperty("--stage",STEPS[row.status].color);
    const meta=node("div","pote-order-control-meta");meta.append(node("strong","",row.code+" · "+row.customer),node("span","pote-order-control-clock"));meta.lastChild.dataset.started=row.createdAt||"";
    article.append(meta,node("p","pote-order-control-stage",STEPS[row.status].label),node("p","",row.items.join(" · ")),node("p","",row.delivery?"Tele-entrega · "+row.address:"Retirada na loja"));
    const action=node("button","pote-order-control-action",row.label);action.type="button";action.disabled=!row.action||!ready||busy;action.onclick=()=>void advance(row.id,ctx.key);article.append(action);list.append(article);
   }
  }
  for(const el of list.querySelectorAll("[data-started]"))el.textContent=duration(el.dataset.started);
 }
 async function advance(id,expected){
  const ctx=context();if(busy||!ctx.allowed||ctx.key!==expected||!available()||!operationReady("Pedido online"))return;
  const row=groups().find(x=>x.id===id);if(!row?.action)return;
  if(row.action==="deliver"&&!confirm(row.delivery?"Confirmar que o pedido foi entregue?":"Confirmar que o cliente retirou o pedido?"))return;
  busy=true;refresh();
  try{
   if(row.action==="produce"){
    // Each kitchen row uses the existing authoritative production transition.
    // Stop on first rejection, preserve already confirmed lines and allow retry.
    for(const id of row.ids){
     if(context().key!==expected||!context().allowed||!available())break;
     const current=groups().find(g=>g.id===row.id);
     if(current?.action!=="produce"||!current.ids.includes(id))continue;
     if(await produce(id,{keepView:true})!==true)break;
    }
   }else await onlineOrderStage(row.ids[0],row.action,{keepView:true});
  }catch(e){toast(String(e.message||e),"error")}finally{busy=false;fingerprint="";refresh()}
 }
 button.onclick=()=>{if(!context().allowed)return;modal.showModal();fingerprint="";refresh()};
 modal.addEventListener("close",()=>{fingerprint="";list.replaceChildren();summary.replaceChildren();notice.textContent=""});
 window.POTE_ORDER_CONTROL={refresh};
 setInterval(()=>{if(!document.hidden)refresh()},1000);
 refresh();
}
