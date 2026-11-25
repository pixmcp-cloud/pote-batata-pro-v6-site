/* V6 public checkout — opt-in canary, off by default. One transaction for
 * all lines, reservation via native received orders, no physical debit/payment.
 * The browser supplies product IDs, quantities and expected total ONLY. */
import {OperationalError,quantities,recordPath,resolveRecord} from "./domain.mjs";
import {trackingPath,initialTracking} from "./tracking.mjs";
const fail=(message,code="invalid_checkout",status=400)=>{throw new OperationalError(message,status,code)};
const isObject=x=>x&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,keys)=>isObject(x)&&Object.keys(x).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(x,k));
const idOk=x=>typeof x==="string"&&/^[A-Za-z0-9_.:-]{1,72}$/.test(x);
const uuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const money=(v,max=1e9)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
const put=(path,data,previous)=>({path,data,precondition:previous?{updateTime:previous.updateTime}:{exists:false}});
const unavailable=x=>!x||x.unavailable===true||x.suspended===true||x.franchiseLocked===true||x.archived===true;
const keyForOrder=(operationId,index)=>"web-"+operationId+"-"+index;
const scope=new Set(["batataria","pizzaria","hamburgueria","hotdog","pastelaria","lancheria"]);
const text=(x,max)=>typeof x==="string"&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const sha256=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,"0")).join("");
export async function checkoutRequest(req){
 let raw;
 try{
  if(Number(req.headers.get("Content-Length")||0)>12000)fail("Pedido muito extenso.");
  const reader=req.body?.getReader();if(!reader)fail("Pedido inválido.");
  let length=0,body="";const decoder=new TextDecoder("utf-8",{fatal:true});
  try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>12000){await reader.cancel();fail("Pedido muito extenso.")}body+=decoder.decode(next.value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock()}
  raw=JSON.parse(body);
 }catch(e){if(e instanceof OperationalError)throw e;fail("Pedido inválido.")}
 if(!exact(raw,["slug","operationId","items","expectedTotalCents","customerName","customerPhone","payment","challenge"])||
   typeof raw.slug!=="string"||!/^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/.test(raw.slug)||!uuid(raw.operationId)||
   !Array.isArray(raw.items)||raw.items.length<1||raw.items.length>20||
   !Number.isSafeInteger(raw.expectedTotalCents)||raw.expectedTotalCents<=0||raw.expectedTotalCents>10000000||
   !text(raw.customerName,80)||raw.customerName.trim().length<2||!text(raw.customerPhone,24)||
   !["pix","cartao","dinheiro"].includes(raw.payment)||typeof raw.challenge!=="string"||raw.challenge.length<1||raw.challenge.length>2048)
  fail("Confira os dados do pedido.");
 const digits=raw.customerPhone.replace(/\D/g,""),phone=digits.length===10||digits.length===11?"55"+digits:digits;
 if(!/^[+0-9(). -]+$/.test(raw.customerPhone)||!/^55[1-9][0-9][2-9][0-9]{7,8}$/.test(phone))fail("Informe um telefone brasileiro válido.");
 let units=0;
 const items=raw.items.map(item=>{
  if(!exact(item,["id","quantity","note"])||!idOk(item.id)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>20||!text(item.note,220))fail("Produto ou quantidade inválida.");
  units+=item.quantity;return {id:item.id,quantity:item.quantity,note:item.note.trim()};
 });
 if(units>60)fail("Limite de 60 produtos por pedido.");
 return {slug:raw.slug,operationId:raw.operationId.toLowerCase(),items,expectedTotalCents:raw.expectedTotalCents,customerName:raw.customerName.trim(),customerPhone:phone,payment:raw.payment,challenge:raw.challenge};
}
export async function verifyCheckoutChallenge(token,env,operationId){
 const secret=env.TURNSTILE_SECRET,hosts=String(env.TURNSTILE_HOSTNAMES||"").split(",").map(x=>x.trim()).filter(Boolean);
 if(!secret||!hosts.length||hosts.length>10||!hosts.every(x=>/^[a-z0-9.-]+$/.test(x)))return false;
 try{
  const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret,response:token,idempotency_key:crypto.randomUUID()}),signal:AbortSignal.timeout(7000)});
  if(!response.ok)return false;
  const data=await response.json();
  return data.success===true&&data.action==="pote_checkout"&&hosts.includes(data.hostname);
 }catch{return false}
}
function permit(profile,env,uid,universe,slug,at){
 const list=String(env.CANARY_UIDS||"").split(",").map(x=>x.trim()).filter(Boolean);
 const p=profile?.accessPolicy||{},l=profile?.license||{},fr=profile?.franchise;
 if(!list.length||list.length>20||!list.every(x=>/^[A-Za-z0-9:_-]{1,128}$/.test(x))||!list.includes(uid)||
 p.workerAuthoritative!==true||p.publicCheckout!==true||p.publicCheckoutSlug!==slug||
 p.blockedUniverses?.includes(universe)||["orders","stock","vitrine"].some(service=>p.blockedServices?.includes(universe+":"+service)))return false;
 if(fr?.status==="active"&&fr.brandId==="potebatata")return universe==="batataria";
 return l.status==="active"&&((l.kind==="lifetime"&&l.term==="lifetime")||(["pro","trial"].includes(l.kind)&&Date.parse(l.expiresAt)>at.getTime()));
}
const round5=n=>Math.round(n*100000)/100000;
function addNeeds(target,order){
 for(const [k,v] of quantities(order))target.set(k,round5((target.get(k)||0)+v));
}
function numeric(value,label,fallback){
 const v=value??fallback;
 if(!money(v))fail("Cadastro financeiro incompleto: "+label,"catalog_incomplete",409);
 return v;
}
function cost(item,basis){
 if(basis==="average"&&item.averageCostKnown===true&&money(item.averageUnitCost)&&item.averageUnitCost>0)return item.averageUnitCost;
 const price=numeric(item.purchasePrice??item.price,"preço de compra"),qty=numeric(item.purchaseQuantity,"quantidade de compra");
 if(qty<=0||price<=0)fail("Custo de compra precisa ser revisado.","catalog_incomplete",409);
 if(!["g","kg","ml","L","un"].includes(item.purchaseUnit))fail("Unidade de compra precisa ser revisada.","catalog_incomplete",409);
 return price/(qty*(["kg","L"].includes(item.purchaseUnit)?1000:1));
}
function record(doc,group,universe,id){
 const r=doc?.data?.record;
 if(!r||r.id!==id||r.group!==group||r.universe!==universe||r.item?.id!==id||unavailable(r.item))fail("Produto ou insumo indisponível.","catalog_changed",409);
 return r.item;
}
const dateBR=at=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(at);
export async function submitCheckout({input,env,repository,at,consumerUid}){
 if(typeof consumerUid!=="string"||!/^[A-Za-z0-9:_-]{1,128}$/.test(consumerUid))fail("Entre com Google para confirmar.","authentication_required",401);
 if(env.ENABLE_WRITES!=="true"||env.ENABLE_PUBLIC_CHECKOUT!=="true")fail("Checkout em homologação.","checkout_disabled",423);
 const tx=await repository(env).transaction();
 try{
  const menu=(await tx.get("publicMenus/"+input.slug))?.data;
  if(!menu||menu.schemaVersion!==1||menu.published!==true||menu.checkoutEnabled!==true||menu.slug!==input.slug||
   !scope.has(menu.businessType)||typeof menu.ownerUid!=="string"||!/^[A-Za-z0-9:_-]{1,128}$/.test(menu.ownerUid)||
   !Array.isArray(menu.items)||menu.items.length>60)fail("Loja indisponível para pedidos automáticos.","checkout_disabled",423);
  const uid=menu.ownerUid,universe=menu.businessType,root="users/"+uid;
  const profile=(await tx.get(root))?.data;
  if(!permit(profile,env,uid,universe,input.slug,at))fail("Loja indisponível para pedidos automáticos.","checkout_disabled",423);
  const eventPath=root+"/publicCheckoutEvents/"+input.operationId;
  const {challenge,...intent}=input,fingerprint=await sha256(JSON.stringify({consumerUid,...intent}));
  const previous=await tx.get(eventPath);
  if(previous){
   if(previous.data.consumerUid!==consumerUid||previous.data.fingerprint!==fingerprint)fail("Identificador já utilizado em outro pedido.","idempotency_conflict",409);
   return {...previous.data.result,alreadyApplied:true};
  }
  const consumerPath=trackingPath(consumerUid,input.operationId);
  if(await tx.get(consumerPath))fail("Identificador já utilizado.","idempotency_conflict",409);
  const metaPath=root+"/appState/v5",guardPath=root+"/appState/v5InventoryGuard",pulsePath=root+"/appState/v5Pulse";
  const [meta,guard,pulse]=await Promise.all([tx.get(metaPath),tx.get(guardPath),tx.get(pulsePath)]);
  const state=meta?.data?.state?.data;
  // Initially restrict to the active workspace and separate stock. Shared
  // kitchens require cross-universe reservation reconciliation before rollout.
  if(meta?.data?.schemaVersion!==5||state?.businessType!==universe||
   state.kitchenStock?.mode!=="separate"||!Number.isSafeInteger(guard?.data?.revision)||guard.data.revision<0||
   !pulse?.data?.eventId||!Number.isSafeInteger(state.orderSequenceLast??0)||(state.orderSequenceLast??0)<0)
   fail("Loja ainda não preparada para checkout.","not_ready",409);
  const settings=state.settings||{};
  const fees=numeric(settings.fee,"taxa",0)+numeric(settings.tax,"impostos",0);
  if(fees>=100)fail("Taxas precisam ser revisadas.","catalog_incomplete",409);
  // Expenses are normalized records, not metadata; fetched below using the
  // bounded transactional query. Avoid estimating profits without expenses.
  const catalog=new Map();
  for(const p of menu.items){if(!idOk(p?.id)||catalog.has(p.id))fail("Cardápio inválido.","catalog_changed",409);catalog.set(p.id,p)}
  const rows=[];
  let total=0;
  const stock=new Map();
  const load=async(group,id)=>{
   if(!idOk(id))fail("Identificador do catálogo inválido.","catalog_changed",409);
   const key=group+":"+id;
   if(!stock.has(key))stock.set(key,record((await resolveRecord(tx,uid,universe,group,id)).doc,group,universe,id));
   return stock.get(key);
  };
  // Query all received records and count all existing reservations, including
  // orders from the ordinary POS. The inventory guard serializes every writer.
  const pending=await tx.receivedOrders(uid,201);
  if(pending.length>=201)fail("Muitos pedidos aguardando produção. Tente mais tarde.","queue_full",409);
  const reserved=new Map(),customerPending=new Set();
  let sequence=state.orderSequenceLast??0;
  for(const doc of pending){
   const r=doc.data?.record;if(r?.group!=="orders"||r.universe!==universe||r.item?.status!=="recebido")continue;
   const o=r.item;
   if(o.stockDeducted!==true)addNeeds(reserved,o);
   if(Number.isSafeInteger(o.orderNumber))sequence=Math.max(sequence,o.orderNumber);
   if(o.checkoutId&&(o.consumerUid===consumerUid||o.clientPhone===input.customerPhone))customerPending.add(o.checkoutId);
  }
  if(customerPending.size>=3)fail("Você já tem pedidos aguardando preparo. Fale com a loja.","queue_full",409);
  const expenseDocs=await tx.expenses(uid,201);
  if(expenseDocs.length>=201)fail("Despesas precisam ser revisadas.","catalog_incomplete",409);
  let variableExpense=0,fixedExpense=0;
  for(const doc of expenseDocs){
   const r=doc.data?.record;if(r?.group!=="expenses"||r.universe!==universe||r.item?.enabled!==true)continue;
   const e=r.item,amount=numeric(e.amount,"despesa")*numeric(e.repeat,"ocorrências",1);
   if(e.mode==="mensal")fixedExpense+=amount;
   else if(e.mode==="unidade")variableExpense+=amount;
   else fail("Tipo de despesa inválido.","catalog_incomplete",409);
  }
  const fixed=fixedExpense/Math.max(1,numeric(settings.estimatedMonthlyUnits,"unidades mensais",1));
  for(const line of input.items){
   const p=catalog.get(line.id);
   if(!p||p.available===false||!Number.isSafeInteger(p.priceCents)||p.priceCents<=0||p.priceCents>9999999)
    fail("Produto indisponível. Atualize o cardápio.","catalog_changed",409);
   const isBev=p.category==="Bebidas"&&line.id.startsWith("bev-");
   const source=await load(isBev?"beverages":"recipes",isBev?line.id.slice(4):line.id);
   let ingredients=[],beverages=[],variable=variableExpense+numeric(settings.otherCost,"outros custos",0);
   if(isBev){
    if(Math.round(numeric(source.sellPrice,"preço de venda")*100)!==p.priceCents)fail("Preço da bebida mudou. Atualize o cardápio.","price_changed",409);
    const unitCost=cost({...source,purchaseUnit:"un"},settings.costBasis);
    beverages=[{id:source.id,name:source.name,qty:1,unitCost}];variable+=unitCost;
   }else{
    if(!Array.isArray(source.items)||source.items.length<1||source.items.length>30||source.costEstimateMode==="estimated")
     fail("Ficha técnica precisa ser revisada para venda automática.","catalog_incomplete",409);
    const sourceRows=source.items.map(x=>({id:x?.id,g:x?.g}));
    const packages=settings.usePackagingStock===true?(source.packagingIngredientIds||[]):[];
    if(!Array.isArray(packages)||packages.length>10||new Set(packages).size!==packages.length)fail("Embalagens inválidas.","catalog_incomplete",409);
    for(const id of packages)sourceRows.push({id,g:1,isPkg:true});
    for(const row of sourceRows){
     if(!money(row.g,1e6)||row.g<=0)fail("Quantidade de ficha inválida.","catalog_incomplete",409);
     const i=await load("ingredients",row.id),yieldPct=numeric(i.yield,"rendimento",100);
     if(yieldPct<1||yieldPct>1000||!["g","ml","un"].includes(i.measureUnit)||row.isPkg&&i.measureUnit!=="un")
      fail("Unidade ou rendimento inválido.","catalog_incomplete",409);
     if(i.measureUnit==="un"&&!Number.isInteger(row.g))fail("Insumo unitário fracionado.","catalog_incomplete",409);
     ingredients.push({id:i.id,g:row.g,ingredientName:i.name,measureUnit:i.measureUnit,yieldPct,...(row.isPkg?{isPkg:true}:{})});
     variable+=row.g*cost(i,settings.costBasis)/(yieldPct/100);
    }
    if(!packages.length)variable+=numeric(settings.packageCost,"embalagem",0);
   }
   const price=p.priceCents/100,contribution=price*(1-fees/100)-variable;
   // Do not accept stale posted prices that would sell below variable cost.
   if(!Number.isFinite(contribution)||contribution<=0)fail("Preço indisponível. A loja precisa revisar os custos.","price_changed",409);
   if(sequence>=Number.MAX_SAFE_INTEGER-20)fail("Sequência inválida.","not_ready",409);
   const order={id:keyForOrder(input.operationId,rows.length),orderNumber:++sequence,checkoutId:input.operationId,source:"public-checkout",consumerUid,
    name:String(p.title).slice(0,90),recipeId:isBev?"":source.id,comboId:"",qty:line.quantity,price,deliveryFee:0,deliveryCost:0,
    profit:contribution-fixed,unitContribution:contribution,unitVariableCost:variable,feePct:fees,
    clientId:"",clientName:input.customerName,clientPhone:input.customerPhone,clientAddress:"",deliveryType:"Retirada",
    paymentMethod:"Na entrega",requestedPaymentMethod:({pix:"Pix",cartao:"Cartão",dinheiro:"Dinheiro"})[input.payment],
    paymentStatus:"Pendente",paidAmount:null,changeGiven:null,cashSessionId:null,status:"recebido",stockDeducted:false,
    date:dateBR(at),createdAt:at.toISOString(),note:line.note,channel:"direto",items:ingredients,beverageItems:beverages,addons:[],
    removedIngredients:[],customAddons:[],businessType:universe,recipeCategory:p.category};
   addNeeds(reserved,order);
   rows.push(order);total+=p.priceCents*line.quantity;
  }
  if(total!==input.expectedTotalCents)fail("O total mudou. Atualize o cardápio antes de confirmar.","price_changed",409);
  // Only check items touched by the new order, while subtracting ALL existing holds.
  const needed=new Map();for(const o of rows)addNeeds(needed,o);
  for(const [key] of needed){
   const [group,...parts]=key.split(":"),id=parts.join(":");const item=await load(group,id);
   if(!money(item.stock)||reserved.get(key)>item.stock+0.000001)fail("Estoque insuficiente. Atualize a sacola.","insufficient_stock",409);
   if(group==="beverages"&&!Number.isSafeInteger(item.stock))fail("Estoque de bebida inválido.","catalog_incomplete",409);
  }
  const nextState=structuredClone(meta.data.state);nextState.data.orderSequenceLast=sequence;
  const writes=[],changed=[];
  for(const [index,o] of rows.entries()){
   const path=recordPath(uid,universe,"orders",o.id);
   writes.push(put(path,{record:{universe,group:"orders",id:o.id,item:o,rank:-at.getTime()-index/100}},null));
   changed.push(path.split("/").at(-1));
  }
  const result={ok:true,checkoutId:input.operationId,createdAt:at.toISOString(),totalCents:total,orderNumbers:rows.map(o=>o.orderNumber),status:"recebido",paymentStatus:"pendente",alreadyApplied:false};
  writes.push(put(metaPath,{...meta.data,state:nextState},meta),put(guardPath,{revision:guard.data.revision+1},guard),
   put(pulsePath,{eventId:"web-"+input.operationId,previousEventId:pulse.data.eventId,origin:"public-checkout",affected:changed.length,changedKeys:changed,metaChanged:true,sensitive:true},pulse),
   put(eventPath,{fingerprint,result,consumerUid,createdAt:at.toISOString()},null),
   put(consumerPath,initialTracking({rows,slug:input.slug,title:menu.title,total,at:at.toISOString(),checkoutId:input.operationId}),null));
  await tx.commit(writes);
  return result;
 }finally{await tx.rollback()}
}
