/* Hub de Delivery: adaptadores de importação offline, sem tokens/HTTP.
   As APIs oficiais requerem credenciais e backend. Este módulo não as chama. */
export const CHANNELS=Object.freeze([
 {id:"maisdelivery",name:"Mais Delivery",doc:"https://maisdeliveryapp.com.br/institucional/api/cadastro/",access:"Cadastro para documentação e credenciais",parser:"generic"},
 {id:"ifood",name:"iFood",doc:"https://developer.ifood.com.br/pt-BR/",access:"Cadastro CNPJ e homologação",parser:"opendelivery"},
 {id:"99food",name:"99Food",doc:"https://developer-food.99app.com/",access:"Aplicação e certificação",parser:"opendelivery"},
 {id:"aiqfome",name:"aiqfome / Magalu Delivery",doc:"https://developer.aiqfome.com/docs/api/v2",access:"API V2, autorização da loja",parser:"aiqfome"},
 {id:"rappi",name:"Rappi",doc:"https://dev-portal.rappi.com/pt/",access:"Credencial de parceiro",parser:"generic"},
 {id:"deliverymuch",name:"Delivery Much",doc:"https://developer.deliverymuch.com.br/",access:"OAuth e homologação",parser:"generic"},
 {id:"goomer",name:"Goomer",doc:"https://partner-api.goomer.app/opendelivery/docs.html",access:"OAuth Open Delivery e parceria",parser:"opendelivery"},
 {id:"deliverydireto",name:"Delivery Direto",doc:"https://developers.deliverydireto.com.br/open-delivery-api/docs/",access:"Client ID e Secret autorizados",parser:"opendelivery"},
 {id:"cardapioai",name:"Cardapio.ai",doc:"https://cardapio.ai/integracao/",access:"Webhook no painel da loja; API com chave",parser:"cardapioai"},
 {id:"olaclick",name:"OlaClick",doc:"https://developers.olaclick.app/pt-BR/docs/",access:"API Key da loja e webhook",parser:"olaclick"},
 {id:"beefood",name:"BeeFood",doc:"https://docs.beefood.app/",access:"Credencial de parceiro e sandbox",parser:"generic"},
 {id:"keeta",name:"Keeta",doc:"https://api-docs.mykeeta.com/apis/opendelivery/section/general-info",access:"Acesso e homologação de integrador",parser:"opendelivery"}
]);
const channelIds=new Set(CHANNELS.map(x=>x.id));
const safeText=(v,n=250)=>String(v==null?"":v).replace(/[\u0000-\u001f]/g," ").trim().slice(0,n);
const amount=v=>{
 if(v===null||v===undefined||v==="")return null;
 const x=Number(typeof v==="string"&&v.includes(",")?v.replace(/\./g,"").replace(",","."):v);
 return Number.isFinite(x)&&x>=0&&x<=9999999?Math.round(x*100)/100:null;
};
const positive=v=>{const n=Number(v);return Number.isInteger(n)&&n>0&&n<=1000?n:null};
const obj=x=>x&&typeof x==="object"&&!Array.isArray(x)?x:{};
const list=x=>Array.isArray(x)?x:[];
const first=(...items)=>items.find(x=>x!==undefined&&x!==null&&String(x)!=="");
const normalizeName=v=>safeText(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const parseList=(rows)=>list(rows).slice(0,100).map(x=>{
 const o=obj(x),t=obj(o.product||o.item||o.variant||o.menuItem),price=amount(first(o.unitPrice,o.unit_price,o.price,o.value,o.valor)),
 qty=positive(first(o.quantity,o.qty,o.quantidade,o.count,1));
 const name=safeText(first(o.name,o.nome,o.productName,o.title,t.name,t.nome,t.title),140);
 if(!name||!qty)return null;
 return {externalItemId:safeText(first(o.id,o.productId,o.sku,t.id),100),
  name,qty,unitPrice:price,notes:safeText(first(o.notes,o.observation,o.observacao),350),
  modifiers:list(first(o.adicionais,o.modifiers,o.options)).slice(0,40).map(y=>({name:safeText(first(y.name,y.nome),100),qty:positive(first(y.quantity,y.qty,1))||1,price:amount(first(y.price,y.valor))})).filter(y=>y.name)};
}).filter(Boolean);
function unwrap(channelId,payload){
 const p=obj(payload);
 if(channelId==="olaclick")return obj(p.data?.order||p.data?.data||p.data||p.order||p);
 if(channelId==="aiqfome")return obj(p.data?.order||p.data||p.order||p);
 if(channelId==="cardapioai")return obj(p.data?.order||p.data||p.order||p);
 return obj(p.order||p.data?.order||p.data||p);
}
function orderId(channelId,raw,source){
 const id=first(raw.id,raw.orderId,raw.order_id,raw.numeroPedido,raw.orderNumber,raw.reference,source.event_id);
 return safeText(id,140);
}
function statusOf(raw){
 const s=String(first(raw.status,raw.orderStatus,raw.order_status,"NEW")).toUpperCase();
 if(raw.is_cancelled===true||["CANCELLED","CANCELED","CANCELADO","DELETED"].includes(s))return "cancelled";
 if(raw.is_delivered===true||["DELIVERED","ENTREGUE","FINISHED","FINALIZED"].includes(s))return "delivered";
 if(["PREPARING","IN_PROGRESS","PROCESSING","EM_PRODUCAO"].includes(s))return "preparing";
 return "received";
}
/** Convert one object from published/provider export format into safe internal draft. */
export function normalizeOrder(channelId,payload,{storeAlias=""}={}){
 if(!channelIds.has(channelId))throw Error("Canal não reconhecido.");
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Pedido precisa ser um objeto JSON.");
 const source=obj(payload),r=unwrap(channelId,source);
 const id=orderId(channelId,r,source);
 if(!id)throw Error("Pedido sem identificador externo. Informe ID/número do pedido na origem.");
 const ownStore=safeText(first(r.merchantId,r.merchant_id,r.store_id,r.storeId,r.company_id,
  source.merchant_id,source.store_id,storeAlias),100);
 if(!ownStore)throw Error("Informe a identificação da loja no Hub para evitar pedidos de outras lojas.");
 const customer=obj(first(r.customer,r.client,r.user,r.consumidor)),address=obj(first(r.address,r.deliveryAddress,r.delivery?.address,customer.address));
 const items=parseList(first(r.produtos,r.items,r.orderItems,r.products,r.order_items,r.bag?.items,r.bag?.products));
 if(!items.length)throw Error("Pedido sem itens válidos: consulte o JSON completo da plataforma.");
 const externalFee=amount(first(r.deliveryFee,r.delivery_fee,r.delivery_price,r.taxaEntrega,r.frete,r.delivery?.fee));
 const orderTotal=amount(first(r.valorCompra,r.total,r.totalAmount,r.totalPrice,r.total_amount,r.amount?.total,r.amount?.value,r.pricing?.total));
 const itemTotal=items.reduce((s,it)=>s+(it.unitPrice??0)*it.qty,0);
 const total=orderTotal??Math.round((itemTotal+(externalFee||0))*100)/100;
 const format=safeText(first(r.orderType,r.service_type,r.tipoPedido,r.orderTiming,r.type,"delivery"),60);
 return {
  key:channelId+"/"+encodeURIComponent(ownStore)+"/"+encodeURIComponent(id),provider:channelId,storeId:ownStore,externalId:id,
  status:String(source.event_type||"").toUpperCase()==="ORDER_DELETED"?"cancelled":statusOf(r),originStatus:safeText(first(r.status,r.orderStatus,r.order_status),50),
  name:safeText(first(r.nomeCliente,r.clientName,customer.name,customer.full_name,customer.nome),120)||"Cliente externo",
  phone:safeText(first(r.telefoneCliente,r.clientPhone,customer.phone,customer.phone_number),35),
  address:safeText(first(r.endereco,typeof r.address==="string"?r.address:null,r.delivery?.address?.formatted_address,
   address.fullAddress,address.address,address.street),380),
  kind:/PICK|RETIR|TAKEAWAY/i.test(format)?"pickup":"delivery",
  payment:safeText(first(r.metodoPagamento,r.tipoPagamento,r.payment?.method,r.payment_method?.name,r.payment_method),90),
  paid:safeText(first(r.payment_status,r.paymentStatus,r.tipoPagamento),65),
  note:safeText(first(r.order_observations,r.observations,r.notes,r.note,r.observacao,r.comment),600),
  total,deliveryFee:externalFee||0,items,
  createdAt:safeText(first(r.created_at,r.createdAt,r.timestamp,source.timestamp,new Date().toISOString()),65),
  source:"manual-json",approved:false,importedAt:new Date().toISOString(),
  localLinks:{},commission:null,lockReason:"Inspecione os itens e confirme antes de registrar uma venda."
 };
}
/** Array, API response, event envelope or single order; maximum 50 per upload. */
export function parseImport(channelId,source,options={}){
 if(!channelIds.has(channelId))throw Error("Selecione um canal reconhecido.");
 const raw=typeof source==="string"?JSON.parse(source):source;
 const values=Array.isArray(raw)?raw:Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.orders)?raw.orders:[raw];
 if(values.length>50)throw Error("Limite de 50 pedidos por lote; divida o arquivo.");
 const rows=[],errors=[],keys=new Set();
 for(const [index,r] of values.entries()){
  try{
   const normalized=normalizeOrder(channelId,r,options);
   if(keys.has(normalized.key))continue;
   keys.add(normalized.key);rows.push(normalized);
  }catch(e){errors.push("Linha "+(index+1)+": "+String(e.message).slice(0,160))}
 }
 return {rows,errors};
}
export function deduplicate(existing=[],incoming=[]){
 const known=new Set(existing.map(r=>r.key)),unique=[],duplicates=[];
 for(const row of incoming){
  if(known.has(row.key)){duplicates.push(row.key);continue}
  known.add(row.key);unique.push(row);
 }
 return {unique,duplicates};
}
/** Mapping is a suggestion only; never auto-approve, even for exact names. */
export function suggestRecipes(externalItem,recipes=[]){
 const query=normalizeName(externalItem?.name);
 return recipes.map(r=>({id:r.id,name:r.name,score:normalizeName(r.name)===query?100:
  normalizeName(r.name).includes(query)&&query.length>=4?65:query.includes(normalizeName(r.name))&&normalizeName(r.name).length>=4?55:0}))
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
}
export function validChannel(id){return channelIds.has(id)}
export function emptyHub(){return {version:1,storeAliases:{},orders:[],createdAt:new Date().toISOString()}}
export function ensureHub(state){
 const data=state?.data||state;
 if(!data.deliveryHub||!Array.isArray(data.deliveryHub.orders))
  data.deliveryHub=emptyHub();
 return data.deliveryHub;
}
export function stageOrders(hub,rows,{free=false}={}){
 if(!hub||!Array.isArray(hub.orders))throw Error("Hub inválido");
 const {unique,duplicates}=deduplicate(hub.orders,rows);
 if(free&&hub.orders.length+unique.length>1)throw Error("FREE: somente um pedido externo de demonstração por conta.");
 if(hub.orders.length+unique.length>150)throw Error("Limite de 150 pedidos na fila. Arquive ou exporte antes de importar mais.");
 hub.orders.push(...unique);
 return {imported:unique.length,duplicates:duplicates.length};
}
export function markLinked(hub,key,index,local){
 const row=hub.orders.find(x=>x.key===key);
 if(!row||!row.items[index])throw Error("Pedido externo não encontrado");
 if(row.localLinks[String(index)])throw Error("Item externo já registrado no sistema.");
 row.localLinks[String(index)]={...local,at:new Date().toISOString()};
 row.approved=Object.keys(row.localLinks).length===row.items.length;
 return row;
}
export const EXAMPLE={
 cardapioai:{nomeCliente:"CLIENTE DE EXEMPLO",telefoneCliente:"",endereco:"Rua Exemplo, 10",tipoPedido:"Pedido Delivery",
 numeroPedido:"DEMO-101",valorCompra:34.9,produtos:[{nome:"(pdv: 789) | Pastel de Carne",quantidade:1,valor:29.9,adicionais:[{nome:"Queijo",quantidade:1,valor:5}]}]},
 olaclick:{event_type:"ORDER_CREATED",event_id:"demo-event-8",merchant_id:"demo-store",
 data:{id:"DEMO-102",client:{name:"CLIENTE DE EXEMPLO"},status:"PENDING",service_type:"DELIVERY",
 total:42,delivery_price:7,items:[{id:"demo-item",name:"Pizza Calabresa",quantity:1,price:35}]}},
 opendelivery:{id:"DEMO-103",merchantId:"demo-store",status:"CREATED",total:55,
 items:[{id:"item-1",name:"Batata recheada",quantity:1,unitPrice:55}]}
};
