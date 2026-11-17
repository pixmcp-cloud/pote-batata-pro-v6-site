/* Painel de homologação MaisDelivery: somente ADM, sandbox e envio explícito.
   Não incorpora credenciais ao código ou ao banco do Potê Batata Pro. */
import {prepareMaisDelivery} from "./maisdelivery_payload.mjs";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const onlyAdmin=()=>window.POTE_AUTH?.role==="admin";
const storedProxy=()=>{try{return sessionStorage.getItem("pote-md-proxy")||""}catch{return ""}};
export function renderMaisDelivery(){
 if(!onlyAdmin())return "";
 return '<section id="mdSandboxPanel" class="hub-box md-sandbox" aria-label="Integração MaisDelivery Sandbox">'+
 '<h3>MaisDelivery · Em teste</h3>'+
 '<p class="hub-hint">Sandbox, ainda sem conexão ativa. Operações 9 (produto) e 10 (ativar/desativar). Não altera estoque, pedidos ou financeiro do Potê Batata Pro.</p>'+
 '<div class="hub-inputs">'+
 '<label>URL do adaptador PHP (HTTPS)<input id="mdProxy" type="url" placeholder="https://seu-site.com/api/maisdelivery_proxy.php" autocomplete="off" value="'+esc(storedProxy())+'"></label>'+
 '<label>ID empresa<input id="mdEmpresa" type="number" min="1" value="563"></label>'+
 '<label>Restaurante teste<input id="mdRestaurante" type="number" min="1" value="50451"></label>'+
 '<label>Basic Auth do painel<input id="mdBasic" type="password" autocomplete="off" placeholder="Basic Auth (somente nesta tela)"></label>'+
 '<label>Accesstoken de teste<input id="mdToken" type="password" autocomplete="off" placeholder="Token sandbox (não use produção)"></label></div>'+
 '<p class="hub-hint">Não cole token de produção. As credenciais digitadas não são gravadas no GitHub, no Firestore nem no armazenamento do navegador.</p>'+
 '<fieldset class="md-panel"><legend>Operação 9 · Cadastrar produtos de teste</legend>'+
 '<div class="hub-inputs">'+
 '<label>Nome<input id="mdNome" maxlength="160" value="Batata recheada de teste"></label>'+
 '<label>Categoria<input id="mdCategoria" maxlength="120" value="Sandbox"></label>'+
 '<label>Preço em R$<input id="mdPreco" inputmode="decimal" value="29,90"></label>'+
 '<label>Estoque anunciado<input id="mdEstoque" type="number" min="0" value="10"></label>'+
 '<label>Descrição<input id="mdDescricao" maxlength="1000" value="Cadastro de homologação Potê Batata Pro"></label></div>'+
 '<button type="button" class="btn mini" onclick="POTE_DELIVERY_HUB.maisDeliverySend(9)">Enviar produto de teste</button></fieldset>'+
 '<fieldset class="md-panel"><legend>Operação 10 · Ativação no cardápio de teste</legend>'+
 '<div class="hub-inputs">'+
 '<label>ID Cardápio<input id="mdCardapio" type="number" min="1" placeholder="ID retornado pelo MaisDelivery"></label>'+
 '<label>Estado<select id="mdAtivo"><option value="1">Ativar</option><option value="0">Desativar</option></select></label></div>'+
 '<button type="button" class="btn mini line" onclick="POTE_DELIVERY_HUB.maisDeliverySend(10)">Enviar alteração de teste</button></fieldset>'+
 '<pre id="mdResultado" class="md-result" role="status" aria-live="polite">Nenhuma operação enviada.</pre></section>';
}
export async function sendMaisDelivery(operation){
 const output=$("mdResultado");
 if(!onlyAdmin()){if(output)output.textContent="Disponível apenas para administração.";return false}
 const proxy=$("mdProxy")?.value.trim()||"";
 const basic=$("mdBasic")?.value.trim()||"";
 const token=$("mdToken")?.value.trim()||"";
 if(!output)return false;
 try{
  const url=new URL(proxy);
  if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw Error("Use URL HTTPS do seu adaptador PHP.");
  if(!basic||!token)throw Error("Preencha a Basic Auth e o token de TESTE.");
  const data={empresa:$("mdEmpresa")?.value,restaurante:$("mdRestaurante")?.value,
   produtos:operation===9?[{dsNome:$("mdNome")?.value,dsCategoria:$("mdCategoria")?.value,
    dsDescricao:$("mdDescricao")?.value,vlItem:$("mdPreco")?.value,
    qtEstoque:$("mdEstoque")?.value,flgAtivo:"1"}]:
   [{idCardapio:$("mdCardapio")?.value,flgAtivo:$("mdAtivo")?.value}]};
  const request=prepareMaisDelivery(operation,data);
  if(!confirm("Enviar operação "+operation+" somente ao sandbox MaisDelivery? Nenhum pedido ou estoque local será alterado."))return false;
  try{sessionStorage.setItem("pote-md-proxy",url.toString())}catch{/* armazenamento de sessão bloqueado: continuar sem salvar */}
  output.textContent="Consultando ambiente de testes...";
  const response=await fetch(url.toString(),{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({request,basicAuth:basic,accessToken:token}),cache:"no-store",signal:AbortSignal.timeout(25000)});
  const raw=await response.text();
  let result;
  try{result=JSON.parse(raw)}catch{result={message:raw.slice(0,1000)}}
  output.textContent=JSON.stringify({status:response.status,resultado:result},null,2);
  return response.ok;
 }catch(error){
  output.textContent="Não foi possível concluir: "+String(error?.message||error).slice(0,450);
  return false;
 }
}
