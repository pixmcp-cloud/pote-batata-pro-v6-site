# Auditoria de estresse e travamentos — Potê Batata Pro V5

**Data:** 20/11/2026  
**Versão corrigida:** commit `751796600e3c8c605664589ca4b5e925fce60fef` (`main`)  
**PR:** https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/pull/4  
**Site:** https://pdv.livresom.com/

## Escopo efetivamente executado

- **102/102 testes Node** da pipeline de publicação passaram na revisão consolidada.
- **10.496 verificações determinísticas** no teste `test_v5_stress.mjs`, incluindo 400 ciclos de reordenação/edição de cadastros, 365 clientes importados em lotes, limites de transação, 2.400 vendas, 40 turnos, 100 reembolsos e 1.798 bloqueios de pagamento repetido.
- **Chrome real**, novo perfil isolado, nas dimensões 320×568, 375×812, 412×915, 834×375 e 1366×768. Avaliação de login, recursos carregados, módulos V5, erros JS, HTTP e overflow horizontal.
- **Firebase Emulator** aprovado em duas configurações de regras, incluindo transação concorrente com 20 ingredientes, 4 bebidas e 24 movimentações físicas.
- **Site oficial publicado** por Firebase Hosting, com verificação HTTPS dos módulos corrigidos. Smoke test do Chrome repetido sobre o domínio de produção, sem login, com **zero exceções JS, erros de console, rede ou HTTP**.

## Problemas reais encontrados e corrigidos

### 1. Inicialização Firebase e login travado — crítico
Antes da correção, o Chrome registrava `FirebaseError: No Firebase App '[DEFAULT]' has been created`, com 25 exceções em cinco carregamentos. Os módulos `admin_console.js`, `admin_permissions.js`, `franchise_sync.js`, `notifications.js` e `admin_broadcast.js` chamavam `getApp()` antes da configuração compartilhada estar pronta. Corrigido com `firebase_app.mjs` como dependência ES comum de todos os módulos, com configuração única. O login passou de **“Preparando autenticação...”** para **“Entre com sua conta Google para acessar seu espaço.”** após inicialização real no navegador.

### 2. Dependência V2 indevida impedindo carregamento V5 — crítico
`operation_integrity.mjs` ainda importava `./v2_store_core.mjs`, indisponível no pacote Hosting V5. Um import ausente abortava a avaliação do grafo de módulos e podia deixar o login preso. Corrigido importando `./v5_store_core.mjs`. O teste de contrato novo falha se a referência V2 reaparecer.

### 3. PWA e ícones 404 — médio
`assets/brand/manifest.webmanifest` utilizava `start_url: "."`, `scope: "."` e ícones `./assets/brand/pdv-192.png` relativos ao próprio diretório do manifesto, gerando URL duplicada `/assets/brand/assets/brand/pdv-192.png` e HTTP 404. Corrigidos URLs absolutos, `start_url: "/"`, `scope: "/"`, e validação de arquivos no build.

### 4. Testes antigos que simulavam imports anteriores — regressões dos mocks
Seis casos de testes ficaram incompatíveis com o novo módulo ES compartilhado, mesmo sem defeito funcional. Os mocks de autenticação/notificações/ADM e os parâmetros de versão foram corrigidos sem remover verificações de acesso, cobrança ou franquia. Suíte final passou integralmente (102/102).

## Proteções e limites observados

- Nenhuma venda artificial foi gravada nas quatro contas oficiais, nenhum estoque de produção foi alterado e nenhuma licença foi concedida ou removida. Os cenários de negócio usaram dados em memória e Firestore Emulator.
- Nenhum serviço pago foi habilitado.
- A confirmação de login real com credencial Google e uma venda em dois celulares físicos permanece **não testada**. O smoke test do Chrome confirmou inicialização da tela de login em perfil não autenticado, não uma compra real.
- Os testes não substituem conciliação Pix/cartão em extrato bancário, entrega de mensagens externas nem testes de conexão móvel intermitente em aparelhos reais.

## Comandos de regressão reutilizáveis

```sh
node test_v5_stress.mjs
node test_v5_startup_contract.cjs
node test_auth_v5_integration.js
node test_v5_storage.mjs
# Chrome disponível no PC conectado (sem login de produção):
node test_v5_browser_smoke.cjs
```

**Resultado:** correções no GitHub principal e publicadas no Firebase Hosting; verificação HTTPS e Chrome de produção concluídas com sucesso.
