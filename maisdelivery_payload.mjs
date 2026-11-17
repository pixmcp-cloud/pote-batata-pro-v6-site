/* MaisDelivery API pública V2 — construtores puros de payload. Exclusivo sandbox.
   Sem credenciais, sem rede, sem mutação de pedidos, receitas ou estoque. */
export const MD_TEST_DEFAULTS=Object.freeze({idEmpresaIntegrada:563,idOrigem:11,idRestaurante:50451,sandBox:true});
const integer=(value,label)=>{
 const number=Number(value);
 if(!Number.isInteger(number)||number<=0||number>2147483647)throw Error(label+" inválido.");
 return number;
};
const name=(value,label,max)=>{
 const text=String(value??"").trim();
 if(!text||text.length>max)throw Error(label+" é obrigatório (máximo "+max+" caracteres).");
 return text;
};
export function toMoneyBR(value){
 const raw=String(value??"").trim();
 const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw;
 const price=Number(normalized);
 if(!Number.isFinite(price)||price<=0||price>999999)throw Error("Preço inválido.");
 return price.toFixed(2).replace(".",",");
}
export function prepareMaisDelivery(operation,{empresa=563,restaurante=50451,origem=11,produtos=[]}={}){
 if(![9,10].includes(operation))throw Error("Somente operações 9 e 10 são admitidas.");
 if(!Array.isArray(produtos)||produtos.length<1||produtos.length>30)throw Error("Informe de 1 a 30 produtos.");
 const base={nrOperacao:operation,sandBox:true,idEmpresaIntegrada:integer(empresa,"Empresa"),
  idOrigem:integer(origem,"Origem"),idRestaurante:integer(restaurante,"Restaurante")};
 return {...base,produtos:produtos.map(item=>{
  if(operation===10)return {idCardapio:integer(item.idCardapio,"ID do cardápio"),flgAtivo:item.flgAtivo===true||item.flgAtivo===1||item.flgAtivo==="1"?1:0};
  const stock=Number(item.qtEstoque);
  if(!Number.isInteger(stock)||stock<0||stock>1000000)throw Error("Estoque precisa ser inteiro entre 0 e 1.000.000.");
  return {dsNome:name(item.dsNome,"Nome",160),dsCategoria:name(item.dsCategoria,"Categoria",120),
   dsDescricao:String(item.dsDescricao??"").trim().slice(0,1000),vlItem:toMoneyBR(item.vlItem),
   qtEstoque:String(stock),flgAtivo:item.flgAtivo===true||item.flgAtivo===1||item.flgAtivo==="1"?"1":"0"};
 })};
}
