const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("floating_menu.js","utf8");
const nodes=new Map(),events=new Map(),windowEvents=new Map();
function element(id){
 if(nodes.has(id))return nodes.get(id);
 const el={
  id,hidden:true,inert:false,value:"",textContent:"",innerHTML:"",dataset:{},disabled:false,
  classList:{toggle(){}},setAttribute(){},focus(){},addEventListener(type,cb){
   const key=id+":"+type;events.set(key,cb);
  },appendChild(){},querySelectorAll(){return[]}
 };
 nodes.set(id,el);return el;
}
const window={
 POTE_AUTH:{uid:"canary",email:"canary@example.com",role:"free"},
 POTE_ACCOUNT_PROFILE:{uid:"canary",displayName:"Canário Certo",photoURL:"https://img.example/canary.png"},
 POTE_APP_READY:true,POTE_LICENSE_STATUS:{state:"free"},
 addEventListener:(type,cb)=>{const list=windowEvents.get(type)||[];list.push(cb);windowEvents.set(type,list)},
 dispatchEvent:e=>{for(const cb of windowEvents.get(e.type)||[])cb(e)}
};
const ctx={
 window,document:{
  createElement:()=>({id:"poteFloatingRoot",innerHTML:""}),
  body:{appendChild(){}},
  getElementById:element,
  querySelectorAll:()=>[],
  addEventListener(){}
 },MutationObserver:class{observe(){}},console,alert:()=>{},
 state:{data:{profile:{name:"PERFIL VAZADO",photoData:"https://img.example/wrong.png"}},tab:"home"},
 Event:class{constructor(type){this.type=type}}
};
vm.createContext(ctx);vm.runInContext(source,ctx);
let walletOpens=0;
window.POTE_IA_UNIVERSE={open(){walletOpens++;},isOpen(){return false;}};
const navEvent={preventDefault(){},stopImmediatePropagation(){}};
events.get("poteHeadLogo:click")(navEvent);
assert.equal(element("poteFloatBackdrop").hidden,false,"Foto Minha Empresa abre menu");
assert.equal(walletOpens,0,"Foto não abre IA");
events.get("poteFloatToggle:click")(navEvent);
assert.equal(element("poteFloatBackdrop").hidden,true,"Três riscos alternam o menu");
assert.match(element("poteFloatToggle").innerHTML,/M4 7h16/,"Menu fechado mantém três riscos");
events.get("poteFloatToggle:click")(navEvent);
assert.equal(element("poteFloatBackdrop").hidden,false,"Três riscos abrem menu mesmo com carteira disponível");
assert.equal(walletOpens,0);
events.get("poteFloatNavigation:click")({target:{closest(){return {dataset:{tab:"ia-wallet"}};}}});
assert.equal(walletOpens,1,"Só a opção IA COIN abre a carteira");
assert.equal(element("poteFloatBackdrop").hidden,true);
assert.equal(element("poteFloatName").textContent,"Canário Certo","A identidade vem do documento associado ao UID");
assert.match(element("poteFloatAvatar").innerHTML,/canary.png/);
assert.doesNotMatch(element("poteFloatAvatar").innerHTML,/wrong.png/);
events.get("poteFloatProfile:click")();
assert.equal(element("poteProfileName").value,"Canário Certo");
assert.equal(element("poteProfileIdentity").textContent,"Conta: canary@example.com");
window.POTE_AUTH=null;window.POTE_ACCOUNT_PROFILE=null;window.POTE_APP_READY=false;
window.dispatchEvent({type:"pote:user-logout"});
assert.equal(element("poteFloatName").textContent,"Meu perfil");
assert.doesNotMatch(element("poteFloatAvatar").innerHTML,/canary.png/);
assert.equal(element("poteProfileIdentity").textContent,"");
window.POTE_AUTH={uid:"master",email:"pixmcp@gmail.com",role:"admin"};
window.POTE_ACCOUNT_PROFILE={uid:"master",displayName:"ADM Individual",photoURL:"https://img.example/master.png"};
window.POTE_APP_READY=true;
window.dispatchEvent({type:"pote:user-ready"});
assert.equal(element("poteFloatName").textContent,"ADM Individual");
assert.match(element("poteFloatAvatar").innerHTML,/master.png/);
events.get("poteFloatProfile:click")();
assert.equal(element("poteProfileName").value,"ADM Individual");
let saved;
window.POTE_PROFILE_API={save:async v=>{saved=v;window.POTE_ACCOUNT_PROFILE={...window.POTE_ACCOUNT_PROFILE,displayName:v.name};window.dispatchEvent({type:"pote:profile-updated"});return window.POTE_ACCOUNT_PROFILE;}};
element("poteProfileName").value="Nome Personalizado";
(async()=>{
 await events.get("poteProfileForm:submit")({preventDefault(){}});
 assert.equal(saved.name,"Nome Personalizado");
 assert.equal(window.POTE_ACCOUNT_PROFILE.displayName,"Nome Personalizado");
 assert.equal(ctx.state.data.profile.name,"PERFIL VAZADO","Não escrever o nome nos dados de estoque e vendas");
 window.POTE_AUTH={uid:"canary",email:"canary@example.com",role:"free"};
 window.POTE_ACCOUNT_PROFILE={uid:"master",displayName:"ADM Individual",photoURL:"https://img.example/master.png"};
 window.dispatchEvent({type:"pote:profile-updated"});
 assert.equal(element("poteFloatName").textContent,"Meu perfil","Perfil de UID divergente não é exibido");
 assert.doesNotMatch(element("poteFloatAvatar").innerHTML,/master.png/);
 console.log("PASS: perfil visual e salvamento isolados por UID; logout limpa foto, nome e identidade");
})().catch(e=>{console.error(e);process.exitCode=1});
