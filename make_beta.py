#!/usr/bin/env python3
"""Create separate Firebase-authenticated beta from sanitized V6. Keep index.html unchanged."""
from pathlib import Path
import re
import sys

p = Path(sys.argv[1] if len(sys.argv) > 1 else "public/beta.html")
html = p.read_text(encoding="utf-8")

def once(old, new):
    global html
    if html.count(old) != 1:
        raise SystemExit(f"Expected one marker ({html.count(old)}): {old[:75]}")
    html = html.replace(old, new, 1)

once("function pro(){return false} function master(){return false}",
     "function pro(){return Boolean(window.POTE_AUTH?.role==='admin'||window.POTE_AUTH?.proActive)} function master(){return Boolean(window.POTE_AUTH?.role==='admin')}")
once("function render(){state.mode='free';document.body.classList.toggle('admin-mode',false);",
     "function render(){state.mode=master()?'adm':pro()?'pro':'free';document.body.classList.toggle('admin-mode',master());")
pattern = r"let state=original\(\);try\{const old=JSON.parse\(localStorage.getItem\(KEY\).*?\}catch\(e\)\{\}"
html, n = re.subn(pattern, "let state=original();", html, count=1, flags=re.S)
if n != 1:
    raise SystemExit("Previous localStorage guest state pattern changed; stopping")
once("function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}",
     "function persist(){if(window.POTE_AUTH?.uid)window.dispatchEvent(new Event('pote:changed'))}")
once("V6 • DEMONSTRAÇÃO FREE", "POTÊ BATATA PRO • ONLINE")
once("🔒 Demonstração gratuita: dados salvos apenas neste aparelho. Sem login Google ou permissões reais nesta versão.",
     "🔐 Beta conectado ao Firebase: dados por conta Google. Contas FREE e PRO com licença vinculada à sua conta Google.")
once("Todos os dados de teste são armazenados somente no navegador deste aparelho.",
     "Seus dados são sincronizados com sua conta Google pelo Firestore. Guarde também backups JSON.")
once("Nenhum dado enviado ao Floot. A troca FREE / PRO / ADM é um atalho exclusivo da simulação, não uma autenticação real.",
     "O login Google é real. A concessão de licenças PRO é exclusiva da administração mestre. A cobrança online não está habilitada.")
once("pote-simulacao-backup-v6.json", "pote-batata-pro-backup.json")
once("Exportar JSON de teste", "Exportar backup dos meus dados")
html, n = re.subn(r'<button class="btn danger" onclick="resetAll\(\)">[^<]*</button>', '<button class="btn danger" onclick="resetAll()">Zerar minha conta (com backup)</button>', html, count=1)
if n != 1: raise SystemExit("Botão de zerar conta não encontrado")
once("Pesquisa habilitada nesta simulação. Nenhuma chamada externa será enviada.",
     "Busca piloto de estabelecimentos reais no OpenStreetMap. Confirme os dados antes de comprar.")
once('<meta name="robots" content="noindex,nofollow,noarchive">', '<meta name="robots" content="index,follow"><meta name="description" content="Potê Batata Pro: gestão de receitas, custos, preços, pedidos e estoque.">')

head = """<style>
#poteAuthGate{position:fixed;inset:0;z-index:10000;background:#120e0b;display:flex;align-items:center;
justify-content:center;padding:18px;overflow:auto;overflow-x:hidden;color:#fff;width:100%;max-width:100vw;box-sizing:border-box}
#poteAuthGate[hidden]{display:none!important}
.pote-login-card{width:100%;max-width:460px;min-width:0;box-sizing:border-box;border:1px solid #79522f;border-radius:22px;
padding:clamp(24px,5vw,36px);background:linear-gradient(155deg,#2b2017,#16110d);
box-shadow:0 22px 80px #0009;text-align:center}
.pote-login-card h1{font-size:clamp(24px,5vw,31px);margin:10px 0;color:#f4d9a4}
.pote-login-card p{line-height:1.55;color:#d2bfaa;font-size:14px;overflow-wrap:anywhere}
#poteGoogleLogin{border:0;background:#fff;color:#282018;min-height:49px;
border-radius:12px;padding:13px 20px;font-weight:800;font-size:15px;cursor:pointer;width:100%;max-width:100%;box-sizing:border-box;margin-top:14px}
#poteGoogleLogin:disabled{opacity:.65;cursor:wait}
#poteLoginMessage{min-height:26px;font-size:13px;margin-top:14px;color:#ffd39a}
.pote-support{margin-top:18px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.pote-support a{color:#e9c18e;font-size:12px}
#poteExit{font-size:12px;border:1px solid #a87739;border-radius:8px;background:#3c291b;
color:#ffe0a6;padding:8px 10px;cursor:pointer}
#poteLoggedAs{font-size:12px;color:#ffe3b2;overflow-wrap:anywhere}
#poteSyncStatus{font-size:12px;color:#b9dabe;margin-left:auto}
@media(max-width:550px){#poteLoggedAs{font-size:10px}.pote-login-card{padding:22px}}
.pote-brand-logo{height:118px;width:118px;margin:0 auto 12px;border:2px solid #ba9359;border-radius:50%;overflow:hidden;background:#120b07;box-shadow:0 5px 18px #0007}
.pote-brand-logo img{width:100%;height:100%;display:block;object-fit:cover;transform:scale(1.48)}
#poteBrowserHint{font-size:13px;line-height:1.5;color:#ffe2aa;margin:12px 0 0}
#poteBrowserHint a{color:#f1c47c;text-decoration:underline}
</style>"""
once("</head>", head + '<link rel="icon" type="image/jpeg" href="./assets/pote-logo-original.jpg"><link rel="stylesheet" href="./mobile.css?v=mobile-20261115"><link rel="stylesheet" href="./simulation_panel.css?v=sim-20261115"><link rel="stylesheet" href="./visual_refresh.css?v=font-outline-black-20261115"><link rel="stylesheet" href="./floating_menu.css?v=menu-20261115-profile"><link rel="stylesheet" href="./image_responsive.css?v=fit-20261115"><link rel="stylesheet" href="./admin_console.css?v=adm-20261115-years"><link rel="stylesheet" href="./gallery.css?v=galeria-42h"><script src="./dashboard_charts.js?v=ops-20261115"></script><script src="./recipe_images.js?v=recipes-20261115"></script>' + "</head>")

gate = """<div id="poteAuthGate" role="dialog" aria-modal="true" aria-label="Entrar no Potê Batata Pro">
 <div class="pote-login-card">
  <div class="pote-brand-logo"><img src="./assets/pote-logo-original.jpg" alt="Logotipo Potê Batata"></div><h1>Potê Batata Pro</h1>
  <p>Entre com sua conta Google para acessar seu espaço de receitas, preços, pedidos e estoque.</p>
  <button id="poteGoogleLogin" type="button">Entrar com Google</button>
  <div id="poteLoginMessage" role="status">Preparando autenticação...</div>
  <p id="poteBrowserHint" hidden>Se o Google não abrir, use o menu do aplicativo e escolha <strong>Abrir no Chrome</strong>. <a href="https://pixmcp-cloud.github.io/pote-batata-pro-v6-site/">Link do site oficial</a>.</p>
  <div class="pote-support">
   <a href="mailto:contato@livresom.com">✉️ contato@livresom.com</a>
   <a href="https://wa.me/5548999951729" target="_blank" rel="noopener">💬 (48) 99995-1729</a>
  </div>
 </div>
</div>"""
once("<body>", "<body class=\"pote-auth-locked\">" + gate)
brand_markup = ('<div class="brand"><img src="./assets/pote-logo-original.jpg" alt="Potê Batata">'
                '<span>POTÊ BATATA PRO<small>GESTÃO ONLINE</small></span></div>')
html, n = re.subn(r'<div class="brand">[^<]*<small>[^<]*</small></div>', brand_markup, html, count=1)
if n != 1:
    raise SystemExit("Cabeçalho da marca não encontrado")
switch = r'<div class="switch" role="group" aria-label="Versão de demonstração">.*?</div>'
new_switch = ('<div class="switch" role="group" aria-label="Sua sessão">'
 '<span id="poteLoggedAs"></span><button id="poteAdminOpen" type="button" hidden aria-label="Abrir Central Administrativa">ADM · Gerenciar</button><span id="potePlanBadge" hidden></span><span id="potePlanCountdown" hidden role="timer" aria-label="Tempo restante da licença"></span><button id="poteExit" type="button">Sair</button>'
 '<span id="poteSyncStatus" aria-live="polite"></span></div>')
html, n = re.subn(switch, new_switch, html, count=1, flags=re.S)
if n != 1:
    raise SystemExit("Header session marker not found")

admin_start = html.find("function pageAdmin(){")
admin_end = html.find("function changeRecipeAvailability(", admin_start)
if admin_start < 0 or admin_end < 0:
    raise SystemExit("Old simulated admin area not found")
admin = """function pageAdmin(){
 if(!master())return '<div class="notice red">Acesso exclusivo da administração mestre.</div>';
 return '<div class="box"><h2>Central Administrativa</h2>'+
 '<p>Gerencie cadastros, concessões e renovações de licenças sem sair do aplicativo.</p>'+
 '<div class="actions"><button type="button" class="btn" onclick="window.POTE_ADMIN?.open()">Abrir gestão de usuários e licenças</button></div>'+
 '<div class="notice">FREE não tem vencimento. Modalidades: teste de 24 horas, PRO de 1 mês, 6 meses ou 1 ano, e vitalícia. A cobrança não é feita nesta área.</div></div>';
}
"""
html = html[:admin_start] + admin + html[admin_end:]

bridge = """window.POTE_AUTH=null;
const POTE_ORIGINAL_LOGO='./assets/pote-logo-original.jpg';
SEED.brand.logoUrl=POTE_ORIGINAL_LOGO;
const POTE_REAL_EMPTY_LISTS=[
 'ingredients','recipes','suppliers','expenses','clients','orders','recipeVersions',
 'recipeTrash','purchases','stockMovements','beverages','addons','combos','prepBatches'
];
function poteFreshAccount(){
 const start=original();
 for(const name of POTE_REAL_EMPTY_LISTS) start.data[name]=[];
 start.data.checklist=(start.data.checklist||[]).map(x=>({...x,done:false}));
 start.data.settings={...start.data.settings,estimatedMonthlyUnits:0};
 start.data.brand={...start.data.brand,logoUrl:POTE_ORIGINAL_LOGO};
 start.accounts=[];
 start.creatives=[];
 start.audit=[];
 start.pricingPreset100V1=true;
 start.freshAccountV1=true;
 return start;
}
function poteIsPristineSeed(cloud){
 const data=cloud?.data;
 const baseline=original();
 const sample=baseline.data;
 if(!data||!Array.isArray(data.orders)||!sample.orders.length||data.orders.length!==sample.orders.length)return false;
 // If any extra field or user customization exists, require manual confirmation instead.
 if(JSON.stringify(Object.keys(data).sort())!==JSON.stringify(Object.keys(sample).sort())) return false;
 for(const name of ['accounts','creatives','audit','unlocked','freeExpense','freeCreativeCount','trialUntil']){
   if(JSON.stringify(cloud[name])!==JSON.stringify(baseline[name]))return false;
 }
 for(const name of Object.keys(sample)){
   if(name==='brand'){
     const a=data.brand,b=sample.brand;
     if(!a||!b||JSON.stringify({...a,logoUrl:''})!==JSON.stringify({...b,logoUrl:''})) return false;
   }else if(JSON.stringify(data[name])!==JSON.stringify(sample[name]))return false;
 }
 return true;
}
window.POTE_APP={
 snapshot(){
  const data=copy(state);
  delete data.mode;delete data.tab;delete data.expansion;
  return data;
 },
 isPristineDemo(cloud){return poteIsPristineSeed(cloud);},
 applyState(cloud){
  const start=poteFreshAccount();
  state={...start,...copy(cloud),data:{...start.data,...copy(cloud?.data||{})},
    mode:'free',tab:'home',expansion:null};
  if(state.data.brand?.logoUrl?.startsWith('data:image/svg+xml'))state.data.brand.logoUrl=POTE_ORIGINAL_LOGO;
  render();
 },
 reset(){state=poteFreshAccount();render();}
};
resetAll=function(){
 if(!window.POTE_AUTH?.uid){toast('Faça login antes de zerar sua conta.');return;}
 if(!window.confirm('ZERAR a conta: excluir receitas, insumos, estoque, vendas, clientes, fornecedores e despesas? Uma cópia JSON será baixada primeiro.'))return;
 try{exportData();}catch(e){console.warn('Backup não disponível',e);toast('Não foi possível preparar o backup. Cancelado.');return;}
 window.POTE_APP.reset();
 toast('Conta zerada. Aguarde a confirmação de sincronização na nuvem.');
};
const poteOriginalRender=render;
render=function(...args){
 const result=poteOriginalRender(...args);
 if(window.POTE_AUTH?.uid)window.dispatchEvent(new Event('pote:changed'));
 return result;
};
render();
"""
once("render();\n</script></body></html>",
     bridge + "</script><script src=\"./simulation_panel.js?v=sim-20261115\"></script><script src=\"./supplier_integration.js?v=suppliers-20261115\"></script><script src=\"./floating_menu.js?v=menu-20261115-profile\"></script><script type=\"module\" src=\"./firebase_integration.js?v=license-20261115-years\"></script><script type=\"module\" src=\"./admin_console.js?v=adm-20261115-years\"></script><script type=\"module\" src=\"./gallery.js?v=galeria-42h\"></script></body></html>")
# Ensure beta is not confused with the public offline demo.
once("Potê Batata Pro V6 • Simulação offline completa", "Potê Batata Pro • Gestão Online")
if 'id="proBtn"' in html or 'id="admBtn"' in html:
    raise SystemExit("Exposed role switch remained")
if not all(x in html for x in ["id=\"poteAuthGate\"", "id=\"poteSyncStatus\"", "id=\"poteExit\"", "id=\"poteLoggedAs\"", "poteFreshAccount", "simulation_panel.js", "poteOriginalRender", "firebase_integration.js"]):
    raise SystemExit("Missing authentication integration")
p.write_text(html, encoding="utf-8")
print("Created beta login page, size", len(html), "characters")
