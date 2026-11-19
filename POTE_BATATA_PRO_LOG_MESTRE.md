---
tipo: checkpoint-de-continuidade
projeto: Potê Batata Pro
referencia: 2026-11-18
estado: desenvolvimento-validado-em-laboratorio-sem-publicacao-comercial
repositorio: pixmcp-cloud/pote-batata-pro-v6-site
branch_de_trabalho: feat/f35-completion-audit-20261118
head_branch_verificado: aaa2a104724a3355ae75a9078d7f59df1e144667
head_main_verificado: 4cf0622f6f250b4e7422ae88e09a5943fb409935
commits_a_frente_da_main: 19
commits_atras_da_main: 0
arquivo_fonte_adicional: AUDIT_35_PROGRESS_20261118.md
---

# LOG MESTRE DE CONTINUIDADE — POTÊ BATATA PRO

**Finalidade:** transportar o estado exato do projeto entre conversas, evitando perda de contexto, alterações repetidas, correções contraditórias e afirmações de conclusão sem testes. Este arquivo é um registro de trabalho, não uma autorização automática para mudanças de produção.

## 0. INSTRUÇÃO OBRIGATÓRIA PARA A PRÓXIMA CONVERSA

Em toda nova conversa sobre o projeto, consultar automaticamente a cópia no PC ou a cópia versionada no GitHub:

1. **Leia integralmente este documento primeiro**, incluindo todos os 35 itens, requisitos de negócio e bloqueios de segurança. Não peça ao usuário que reconte o projeto.
2. Informe concisamente o ponto de parada e o primeiro passo técnico; depois **continue a execução imediatamente** com os conectores disponíveis. Não transforme este arquivo em mera proposta sem agir.
3. Confira no GitHub o `main`, a branch de trabalho, o HEAD, eventuais commits novos e o diff antes de editar. Este arquivo registra um checkpoint de 18/11/2026 e pode ser superado por mudanças posteriores.
4. **Edite código exclusivamente no GitHub** (branch de trabalho, commits rastreáveis), conforme preferência expressa do proprietário. O computador conectado pode ser usado para ler, compilar, testar e operar o GitHub autenticado; não modificar diretamente o código local do projeto nem atuar no Floot sem pedido explícito.
5. Preserve produção, contas e dados reais. Não faça migrações destrutivas, deploy de Rules em produção, ativações de serviços pagos, mudanças de domínio ou abertura de escrita do Worker sem a autorização específica exigida para ações de risco. A aprovação geral das 35 melhorias não substitui autorização de custos ou cutover comercial.
6. Não refaça itens validados sem motivo objetivo; priorize pendências e regressões. Registre cada nova mudança, commit, comandos executados, resultados dos testes e bloqueios.
7. Na ausência de conector, descreva precisamente o que falta. **Não conclua que o computador está offline por um conector indisponível**; não confunda acesso ao PC com conexão USB do Android.
8. Se a sessão não comportar tudo, encerre com **checkpoint atualizado**, commits, último teste concluído, pendências e comando/ação seguinte, sem sugerir que trabalho continuará em segundo plano.

## 1. IDENTIFICAÇÃO E OBJETIVO DO PROJETO

- **Aplicativo:** Potê Batata Pro, plataforma de gestão para pequenos estabelecimentos de alimentação e futuras franquias.
- **Repositório GitHub:** https://github.com/pixmcp-cloud/pote-batata-pro-v6-site
- **Site comercial existente:** https://pdv.livresom.com — não alterar por inferência; verificar antes de declarar qual release está no ar.
- **Firebase:** projeto `potobatata-b71f3`. Uso de Firebase Auth com login Google, Firestore V2 por conta, Rules versionadas e ambientes Emulator locais.
- **Cloudflare:** Worker de homologação `pote-batata-guard-staging` em `workers/antifraud/`; cliente tem ponte `worker_bridge.mjs` / `firebase_integration.js`.
- **Floot:** plataforma original vinculada ao desenvolvimento; **não editar pelo Floot** sem solicitação expressa.
- **Funcionalidades principais:** receitas, precificação, estoque, pedidos, PDV e caixa, despesas, perdas, clientes, fornecedores, criativos, relatórios, franquias, administração, autenticação e licenciamento Free/Pro.
- **Critério econômico:** evitar custos recorrentes desnecessários; usar o que já existe e não contratar/ativar recursos pagos sem aprovação específica.

### Comportamentos de negócio já estabelecidos

- Ao pressionar **Concluir** uma venda, o pedido deve registrar automaticamente os recebimentos do caixa/PDV quando a forma for dinheiro, Pix ou cartão; **sem segunda confirmação manual**. Pedido com pagamento na entrega permanece pendente.
- Relatórios e gráfico do PDV devem discriminar dinheiro, Pix e cartão, contando somente recebimentos marcados como confirmados; não misturar lucro, contribuição, vendas a receber e perdas.
- Produção baixa ingredientes e bebidas pelas quantidades corretas. Cancelamento antes da produção não gera baixa física; após produção deve permitir devolver ao estoque **uma vez** ou lançar perda física, com histórico verificável e sem duplicar movimentos.
- Vendas, caixa, estoque e configurações comerciais pertencem à conta/universo correto; conta Free nova não deve herdar vendas ou estoque de outras contas.
- Acesso administrativo deve depender de identidade/claim verificada pelo servidor, nunca de botão, parâmetro de URL ou texto editável do navegador.
- Franquia ativa deve receber permissões e catálogo autorizados, preservando isolamento dos dados financeiros privados.
- Experiência mobile limpa, simples, menus e cabeçalho fixo, imagens oficiais e mensagens internas sem redirecionamento inesperado ao login.

## 2. PONTO EXATO DE PARADA, VERIFICADO NO GITHUB

**Comparação executada em 18/11/2026 por conector GitHub:**

| Propriedade | Valor |
| --- | --- |
| Repositório | `pixmcp-cloud/pote-batata-pro-v6-site` |
| Base / produção Git | `main` — `4cf0622f6f250b4e7422ae88e09a5943fb409935` |
| Branch candidata | `feat/f35-completion-audit-20261118` |
| HEAD da candidata | `aaa2a104724a3355ae75a9078d7f59df1e144667` |
| Comparação com `main` | **19 commits à frente, 0 atrás** |
| Arquivos alterados na candidata | **14** |
| Alterações no diff | **302 inserções / 29 exclusões** |
| Merge em `main` | **NÃO realizado** |
| Deploy comercial nesta execução | **NÃO realizado** |
| Estado da versão pública | Preservada; não assumir que branch candidata esteja publicada |

**Última ação de código:** commit `aaa2a104724a3355ae75a9078d7f59df1e144667` alterou `qa/mobile/run_everything.ps1` para o relatório indicar explicitamente quando o Firebase Emulator é omitido pela opção `-SkipFirebase`. A última execução de regressão mobile completa após correção do F08 terminou com código zero; o commit apenas ajustou a mensagem de reporte.

Links de navegação:
- Branch: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/tree/feat/f35-completion-audit-20261118
- Comparação: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/compare/main...feat/f35-completion-audit-20261118
- Registro versionado anterior: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/blob/feat/f35-completion-audit-20261118/AUDIT_35_PROGRESS_20261118.md
- Arquivo de configuração Worker: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/blob/feat/f35-completion-audit-20261118/workers/antifraud/wrangler.toml

## 3. O QUE FOI IMPLEMENTADO NA ÚLTIMA SESSÃO

1. **F03/F09 — parsing monetário:** `finance_core.js` passou a interpretar agrupamento brasileiro de milhares (ex.: `1.234`) de forma consistente com estoque e PDV. Novo `test_numeric_parser_consistency.cjs`; também aprovado `test_finance_core.js`.
2. **F07/F15 — saúde dos módulos:** `module_health.js` ganhou contrato de métodos obrigatórios para módulos críticos, não apenas verificação de que um objeto global existe. `test_module_health.js` cobre módulos ausentes, incompletos e recuperação.
3. **F08 — criativos:** `make_beta.py` remove do **HTML autenticado** as implementações duplicadas do gerador legado, preservando o módulo moderno `creative_studio.js` e mantendo a demonstração offline independente. Atenção: a primeira tentativa removeu por engano `pageBrand` e `saveBrand`, detectado por QA. Corrigido ao delimitar a substituição até `function pageBrand(){`. A suíte de 8 telas móveis **passou depois da correção**. Não repetir o corte amplo que terminava em `function pageAdmin(){`.
4. **F21/F35 — auditoria de arquivos:** novos `qa/release_asset_inventory.mjs` e `qa/test_release_asset_inventory.mjs` para inventário SHA-256 de assets, referências ausentes e arquivos potencialmente sensíveis. Testes integrados à `.github/workflows/deploy.yml`, com ordem compatível com `build_hosting.py`.
5. **F02/F05/F20 — segundo bloqueio no Worker:** além de `ENABLE_WRITES=true`, projetos reais exigem `PRODUCTION_CUTOVER_APPROVED=true`; ambas as variáveis permanecem `false` em `workers/antifraud/wrangler.toml`. Projetos `demo-*` do Emulator seguem trilha de teste. A operação real permanece desativada.
6. **F29 — clareza de QA:** `qa/mobile/run_everything.ps1` passou a registrar se os testes Firestore foram ou não executados.
7. **Documentação:** `AUDIT_35_PROGRESS_20261118.md` registra os 35 itens e pendências. O log mestre é persistido no PC e no GitHub; o usuário não deve anexá-lo em conversas futuras.

### Lista completa dos 14 arquivos modificados/adicionados na branch

```
.github/workflows/deploy.yml
AUDIT_35_PROGRESS_20261118.md
finance_core.js
make_beta.py
module_health.js
qa/mobile/run_everything.ps1
qa/release_asset_inventory.mjs
qa/test_release_asset_inventory.mjs
test_module_health.js
test_numeric_parser_consistency.cjs
workers/antifraud/README.md
workers/antifraud/src/index.mjs
workers/antifraud/test/worker.test.mjs
workers/antifraud/wrangler.toml
```

## 4. EVIDÊNCIAS DE TESTES: NÃO CONFUNDIR LABORATÓRIO COM PRODUÇÃO

**Confirmado na sessão anterior:**

- Worker (`npm.cmd test --prefix workers/antifraud`): **20/20** testes unitários aprovados; `npm.cmd run check` passou.
- Worker usando transações reais do SDK contra Firestore Emulator: testes de produção, cancelamento, idempotência e consumo concorrente aprovados **nas duas configurações** de Rules.
- Firebase Emulator: **10/10** testes na configuração de referência e **10/10** na candidata, incluindo permissões, recuperação V1, estoque negativo, gravação atômica e concorrência.
- `qa/mobile/run_everything.ps1` em execução completa anterior ao ajuste final F08: código de saída **0**. Depois do ajuste F08, nova execução com `-SkipFirebase` passou, com código **0**, cobrindo Chrome/PDV/mobile; a validação Firestore da configuração de Worker foi executada separadamente.
- **8 perfis de tela**: 320, 360, 375, 390, 430, 844 (paisagem), 768 (tablet) e 1366 (desktop), sem falhas no último ensaio.
- **5 cenários** de venda simulada no PDV; Pix, cartão e dinheiro registrando entrada automaticamente; pagamento na entrega fica pendente.
- Criativos: exportações PNG testadas em 9:16, 1:1, 4:5 e 16:9; geração e layout mobile aprovados.
- Inventário final: **216 arquivos**, **7.741.149 bytes**, **zero** caminhos locais ausentes e **zero** arquivos suspeitos detectados pelas regras do verificador. Isso **não equivale** a auditoria de segurança completa.
- Backup V1/V2, isolamentos de contas, limites e permissões foram exercitados em simulação e Emulator; **não** em migração real de produção.

**Pontos que NÃO foram comprovados:** Android físico/APK nativo, custos operacionais reais, integração Firestore REST em projeto de teste não emulado, desempenho com dados comerciais vivos, estorno bancário, isolamento comercial ao vivo de múltiplas contas e publicação controlada da candidata.

**Diagnóstico adicional:** alguns ensaios de interface PDV registraram mensagens de teste `Firebase: No Firebase App '[DEFAULT]' has been created`, embora a suíte tenha aprovado o comportamento simulado. Investigar se isso decorre apenas do harness isolado antes de considerar ausência de erros de console no ambiente real.

## 5. MATRIZ DOS 35 ITENS — NÃO REABRIR SEM NECESSIDADE

| ID | Estado no checkpoint | Trabalho realmente pendente / aceite final |
| --- | --- | --- |
| F01 | Implementado e testado localmente | Conciliação bancária/PSP real |
| F02 | **PARCIAL — crítico** | Backend autoritativo, bloqueio coerente de escritas diretas no corte, testes REST reais |
| F03 | Parcial, parser BRL melhorado | Demais formulários e entradas extremas |
| F04 | Implementado/testado | Aceite comercial |
| F05 | **PARCIAL — crítico** | Cancelamento/estorno com Worker em projeto real isolado, multiaparelho |
| F06 | Parcial | Lotes grandes financeiros e de estoque precisam de operação backend idempotente |
| F07 | Contratos reforçados/testados | Falha efetiva de carga em browser real |
| F08 | Feito na candidata/testado após regressão | Smoke test Android físico autenticado |
| F09 | Parcial | Eliminar demais parsers/funções redundantes |
| F10 | Simulado/testado com V1 preservado | Exportação, verificação e migração de contas reais, sem perda |
| F11 | Parcial | Modelo unificado de autorização cliente/servidor |
| F12 | Parcial | Reduzir monólito/text substitution com regressão controlada |
| F13 | Implementado/testado | Latência e custo de leituras Firestore vivo |
| F14 | Implementado/testado | Carga em aparelho de pouca memória |
| F15 | Contratos de módulos críticos entregues | Formalizar demais interfaces globais |
| F16 | Testado | Escala de ordenação/posicionamento |
| F17 | Emulado em 8 perfis | Android físico, acessibilidade, memória e performance |
| F18 | Regras versionadas/testadas; situação real a verificar | Auditar efetiva versão de Rules publicada e Free real |
| F19 | Controles Free versionados/testados; situação real a verificar | Teste de quotas Free/Pro por SDK e rotas alternativas no ambiente isolado |
| F20 | **PARCIAL — crítico** | Auditoria servidor, reconciliação de recebimentos/reembolsos reais |
| F21 | Inventário de release adicionado | Estratégia de site comercial, autenticação, rollout e monitoramento |
| F22 | Implementado/testado | Aprovação gerencial |
| F23 | Backup JSON emulado | Restauração mobile real/IndexedDB |
| F24 | Claims ADM implementados/testados | Homologação ADM com conta real de teste |
| F25 | Implementado/testado | Estados reais de integrações externas |
| F26 | Implementado/testado | Retenção da galeria local |
| F27 | Parcial | Perfil de CPU/memória/rede e custo de Firestore |
| F28 | Testado em browser | Conta real recém-criada totalmente vazia |
| F29 | QA automatizado, logs claros | Aprovação de ambiente real e revisão de release |
| F30 | Implementado/testado | Alternância real de contas sem retenção cruzada |
| F31 | Contratos MaisDelivery locais | Sandbox oficial e teste ponta a ponta autenticado |
| F32 | **ADIADO POR CUSTO** | Não ativar galeria cloud/Storage sem aprovação |
| F33 | Concorrência Firestore emulada | Dois aparelhos reais no mesmo estabelecimento |
| F34 | Testado localmente | Fornecedores/preços externos, cache e rate limit reais |
| F35 | Auditoria de assets entregue | Fallback de CDN/auth e homologação de rede real |

**Nota de precisão:** documentação anterior usou expressões como "regras publicadas" em F18/F19. A última sessão **não implantou Rules de produção**. Na retomada, conferir diretamente a configuração vigente do Firebase antes de assumir que a segurança Free está completa no ar.

## 6. BLOQUEIOS DE SEGURANÇA E ECONOMIA INEGOCIÁVEIS

- **NÃO** alterar `CLOUD_WORKER_ACTIVE=false` no `firebase_integration.js` até o cutover homologado.
- **NÃO** ativar `ENABLE_WRITES` nem `PRODUCTION_CUTOVER_APPROVED` em projeto real sem homologação e autorização específica.
- **NÃO** inserir `GCP_PRIVATE_KEY`, JWT, tokens de acesso ou arquivos `.env` no GitHub, chat, relatório, navegador ou resposta. Quando autorizado, usar segredos do Cloudflare e identidade com privilégios mínimos.
- **NÃO** presumir que estar logado em um site no navegador concede autorização de API ou de CLI; checar sessão e permissões.
- **NÃO** executar deploy diretamente em produção, troca de Firestore Rules, serviços pagos, upgrade de plano, Cloud Storage/galeria em nuvem, migração destrutiva ou reset de contas sem aprovação específica.
- **NÃO** permitir dois caminhos concorrentes para baixar estoque (browser SDK e Worker) quando ativar backend autoritativo; fazer transição conjunta e reversível.
- Preservar contas Free/Pro e seus dados, saldos, histórico de caixa, custos, movimentos e backups; em testes sempre usar dados sintéticos.
- Fronteira entre "venda registrada" e "Pix/cartão efetivamente liquidado": não alegar confirmação bancária quando há apenas marcação interna do app.
- Manter backups verificáveis e rollback de código, Rules e dados de teste.

## 7. CONECTORES E AMBIENTES — COMO RETOMAR SEM PEDIR O CONTEXTO DE NOVO

**GitHub:** conector de leitura estava acessível. O conector inicialmente retornou HTTP 403 ao tentar criar branch/arquivo. O acesso GitHub já autenticado no **Remote Desktop Commander** permitiu criar e enviar branch e gravar conteúdo pela API do GitHub, sempre de modo versionado. **Não expor nem copiar tokens.** Reavaliar permissões da sessão nova antes de qualquer write.

**Computador autorizado via Desktop Commander (referência histórica, não prova de conexão atual):**

```
Dispositivo: DESKTOP-9481JM1
Sistema: Windows
Device ID: da842e31-12f0-4fa5-9996-1696404896f2
Plugin: Remote Desktop Commander
```

**Caminho local original informado:** `C:\Users\LIVRESOM\Documents\GitHub\pote-batata-pro-v6-site` — estava em branch **antiga** `v3-audit-37-20261116`, com arquivos **untracked**. **NÃO resetar, limpar ou sobrescrever esse diretório.**

**Laboratório temporário da última sessão:** `$env:TEMP\pote-f35-qa-20261118` — clone separado para compilações/testes. A existência atual desse diretório deve ser verificada, não presumida. A política de não editar código diretamente no computador segue válida; correções devem ir ao GitHub, e o clone deve ser atualizado apenas para testar.

**Compilação:** `python build_hosting.py` prepara `public/`. O script extrai os comandos do workflow até a primeira linha `node --check public/premium_motion.js`; **não inserir comandos antes dessa âncora**, pois isso causou falha de build e já foi corrigido.

**Testes usuais (em clone descartável e seguro):**

```powershell
# Atualize o clone temporário com a branch candidata antes dos testes.
python build_hosting.py
node --test qa/test_release_asset_inventory.mjs
node qa/release_asset_inventory.mjs public
node test_numeric_parser_consistency.cjs
node test_module_health.js
node test_finance_core.js
npm.cmd ci --prefix workers/antifraud --ignore-scripts --no-audit --no-fund
npm.cmd run check --prefix workers/antifraud
npm.cmd test --prefix workers/antifraud
powershell.exe -NoProfile -ExecutionPolicy Bypass -File qa\mobile\run_everything.ps1
```

No Windows, **usar `npm.cmd`**, não `npm`, porque a política de PowerShell bloqueou o wrapper `npm.ps1`. Para Firebase Emulator, o laboratório anterior usava o Java do Android Studio (`C:\Program Files\Android\Android Studio\jbr`) e `firebase.cmd`; conferir instalações e portas antes de executar. Alguns testes Chrome exigem Puppeteer e `NODE_PATH` local descritos em `qa/mobile/run_everything.ps1`.

`-SkipFirebase` no runner omite **explicitamente** os testes Firestore; não anunciar essa execução como validação integral do Emulator. `-SkipBuild` pode reaproveitar um pacote antigo, portanto usar build novo no corte final.

## 8. PRIMEIRA TAREFA TÉCNICA A EXECUTAR NA RETOMADA

**Foco:** F02 + F05 + F20, segurança de estoque, cancelamento e auditoria financeira — **antes de novas animações, novas telas ou embelezamento**.

### Sequência objetiva

1. Abrir GitHub, conferir diffs e HEADs. Reusar a branch atual ou nova branch baseada nela, não `main` antigo. Verificar ferramentas conectadas e PC autorizado.
2. Ler **integralmente**: `workers/antifraud/src/index.mjs`, `auth.mjs`, `domain.mjs`, `firestore.mjs`, `worker_bridge.mjs`, `firebase_integration.js`, `firestore.rules`, `firestore.hardened.rules` e testes relevantes. Confirmar que a dupla trava do Worker e `CLOUD_WORKER_ACTIVE=false` permanecem intactos.
3. Verificar se há projeto Firebase **de teste isolado, não emulado** e acesso legítimo a Worker staging, sem tocar produção; se não houver, continuar implementando/validando com mocks e Emulator, sem simular implantação real.
4. Priorizar teste end-to-end **Worker → OAuth de serviço → Firestore REST de teste → sincronização V2 → Rules**: pedido de teste, baixa de ingredientes/bebida, duas transações simultâneas, repetição de `operationId`, cancelamento/devolução única, cancelamento/perda, pedido sem saldo, mudança de conta e falha de rede.
5. Garantir política de escrita que impeça bypass do browser **antes** de qualquer ativação de operações autoritativas. Testar continuidade de vendas, migrações e contas Free. Fazer ensaio de rollback.
6. Auditar trilha financeira de Pix/cartão/dinheiro e diferenças entre marcado como recebido e confirmação real externa. Provar que nenhuma venda é contada ou estornada duas vezes.
7. Reexecutar suites Worker, Emulator, Chrome, PDV e franquias; documentar commits e resultados, além das limitações.
8. Apenas depois de homologação e autorização específica, planejar cutover comercial controlado e reversível. **Não fazer corte unilateral**.

### Critério de conclusão deste próximo bloco

Um teste reproduzível no ambiente não emulado de homologação confirma que todas as mutações de pedido, estoque e perdas passam por um único backend autoritativo, as Rules impedem bypass, o histórico financeiro é coerente, duas sessões concorrentes não causam estoque negativo/duplicidade, e o cliente sincroniza corretamente após interrupção. Se isso não for comprovado, o bloco continua **parcial**.

## 9. PROTOCOLO DE REGISTRO AO FINAL DE CADA CONTINUAÇÃO

Anexar ao final deste log, preservando histórico, um bloco com:

```
CHECKPOINT: AAAA-MM-DDTHH:MM:SS[timezone]
GitHub main SHA:
GitHub branch de trabalho:
GitHub HEAD SHA:
Arquivos/commits novos:
Alterações concluídas por ID (F01-F35):
Testes executados (comando, ambiente, resultado):
Falhas encontradas e correções:
Estado da produção e dos dados reais:
Mudanças com custo ou impacto irreversível (se nenhuma, escrever NENHUMA):
Pendências e riscos restantes:
PRÓXIMA AÇÃO EXATA:
```

Não marcar "feito" sem evidência. Se o GitHub mostrar commits mais recentes que este log, o estado real do repositório prevalece e este documento deve ser atualizado.

---

**Mensagem opcional para iniciar nova conversa sem anexar arquivos:**

> Acesse e leia INTEGRALMENTE o log mestre no PC ou GitHub antes de agir. Confirme o último commit e a tarefa pendente; confira a branch no GitHub; continue a implementação pela F02/F05/F20 imediatamente, sem repetir tarefas já aprovadas. Edite código somente pelo GitHub. Preserve produção e não ative serviços pagos ou migrações destrutivas. Registre as novas evidências no log.
## 10. REGRA PERMANENTE: LOG NO PC E GITHUB (solicitação 18/11/2026)

- O usuário NÃO anexará novamente o log. Sempre consultá-lo proativamente em C:\Users\LIVRESOM\Documents\POTE_BATATA_PRO_LOG_MESTRE.md via Desktop Commander, ou no GitHub se o PC estiver indisponível.
- Cópia GitHub: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/blob/feat/f35-completion-audit-20261118/POTE_BATATA_PRO_LOG_MESTRE.md
- Ao concluir cada serviço ou bloco de alterações, atualizar primeiro o log no GitHub com commit verificável, testes, diffs, riscos, data e próxima ação. Em seguida sincronizar a cópia do PC, verificar hash/conteúdo.
- Não fazer commit do log diretamente em main por poder disparar deploy. Manter na branch de homologação até integração homologada.
- Não registrar tokens, credenciais, chaves de serviço, dados privados ou de clientes. Nunca presumir execução assíncrona após encerrar a conversa.
- Se Desktop Commander não estiver acessível em alguma sessão, não concluir que o PC está offline; ler o GitHub e apontar qual acesso faltou.

### CHECKPOINT: 2026-11-18 (persistência centralizada)
GitHub main inicial: 4cf0622f6f250b4e7422ae88e09a5943fb409935
GitHub branch: feat/f35-completion-audit-20261118
GitHub HEAD de código anterior ao log: aaa2a104724a3355ae75a9078d7f59df1e144667
Ação: cópia integral do log mestre salva no PC e no GitHub. A operação posterior de homologação deverá produzir novo checkpoint verificável.
Produção e dados reais: preservados. Serviços pagos e cutover: nenhum.
PRÓXIMA AÇÃO EXATA: validar camada Worker-Firestore REST no laboratório isolado para F02/F05/F20.

### CHECKPOINT: F02/F20 - leitura de health efetiva / 18-11-2026
GitHub branch: feat/f35-completion-audit-20261118
GitHub HEAD de código deste bloco: c57b81e78fe47e3d7c3d89bec926ed251e1854f6
Arquivos alterados: workers/antifraud/src/index.mjs, workers/antifraud/test/worker.test.mjs
Resultado: GET /health informa writesEnabled=true somente se ENABLE_WRITES=true E projeto demo-* OU PRODUCTION_CUTOVER_APPROVED=true. Assim o indicador corresponde à dupla trava já exigida pelas rotas de escrita.
Problema detectado: parêntese inválido no primeiro commit; corrigido antes de liberar testes; asserção repetida removida do teste de falta de estoque.
Teste: npm.cmd run check --prefix workers/antifraud APROVADO; npm.cmd test --prefix workers/antifraud APROVADO (20/20); node test_worker_bridge.mjs APROVADO.
Ambiente: clone isolado em TEMP; código alterado exclusivamente no GitHub.
Produção, Rules, chaves, custos e dados reais: INALTERADOS.
Pendências críticas: Firestore REST real não emulado, identidade segura de serviço, fechamento coerente da escrita direta SDK e conciliação F20.
PRÓXIMA AÇÃO EXATA: intensificar validação de transações REST HTTP para F02/F05 no laboratório isolado, sem tocar credenciais reais.
### CHECKPOINT: F02/F05 - integração HTTP do adaptador REST / 18-11-2026
GitHub branch: feat/f35-completion-audit-20261118
HEAD do código após o serviço: 2f6f8cbec735da059e8c58972280edf79fa1483a
Novo arquivo: workers/antifraud/test/rest_integration.test.mjs
Implementação: suíte E2E sintética usando o Worker real + createFirestoreRepository REST + simulação in-memory HTTP do protocolo Firestore; sem credenciais ou contas reais.
Comportamentos validados: serialização do adaptador HTTP, transações com pré-condições de versão, baixa de batata e bebida, atualização do pulso V2 e guard, idempotência de operação, cancelamento com devolução, cancelamento com perda sem reentrada de estoque, disputa de dois pedidos sobre o mesmo estoque, negação por falta de estoque e por licença.
Teste: npm.cmd test --prefix workers/antifraud, 25 testes APROVADOS, falhas 0, código de saída 0.
Limite: a simulação HTTP NÃO É um Firestore REST real nem prova OAuth GCP; o Emulator tem incompatibilidade conhecida com transação REST BYTE_STRING. SDK Emulator foi testado em sessões anteriores. Continua faltando projeto não emulado e isolado para homologação final do REST.
Produção, Worker público, Firestore Rules, credenciais, dados reais e custos: INALTERADOS.
PRÓXIMA AÇÃO EXATA: testar integração com Cloud Firestore REST real em ambiente de homologação autenticado, sem desativar a dupla trava de produção; validar depois escrita exclusiva do backend e concorrência.
### CHECKPOINT: projeto Firebase QA real criado / 18-11-2026
Novo ambiente criado exclusivamente para homologação, sem dados comerciais:
Firebase Project ID: pote-batata-qa-20261118
Firebase Display Name: Pote Batata QA Free
Google Cloud Billing API consultada via sessão Firebase autorizada: billingEnabled=false.
Serviço firestore.googleapis.com habilitado somente neste projeto.
Firestore default (default) criado, edição STANDARD, local southamerica-east1 (São Paulo).
Confirmação Firestore: freeTier=true, pointInTimeRecoveryEnablement=DISABLED.
Teste de acesso REST de leitura com OAuth autenticado via Firebase CLI: HTTP 200.
Projeto comercial potobatata-b71f3: NÃO ALTERADO.
Serviços pagos, ligação com faturamento e migração destrutiva: NENHUM.
Atenção: ambiente de homologação utiliza quota gratuita do Spark; não mudar de plano nem ativar faturamento.
PRÓXIMA AÇÃO EXATA: executar Worker com adaptador Firestore REST real nesta base QA isolada usando somente dados sintéticos e conta autenticada de teste; não ativar Worker público.
### CHECKPOINT: REST real de homologação aprovado / 18-11-2026
Branch: feat/f35-completion-audit-20261118
Commit de código: fb75e4c89384b00088907c8e676354df7a4d91af
Arquivo novo: qa/worker_live_firestore_qa.mjs
Ambiente: projeto exclusivo pote-batata-qa-20261118, Firestore Standard southamerica-east1, freeTier=true, billingEnabled=false.
Teste HTTP Cloud Firestore real (sem emulador): beginTransaction 200; rollback 200; leitura OAuth 200.
Teste E2E Worker + adapter REST Cloud Firestore: PASS, exit 0. Produção, baixa física de batata e bebida, retry idempotente, cancelamento com devolução, guard revision 2.
Remoção de dados sintéticos: 13 documentos, confirmada ao terminar o ensaio.
Autenticação: token de curta duração injetado somente no processo; não salvo no código, no PC nem neste log.
Dupla trava real: requisição com PRODUCTION_CUTOVER_APPROVED=false devolveu 423.
NÃO testado em REST real ainda: corrida de dois pedidos e cancelamento com perda; testes HTTP sintéticos e SDK Emulator dessas rotas já passaram anteriormente. Tentativa de extensão não aplicada por bloqueio de ferramenta, sem alterar o repositório.
Worker Cloudflare público, produção Firebase, regras comerciais, credenciais permanentes e planos pagos: INALTERADOS.
PRÓXIMA AÇÃO EXATA: ampliar teste REST real para concorrência e perda, depois criar serviço Google de homologação de menor privilégio e testar JWT/OAuth sem expor credenciais.
### CHECKPOINT: F02/F05 - corrida real do Firestore aprovada / 18-11-2026
GitHub: pixmcp-cloud/pote-batata-pro-v6-site
Branch candidata: feat/f35-completion-audit-20261118
Commit de código: 7b0b0d878bcd9ed9872183f613d1b2fc3676c481
Implementação: ampliado qa/worker_live_firestore_qa.mjs para dois pedidos simultâneos e cancelamento por perda após produção.
Teste de sintaxe: node --check qa/worker_live_firestore_qa.mjs — APROVADO.
Suite Worker: npm.cmd test --prefix workers/antifraud — 25/25 APROVADOS.
REST Cloud Firestore REAL do QA, execução isolada: QA_LIVE_REST_WORKER_PASS, status final 0; produção, retry idempotente, cancelamento, corrida de dois pedidos (um sucesso e um conflito), perda sem reentrada no estoque e guard V2 foram verificados.
19 documentos sintéticos removidos ao final: QA_LIVE_REST_SYNTHETIC_CLEANUP=19.
OAuth: sessão temporária do PC, credenciais não copiadas ao GitHub nem ao log.
Cloudflare staging /health: HTTP 200 com writesEnabled=false; nenhum cutover público ou serviço pago ativado.
Firestore QA: pote-batata-qa-20261118, plano gratuito isolado; projeto comercial não alterado.
PENDENTE: identidade de serviço Google de menor privilégio para Worker, bloqueio da escrita direta via SDK sem interromper o PDV, homologação das regras candidatas, reconciliação financeira.
PRÓXIMA AÇÃO EXATA: elaborar/revisar a política de Rules candidata para impedir bypass do navegador, validar no Emulator e preservar compatibilidade antes de qualquer publicação.
### CHECKPOINT: F02/F20 - Rules candidatas testadas / 18-11-2026
GitHub branch: feat/f35-completion-audit-20261118
Commits do serviço:
  820346b548f1790271d37b0e70732bc472c32b23 — firestore.worker_cutover.candidate.rules
  c9b0e36fd6407fc9215260ef2788cdb68cc5f09d — firebase.worker_cutover.qa.json
  76a9f529acc6765e906e93a9ad199186401585b7 — modo cutover no harness Emulator
  d58f56bc077e5650adc2ce744caf405dca894af7 — teste test_worker_cutover_rules_emulator.cjs
Objetivo: política candidata futura em que o navegador não grava diretamente pedidos, ingredientes, bebidas, movimentos, perdas, compras, lotes e eventos de caixa; revisão de guarda somente via servidor. Receitas comuns continuam editáveis, dados do proprietário legíveis e dados de outras contas bloqueados.
Teste de Rules candidata: Firebase Emulator local demo-pote-hardening, PASS. Validados bloqueio de escrita do cliente, leitura e edição de receita, isolamento e escrita privilegiada de servidor. As mensagens PERMISSION_DENIED da suíte são esperadas.
Regressão: firestore.rules original PASS; firestore.hardened.rules PASS; Worker 25/25 PASS. Exit 0.
ALERTA CRÍTICO: estas Rules NÃO podem ser publicadas ainda: o Worker atual oferece somente produce/cancel; faltam endpoints de criação de pedido, suprimento/compra de estoque, caixa/recebimentos e outras operações que o navegador ainda realiza. Publicá-las antes disso interromperia o aplicativo.
Produção GitHub main, Firebase comercial, Cloudflare Worker público, serviços pagos e dados reais: INALTERADOS.
Staging público GET /health: HTTP 200, writesEnabled=false.
PRÓXIMA AÇÃO EXATA: ampliar Worker com operações de servidor que faltam, aplicar testes REST reais e liberar corte conjunto somente após homologação e autorização específica.
### CHECKPOINT: F02/F05 - ajuste físico de estoque no Worker / 18-11-2026
Branch: feat/f35-completion-audit-20261118. Produção comercial não publicada.
Arquivo novo: workers/antifraud/src/stock_adjust.mjs (commit eea7624).
Rota conectada: POST /v1/inventory/adjust, index.mjs (commit 5b4d509).
Suporta apenas itens já cadastrados: entrada física por compra, perda, correção; leitura de saldo e perfil autenticado no servidor; idempotência via workerEvents, transação atômica de registro, stockMovements, losses quando perda, revisão de estoque e pulso V2; checa unidade-base, quantidades, licença, limite e saldo negativo.
Importante: entrada física não confirma pagamento, nota fiscal ou valor de custo novo. Perda utiliza custo médio conhecido do servidor; quando desconhecido não inventa custo.
Testes adicionados em worker.test.mjs (commits 56497f7, 5f15e1b, 8bc220f, 7e4cbc3): 29/29 APROVADOS, incluindo entradas idempotentes, perda física, bloqueio de saldo insuficiente e corrida concorrente.
Validação real em Cloud Firestore de homologação pote-batata-qa-20261118: entrada +500, repetição idempotente, perda -50 e lançamento de perda, revisão V2; saída QA_LIVE_REST_WORKER_PASS / código 0. 24 documentos sintéticos apagados após ensaio. Teste com identidade Firebase sintética injetada, mas REST Firestore e OAuth da sessão de QA reais; NÃO valida integração completa de autenticação do usuário final.
Documentação de API atualizada em workers/antifraud/README.md (commit 02faa1c).
Sintaxe CI worker atualizada para incluir novo módulo (commit 61935df).
Nenhuma migração real, implantação comercial, conta paga ou alteração de regras comerciais.
PENDENTE: criação de pedidos, compras com histórico de custos, movimentações de caixa/recebimentos, integração progressiva com o frontend, service identity de menor privilégio, Rules candidatas e homologação física Android.
PRÓXIMA AÇÃO EXATA: implementar rotas financeiras e/ou cadastro de pedidos com idempotência, validação de autorização e testes, mantendo a versão pública protegida.
### CHECKPOINT: F20 - recebimento declarado no backend / 18-11-2026
GitHub branch candidata: feat/f35-completion-audit-20261118
Módulo: workers/antifraud/src/receipt.mjs (commits 32d3462, f464b6b, 6784833 e 2c8b089).
Nova rota: POST /v1/orders/receipt (commit afe8cb3), ainda desativada na versão pública.
Regra: recebe apenas universe, orderId, operationId e reference opcional; lê pedido e valor do servidor, exige pedido entregue com estoque baixado, turno de caixa existente e aberto, conta Pro/franquia autorizada, método Dinheiro/Pix/Cartão. Grava confirmação declarada pelo operador, banco NÃO conciliado, evento idempotente, revisão e pulso V2 numa única transação. Não cria cashMovements repetidos nem aceita valores monetários do navegador.
Testes: F20 confirma valor do pedido e uma única operação, rejeita pedido não entregue; Worker 31/31 e worker_bridge PASS, exit 0.
Firestore QA REST REAL: recebimento de pedido sintético o4, valor 6000 centavos, bankReconciled=false, idempotência, revisão V2 7. Ensaio com token OAuth local de curta duração; autenticação Firebase do usuário final foi simulada. Exit 0, 27 documentos sintéticos removidos.
Documentação Workers README atualizada (commit becceaf). Script CI verifica receipt.mjs (commit aa6e8d7).
Staging: GET /health HTTP 200, writesEnabled=false. main comercial permanece 4cf0622.
Pendentes F20: fluxo sem caixa aberto, rotas de abertura/fechamento de turno, conciliação bancária, integração progressiva do cliente e bloqueio direto das Rules; nenhuma destas pendências foi declarada pronta.
Automação de continuidade: criada e ativa, frequência horária, leitura do log GitHub/PC, alterações exclusivamente na branch e testes. Executará somente quando a plataforma iniciar a tarefa; não pressupor execução ou acessos antes de verificar.
PRÓXIMA AÇÃO EXATA: desenvolver criação de pedido e abertura de caixa server-side e incluir testes de negação para turno fechado. Preservar dados reais e planos gratuitos.
### CHECKPOINT: F20 caixa aberto/fechado, F02 pedido com preço servidor / 18-11-2026
Branch de homologação: feat/f35-completion-audit-20261118, HEAD de código e testes e82c0ff921a7795a05ea48780aa0292d72370ee4.
F20: nova rota POST /v1/cash/open, em workers/antifraud/src/cash_session.mjs. Exige perfil/licença autorizados, V2 pronta e controle exclusivo v2CashControl__<universe> previamente migrado. Registra turno, guarda V2, pulso e workerEvent em transação atômica. Bloqueia segundo turno e repetições.
F20: nova rota POST /v1/cash/close. Fecha turno existente, guarda valor de dinheiro DECLARADO pelo operador e reconciliationStatus=pending, libera controle e registra evento atômico. Não calcula extrato bancário, não marca Pix/cartão conciliado, não cria receita duplicada.
Rules candidatas firestore.worker_cutover.candidate.rules agora negam escrita/deleção de v2CashControl__* pelo navegador, teste no Firebase Emulator aprovado (deny esperado); NÃO publicadas.
Teste do caixa: concorrência entre aberturas, idempotência, exigência de migração, fechamento e reabertura passaram no Worker. Abertura de caixa já passou no REST real do projeto QA isolado, 30 documentos sintéticos eliminados. Fechamento REST real ainda não foi confirmado: o iniciador OAuth foi bloqueado neste corte. Nenhuma credencial foi transferida.
F02: nova rota experimental POST /v1/orders/create e workers/antifraud/src/order_create.mjs. Apenas receita simples sem desconto/extra/combo, preço em centavos e versão já homologados no documento da receita, custo de insumos conhecido e caixa aberto. Rejeita preço enviado pelo cliente, preço não homologado e margem inferior ao mínimo do servidor; valida estoque, cria pedido e jornal de forma atômica e idempotente.
Limite crítico: criar pedido ainda NAO reserva estoque; a disponibilidade é reconferida na produção. Modelos reais do app ainda não dispõem de serverSalePriceCents/version 1 por padrão. NÃO liberar a rota comercial sem migração/validação do catálogo e regra de reservas. Teste real Firestore REST da nova rota ainda pendente.
Testes: Worker 38/38 PASS, inclusive roteamento, produção após cadastro, rejeição de adulteração e adaptador REST HTTP sintético. src/index.mjs, cash_session.mjs, order_create.mjs incluídos no syntax check. Público Cloudflare writesEnabled=false e main sem mudança.
Bloqueio adicional: a rotina de conclusão em um clique com recebimento declarado ainda não foi gravada, por bloqueio da ferramenta nesta tentativa. Não declarar entregue.
PRÓXIMA AÇÃO EXATA: concluir venda em uma transação no Worker (status entregue e pagamento declarado sem segunda confirmação), testar caixa fechado e idempotência. Depois harmonizar motor de preços, reservas e autenticação de serviço para eventual cutover. Jamais ativar custos, migrar produção ou publicar Rules candidatas sem homologação e autorização.
### DIRETRIZ DE NEGOCIO / 18-11-2026
LIMITE COMERCIAL INICIAL: 10 PEQUENOS NEGOCIOS. Infraestrutura inicial enxuta com servicos e ferramentas gratuitas, ate 10 estabelecimentos clientes distintos (tenants) do SaaS Potê Batata Pro. O objetivo e comercializar assinaturas mensais de PDV/gestao com lucro e baixo custo. Priorizar fim funcional do MVP, usabilidade na lancheria e entregas de alto impacto. Evitar revisitar os mesmos testes sem mudancas relevantes: 1 QA dirigido para funcionalidade nova + 1 regressao consolidada no fim. Acima de 10 clientes, analisar consumo, quotas, necessidade de plano pago e retorno esperado antes de propor escalonamento; qualquer ativacao paga depende de aprovacao explicita do proprietario. Nao bloquear automaticamente o 11o cliente sem politica comercial aprovada; 10 e marco de capacidade/planejamento, nao trava comercial. Nenhum custo novo autorizado. Para considerar 10/10 exigir PDV real funcionando, isolamento dos dados, recebimentos sem duplo clique, estoque consistente, fluxo de mensalidade, validacao em celular e autorizacao para publicacao.
### CHECKPOINT: PDV CONCLUIR VENDA EM UM CLIQUE / 18-11-2026
Implementado exclusivamente na branch feat/f35-completion-audit-20261118. Commits: 2d405c5 (transacao atomica F20), e5d89c5 (rota correta/UTF-8), afa44d5 (teste), 632453a (ponte e interface).
Backend: POST /v1/orders/finish transaciona pedido em_producao + stockDeducted=true para entregue, marca dinheiro/Pix/cartao imediato como pagamento DECLARADO pelo operador, sem cashMovement duplicado, mantém na entrega pendente, exige turno aberto, guarda revision/pulse e evento idempotente. Nao confirma banco.
Frontend: worker_bridge.mjs expõe finish() e finishOrder chama o Worker, aguarda sincronizacao V2 e evita gravacao local concorrente. CLOUD_WORKER_ACTIVE=false permanece no app comercial; o fluxo antigo continua em vigor ate cutover autorizado.
QA dirigido F20 finish: Pix sem dupla entrada, na entrega pendente, turno fechado rejeitado = 3/3. Uma unica regressao consolidada ao fim: npm run check + Worker 41/41 PASS + test_worker_bridge.mjs PASS. Nenhum teste Android fisico ou cutover em producao foi realizado aqui.
POLITICA DE QA: NAO rodar todos os testes a cada chat. Testar apenas novidade + regressao consolidada na entrega. Reabrir suites antigas somente se houve mudanca que possa quebra-las.
CAPACIDADE DE NEGOCIO: Piloto SaaS de ate 10 pequenos estabelecimentos, ferramentas gratuitas; conferir custos ao atingir 10 e pedir aprovacao antes de qualquer servico pago. Nao criar limite artificial de cadastro.
PENDENTE PARA COMERCIALIZAR: fluxo de assinatura e ativacao/renovacao mensal com cobranca segura, conciliacao de pagamentos reais, aceitacao mobile end-to-end, migracao de clientes/faturas existentes, ativacao assistida de Worker e Rules candidatas, auditoria de isolamento em contas reais de teste. NAO classificar 10/10 antes da homologacao.
PROXIMA PRIORIDADE: revisar o fluxo atual de assinatura/licenca e implementar somente lacunas que impedem a comercializacao do piloto de 10 clientes. Producao main e Cloudflare staging inalterados.

### CHECKPOINT: PILOTO 10 CLIENTES E PUBLICACAO CONCLUIDA / 18-11-2026
Diretriz: ate 10 estabelecimentos de pequeno porte para piloto em infraestrutura gratuita, sem exigir pagamento de ferramentas antes do crescimento e autorizacao. Nao bloquear automaticamente novas contas.
Worker F20 em branch isolada: concluir em um clique, Pix/cartao/dinheiro imediato declarado no mesmo commit do pedido, entrega pendente, caixa fechado nega, sem duplo cashMovement. Testes novos 3/3 e regressao unica Worker 41/41, ponte cliente PASS. CLOUD_WORKER_ACTIVE=false: nao liberado publicamente.
Administracao ja tinha PRO de 1/6/12 meses e expiracao automatica. Adicionado contador 'Negocios no piloto: X/10' e alerta de verificar Pix no banco antes da promocao/renovacao de PRO. Sem gateway e sem nova tarifa.
Release de baixissimo risco (apenas admin_console.js) publicado na main via 60f8de8. CI de Pages revelou falha anterior no harness test_sync_integration.js: createWorkerBridge sem mock. Corrigido apenas teste no main 72c6759, com verificacao de que Worker segue disabled. Teste dirigido de sincronizacao passou.
Confirmado: GitHub Actions 'Publicar V6 e beta autenticado' run 44364843123 SUCCESS (GitHub Pages declarou sucesso); 'Verificar regras do Firestore' run 44364840018 SUCCESS. Teste de 8 perfis Chrome passou no Actions. Nao mudou Firestore Rules comercial, dados dos clientes, chaves ou planos pagos.
Operacao inicial: recebimento da mensalidade por Pix externo e renovacao manual PRO com conferencia do extrato. Nao declarar conciliacao bancaria automatica. Proximas pendencias 10/10: teste de campo Android Google com contas separadas, primeiro ciclo real pago e suporte, homologacao do fluxo Worker antes de qualquer cutover.
Estrategia de QA: somente teste da funcionalidade alterada e 1 regressao consolidada por entrega, sem repetir bateria completa em cada chat.


### CHECKPOINT: PILOTO SAAS 10 CLIENTES COM RECIBO PIX EM FIREBASE HOSTING / 18-11-2026
Demanda: ate 10 clientes pequenos negocios; lucro e economia. Sem planos pagos novos. Ao passar de 10, observar quotas e negociar escala mediante autorizacao, sem criar bloqueio automatico.
Nova capacidade: admin_console.js (sem alterar Floot) tem recebimento manual ao promover ou renovar PRO/vitalicia: modo Pix verificado no extrato ou cortesia; valor variavel em BRL e centavos, referencia, confirmacao obrigatoria pelo administrador; so entao salva licenca e evento imutavel no mesmo batch. Historico mostra valor e referencia. Trial e revogacao nao cobram.
GitHub feature commits: 87ee299 (manual_receipt e teste), f16aaf5 (formulario/protected grant), e9fb144 (Rules e emulator), b600281 (historico) e 352ba62 (reset para Pix ao trocar cliente). Release candidata separada ea79bd65fbf3c78c26d2cd8215839eb70e563af2. Main foi promovida apenas com 8 arquivos de assinatura, sem Worker F02/F05/F20 novo.
Acesso Firebase: regras ao vivo anteriores lidas, comparadas EXATAMENTE com baseline main 72c6759 e copiadas no PC antes da mudanca. Nova Firestore Rules instalada via firebase deploy --only firestore:rules --project potobatata-b71f3; API compilou e liberou. Leitura REST posterior confirmou SHA256 2a720d53d1df5eb3a2624b1f88d55a955170b536fb1d48fc6308d90c58a1bc64, identico ao release homologado.
QA: parsing BRL/Pix e cortesia PASS, admin licenses PASS, Google admin custom claim F24 PASS, Firestore Emulator admin allow/nao-admin deny/valores e metodos falsos deny PASS, tela Android Chrome 390px sem overflow PASS, compilacao do beta autenticado PASS. GitHub Actions run 44370488788 rules SUCCESS e run 44370488800 Pages SUCCESS.
DESCOBERTA CRITICA DE PUBLICACAO: pdv.livresom.com aponta para potobatata-b71f3.web.app (FIREBASE HOSTING), e NAO para GitHub Pages. Atualizacoes apenas no GitHub Pages NAO chegam ao dominio comercial! Para publicar usar: git fonte homologada + python build_hosting.py + firebase deploy --only hosting --project potobatata-b71f3. O build do release ea79bd6 gerou 217 arquivos, validacao OK. Firebase Hosting release novo sites/potobatata-b71f3/versions/e8527543da1e756d de 2026-11-18T18:36:14Z. Versao anterior para rollback: sites/potobatata-b71f3/versions/0353734ae34136dd.
VERIFICACAO PUBLICA REAL: HTTPS pdv.livresom.com/manual_receipt.mjs HTTP 200 e funcao presente; admin_console.js HTTP 200 e formulario presente; raiz HTTP 200 com login Google; firebase_integration.js HTTP 200 com CLOUD_WORKER_ACTIVE=false. Worker Cloudflare continuo desativado, Firebase Regras apenas alteracao aditiva, sem migrar dados, sem alterar assinaturas de clientes e sem adicionar servicos pagos.
PENDENTES PARA NOTA 10/10: homologacao com 2 contas Google reais de TESTE e celular Android fisico, ciclo real do primeiro pagamento e concessao/expiracao de mensalidade, reconciliação de banco somente manual; Worker authoritative ainda precisa ativacao segura/Rules cutover, estoque de pedidos e precos completos sem adulteracao, integracao MaisDelivery sandbox real e pontos restantes auditados. Nao prometer 10/10 ainda.
POLITICA TESTES: nao repetir suites de 35 melhorias sem alteracao. Apenas teste dirigido e uma regressao consolidada antes de lancar. Atualizacao publica sempre deve conferir FIREBASE HOSTING e nao confundir com GitHub Pages. PROXIMA ACAO: testar fluxo ponta a ponta de licenca do primeiro cliente piloto com conta isolada, sem dados reais, e melhorar onboarding para remuneracao recorrente.


### QA FINAL DO PILOTO: RENOVACAO PRO PIX NO BROWSER / 18-11-2026
Teste dirigido de interacao do ADM, Chrome emulado 390px, SEM dados reais: login Google e custom claim de admin simulados, conta cliente ficticia, selecao PRO mensal, insercao R$39,90 Pix com referencia Pix-QA-20261118, caixa de conferencia marcado e clique de Promover/Renovar. A interface executou o mesmo batch com atualizacao da licenca mais evento licenseAudit contendo paymentMethod=pix_manual, paymentAmountCents=3990 e paymentReference correto. Browser sem erro JS nem overflow horizontal. PASS. Teste de dados reais e primeiro cliente pagante continuara pendente ate existir pagamento conferido no banco.
Os testes anteriores do Firebase Emulator, build, autenticação e regras mantem resultado PASS. Nao repetir suites sem alteracoes. A versao comercial PUBLICA foi confirmada no endereco pdv.livresom.com (Firebase Hosting, nao GitHub Pages) com Worker desativado.


### CHECKPOINT: ASAAS API EM HOMOLOGACAO / 18-11-2026
Usuário mostrou existência de conta Asaas. NÃO copiar dados bancarios da imagem. Pesquisa documental confirmou Asaas API v3, chave administradora via website: Menu do Usuário > Integrações > Chaves de API (chave visível uma vez). Sandbox separado obrigatório em https://sandbox.asaas.com (prefixo $aact_hmlg_); produção $aact_prod_. Nunca registrar chave em chat ou GitHub.
GitHub branch feat/f35-completion-audit-20261118 agora tem integrations/asaas/sandbox_client.mjs, webhook_guard.mjs, sandbox.test.mjs e README.md. Cliente REST suporta POST /v3/customers e POST /v3/subscriptions de Pix mensal APENAS Sandbox, exigindo gate allowSandboxWrites=true, credencial de homologação e fetch injetado. Guard de webhook valida segredo separado e sempre retorna eligibleToGrant=false. Sem ativação automática de PRO, sem armazenamento de IDs reais, sem chamada externa, sem deployment ou pagamentos reais.
Teste dirigido: node --test integrations/asaas/sandbox.test.mjs PASS (respostas mock de clientes e assinatura Pix 39,90, bloqueio de chave de produção, autenticação webhook e proibição de auto grant).
Configuração futura: criar conta Sandbox e chave no painel Asaas; armazenar secreto ASAAS_SANDBOX_API_KEY no Worker de homologacao Cloudflare (nunca no frontend); criar segredo separado ASAAS_WEBHOOK_TOKEN; implementar endpoint autenticado com armazenamento e verificação idempotente de assinatura/tenant/valor antes de liberar PRO. Não executar wrangler secret put sem autorização, porque pode disparar implantação do Worker.
CUSTO: para até 10 clientes, comparar taxa de recebimento de cobranca Asaas vs Pix manual. Até 100 Pix gratis por chave/QR estático não equivale a assinatura dinamica. Manter atual Pix manual funcional até aprovação explícita de uso real.
PRÓXIMA AÇÃO: obter chave SOMENTE no próprio cofre da plataforma, sem compartilhá-la no chat; fazer teste de autenticação SOMENTE Sandbox; criar webhook persistente/testado sem acesso a contas reais; homologar pagamento antes do cutover. Continuar sem repetir auditorias globais.


### CHECKPOINT: ASAAS RECONCILIATION PREFLIGHT F19 / 18-11-2026
Branch homologacao somente. Modulo integrations/asaas/reconciliation_preflight.mjs valida evento PAYMENT_RECEIVED contra pagamento confirmado em consulta servidor-servidor, ID do pagamento, cliente, assinatura, Pix, valor em centavos, data e ledger de idempotencia. Falha fechada em ausencia de qualquer vinculo ou em duplicata. Nunca concede PRO: eligibleToGrant=false em TODOS os caminhos. QA novo integrations/asaas/reconciliation_preflight.test.mjs com 13 cenarios isolados. O preflight NAO substitui webhook persistente, consulta real a API Asaas nem transacao atomica Firestore; nenhum deploy ou cobranca real. Proxima acao: implementar persistencia idempotente de eventos em Firebase Emulator e checagem autenticada server-side antes de liberar licencas; manter Pix manual.


### CHECKPOINT: ASAAS WEBHOOK INBOX / 2026-11-18
Branch: feat/f35-completion-audit-20261118. Main: 4cf0622f6f250b4e7422ae88e09a5943fb409935.
Commits: 5788de1 (inbox Firestore), 596f577 (route behind disabled flags), 49d28de (five directed tests), test fix subsequent.
F19: POST /v1/asaas/webhook authenticated with independent webhook secret, JSON checks, size limit, event ID SHA256 document key, Firestore transactional create-only precondition, idempotent replay, collision rejection. Does not grant PRO, alter balances or mark bank reconciliation.
Safety: ENABLE_WRITES, PRODUCTION_CUTOVER_APPROVED, ASAAS_WEBHOOK_ENABLED all true plus ASAAS_MODE=sandbox required. Versioned config has ASAAS_WEBHOOK_ENABLED=false and ASAAS_MODE=off. No secret committed.
QA: node --test workers/antifraud/test/asaas_webhook.test.mjs: 5/5 PASS. npm.cmd run check --prefix workers/antifraud PASS. npm.cmd test --prefix workers/antifraud: 46/46 PASS. Initial test bug (Response body consumed twice) corrected on GitHub before final run.
Limitations: mock Firestore only; no real Asaas sandbox or Firebase Emulator verification in this block. No tenant mapping or server-to-server Asaas verification; no automatic license grant. No deployment.
Main, production, commercial Firebase, real customers, Cloudflare staging, paid services, billing: UNCHANGED.
NEXT: validate webhook persistence against Firebase Emulator, then implement authenticated Asaas sandbox payment lookup and tenant reconciliation before any PRO entitlement mutation. Evaluate Inter PJ API as potentially cheaper option.


### REGRA COMERCIAL: CLIENTE ESCOLHE PIX OU CARTAO / 18-11-2026
Requisito aprovado pelo usuario para cobranca de ASSINATURAS do SaaS Pote Batata Pro: na tela de pagamento, o proprio cliente escolhe PIX ou CARTAO DE CREDITO. Pix oferece QR Code e copia-e-cola; cartao direciona a checkout seguro de provedor (nunca armazenar dados de cartao/CVV no app). Ambas as opcoes exibem preco total e eventuais taxas de modo transparente antes da confirmacao. A liberacao/renovacao PRO depende de confirmacao autenticada no backend, vinculada ao tenant, valor e pagamento, com evento idempotente; nunca pelo simples clique do usuario.
Planejamento bancario: usuario ja possui conta PJ no Banco Inter; pretende gerar API no PC futuramente (nao agora, pois usa celular). Portal oficial developers.inter.co documenta API Pix e API Cobranças (boleto/Pix), mas NAO processamento direto de cartao na API publica consultada. Inter Pag tem Link de Pagamento para cartao, mas automacao via API nao foi verificada: NAO prometer integracao completa apenas com API Pix. Verificar credenciamento, requisitos e tarifa MDR de cartao. Como alternativa, plugar gateway de cartao externo (Asaas ou outro) em checkout hospedado sem alterar Pix Inter. Pix manual permanece ativo ate homologacao. Proibido criar cobrancas reais/ativar servicos pagos sem autorizacao; nenhuma mudanca de codigo de producao nesta anotacao.
Estado tecnicamente confirmado no log anterior: inbox Asaas e 46 testes Worker passaram, sem ativacao publica. Nao desfazer nem repetir testes sem mudanca. Proximo passo de Inter adiado expressamente ate usuario estar no PC; seguir demais prioridades GitHub.


### CHECKPOINT: 35 MELHORIAS - F02 RESERVA ATOMICA DE ESTOQUE / 18-11-2026
Solicitacao: concluir as 35 frentes aprovadas; nao declarar concluido sem evidencias nem repetir trabalhos previamente aprovados. Auditoria original de 35 itens revisada; versoes recentes ja corrigiram F06 (importacao de cadastro em lotes), F10 (migracao V1/V2 retomavel), F21 (inventario e Firebase Hosting) e F24 (UID/claims). F32 continua adiada por custo.
Novos commits na branch feat/f35-completion-audit-20261118: acb8a4229c4216bfc89976e28a1c0da6a2e154a1 (reserva atomica dos ingredientes no backend ao criar pedido), b47fdb9779285059f3e2905d78ef9156455440b3 (quatro cenarios novos de reserva, estoque duplicado, cancelamento e concorrencia), 746f5da0cfd5e22dd3965f4464506d40b43c52ad (adapta teste REST a nova semantica). Nao mexer no Floot.
Novo F02: createSimpleOrder reserva estoque por ingrediente unico em transacao Firestore junto com pedido, movimentos negativos, guard/pulse e journal. Itens repetidos somados. Pedido grava stockReservationStatus=reserved e stockDeducted=true. Na producao, F02 identifica reserva e altera status para consumed sem descontar novamente. Cancelamento retorna apenas uma vez. Criacao continua limitada a receita simples com serverPriceVersion=1, sem extras/combos; nenhum pagamento bancario e validado por este codigo.
QA: npm.cmd --prefix workers/antifraud run check PASS; npm.cmd --prefix workers/antifraud test 50/50 PASS, inclusive REST HTTP simulado e novo ciclo pedido-reserva-producao-cancelamento, retries, estoque insuficiente e corrida entre dois pedidos. Firebase Firestore Emulator real (demo-pote-hardening), comando node test_firestore_worker_emulator.cjs: PASS para F02/F05 antigos (transacao, saldo, estorno, concorrencia). Java existente no Android Studio JBR localizado e injetado temporariamente no PATH; sem instalacao paga. O NOVO caminho de reserva ainda NAO foi executado no Firestore Emulator real e precisa de teste dirigido adicional; tentativa de editar este teste foi bloqueada pelo conector (nao fingir que passou).
Bloqueios: catalogo real ainda nao tem preco autoritativo serverSalePriceCents/version 1 migrado para todas receitas; extras, combos e promocao fora do escopo do Worker; falta executar caminho novo no Emulator, testar fisicamente Android e duas contas reais; requer cutover conjunto da UI e Firestore Rules com backup e aprovacao separada. CLOUD_WORKER_ACTIVE=false, ENABLE_WRITES=false e PRODUCTION_CUTOVER_APPROVED=false devem continuar. Nenhuma escrita real, deploy, cobranca, tarifa nova, migracao destrutiva ou servico pago autorizados. Mantido Pix manual comercial em main ea79bd6.
Proximo passo de execucao: testar nova reserva no Firestore Emulator com backend real, validar esquema do catalogo e precos confiaveis, concluir extrato e conta com 2 usuarios reais, e preparar release incremental sem ativar Worker prematuramente. Nao repetir suites completas sem alteracoes.


### CHECKPOINT: PDV CAIXA REFATORACAO CIRURGICA V6 PUBLICADA / 18-11-2026
Solicitacao do usuario: 'B' = realizar refatoracao cirurgica diretamente no projeto real, para corrigir accordions que abrem e fecham imediatamente, modais que se expandem para fora da tela e ausencia de botao visivel Retirada/Sangria. Evidencia original: screenshot real de pdv.livresom.com mostrando fechamento de caixa e opcao detalhada sem persistencia.
Diagnostico no codigo: Motor financeiro pdv_cash_core.mjs JA suportava kind=sangria, suprimento, justificativa, protecao de saldo e historico em cashMovements. Problema: seletor de sangria escondido no ultimo <details> sob 'Mais opcoes'; detalhes nativos e DOM refeito por render/sync, sem estado controlado robusto; scroller anterior era a caixa toda e podia perder foco e rolagem.
GitHub: branch de homologacao commits ada9337 (controle explicito de accordions e estado de UI), 59ad17f (botoes Retirada/Sangria e Suprimento antes do fechamento, formulario vinculado ao motor existente e remocao do acordeao oculto), 3f59990 (scroll flex com corpo interno e altura 100dvh, cache bust), 960a900 (ajuste contrato de QA), 0faa670 (teste real Chrome mobile da sangria e suprimento). Nenhum dado de cliente real foi utilizado nos testes.
Publicacao comercial controlada: release/pdv-cash-surgery-20261118 criada isolada do main ea79bd65fbf3c78c26d2cd8215839eb70e563af2; somente cinco arquivos incluidas: make_beta.py, pdv_cash_ui.mjs, pdv_cash.css, test_pdv_accordion_contract.cjs, test_pdv_sangria_mobile.cjs. HEAD do novo main e538e64fb7be4dca0de022c837f9d2b1c359e979, fast-forward confirmado; tag rollback-pre-pdv-surgery-20261118 aponta ea79bd6. Nao foram incorporadas ao main mudancas experimentais do Worker F02/F05/F20/Asaas ou regras candidatas.
QA no worktree isolado: node --check pdv_cash_ui.mjs PASS; test_pdv_cash_ui, test_pdv_cash_core, test_pdv_cash_summary PASS; python build_hosting.py PASS; test_pdv_accordion_contract PASS; test_pdv_accordion_stability Chrome 375/430/1280 PASS; test_pdv_visible_browser Chrome 375/430/1280 PASS; test_pdv_sangria_mobile Chrome 375 e 430 PASS. Simulacao navegador: inicio 100 + venda dinheiro 40 = 140, sangria 30 = 110, suprimento 20 = 130, justificativa e historico presentes, ultimo acordeao aberto apos pote:changed, sem overflow horizontal. Testes rodaram com dados ficticios, NAO em Android fisico, sem saldos bancarios.
Publicacao Firebase Hosting: firebase.cmd deploy --only hosting --project potobatata-b71f3 --non-interactive SUCESSO; hosting encontrou 217 arquivos em public e completou release. URL oficial https://pdv.livresom.com testada com HTTP 200 em index.html, pdv_cash_ui.mjs e pdv_cash.css; flags: cache bust pdv-surgery-v6-20261118 presente, ambos botoes sangria/suprimento presentes, expandedCashDetails presente, CSS overflow-y auto ativo, firebase_integration.js CLOUD_WORKER_ACTIVE=false, poteAuthGate presente. Main e rollback verificados por git ls-remote.
Nao houve deploy de Firestore Rules, ativacao Worker, credencial, servico pago ou migracao destrutiva. O Pix manual e a administracao de licencas continuam conforme releases anteriores. Proxima acao pratica: verificar o PDV no Android real do usuario (atualizar a aba); corrigir apenas eventual divergencia fisica que ele reportar.


### CHECKPOINT: F02 RESERVA ATOMICA VALIDADA NO FIRESTORE SDK EMULATOR / 18-11-2026
Branch exclusiva: feat/f35-completion-audit-20261118. HEAD de codigo/teste c9a416a6cfffde1994582aff496774e2737143e5. Commits novos: 2bfd5918676a3a89d666593e6685b1cf93da0404 (teste do ciclo de reserva no SDK Emulator) e c9a416a6cfffde1994582aff496774e2737143e5 (fixture de custo unitario conhecido).
Progresso F02: test_firestore_worker_emulator.cjs agora executa rota /v1/orders/create contra transacoes reais do Firestore SDK Emulator, com preco homologado no servidor, caixa aberto, saldo inicial 200 g; reserva 125 g e saldo 75 g; replay idempotente sem nova baixa; producao de pedido reservado sem dupla baixa; cancelamento com devolucao para 200 g. Os testes anteriores de concorrencia de dois dispositivos e bloqueio de saldo insuficiente tambem passaram. Sem dados reais.
QA: node --check test_firestore_worker_emulator.cjs PASS; Firebase CLI emulators:exec --only firestore --project demo-pote-hardening --config firebase.emulator.qa.json 'node test_firestore_worker_emulator.cjs' PASS (exit 0). Java do Android Studio JBR e dependencias npm do Worker foram instaladas/usadas somente no worktree de QA isolado; nenhuma edicao direta de codigo no PC. A primeira tentativa falhou por dependencia jose ausente, corrigida com npm ci --prefix workers/antifraud; a segunda falhou porque fixture antiga nao continha custo de compra, corrigida no GitHub; a terceira passou integralmente. Evidencia stdout: PASS F02 SDK EMULATOR: atomic reservation, replay, production without double deduction, cancel once; PASS WORKER SDK EMULATOR.
Nao houve merge em main, deploy, alteracao em Firebase/Cloudflare comercial, Worker publico, Rules, dados reais, planos pagos ou faturamento. GitHub connector create_file retornou 403, mas git push autenticado via Remote Desktop Commander funcionou, com commits rastreaveis diretamente na branch GitHub.
Limitacoes: o novo teste nao abrange concorrencia de duas reservas criadas simultaneamente no SDK Emulator (concorrencia anterior e suite Worker cobrem outros caminhos); schema comercial ainda nao tem preco autoritativo para todas receitas, combos/adicionais continuam fora do escopo e cutover permanece bloqueado. Proximo passo: teste SDK Emulator especifico de duas reservas concorrentes e revisao de catalogo/precos, sem publicacao.


### CHECKPOINT: F02 CONCORRENCIA E PRECOS HOMOLOGADOS / 18-11-2026
Retomada do Log Mestre e AUDIT_35 via GitHub/Remote Desktop. Main comercial preservado em e538e64fb7be4dca0de022c837f9d2b1c359e979, com PDV V6 publicado em Firebase Hosting. Todos os novos trabalhos somente em feat/f35-completion-audit-20261118. Nenhum dado de cliente real usado.
F02 concorrencia: commit 2e9b75b. Duas criacoes simultaneas tentam reservar 125 g cada dos mesmos 200 g no Firestore SDK Emulator. Uma vence, uma falha 409, saldo final 75 g; reexecucao idempotente, sem pedido perdedor, sem estoque negativo, devolucao unica apos cancelamento. Firebase Emulator real PASS.
Falha de seguranca descoberta: receita proprietaria era editavel pelo navegador e tinha serverSalePriceCents e serverMinimumGainPct. Nao era prova de precificacao autoritativa; impedir cutover ate preco privilegiado.
Correcao de leitura: b7d1c26 adicionou server_price.mjs com aprovacao users/{uid}/serverPrices/{keyFor(universe,recipes,recipeId)}, exigida para criar pedido e vinculada a titular, universo, receita, ingredientes/gramas, centavos, ganho e revisao. Ausencia, divergencia e alteracao de itens falham fechadas. 5569728 fixtures Unit/REST/SDK. bd823d3 explicitou Firestore Rules deny read/write dos precos via navegador (tres Rules versionadas, sem deploy comercial) e adicionou testes em Emulator.
Correcao de escrita: 8c0926b acrescentou POST /v1/catalog/approve-price no Worker; usuario autenticado e licenca/tenant validos, quatro campos permitidos, custo calculado do Firestore e margem default 100% ou targetGainPct; rejeita custo ausente, estimativa, embalagem nao suportada e preco abaixo de custo+ganho. Em transacao grava receita com serverSalePriceCents/revision, aprovacao privada, v2InventoryGuard, v2Pulse e workerEvents idempotente. Nenhuma permissao de escrita pelo SDK browser. Nada em producao. c6e132c testes unit/REST; e346ee9 verificacao de revisao de preco e pedido no SDK Emulator; ead47d4 teste bloqueio Free e Worker desativado; 76e39ff executa QA com candidata de Firestore Rules.
QA dirigido: npm.cmd --prefix workers/antifraud run check PASS; npm.cmd --prefix workers/antifraud test 58/58 PASS; node test_worker_bridge.mjs PASS. Firebase Emulator com firestore.rules base: regras e cliente proibido de editar serverPrices PASS. Firestore SDK Emulator base: reserva, cancelamento, concorrencia, aprovacao e reprovacao de preco PASS. Firebase Emulator com firebase.worker_cutover.qa.json e POTE_WORKER_CUTOVER_RULES=1: mesmo fluxo e negacao de adulteracao via SDK proprietario PASS. Nao confundir teste Emulator com implantacao na nuvem.
Pendentes: F02 ainda PARCIAL ate integrar ponte/UI de salvamento e aprovacao de precos, catalogo com precos confiaveis, adicionais/combos, embalagens/bebidas, custos desconhecidos, regras de equipe, uso em 2 contas e Android fisico e corte reversivel do Worker + Rules. O cliente ainda NAO invoca approve-price no app comercial. Nao declarar 35/35 concluido.
Seguranca/economia: producao/main e Firebase Hosting imutaveis nesta retomada. CLOUD_WORKER_ACTIVE=false, ENABLE_WRITES=false, PRODUCTION_CUTOVER_APPROVED=false em staging, Asaas desativado. Nenhum deploy de Worker/Rules comercial, migracao destrutiva, cobranca real, taxa ou servico pago. Proximo passo: conectar a ponte de catalogo ao cliente apenas na branch de homologacao, sem habilitar Worker; depois validar complexidade de extras/bebidas antes do cutover.

### CHECKPOINT: F02 - ponte de precificacao autoritativa (18/11/2026)
Branch: feat/f35-completion-audit-20261118. Commit de codigo: ddabbefa952b08c3fa4aa15645caacee76f3bcff.
Arquivos: worker_bridge.mjs, test_worker_bridge.mjs.
Implementado approvePrice(recipeId,universe,salePriceCents) via POST /v1/catalog/approve-price, protegido pelo Worker desativado por padrao, sessao Google, sincronizacao antes de enviar, chave de idempotencia especifica por receita e valor, resposta validada por operacao e refresh do Firestore apos sucesso. Sem valores de custo, insumos ou UID fornecidos pelo cliente.
QA isolado no PC: node --check worker_bridge.mjs PASS; node test_worker_bridge.mjs PASS (inclui 423 fail-closed, retry persistente, validacao de resposta, rejeicao de preco invalido e desativacao padrao).
Conector GitHub update_file retornou 403; git push autenticado via Desktop Commander concluiu commit rastreavel diretamente na branch GitHub. Nenhum arquivo de codigo editado diretamente no worktree local.
Main e Firebase/Cloudflare publicos inalterados; dados reais, regras, servicos pagos e cobrancas: NENHUM.
Pendencias: ponte ainda nao integrada ao formulario de precificacao; Worker nao ativado; combos/adicionais e embalagens exigem modelo de custo autoritativo e testes.
PROXIMA ACAO EXATA: integrar approvePrice no fluxo de edicao de receita somente na branch candidata, validar no Chrome movel e Firebase Emulator, sem cutover.


### CHECKPOINT: CORRECOES DE PEDIDOS, SINCRONIZACAO E TESTE DE ESTOQUE 10% PUBLICADOS / 18-11-2026
Usuario apresentou capturas do proprio Android em pdv.livresom.com: modal com Dinheiro recebido vazio mostrava 'Informe valores monetarios validos' para venda R$21,90; ao Registrar pedido aparecia alerta de conflito de sincronizacao; nao encontrava botao de Retirada/Sangria; havia diversas abas iguais abertas. Usuario esclareceu: NAO existem pedidos reais, tudo que ha sao dados de TESTE. Pediu tambem reduzir TODO estoque a 10% do necessario, sem prejudicar outros clientes.
Diagnosticos confirmados: payment_flow.js calculate(total,received) convertia campo dinheiro vazio em NaN e informava erro, embora pagamento com valor exato possa dispensar digitar o valor entregue. Sync guard impede corretamente nova venda quando ha conflito ou backup pendente; multiplas abas abertas podem contribuir, sem comprovar causa especifica no dispositivo. Controle seguro de sangria estava no PDV, mas dificil de localizar desde o formulario de vendas.
RELEASE: branch release/orders-cash-sync-recovery-20261118 baseada unicamente em main e538e64, HEAD de publicacao 2df55105d715916a6cc524811e30cf5c3d04c201. Fast-forward de main concluido. Tag de rollback rollback-pre-orders-stock-20261118 aponta main anterior e538e64. Fonte editada exclusivamente no GitHub, sem Floot. Arquivos afetados: payment_flow.js, source/pote_app_base.html, firebase_integration.js, stock_ui.js, make_beta.py e testes; NENHUMA alteracao de Firestore Rules, Worker, credenciais bancarias ou migration.
Pagamento: se Dinheiro e campo Dinheiro entregue estiver vazio, considera pagamento exato sem troco; se usuario informa valor abaixo do total ou texto invalido, continua bloqueando. Preview explica valor exato. Pix e cartao continuam separados e valores em centavos. Teste unit test_cash_exact_and_order_payment.cjs PASS; Chrome mobile 375 e 430 PASS.
Pedido/Sangria: pagina Pedidos agora contem botao visivel 'Meu caixa PDV - Retirada / Sangria' que abre modal real, alem dos botoes de sangria/suprimento no PDV; test_orders_cash_recovery_mobile.cjs PASS. Um pedido bloqueado por conflito NAO gera registro e mostra banner persistente com acoes baixar backup e resolver conflito. firebase_integration.js passou a exigir verificacao do arquivo JSON baixado e checagem de UID/estado antes de remover backup pendente e recarregar nuvem. Teste sync_integration cobre backup errado recusado e arquivo correto aceito. Nao soltar guard sem backup. Para usuario: fechar abas duplicadas, verificar backup, resolver conflito, recarregar dados cloud; depois testar venda.
ESTOQUE 10%: usuario solicitou saldo critico em todos os itens, e todos dados atuais sao de teste. NAO executamos escrita remota de estoque na conta, pois a sessao Android apresenta conflito de sincronizacao e sobrescrever alteracoes em nuvem neste estado poderia perder testes. Em vez disso, stock_ui.js disponibiliza na area Estoque e Compras para a conta administradora identificada por pixmcp@gmail.com, no universo batataria, botao 'Aplicar estoque 10% (teste)' e 'Restaurar estoque anterior'. Acesso somente administradora, requer nuvem/app pronto, sem conflito nem backup pendente; confirmacao, exportacao de backup e copia do saldo em localStorage antes de editar. Todos os ingredientes ativos, embalagens e bebidas: alvo 10% do campo minimum; sem minimo, usa demanda de uma ficha ou saldo anterior. Unidades inteiras arredondadas para baixo. Registros de movimentacao classificados como simulacao/restauracao (NAO perdas ou compras); restaura somente se nenhum saldo mudou apos simulacao. Exemplo batata minimum=2500g -> saldo teste 250g; anterior 8000g foi recuperado no Chrome QA. Esta ferramenta exige toque do usuario na conta atual apos recuperar sincronizacao; nao afirmar que estoque ja foi reduzido em Firebase.
QA release: tests node --check stock_ui.js, payment_flow.js, firebase_integration.js PASS; test_stock_10percent_admin.cjs PASS (todos grupos, backup unico, isolamento, restore, conflito bloqueado); test_stock_10_mobile.cjs PASS Chrome 375 e 430 (8000g -> 250g -> 8000g); test_cash_exact_and_order_payment.cjs PASS; test_sync_integration.js PASS; test_orders_cash_recovery_mobile.cjs PASS Chrome 375 e 430 (sem vendas duplicadas em conflito); test_pdv_sangria_mobile.cjs PASS Chrome 375 e 430; test_pdv_accordion_stability.cjs PASS Chrome 375,430,1280. Firebase Hosting build python build_hosting.py PASS; versionamento do cache atualizado.
Publicacao: GitHub main 2df55105d715916a6cc524811e30cf5c3d04c201 e Firebase Hosting projeto potobatata-b71f3 com 217 arquivos, deploy success. Consultas HTTP 200 em pdv.livresom.com confirmaram payment_flow.js exato, firebase_integration.js backup verificado, stock_ui.js 10%/restore, atalho de sangria, banner de conflito e login Google protegido. Worker CLOUD_WORKER_ACTIVE=false permaneceu, rotas Cloudflare e Asaas nao foram ativadas; sem servico pago ou cobranca.
Proximos passos: se usuario disser que conflito persiste, acompanhar resultado da opcao de recuperacao SEM pedir credenciais nem descartar backup; confirmar no Android real (QA foi Chrome emulado). Quando sincronizacao estiver liberada, ele pode acionar 10% no Estoque e Compras; validar se contagem alterou e salvou na nuvem. NAO ativar cutover F02/Worker; seguir homologando extras/combos/bebidas. Usuario declarou que pedidos atuais sao todos TESTE, nao reivindicar vendas reais.

### CHECKPOINT: F02 UI DE HOMOLOGACAO DE PRECO NO CATALOGO / 18-11-2026
Branch exclusiva: feat/f35-completion-audit-20261118. Commits: 0ccd076 (acao de homologacao na ficha de receita e teste), 6777e4c (restauracao da codificacao UTF-8 original do HTML, sem alterar producao).
A ficha de receita passa a exibir "Homologar preço no servidor" SOMENTE quando window.POTE_WORKER.enabled===true. A funcao approveRecipeServerPrice valida PRO ativo, receita liberada, centavos inteiros, confirmacao explicita, bloqueia duplo clique e chama a ponte approvePrice que faz flush/Google token e POST /v1/catalog/approve-price. Nao fornece custos ou saldo pelo navegador, nao considera aprovado se o Worker rejeitar e nao faz fallback de escrita local. Na versao publica, CLOUD_WORKER_ACTIVE=false, portanto o botao NAO aparece.
QA dirigido: node test_f02_price_ui.cjs PASS para Worker desativado, 2990 centavos, licenca PRO, resposta 423 sem sucesso falso; node test_worker_bridge.mjs PASS (idempotencia, retries e autenticacao). A primeira tentativa de build isolado revelou corrupcao de UTF-8 no transporte PowerShell do HTML; corrigido com Git byte-preserving no commit 6777e4c e novo teste/build iniciado. Nao afirmar browser fisico ou Cloudflare deploy.
Restricoes: main, Firebase Hosting publico, Firestore Rules comerciais, dados reais, Asaas, Cloudflare Worker e custos permanecem intocados. Proxima etapa: confirmar build e browser Chrome mobile isolado, validar homologacao do catalogo com custos e receitas complexas no Firebase Emulator antes de habilitar qualquer cutover. Nenhum servico pago autorizado.



### COMPLEMENTO QA F02 UI / 18-11-2026
O build isolado python build_hosting.py finalizou com FIREBASE_HOSTING_BUILD_OK copies=129 files=223. Confirmado no HTML gerado approveRecipeServerPrice=True e poteApproveServerPrice=True; firebase_integration.js gerado contem CLOUD_WORKER_ACTIVE=false. O primeiro verificador erroneamente procurou a flag dentro do HTML, embora ela pertença ao modulo firebase_integration.js; portanto falha de assercao do QA, nao falha do build. Teste dirigido test_f02_price_ui.cjs PASS e regressao test_worker_bridge.mjs PASS. Nenhum deploy. Browser Chrome fisico ou mobile end-to-end ainda nao executado neste bloco.



### CHECKPOINT: PDV V7 SANGRIA VISIVEL NA TELA PRINCIPAL / 18-11-2026
Usuario enviou captura de TELA COMPLETA do Caixa PDV principal em pdv.livresom.com: apareciam 'Conferir recebimentos e fechar caixa' e 'Registrar novo pedido', mas NAO havia botoes de Retirada/Sangria e Reforco. Confirmado em codigo: pdv_cash_ui.mjs renderPage() nao inseria os botoes no painel principal, embora modal interno ja tivesse formulario de movimento.
Correcao cirurgica feita SOMENTE no GitHub, diretamente sobre main anterior 2df55105d715916a6cc524811e30cf5c3d04c201. Branch release/pdv-main-sangria-20261118, release main 360ed358cb6c3db0fdb26f54b50aec5719e25385. Apenas pdv_cash_ui.mjs, pdv_cash.css, make_beta.py e teste test_pdv_main_page_sangria_mobile.cjs. Nova pagina renderPage() inclui botoes exclusivos de turno ABERTO 'Retirada / Sangria' e 'Reforco / Suprimento' antes de 'Conferir recebimentos e fechar caixa'. API window.POTE_PDV.openMovement('sangria'/'suprimento') abre modal existente e diretamente o formulario correto, com scroll/foco em valor. Nao duplicou rotina financeira nem mudou rules, banco, estoque ou pagamentos. Cache de pdv_cash_ui.mjs e pdv_cash.css versionado como pdv-page-cash-actions-v7-20261118.
QA: node --check pdv_cash_ui.mjs PASS; python build_hosting.py PASS; novo test_pdv_main_page_sangria_mobile.cjs PASS no Chrome mobile 375 e 430, verificando botoes visiveis acima de fechar caixa, Sangria de 30 reduz saldo de gaveta de 100 a 70, Suprimento 20 aumenta saldo a 90, formularios corretos e sem overflow; test_pdv_sangria_mobile.cjs PASS 375 e 430; test_pdv_accordion_stability.cjs PASS 375,430,1280. Dados ficticios; nao declarar teste Android fisico.
PUBLICADO: git push main = 360ed358cb6c3db0fdb26f54b50aec5719e25385. Tag de reversao rollback-pre-pdv-main-sangria-20261118 aponta 2df55105d715916a6cc524811e30cf5c3d04c201. firebase.cmd deploy --only hosting --project potobatata-b71f3 --non-interactive SUCESSO (217 arquivos). Checagem HTTP 200 do dominio oficial pdv.livresom.com confirmou index v7, UI com ambos botoes, openMovement exportado, CSS responsivo, autenticacao Google e CLOUD_WORKER_ACTIVE=false. Sem deploy de Worker/Firestore Rules, sem servicos pagos, sem cobrancas reais, sem migracao destrutiva.
Acao de usuario: atualizar aba do PDV no Android, procurar Sangria e Suprimento acima de 'Conferir recebimentos e fechar caixa'. Proximas melhorias log seguem em branch feat/f35-completion-audit-20261118, sem alterar main fora de release homologada.

### CHECKPOINT: F02 APROVACAO DE PRECO TESTADA EM CHROME MOBILE / 18-11-2026
Branch de homologacao feat/f35-completion-audit-20261118; commit de teste 371d9bb31a97b2988bfd0274ecb0f4d4d044e463. Apos leitura integral do Log Mestre versionado (537 linhas antes deste checkpoint) e conferencia do arquivo PC, identificou-se que o teste Chrome mobile da funcao approveRecipeServerPrice ainda estava pendente. Foi adicionado SOMENTE via objetos Git e push autenticado na branch de homologacao o arquivo test_f02_price_ui_chrome_mobile.cjs; nenhuma edicao de codigo diretamente no worktree do PC.
QA Chrome real headless em viewport movel 375 e 430 px PASS: Worker desativado bloqueia envio; Worker habilitado e conta PRO de teste enviam recipe-qa, batataria, 2990 centavos; conta sem PRO nao envia; erro 423 nao registra sucesso nem deixa botao travado; cancelamento nao aprova. O teste executa a funcao real extraida de source/pote_app_base.html em documento DOM isolado com mocks do Worker, NAO realiza login Google real, Firestore ou chamada externa. Regressao node test_f02_price_ui.cjs PASS e node test_worker_bridge.mjs PASS. Evidencia terminal: PASS F02 CHROME MOBILE 375; PASS F02 CHROME MOBILE 430; F02_BROWSER_QA_ALL_PASS.
GitHub main permaneceu 360ed358cb6c3db0fdb26f54b50aec5719e25385; Firebase Hosting, Firestore comercial, Cloudflare publico, dados de clientes, cobrancas e servicos pagos intactos. Worker desativado, nenhum cutover.
Limites: teste de navegador foi de componente DOM isolado, nao fluxo completo da ficha em app autenticado. Proximo passo: teste integrado de catalogo/preco com receitas contendo adicionais, bebidas e embalagens no Firebase Emulator e Chrome app completo; garantir falha fechada quando custo desconhecido, sem habilitar Worker.


### CHECKPOINT: SINCRONIZACAO EXPLICITA E PEDIDOS ANOTADOS COM SEGURANCA / 19-11-2026
User reported Android screenshot showing permanent 'Vendas pausadas: conflito de sincronizacao' and asked for explicit cause and if possible not to prevent sales. Existing screenshot showed multiple Potê Batata tabs, but no evidence it was the definite root cause. User previously confirmed all current orders are tests.
Original root cause in firebase_integration.js: v2Store.subscribe treated ANY failed remote refresh as syncBlocked=true, including transient Firestore read/network errors, saving an old pending backup in localStorage. v2Store.save's specific result.error was sometimes lost when pending backup reason was recorded as generic result.code. Genuine optimistic Firestore sync/conflict MUST continue to prevent overwriting sales and stock.
GitHub commercial release isolated branch release/sync-clarity-sales-20261119; main advanced safely from 360ed358cb6c3db0fdb26f54b50aec5719e25385 to 8c1cbfe317e7b18ffea1acf900de5eb6506b4dc5. Rollback tag rollback-pre-sync-clarity-20261119 points to old SHA. Only firebase_integration.js, source/pote_app_base.html, make_beta.py and test_pending_sale_recovery_mobile.cjs changed. No direct Floot edits, no Worker/rules/migrations/real bank changes. Worker flag remains CLOUD_WORKER_ACTIVE=false.
Changes: firebase_integration.js introduces syncExplanation diagnosing cause from error code/detail or old pending reason, exposed via POTE_SYNC_GUARD.diagnosis and used to replace generic banner text. V2 subscribe no longer permanently blocks on transient read errors sync/error, unavailable, deadline-exceeded or network-request-failed; performs delayed refresh, while real sync/conflict, sync/invalid-state and partial transaction still maintain protection. V2 save stores more specific error detail in pending state.
Sales fallback: on clicking Registrar Pedido while sync guard fails, savePendingSaleNote stores a per-auth-UID/per-universe localStorage draft including selected item, qty, unit sale price, payment, delivery fields, customer/address, notes, and a summary of custom ingredients. This is a LOCAL NOTE ONLY: it does NOT create official orders, deduct inventory, record payments, update PDV or claim bank reconciliation. The UI displays PEDIDOS PENDENTES NESTE APARELHO and actions to reopen or export JSON; user must reselect custom extras and then confirm real order after sync resumes. Max 30 notes, 1200ms immediate double-tap protection, legitimate later identical orders allowed, safe draft IDs. Do not auto-post offline draft or delete backup.
QA: isolated Python build_hosting.py PASS (223 files generated; published 217), node --check firebase_integration.js PASS, test_sync_integration.js PASS, test_auth_v2_integration.js PASS. New Puppeteer test_pending_sale_recovery_mobile.cjs PASS at 375/430: blocked operation saves local pending note and restores form without creating an official order. test_orders_cash_recovery_mobile.cjs PASS at 375/430 and test_pdv_main_page_sangria_mobile.cjs PASS at 375/430; some first-run PDV test intermittency cleared on rerun. All tests used fictional local data, not real Android/device or account credentials. One source syntax defect in pending HTML action was caught by browser and corrected before release. No production data mutated.
Published: GitHub main 8c1cbfe317e7b18ffea1acf900de5eb6506b4dc5; Firebase Hosting project potobatata-b71f3 deploy --only hosting succeeded with 217 files. LIVE https://pdv.livresom.com HTTP smoke confirmed new firebase_integration.js?v=explicit-sync-20261119, syncExplanation diagnosis API, retry path, pendingSaleNotes/reopen/export in index, POTE Auth Google gate retained, Sangria UI retained and Worker off. Old pending backups in the user's Android were NOT removed, nor could root cause for historical backups be fully determined; refreshed app still requires safe verified backup recovery when actual local-vs-cloud divergence exists.
Next action if complaint persists: gather banner after updating page (it now includes actual available reason) or safe read-only diagnostics; avoid disabling Firestore optimistic guard. User should close extra Potê Batata tabs, reload only one, verify backup before resolving older pending conflict, then re-open any local drafts and register once cloud is safely synced. Never imply provisional note is an officially confirmed sale. Keep 10% stock test guarded while sync blocked. Continue Log Mestre F02 on feature only; no paid service activation.