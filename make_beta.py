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
once("function render(){window.POTE_EXIT?.beforeRender?.(state);state.mode='free';document.body.classList.toggle('admin-mode',false);",
     "function render(){window.POTE_EXIT?.beforeRender?.(state);state.mode=master()?'adm':pro()?'pro':'free';document.body.classList.toggle('admin-mode',master());")
# Em producao, o distintivo mostra a licença real, nunca acesso simulado.
html, real_badge_count = re.subn(
 r"document.getElementById\('modeBadge'\)\.textContent=state\.mode==='free'\?.*?;document.getElementById\('pageTitle'\)",
 "document.getElementById('modeBadge').textContent=master()?'ADM • ACESSO MESTRE':window.POTE_AUTH?.franchiseActive?'FRANQUIA • OFICIAL':pro()?'PRO • LICENÇA ATIVA':'FREE • PLANO GRATUITO';document.getElementById('pageTitle')",
 html,count=1)
if real_badge_count != 1: raise SystemExit("Badge de perfil simulado não encontrado")

pattern = r"let state=original\(\);try\{const old=JSON.parse\(localStorage.getItem\(KEY\).*?\}catch\(e\)\{\}"
html, n = re.subn(pattern, "let state=original();", html, count=1, flags=re.S)
if n != 1:
    raise SystemExit("Previous localStorage guest state pattern changed; stopping")
once("function persist(){window.POTE_KITCHEN?.capture?.(state);try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}",
     "function persist(){window.POTE_KITCHEN?.capture?.(state);if(window.POTE_AUTH?.uid)window.dispatchEvent(new Event('pote:changed'))}")
once("V6 • DEMONSTRAÇÃO FREE", "PDV MULTIVERSAL • ONLINE")
once("🔒 Demonstração gratuita: dados salvos apenas neste aparelho. Sem login Google ou permissões reais nesta versão.",
     "🔐 Beta conectado ao Firebase: dados por conta Google. Contas FREE e PRO com licença vinculada à sua conta Google.")
once("Todos os dados de teste são armazenados somente no navegador deste aparelho.",
     "Seus dados são sincronizados com sua conta Google pelo Firestore. Guarde também backups JSON.")
once("Nenhum dado enviado ao Floot. A troca FREE / PRO / ADM é um atalho exclusivo da simulação, não uma autenticação real.",
     "O login Google é real. A concessão de licenças PRO é exclusiva da administração mestre. A cobrança online não está habilitada.")
once("pote-simulacao-backup-v6.json", "pote-batata-pro-backup.json")
once("Exportar JSON de teste", "Exportar backup dos meus dados")
once("Free: 1 cliente. Pro: sem limite local na simulação.",
     "FREE: 1 cliente. PRO: cadastros adicionais conforme sua licença.")
html, n = re.subn(r'<button class="btn danger" onclick="resetAll\(\)">[^<]*</button>', '<button class="btn danger" onclick="resetAll()">Zerar minha conta (com backup)</button>', html, count=1)
if n != 1: raise SystemExit("Botão de zerar conta não encontrado")
once("Pesquisa habilitada nesta simulação. Nenhuma chamada externa será enviada.",
     "Busca piloto de estabelecimentos reais no OpenStreetMap. Confirme os dados antes de comprar.")
once('<meta name="robots" content="noindex,nofollow,noarchive">', '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="description" content="PDV MULTIVERSAL: plataforma para batatarias, pizzarias, hamburguerias e lancherias.">')

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
.pote-brand-logo img{width:100%;height:100%;display:block;object-fit:cover;transform:none}
#poteBrowserHint{font-size:13px;line-height:1.5;color:#ffe2aa;margin:12px 0 0}
#poteBrowserHint a{color:#f1c47c;text-decoration:underline}
</style>"""
HEAD_ASSETS = (
    '<script src="./finance_core.js?v=core-20261116-f03-20261125"></script>'
    '<link rel="stylesheet" href="./franchise_shopping_list.css?v=shopping-close-20261118">'
    '<link rel="icon" href="./assets/brand/pdv-64.png?v=multiversal-20261125" type="image/png" sizes="64x64">'
    '<link rel="icon" href="./assets/brand/pdv-icon.svg?v=multiversal-20261125" type="image/svg+xml">'
    '<link rel="apple-touch-icon" href="./assets/brand/pdv-180.png?v=multiversal-20261125" sizes="180x180">'
    '<link rel="manifest" href="./assets/brand/manifest.webmanifest?v=multiversal-20261125">'
    '<meta name="theme-color" content="#090a0b">'
    '<meta name="description" content="PDV MULTIVERSAL: gestão de vendas, estoque, pedidos e financeiro.">'
    '<meta property="og:type" content="website">'
    '<meta property="og:locale" content="pt_BR">'
    '<meta property="og:site_name" content="PDV MULTIVERSAL">'
    '<meta property="og:title" content="PDV MULTIVERSAL">'
    '<meta property="og:description" content="Gestão de vendas, estoque, pedidos e financeiro em um só lugar.">'
    '<meta property="og:url" content="https://pdv.livresom.com/">'
    '<meta property="og:image" content="https://potobatata-b71f3.web.app/assets/brand/pdv-share.jpg">'
    '<meta property="og:image:type" content="image/jpeg">'
    '<meta property="og:image:width" content="1200">'
    '<meta property="og:image:height" content="630">'
    '<meta property="og:image:alt" content="Emblema preto metálico PDV MULTIVERSAL">'
    '<meta name="twitter:card" content="summary_large_image">'

    '<link rel="stylesheet" href="./mobile.css?v=header-sync-20261116">'
    '<link rel="stylesheet" href="./supplier_directory.css?v=contacts-20261116">'
    '<link rel="stylesheet" href="./garimpo.css?v=regional-sources-20261116">'
    '<link rel="stylesheet" href="./pote_notice.css?v=aviso-20261116">'
    '<link rel="stylesheet" href="./simulation_panel.css?v=sim-20261115">'
    '<link rel="stylesheet" href="./visual_refresh.css?v=glass-icons-20261116">'
    '<link rel="stylesheet" href="./floating_menu.css?v=menu-20261115-profile">'
    '<link rel="stylesheet" href="./image_responsive.css?v=square-recipe-20261116">'
    '<link rel="stylesheet" href="./admin_console.css?v=adm-popup-20261121">'
    '<link rel="stylesheet" href="./gallery.css?v=galeria-42h">'
    '<link rel="stylesheet" href="./business_setup.css?v=business-universes-20261115-free-lock-1-v6-layout-20261125-multiversal">'
    '<link rel="stylesheet" href="./stock_ui.css?v=stock-clear-20261115">'
    '<link rel="stylesheet" href="./order_ui.css?v=orders-v2-20261115">'
    '<link rel="stylesheet" href="./order_customization.css?v=custom-20261115">'
    '<link rel="stylesheet" href="./receipt_enhanced.css?v=receipt-20261115">'
    '<link rel="stylesheet" href="./pricing_explainer.css?v=price-guide-20261115">'
    '<link rel="stylesheet" href="./commerce_update.css?v=commerce-20261115">'
    '<link rel="stylesheet" href="./stock_triage.css?v=stock-priority-20261115">'
    '<link rel="stylesheet" href="./stock_update_modal.css?v=stock-update-20261115">'
    '<link rel="stylesheet" href="./losses.css?v=losses-20261116">'
    '<link rel="stylesheet" href="./cancel_order_flow.css?v=cancel-audit-20261115">'
    '<link rel="stylesheet" href="./app_audit.css?v=audit-20261115">'
    '<link rel="stylesheet" href="./release_news.css?v=news-20261115-06">'
    '<link rel="stylesheet" href="./pro_offer.css?v=plans-2">'
    '<script src="./dashboard_charts.js?v=ops-20261115"></script>'
    '<script src="./recipe_images.js?v=recipes-20261115"></script>'
)
once("</head>", head + HEAD_ASSETS + "</head>")

gate = """<div id="poteAuthGate" role="dialog" aria-modal="true" aria-label="Entrar no PDV MULTIVERSAL">
 <div class="pote-login-card">
  <div class="pote-brand-logo"><img src="./assets/brand/pdv-icon.svg?v=multiversal-20261125" alt="PDV MULTIVERSAL"></div><h1>PDV MULTIVERSAL</h1><p>Todos os segmentos. Uma única plataforma.</p>
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
brand_markup = ('<div class="brand"><img id="poteHeadLogo" src="./assets/generic/business-neutral.svg" alt="Ícone do negócio">'
                '<span><span id="poteHeadName">PDV MULTIVERSAL</span><small id="poteHeadSubtitle">ESCOLHA SEU NEGÓCIO</small></span></div>')
html, n = re.subn(r'<div class="brand">[^<]*<small>[^<]*</small></div>', brand_markup, html, count=1)
if n != 1:
    raise SystemExit("Cabeçalho da marca não encontrado")
switch = r'<div class="switch" role="group" aria-label="Versão de demonstração">.*?</div>'
new_switch = ('<div class="switch" role="group" aria-label="Sua sessão">'
 '<span id="poteLoggedAs"></span><button id="poteAdminOpen" type="button" hidden aria-label="Abrir Central Administrativa">ADM · Gerenciar</button><span id="potePlanBadge" hidden></span><button id="potePlansButton" type="button" hidden>Planos</button><span id="potePlanCountdown" hidden role="timer" aria-label="Tempo restante da licença"></span><button id="poteExit" type="button">Sair</button>'
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
const POTE_GENERIC_LOGO='./assets/generic/business-neutral.svg';
const POTE_NEUTRAL_BRAND={name:'Meu Negócio',subtitle:'GESTÃO DE ALIMENTAÇÃO',
 slogan:'Organize vendas, estoque e receitas',phone:'',instagram:'',
 primary:'#233449',accent:'#e4b974',logoUrl:POTE_GENERIC_LOGO};
SEED.brand.logoUrl=POTE_ORIGINAL_LOGO;
window.POTE_SEED=SEED;
const POTE_REAL_EMPTY_LISTS=[
 'ingredients','recipes','suppliers','expenses','clients','orders','recipeVersions',
 'recipeTrash','purchases','stockMovements','beverages','addons','combos','prepBatches',
 'losses','garimpoOffers','cashSessions','cashMovements'
];
function poteFreshAccount(){
 const start=original();
 for(const name of POTE_REAL_EMPTY_LISTS) start.data[name]=[];
 start.data.checklist=(start.data.checklist||[]).map(x=>({...x,done:false}));
 start.data.settings={...start.data.settings,estimatedMonthlyUnits:0};
 start.data.brand=window.POTE_AUTH?.role==='admin'
  ? {...start.data.brand,logoUrl:POTE_ORIGINAL_LOGO}
  : {...start.data.brand,...POTE_NEUTRAL_BRAND};
 start.data.businessType='batataria'; // FREE e ADM começam na Batataria e podem selecionar outros ramos
 start.data.businessUniverses={};
 start.data.businessTemplates={};
 start.data.kitchenStock={mode:"shared",version:1,inventory:{}};
 start.data.kitchenLogistics={couriers:[],trips:[],settlements:[]};
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
 applyState(cloud,options={}){
  const currentTab=state?.tab||'home',currentExpansion=state?.expansion||null;
  const start=poteFreshAccount();
  state={...start,...copy(cloud),data:{...start.data,...copy(cloud?.data||{})},
    mode:'free',tab:options.preserveNavigation&&NAMES[currentTab]?currentTab:'home',
    expansion:options.preserveNavigation?currentExpansion:null};
  // Existing profiles have no kitchen mode: retain separated stock until they opt in.
  if(cloud?.data&&!Object.prototype.hasOwnProperty.call(cloud.data,"kitchenStock"))
   state.data.kitchenStock={mode:"separate",version:1,inventory:{},legacyUnreviewed:true};
  if(window.POTE_AUTH?.role==='admin'){
   if(state.data.businessType==='batataria'&&state.data.brand?.logoUrl?.startsWith('data:image/svg+xml'))state.data.brand.logoUrl=POTE_ORIGINAL_LOGO;
  }else{
   if(!state.data.businessType)state.data.businessType='';
   if(window.POTE_UNIVERSES&&state.data.businessType){
     const migration=window.POTE_UNIVERSES.switchTo(state,state.data.businessType,SEED,
       {skipTemplates:!!window.POTE_AUTH?.franchiseActive});
     if(migration.changed)window.POTE_UNIVERSE_MIGRATED=true;
   }
   if(window.POTE_BUSINESS?.normalizeAccountBrand?.())window.POTE_BRAND_MIGRATED=true;
  }
  window.POTE_KITCHEN?.project?.(state);
  render();
 },
 reset(){state=poteFreshAccount();window.POTE_UNIVERSE_MIGRATED=false;render();}
};
resetAll=function(){
 if(!window.POTE_AUTH?.uid){toast('Faça login antes de zerar sua conta.');return;}
 if(window.POTE_SYNC_GUARD?.blocked||window.POTE_SYNC_GUARD?.hasPending?.()){
  toast('Existe pendência de sincronização. Resolva antes de zerar a conta.');return;
 }
 if(!window.confirm('ZERAR a conta? Faça o download do backup e reabra o arquivo para comprovar que ele foi salvo.'))return;
 const accountUid=window.POTE_AUTH.uid,previous=window.POTE_APP.snapshot();
 const guard=window.POTE_SYNC_GUARD;
 if(!guard?.downloadPending||!guard?.verifyBackupFile){
  toast('Validação de backup não disponível. Operação bloqueada.');return;
 }
 try{guard.downloadPending()}
 catch(error){console.warn('Backup indisponível',error);toast('Falha ao gerar backup. Operação cancelada.');return;}
 // The browser must return a real File chosen from device storage.
 void guard.verifyBackupFile(accountUid,previous).then(result=>{
  if(!result?.ok){toast('Backup não validado: '+String(result?.error||'arquivo incorreto'));return;}
  if(window.POTE_AUTH?.uid!==accountUid||window.POTE_SYNC_GUARD?.blocked||
   JSON.stringify(window.POTE_APP.snapshot())!==JSON.stringify(previous)){
   toast('Os dados ou a conta mudaram. Faça um novo backup antes de zerar.');return;
  }
  if(window.prompt('Backup '+result.fileName+' validado. Para confirmar o reset definitivo, digite ZERAR:')!=='ZERAR'){
   toast('Nenhum dado foi zerado.');return;
  }
  window.POTE_APP.reset();
  toast('Redefinição solicitada. Confira a confirmação de sincronização na nuvem.');
 }).catch(error=>{console.warn('Validação de backup',error);toast('Falha na verificação. Nenhum dado foi zerado.')});
};
const poteOriginalRender=render;
let poteRenderLastUid=null,poteRenderLastState=null;
render=function(...args){
 window.POTE_KITCHEN?.capture?.(state);
 const auditNormalization=window.POTE_STOCK?.normalizeInventory?.(state.data);
 if(auditNormalization?.invalid?.length)console.warn("Estoque com saldo numérico inválido",auditNormalization.invalid);
 window.POTE_DRINKS?.ensure?.(state);
 const result=poteOriginalRender(...args);
 window.POTE_BUSINESS?.refresh?.();
 if(state.tab==='ingredients')window.POTE_STOCK_UI?.selectIngredient?.();
 if(state.tab==='vitrine')window.POTE_PAYMENT?.vitrineSync?.();
 if(state.tab==='pricing')window.POTE_PRICING?.mount?.();
 if(state.tab==='losses')window.POTE_LOSSES?.mount?.();
 if(state.tab==='garimpo')window.POTE_GARIMPO?.mount?.();
 if(state.tab==='orders'){window.POTE_DRINKS?.mount?.();window.POTE_ORDER?.restoreDraft?.();window.POTE_ORDER_CUSTOM?.mount?.();window.POTE_ORDER?.refresh?.();window.POTE_PAYMENT?.sync?.();}
 // Navigation and presentation-only rerenders are not data mutations.
 // Keep this hash per user so a session change cannot reuse a stale baseline.
 const currentUid=window.POTE_AUTH?.uid||null;
 if(currentUid && window.POTE_APP?.snapshot){
  const currentState=JSON.stringify(window.POTE_APP.snapshot());
  if(currentUid!==poteRenderLastUid || currentState!==poteRenderLastState){
   poteRenderLastUid=currentUid;poteRenderLastState=currentState;
   window.dispatchEvent(new Event('pote:changed'));
  }
 }else{poteRenderLastUid=null;poteRenderLastState=null;}
 return result;
};
const poteOriginalGo=go;
go=function(tab){if(window.POTE_ACCESS?.requireTab?.(tab)===false)return;const result=poteOriginalGo(tab);
 if(tab==='orders')window.POTE_ORDER?.alertOnEnter?.();
 return result;
};
state=poteFreshAccount();
render();
"""
# O bloco demarcado contém a inicialização da versão offline.
startup = re.compile(
    r"^/\* POTE_BETA_STARTUP_BEGIN \*/\n.*?^/\* POTE_BETA_STARTUP_END \*/\n",
    re.M | re.S,
)
html, startup_count = startup.subn(lambda _: bridge, html)
if startup_count != 1:
    raise SystemExit(f"Expected one POTE_BETA_STARTUP block ({startup_count})")

BODY_ASSETS = (
    '<script src="./simulation_panel.js?v=sim-20261115"></script>'
    '<script src="./supplier_integration.js?v=suppliers-v4-20261117"></script>'
    '<script src="./supplier_directory.js?v=kitchen-motoboy-20261116"></script>'
    '<script src="./garimpo.js?v=radar-v4-20261117"></script>'
    '<script src="./pote_notice.js?v=aviso-20261116"></script>'
    '<script src="./floating_menu.js?v=moderation-20261121-plans"></script>'
    '<script src="./release_news.js?v=pdv-20261116"></script>'
    '<script src="./pro_offer.js?v=free-offer-3"></script>'
    '<script src="./pro_plans.js?v=plans-2"></script>'
    '<script type="module" src="./firebase_integration.js?v=moderation-20261121-free-offer-2-f10-segment-20261125-checkout-tracking"></script>'
    '<script type="module" src="./admin_console.js?v=adm-popup-20261121"></script>'
    '<script type="module" src="./admin_permissions.js?v=firebase-order-v5-20261120"></script>'
    '<script type="module" src="./gallery.js?v=galeria-42h"></script>'
    '<script src="./universe_templates.js?v=universes-20261115"></script>'
    '<script src="./pastelaria_templates.js?v=pastelaria-20261116"></script>'
    '<script src="./universe_core.js?v=kitchen-motoboy-20261116"></script>'
    '<script src="./access_control.js?v=delivery-hub-20261116-free-lock-1-f10-segment-20261125"></script>'
    '<script src="./business_setup.js?v=company-label-20261117-v6-artes-20261125-layout-2-multiversal-f10"></script>'
    '<script src="./beverage_catalog.js?v=commerce-20261115"></script>'
    '<script src="./payment_flow.js?v=exact-cash-safe-sync-20261118"></script>'
    '<script src="./stock_inventory.js?v=stock-priority-20261115"></script>'
    '<script src="./stock_delete.js?v=stock-priority-20261115"></script>'
    '<script src="./stock_math.js?v=v4-stock-balance-20261117"></script>'
    '<script src="./stock_update_modal.js?v=v4-stock-balance-20261117"></script>'
    '<script src="./stock_status.js?v=audit-20261115"></script>'
    '<script src="./app_audit.js?v=audit-20261115"></script>'
    '<script src="./stock_ui.js?v=critical-stock10-20261118"></script>'
    '<script src="./pricing_explainer.js?v=v3-wave1-20261116"></script>'
    '<script src="./order_customization.js?v=base-fixed-v10-20261119"></script>'
    '<script src="./receipt_enhanced.js?v=tracking-receipt-order-sequence-20261119"></script>'
    '<script src="./stock_ext.js?v=v4-stock-balance-20261117"></script>'
    '<script src="./order_guard.js?v=audit-20261115"></script>'
    '<script src="./cost_history.js?v=v3-cost-20261116"></script>'
    '<script src="./losses.js?v=f05-final-20261120"></script>'
    '<script src="./cancel_order_flow.js?v=order-sequence-20261119"></script>'
    '<script src="./exit_guard.js?v=android-back-drafts-v5-20261117"></script>'
    '<script src="./recipe_photo.js?v=recipe-square-v5-20261117"></script>'
    '<script type="module" src="./franchise_sync.js?v=firebase-order-v5-20261120"></script>'
    '<script type="module" src="./franchise_shopping_list.mjs?v=shopping-close-20261118"></script>'
    '<link rel="stylesheet" href="./kitchen_inventory.css?v=kitchen-20261116">'
    '<script src="./kitchen_inventory.js?v=kitchen-20261116"></script>'
    '<link rel="stylesheet" href="./notifications.css?v=inline-detail-20261117">'
    '<link rel="stylesheet" href="./admin_broadcast.css?v=notices-20261116">'
    '<script type="module" src="./notifications.js?v=firebase-order-v5-20261120"></script>'
    '<script type="module" src="./admin_broadcast.js?v=firebase-order-v5-20261120"></script>'
    '<link rel="stylesheet" href="./delivery_hub.css?v=maisdelivery-pilot-20261117">'
    '<script type="module" src="./delivery_hub.js?v=maisdelivery-pilot-20261117"></script>'
    '<link rel="stylesheet" href="./motoboy.css?v=motoboy-20261116">'
    '<script type="module" src="./motoboy.js?v=motoboy-20261116"></script>'
    '<link rel="stylesheet" href="./pdv_cash.css?v=pdv-page-cash-actions-v7-20261118">'
    '<script type="module" src="./pdv_cash_ui.mjs?v=public-checkout-20261125"></script>'
    '<script src="./numeric_keyboard.js?v=teclado-contextual-v6-20261125"></script>'
    '<script src="./module_health.js?v=v3-wave1-20261116"></script>'
    '<link rel="stylesheet" href="./pote_calc_launcher.css?v=quantum-99-20261117">'
    '<script defer src="./pote_calc_launcher.js?v=quantum-99-20261117"></script>'
    '<link rel="stylesheet" href="./tablet_layout.css?v=tablet-responsive-20261117">'
    '<script defer src="./tablet_layout.js?v=tablet-responsive-20261117"></script>'
    '<link rel="stylesheet" href="./compact_account_header.css?v=profile-compact-20261117">'
    '<script defer src="./compact_account_header.js?v=profile-compact-20261117"></script>'
    '<link rel="stylesheet" href="./top_navigation.css?v=topnav-menu-20261117">'
    '<script defer src="./top_navigation.js?v=topnav-menu-20261117"></script>'
    '<link rel="stylesheet" href="./company_pdv_polish.css?v=company-pdv-20261117">'
    '<link rel="stylesheet" href="./premium_motion.css?v=premium-motion-20261117">'
    '<script defer src="./premium_motion.js?v=premium-motion-20261117"></script>'
    '<link rel="stylesheet" href="./creative_studio.css?v=creative-v7-20261117">'
    '<script src="./creative_studio.js?v=creative-v7-20261117"></script>'
    '<script src="./creative_prompt.js?v=prompt-v5-20261117"></script>'
)
once("</body>", BODY_ASSETS + "</body>")
# Identidade neutra no login; conta mestre recupera a marca ao entrar.
html, title_count = re.subn(r"<title>.*?</title>", "<title>PDV MULTIVERSAL · Gestão de negócios de alimentação</title>", html, count=1, flags=re.S)
if title_count != 1: raise SystemExit("Título neutro não encontrado")
# Ensure beta is not confused with the public offline demo.
once("Potê Batata Pro V6 • Simulação offline completa", "PDV MULTIVERSAL • Gestão Online")
if 'id="proBtn"' in html or 'id="admBtn"' in html:
    raise SystemExit("Exposed role switch remained")
if not all(x in html for x in ["id=\"poteAuthGate\"", "id=\"poteSyncStatus\"", "id=\"poteExit\"", "id=\"poteLoggedAs\"", "poteFreshAccount", "simulation_panel.js", "poteOriginalRender", "firebase_integration.js"]):
    raise SystemExit("Missing authentication integration")
p.write_text(html, encoding="utf-8")
print("Created beta login page, size", len(html), "characters")
