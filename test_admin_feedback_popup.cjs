"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("admin_console.js","utf8");
const css=fs.readFileSync("admin_console.css","utf8");
assert(source.includes('id="poteAdmActionPopup"'));
assert(source.includes('role="alertdialog"'));
assert(source.includes('aria-modal="true"'));
assert(css.includes("#poteAdmActionPopup{position:fixed;inset:0"));
assert(css.includes("#poteAdmActionPopup[hidden]{display:none!important}"));
const begin=source.indexOf("let popupReturnFocus=null;");
const end=source.indexOf("async function assertAdmin(){",begin);
assert(begin>0&&end>begin,"O controle de feedback deve existir");
const resultSource=source.slice(begin,end);
const nodes=new Map();
const parent={id:"poteAdmActionPopup",hidden:true,
 querySelector(selector){assert.equal(selector,".pote-adm-action-card");return nodes.get("card")}
};
nodes.set("poteAdmActionPopup",parent);
nodes.set("card",{dataset:{}});
for(const id of ["poteAdmActionMessage","poteAdmActionTitle","poteAdmActionIcon","poteAdmFeedback","poteAdmActionDismiss"]){
 nodes.set(id,{textContent:"",classList:{toggle(name,value){this[name]=value}},
  focused:false,focus(){this.focused=true}});
}
let restored=false;
const focusBefore={isConnected:true,focus(){restored=true}};
const ctx={
 overlay:{hidden:false},
 document:{activeElement:focusBefore,getElementById:id=>nodes.get(id)},
 $:id=>nodes.get(id),
};
vm.createContext(ctx);
vm.runInContext(resultSource+";this.popupFunctions={status,hideActionPopup,showActionPopup}",ctx);
const {status,hideActionPopup}=ctx.popupFunctions;
status("Consultando cadastros...");
assert.equal(parent.hidden,true,"Mensagens de progresso não devem interromper a tela");
status("Nome e proteção da conta atualizados. Histórico de moderação registrado.",false,true);
assert.equal(parent.hidden,false,"Confirmação deve abrir popup");
assert.equal(nodes.get("card").dataset.state,"success");
assert.equal(nodes.get("poteAdmActionTitle").textContent,"Operação concluída");
assert.equal(nodes.get("poteAdmActionDismiss").focused,true);
assert.match(nodes.get("poteAdmActionMessage").textContent,/Nome e proteção/);
hideActionPopup();
assert.equal(parent.hidden,true);
assert.equal(restored,true,"O foco deve retornar ao botão original");
status("Moderação não concluída: permissão negada.",true,true);
assert.equal(parent.hidden,false);
assert.equal(nodes.get("card").dataset.state,"error");
assert.equal(nodes.get("poteAdmActionTitle").textContent,"Não foi possível concluir");
assert.match(nodes.get("poteAdmActionMessage").textContent,/permissão negada/);
ctx.overlay.hidden=true;
hideActionPopup(false);
status("Qualquer atualização",false,true);
assert.equal(parent.hidden,true,"Não exibir popup após fechamento do painel");
for(const fragment of [
 'status("Nome e proteção da conta atualizados. Histórico de moderação registrado.",false,true)',
 'status("Licença atualizada e registrada no histórico.",false,true)',
 'status(enable?"Franquia ativada.',
 'hideActionPopup(false);',
 'poteAdmActionDismiss'
])assert(source.includes(fragment),"Confirmação visível ausente: "+fragment);
console.log("PASS: popup administrativo central, erros, sucesso, foco, progresso, fechamento e histórico textual");
