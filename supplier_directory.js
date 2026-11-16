/* Agenda de fornecedores pessoais. A pesquisa por GPS e os locais descobertos ficam separados. */
(function(){
"use strict";
if(window.POTE_SUPPLIER_CONTACTS || typeof pageSuppliers!=="function")return;
const previousPage=pageSuppliers;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=v=>{const s=String(v??"").trim().replace(/R\$\s*/gi,"").replace(/\s/g,"");const x=Number(s.includes(",")?s.replace(/\./g,"").replace(",","."):s);return Number.isFinite(x)?x:NaN};
const money=v=>(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmt=v=>(Number(v)||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
const isRegional=s=>!!(s?.osmId||s?.externalId||s?.supplierType==="regional"||(s?.type==="Local"&&Number.isFinite(Number(s?.lat))&&Number.isFinite(Number(s?.lon))));
const people=()=>Array.isArray(state?.data?.suppliers)?state.data.suppliers.filter(s=>!isRegional(s)):[];
const regional=()=>Array.isArray(state?.data?.suppliers)?state.data.suppliers.filter(isRegional):[];
const get=id=>people().find(s=>String(s.id)===String(id));
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g," ");
const units={"g":["kg",0.001],"kg":["kg",1],"ml":["L",0.001],"L":["L",1],"un":["un",1],"caixa":["caixa",1],"pacote":["pacote",1],"fardo":["fardo",1]};
const pricePer=x=>{const q=Number(x.quantity),p=Number(x.price),conversion=units[x.unit];return conversion&&q>0&&p>0?{unit:conversion[0],rate:p/(q*conversion[1])}:null};
const key=x=>norm(x.name)+"|"+(pricePer(x)?.unit||x.unit);
const allOffers=()=>people().flatMap(s=>(s.products||[]).filter(x=>pricePer(x)).map(x=>({contact:s,product:x,unitRate:pricePer(x).rate,normalizedUnit:pricePer(x).unit,key:key(x)})));
const bestOffers=()=>{const result=new Map();for(const x of allOffers()){const current=result.get(x.key);if(!current||x.unitRate<current.unitRate)result.set(x.key,x)}return result};
function contactNumber(phone){
 let digits=String(phone||"").replace(/\D/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 if(digits.length===10||digits.length===11)digits="55"+digits;
 return /^55\d{10,11}$/.test(digits)?digits:"";
}
function waLink(contact,product){
 const number=contactNumber(contact?.phone);
 if(!number)return "";
 const msg=product?"Olá, "+contact.name+"! Poderia confirmar o preço e a disponibilidade de "+product.name+"?":
  "Olá, "+contact.name+"! Gostaria de conversar sobre fornecimento para o meu negócio.";
 return "https://wa.me/"+number+"?text="+encodeURIComponent(msg);
}
function field(id,label,value="",type="text"){
 return '<label><span>'+esc(label)+'</span><input id="'+esc(id)+'" type="'+type+'" value="'+esc(value)+'"></label>';
}
function supplierDetails(s){
 const id=String(s.id),items=Array.isArray(s.products)?s.products:[];
 const best=bestOffers();
 const msg=waLink(s);
 const rows=items.map(p=>{
  const price=pricePer(p),cheapest=price&&best.get(key(p))?.contact.id===s.id&&best.get(key(p))?.product.id===p.id;
  const request=waLink(s,p);
  const buttons='<button type="button" class="btn mini line" data-sid="'+esc(id)+'" data-pid="'+esc(p.id)+'" onclick="POTE_SUPPLIER_CONTACTS.updatePrice(this.dataset.sid,this.dataset.pid)">Atualizar preço</button>'+
   '<button type="button" class="btn mini danger" data-sid="'+esc(id)+'" data-pid="'+esc(p.id)+'" onclick="POTE_SUPPLIER_CONTACTS.removeProduct(this.dataset.sid,this.dataset.pid)">Remover</button>';
  return '<div class="pote-personal-product"><div><strong>'+esc(p.name)+'</strong> '+(cheapest?'<span class="pote-best-price">Melhor preço</span>':"")+
   '<small>'+esc(fmt(p.quantity))+' '+esc(p.unit)+' por '+money(p.price)+(price?' · '+money(price.rate)+' / '+esc(price.unit):"")+
   (p.updatedAt?' · atualizado '+esc(String(p.updatedAt).slice(0,10).split("-").reverse().join("/")):"")+'</small></div>'+
   '<div class="pote-personal-actions">'+(request?'<a class="btn mini" target="_blank" rel="noopener noreferrer" href="'+esc(request)+'">Pedir pelo WhatsApp</a>':"")+buttons+'</div></div>';
 }).join("");
 return '<article class="pote-personal-card"><div class="pote-personal-heading"><div><strong>'+esc(s.name)+'</strong>'+
  (s.preferred?'<span class="pote-preferred">Favorito</span>':"")+
  '<small>'+esc(s.phone||"Telefone não cadastrado")+(s.city?' · '+esc(s.city):"")+'</small>'+
  (s.deliveryTerms?'<small>Entrega: '+esc(s.deliveryTerms)+'</small>':"")+
  (s.notes?'<small>Observações: '+esc(s.notes)+'</small>':"")+'</div>'+
  (msg?'<a class="btn mini" target="_blank" rel="noopener noreferrer" href="'+esc(msg)+'">WhatsApp</a>':
   '<span class="pote-contact-warning">Cadastre telefone com DDD para usar WhatsApp</span>')+'</div>'+
  '<div class="pote-personal-products"><h4>O que fornece e quanto cobra</h4>'+
  (rows||'<p class="muted">Cadastre o primeiro produto e seu preço negociado.</p>')+'</div>'+
  '<div class="pote-personal-form">'+
   field("poteSupProdName-"+id,"Produto ou insumo")+
   field("poteSupProdQty-"+id,"Quantidade do lote",1,"number")+
   '<label><span>Unidade</span><select id="poteSupProdUnit-'+esc(id)+'">'+
   ["kg","g","L","ml","un","caixa","pacote","fardo"].map(u=>'<option value="'+u+'">'+u+'</option>').join("")+'</select></label>'+
   field("poteSupProdPrice-"+id,"Preço total do lote (R$)","","text")+
   '<button type="button" class="btn" data-sid="'+esc(id)+'" onclick="POTE_SUPPLIER_CONTACTS.addProduct(this.dataset.sid)">+ Registrar produto</button></div>'+
  '<details class="pote-supplier-edit"><summary>Editar contato e condições</summary><div class="pote-personal-form">'+
  field("poteSupName-"+id,"Nome / apelido",s.name)+field("poteSupPhone-"+id,"WhatsApp com DDD",s.phone||"")+
  field("poteSupCity-"+id,"Cidade / região",s.city||"")+
  field("poteSupDelivery-"+id,"Entrega / pedido mínimo",s.deliveryTerms||"")+
  field("poteSupNotes-"+id,"Anotações",s.notes||"")+
  '<button type="button" class="btn mini" data-sid="'+esc(id)+'" onclick="POTE_SUPPLIER_CONTACTS.saveContact(this.dataset.sid)">Salvar alterações</button>'+
  '<button type="button" class="btn mini line" data-sid="'+esc(id)+'" onclick="POTE_SUPPLIER_CONTACTS.toggleFavorite(this.dataset.sid)">'+
   (s.preferred?"Retirar favorito":"Marcar favorito")+'</button>'+
  '<button type="button" class="btn mini danger" data-sid="'+esc(id)+'" onclick="POTE_SUPPLIER_CONTACTS.removeContact(this.dataset.sid)">Excluir contato</button></div></details></article>';
}
function renderPersonal(){
 const all=people().sort((a,b)=>Number(!!b.preferred)-Number(!!a.preferred)||String(a.name).localeCompare(String(b.name),"pt-BR"));
 const offers=allOffers(),best=bestOffers();
 const comparison=[...best.values()].sort((a,b)=>a.product.name.localeCompare(b.product.name,"pt-BR")).slice(0,30);
 return '<section class="box pote-personal-directory"><div class="pote-personal-intro"><small>AGENDA COMERCIAL PRIVADA</small><h2>Meus Fornecedores</h2>'+
  '<p>Pessoas com quem você negocia diretamente: produtores, distribuidores autônomos, entregadores e contatos de confiança. Não é a busca por supermercados.</p></div>'+
  '<div class="pote-personal-stats"><strong>'+all.length+' contatos</strong><strong>'+offers.length+' preços cadastrados</strong></div>'+
  '<h3>Novo contato direto</h3><div class="pote-personal-form">'+
  field("poteSupNewName","Nome ou apelido")+
  field("poteSupNewPhone","WhatsApp (DDD + número)")+
  field("poteSupNewCity","Cidade / região")+
  field("poteSupNewDelivery","Prazo de entrega, frete e pedido mínimo")+
  field("poteSupNewNotes","Observações de negociação")+
  '<button type="button" class="btn" onclick="POTE_SUPPLIER_CONTACTS.addContact()">+ Salvar fornecedor</button></div>'+
  '<h3>Meus contatos</h3>'+(all.length?all.map(supplierDetails).join(""):'<p class="muted">Nenhum fornecedor pessoal cadastrado.</p>')+
  '<h3>Menor preço por produto</h3>'+
  '<p class="muted">Compara apenas o mesmo produto em unidades equivalentes (g/kg, ml/L ou a mesma unidade). Preços são informados manualmente, não cotações em tempo real. Confira frete e qualidade antes de comprar.</p>'+
  (comparison.length?'<div class="pote-price-comparison">'+comparison.map(x=>'<div><span>'+esc(x.product.name)+' <small>('+esc(x.normalizedUnit)+')</small></span>'+
   '<strong>'+money(x.unitRate)+'/'+esc(x.normalizedUnit)+'</strong><small>'+esc(x.contact.name)+'</small></div>').join("")+'</div>':
   '<p class="muted">Cadastre preços em pelo menos um fornecedor para começar a comparar.</p>')+
  '</section>';
}
function renderRegional(){
 const saved=regional();
 return '<div class="box pote-supplier-regional"><h3>Estabelecimentos encontrados na região</h3>'+
  '<p class="muted">Resultados da pesquisa geográfica ficam aqui, separados dos seus contatos comerciais pessoais.</p>'+
  (saved.length?saved.map(s=>'<div class="pote-regional-row"><div><strong>'+esc(s.name)+'</strong>'+
    '<small>'+esc(s.city||s.address||"Sem endereço")+'</small></div>'+
    '<button type="button" class="btn mini danger" data-sid="'+esc(s.id)+'" onclick="POTE_SUPPLIER_CONTACTS.removeRegional(this.dataset.sid)">Excluir</button></div>').join(""):
    '<p class="muted">Nenhum local salvo da pesquisa por GPS.</p>')+'</div>';
}
pageSuppliers=function(){
 const html=previousPage();
 const split=html.indexOf("<h3>Adicionar manualmente</h3>");
 let gps=split>=0?html.slice(0,split)+"</div>":html;
 gps=gps.replace("<h2>Fornecedores</h2>","<h2>Pesquisar Fornecedor</h2>");
 gps=gps.replace('<div class="box"><h2>Pesquisar Fornecedor</h2>','<div class="box" id="poteSupplierSearchSection"><h2>Pesquisar Fornecedor</h2>');
 gps=gps.replace(/O cadastro manual de 1 fornecedor permanece liberado\./,"Os contatos pessoais são cadastrados acima.");
 gps=gps.replace(/FREE permite 1 fornecedor manual\./,"A agenda de contatos pessoais fica na seção acima.");
 return renderPersonal()+gps+renderRegional();
};
function changed(){if(typeof persist==="function")persist();if(typeof render==="function")render();}
function addContact(){
 if(typeof pro==="function"&&!pro()&&people().length>=1){toast("Plano Free: limite de 1 fornecedor pessoal.");return false;}
 const name=String($("poteSupNewName")?.value||"").trim();
 if(!name){toast("Informe o nome do fornecedor.");return false;}
 const phone=String($("poteSupNewPhone")?.value||"").trim();
 if(phone&&!contactNumber(phone)){toast("WhatsApp inválido. Informe DDD + número.");return false;}
 if(!Array.isArray(state.data.suppliers))state.data.suppliers=[];
 state.data.suppliers.push({id:uid(),supplierType:"personal",name,phone,city:String($("poteSupNewCity")?.value||"").trim(),
  deliveryTerms:String($("poteSupNewDelivery")?.value||"").trim(),notes:String($("poteSupNewNotes")?.value||"").trim(),
  category:"Contato direto",products:[],preferred:false,createdAt:new Date().toISOString()});
 changed();toast("Contato do fornecedor salvo.");return true;
}
function saveContact(id){
 const s=get(id);if(!s)return false;
 const name=String($("poteSupName-"+id)?.value||"").trim(),phone=String($("poteSupPhone-"+id)?.value||"").trim();
 if(!name){toast("O nome não pode ficar vazio.");return false;}
 if(phone&&!contactNumber(phone)){toast("WhatsApp inválido. Informe DDD + número.");return false;}
 Object.assign(s,{name,phone,city:String($("poteSupCity-"+id)?.value||"").trim(),
  deliveryTerms:String($("poteSupDelivery-"+id)?.value||"").trim(),notes:String($("poteSupNotes-"+id)?.value||"").trim()});
 changed();toast("Fornecedor atualizado.");return true;
}
function addProduct(id){
 const s=get(id);if(!s)return false;
 const name=String($("poteSupProdName-"+id)?.value||"").trim().slice(0,120);
 const quantity=n($("poteSupProdQty-"+id)?.value),price=n($("poteSupProdPrice-"+id)?.value);
 const unit=String($("poteSupProdUnit-"+id)?.value||"");
 if(!name||!units[unit]||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<=0){
  toast("Informe produto, quantidade, unidade e preço total maior que zero.");return false;
 }
 s.products??=[];
 const existing=s.products.find(p=>norm(p.name)===norm(name)&&p.unit===unit);
 const at=new Date().toISOString();
 if(existing){
  (existing.priceHistory??=[]).push({quantity:existing.quantity,price:existing.price,at:existing.updatedAt||at});
  existing.quantity=quantity;existing.price=price;existing.updatedAt=at;
 }else s.products.push({id:uid(),name,quantity,unit,price,updatedAt:at,priceHistory:[]});
 changed();toast(existing?"Preço atualizado e histórico preservado.":"Produto e preço cadastrados.");return true;
}
function updatePrice(sid,pid){
 const s=get(sid),p=s?.products?.find(p=>String(p.id)===String(pid));if(!p)return false;
 const q=window.prompt("Nova quantidade do lote em "+p.unit+":",String(p.quantity));
 if(q===null)return false;
 const price=window.prompt("Novo preço total em R$:",String(p.price));
 if(price===null)return false;
 const quantity=n(q),total=n(price);
 if(!(quantity>0&&total>0)){toast("Quantidade e preço devem ser maiores que zero.");return false;}
 (p.priceHistory??=[]).push({quantity:p.quantity,price:p.price,at:p.updatedAt||new Date().toISOString()});
 p.quantity=quantity;p.price=total;p.updatedAt=new Date().toISOString();
 changed();toast("Preço atualizado. Valor anterior guardado no histórico.");return true;
}
function removeProduct(sid,pid){
 const s=get(sid);if(!s?.products)return false;
 if(!window.confirm("Remover este produto da lista do fornecedor?"))return false;
 s.products=s.products.filter(p=>String(p.id)!==String(pid));changed();return true;
}
function toggleFavorite(id){const s=get(id);if(!s)return false;s.preferred=!s.preferred;changed();return true;}
function removeContact(id){
 const s=get(id);if(!s||!window.confirm("Excluir o contato e sua lista de preços?"))return false;
 state.data.suppliers=state.data.suppliers.filter(x=>String(x.id)!==String(id));changed();return true;
}
function removeRegional(id){
 const s=regional().find(s=>String(s.id)===String(id));if(!s||!window.confirm("Excluir este estabelecimento da pesquisa?"))return false;
 state.data.suppliers=state.data.suppliers.filter(x=>String(x.id)!==String(id));changed();return true;
}
window.POTE_SUPPLIER_CONTACTS={renderPersonal,renderRegional,addContact,saveContact,addProduct,updatePrice,removeProduct,toggleFavorite,removeContact,removeRegional,contactNumber,waLink,pricePer,allOffers,bestOffers,people,regional};
})();