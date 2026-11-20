# LOG FLOOT — PLANO MESTRE DE ENGENHARIA E DIÁRIO DE EXECUÇÃO

**Produto:** Potê Batata Pro | **Criado:** 20/11/2026 (America/Sao_Paulo)
**Status documental:** PLANO INICIAL REGISTRADO; implementação Floot NESTA ETAPA não iniciada.
**Projeto Floot verificado:** Potê Batata Pro — ID 0ac73184-2ba0-41f8-9a16-fd1d03017e6d.
**Repositório principal:** https://github.com/pixmcp-cloud/pote-batata-pro-v6-site
**Branch autorizada de desenvolvimento/homologação:** feat/f35-completion-audit-20261118
**Documento relacionado:** POTE_BATATA_PRO_LOG_MESTRE.md, mesma branch.
**Registro técnico prévio no Floot:** static/__dev/floot-git-paridade.md (apenas referência, NÃO substitui este log).
**Política:** atualizar este arquivo APÓS CADA lote executado, em commit GitHub, para retomada exata; jamais substituir evidências por suposições.

---

## 1. Missão e critério de êxito

Entregar uma experiência Potê Batata Pro confiável no Floot e no Android, **sem reconstruir desnecessariamente** o sistema oficial nem criar dois bancos de estoque/venda. O resultado precisa manter identidade visual, marca original, receitas, cadastro, PDV, licenças, franquias, estoque, perdas, vendas, caixa, relatórios, notificações, impressão/WhatsApp, fornecedores, delivery e demais requisitos aprovados no Log Mestre.

**NÃO equivale a concluído:** código compilando sozinho, testes unitários isolados, iframe exibindo a tela inicial, preview bonito, backend isolado funcionando, APK gerado sem login e sem testes multiusuário.
**Concluído somente quando:** frontend + backend + persistência + permissões + mobile + falhas de rede + dados de teste + regressão + evidência + aprovação de publicação, conforme gates abaixo.

Prioridades de negócio: preservar vendas e histórico, reduzir custo recorrente, não contratar serviços sem aprovação, evitar retrabalho e manter um único padrão para correções comerciais.

## 2. Fontes de verdade e restrições inegociáveis

1. **Código autoritativo e decisões:** GitHub; TODO código de produto deve ser escrito/alterado primeiro no GitHub, com commits rastreáveis. Não editar o código original no Floot manualmente. Uma futura transferência para o Floot exige instrução/operador de sincronização autorizado e verificação de hashes. Este log é mantido no GitHub; uma eventual cópia de leitura dentro do Floot não pode virar segunda fonte autoritativa.
2. **Regras aprovadas/requisitos:** POTE_BATATA_PRO_LOG_MESTRE.md e a matriz de 35 melhorias. Dúvida ou contradição deve ser registrada antes de decidir; a fase aprovada não se reinicia.
3. **Dados de negócio e autenticação operacional:** Firebase do produto oficial, Firestore V2, UID Firebase e regras verificadas; Worker Cloudflare é a autoridade em operações server-only homologadas. Não usar a base PostgreSQL do Floot como segundo estoque/pagamento comercial.
4. **Floot:** distribuição/experiência e, se validado, casca mobile ou UI React migrada. O Floot não deve inventar licença Pro por estado de navegador nem registrar vendas paralelas.
5. **Ambiente comercial:** https://pdv.livresom.com/ — não alterar sem autorização específica de publicação.
6. **Sem** migração destrutiva, perda de dados reais, credenciais no GitHub/log/chat, compra de serviços, alteração de main, Floot comercial ou publicação de APK antes dos gates.
7. Em caso de falha/latência/timeout, não repetir mutações com novo ID; manter chave de idempotência, consultar o servidor e recusar gravação local paralela.
8. Documentar o que é **informado pelo operador como recebido** versus Pix/cartão **efetivamente confirmado pelo provedor**. Não tratar autodeclaração como liquidação bancária.

## 3. Fotografia do estado verificado em 20/11/2026

### 3.1 Floot — acesso real ao projeto

- Nome: Potê Batata Pro; ID estável 0ac73184-2ba0-41f8-9a16-fd1d03017e6d.
- Floot informa: **published=false**, sem domínio próprio conectado, plano **free**, 0 builds nativas utilizadas e **2 builds Android/iOS disponíveis até o reset indicado em 01/12/2026**. Não presumir que esta cota se manterá.
- **Nenhuma branch Floot separada** identificada. O projeto atual é o principal. Não modificar sem janela aprovada e checkpoint.
- A rota pages/_index.tsx só renderiza components/OfficialPdvFrame.tsx; esse componente usa iframe src=https://pdv.livresom.com/ e oferece link de abertura externa. A tela incorporada é o **site oficial**, não prova que as telas React nativas estão montadas ou que o APK passou.
- Existe base React Floot com components/FirebaseUnified.tsx, OrderComposerV5.tsx, PDVCash.tsx, InventoryLosses.tsx, DeliveryHub.tsx, LicenseAdmin.tsx, PromoBuilder.tsx, etc. Essas peças **não formam automaticamente a experiência principal atual**.
- O componente FirebaseUnified.tsx já tenta conectar mesmo e-mail Google Floot + Firebase, usa Firestore V2, bloqueia conflito e possui caminho de backup; não foi comprovado o login ponta a ponta no APK. Há duas identidades possíveis (sessão Floot e UID Firebase) e esta reconciliação deve ser testada.
- A transferência histórica descrita em static/__dev/floot-git-paridade.md relata sequenciamento público #P0000001, PDV, WhatsApp, proteção de estoque, V2, Chef IA, criativos, fornecedores e adaptações em React; NÃO significa que a página principal atual as exercita.
- O Floot apontou endpoints sem chamadores de interface; auditar quais são realmente necessários antes de expô-los ou removê-los. Não excluir endpoints nem dados por simples alerta de uso.

### 3.2 GitHub / backend / site

- F05, **perdas físicas nas contas Pro**, teve homologação de QA e publicação comercial anteriores, confirmadas no Log Mestre; não reabrir o trabalho.
- F02, F20 e F10 possuem avanços e testes de integração no GitHub, mas permanecem **HOMOLOGAÇÃO PARCIAL**: Fluxos autoritativos completos e implantação comercial geral ainda requerem cutover seguro.
- Na branch de homologação: integração staged de criação de pedidos pelo Worker, embalagem legada resolvida sem estoque espelho, reservas de combos/receitas complexas, abertura/fechamento de caixa com idempotência, isolamento Pro/franquias/Free e testes HTTP Firestore Emulator.
- Um runner ampliado qa/mobile/run_everything.ps1 teve PASS com suíte emulada e Chrome/mobile; Worker 92/92 PASS naquele checkpoint. **Android físico/APK ainda não homologado.**
- A branch de homologação diverge de main: NÃO mesclar integralmente sem comparar commits e alterações recentes comerciais. Não substituir bundles atuais por artefatos public/ de outra branch.

### 3.3 Definição do que está APROVADO vs o que falta

| Frente | Evidência disponível | Estado no Floot |
|---|---|---|
| F05 perda física Pro no site oficial | Publicada e testada no Firebase/Worker | Via iframe, pode exibir; uso Android/login NÃO validado |
| F02 preço/receita/combos/estorno | Worker e Firestore Emulator + testes UI staged | Transferência integral ao React Floot NÃO homologada |
| F20 PDV/cash | UI e Worker REST emulados, sem reconciliação bancária presumida | UI React existe, porém navegação principal atual é iframe; integração completa NÃO homologada |
| F10 Free/Pro/admin/franquias | Regras/testes HTTP por tenant e Firebase | Login duplo, licença e franquia no APK NÃO homologados |
| Sequência #P0000001, WhatsApp e comprovantes | Código Floot prévio e specs | Concorrência multiaparelho / sessão real pendentes |
| Delivery/fornecedores/criativos/relatórios | Componentes ou módulos parciais; Log Mestre | Paridade e navegação completa a aferir |
| Responsividade | Chrome emulado, múltiplos viewports | WebView/Android real, teclado, arquivos, câmera, impressão pendentes |

**Status do produto FLOOT como um todo: HOMOLOGAÇÃO PARCIAL / não publicado.**

## 4. Arquitetura-alvo e decisões de engenharia

### ADR-FL-001 — Uma só base de negócio e um só motor financeiro

Modelo obrigatório:
- GitHub = repositório de código, testes, artefatos de release e históricos;
- Firebase Authentication + Firestore V2 = identidade e dados oficiais por UID/empresa;
- Cloudflare Worker = transações server-only homologadas (preço, reserva, estoque, perda e caixa conforme fase);
- Floot = uma apresentação do mesmo produto, sem banco paralelo de pedidos/estoque;
- site oficial = release web homologada;
- aplicativo Android = canal de entrega, não segundo livro-caixa.

As operações de pedido devem ter ID estável, contador #P por empresa atribuído sem duplicidade, reserva atômica por componente, estorno único e transição de estado; receber Pix/cartão declarados no PDV não equivale a liquidação confirmada.

### ADR-FL-002 — Estratégia de transferência, com bifurcação controlada

**Trilha A — casca do site oficial, preferencial pela economia se passar:** o Floot encapsula o site publicado. Código e funcionalidades continuam no GitHub/site; Floot não precisa receber 35 implementações duplicadas. Requer testes de origin, cookie, Firebase Google popup/redirect, CSP/iframe, sessão Android WebView, arquivos, câmera, impressão, WhatsApp, navegação, desempenho, offline e reconexão. **A existência do iframe NÃO prova viabilidade do APK**. Se falhar em autenticação, segurança ou recursos nativos, interromper essa trilha.

**Trilha B — React Floot nativo, alternativa controlada e de maior esforço:** portar apenas a interface e os adaptadores a partir de módulos versionados no GitHub; usar a mesma autoridade Firestore/Worker e os mesmos contratos. Não copiar todo o HTML/JavaScript monolítico para helpers Floot nem criar uma segunda fonte de preços e saldos. Migrar rotas por módulo com testes de paridade e rollback de navegação.

**Gate de decisão:** escolher A somente com prova em preview e Android de que login, sessão e os fluxos críticos funcionam. Se iframe for tecnicamente incompatível, escolher B documentando o motivo, estimativa de manutenção e interface de adaptadores. Não inventar compatibilidade WebView. Registrar a decisão em ADR-FL-003 com evidência.

### ADR-FL-003 — Autenticação e autorização

- Estabelecer sessão Firebase Google por mecanismo suportado no contexto Floot/Android; testar popup, redirect e retomada de sessão; tratar claims assinadas e e-mail verificado.
- Vincular sessão Floot à mesma identidade sem confiar em e-mail escrito pelo navegador. Servidor verifica UID e licença, inclusive Free, trial, Pro, ADM e franquia.
- Usuário de nova conta inicia com estado isolado/zerado ou simulação claramente separada; nunca vê vendas de outra conta.
- Nenhum token, chave de API privada, JSON de serviço, ID token ou dados de cliente no log.
- Verificar regras CORS e domínios permitidos exclusivamente no teste; não liberar '*' nem desativar regras Firestore para contornar login.

### ADR-FL-004 — Entrega e reversão

- Elaborar versão de release imutável do GitHub, por SHA; construir artefato e verificar assets/manifesto.
- Se a trilha B for aprovada: espelhar código Floot em diretório GitHub de mesma árvore lógica; a operação de sincronização para Floot será **transporte de conteúdo já commitado**, não criação/edição ad hoc do produto na interface Floot.
- No Floot, criar checkpoint nomeado de restauração antes de transferir código, preservando dados. Não publicar antes de aprovação específica.
- Manter reversão independente do site Firebase Hosting, regras Firestore, Worker e Floot; rollback de UI NÃO reverte banco ou regras automaticamente.
- Nunca zerar contas para migrar; snapshots/backup verificáveis, reconciliação por UID, modo somente leitura durante migração quando necessário, relatório de diferenças.

## 5. Sequência integral de execução (gates)

**Gate G0 — inventário e baseline** | ESTADO: PARCIAL, fontes confirmadas
- [x] Identificar projeto Floot, publicação, plano, branches e arquivos iniciais.
- [x] Confirmar iframe atual e módulos React pré-existentes.
- [x] Ler Log Mestre + documentação floot-git-paridade.
- [ ] Capturar baseline de preview/screenshots e estado de login em largura mobile.
- [ ] Criar snapshot/checkpoint Floot nomeado de restauração quando a transferência for autorizada.
- [ ] Fixar SHA GitHub, hashes dos módulos de Floot e versão do site usada nos testes.
- **Saída:** inventário de telas, importações, recursos, dados, pontos de falha e reversão antes de qualquer edição.

**Gate G1 — provar ou reprovar a trilha A (iframe)** | PENDENTE — PRÓXIMA AÇÃO
- [ ] Abrir preview real Floot e inspecionar DOM/iframe, erros do navegador, origem e política de framing.
- [ ] Testar login Google de conta QA, troca de contas, logout/relogin e refrescamento.
- [ ] Conferir que a sessão Firebase permanece válida e que o usuário errado não assume conta.
- [ ] Testar navegação, formulários, teclado, rolagem, WhatsApp, impressão, downloads/upload sem usar dados reais.
- [ ] Testar rede offline/online e recuperação sem duplicar pedidos.
- [ ] Registros de evidência: data/hora, dispositivo, navegador, screenshot, erro real, URL, hash de versão.
- **Decisão:** se passar, A é interface principal temporária e o trabalho React não deve ser duplicado; se falhar, registrar bloqueador e iniciar B.

**Gate G2 — contratos, autenticação e modelo de dados** | PENDENTE
- [ ] Mapa único por entidade: receitas, ingredientes, embalagens, bebidas, adicionais, combos, perdas, estoque, pedidos, pagamentos, turnos, usuários/franquias, relatórios, fornecedores, promoções, criativos.
- [ ] Adapters versionados e validados; Firestore V2 e Worker não podem divergir na identidade de SKU/unidade (g, ml, un, kg, L) e custo.
- [ ] Revisar fonte de verdade das licenças (Floot vs Firebase) e regras ADM/trial/franquia.
- [ ] Plano de migração sem perda por UID, com estado vazio/conta Free e simulação isolada.
- **Saída:** especificações de API/eventos, matriz de autorização e esquema de compatibilidade com rollback.

**Gate G3 — F02 precificação e catálogo** | Git/Worker: PARCIALMENTE HOMOLOGADO; Floot: PENDENTE
- [ ] Fonte única de custo e preço; rendimento, custo variável, margem padrão 100% editável, arredondamento xx,50/xx,90 sem reduzir abaixo do mínimo aprovado.
- [ ] Receitas simples, complexas, combinadas, adicionais repetidos, potes/embalagens, bebidas, preferências/remoções.
- [ ] Preço e estoque confirmados por servidor (não aceitar saldo/CMV informado pelo navegador).
- [ ] Reserva atômica ao finalizar pedido, rollback/estorno/cancelamento pré e pós-preparo, concorrência 2 dispositivos e retry idempotente.
- [ ] Exibir mensagens úteis quando combinação não homologada, sem pedido fantasma.
- **Saída:** comprar/vender/cancelar na UI escolhida, com documentos e movimento auditáveis por tenant.

**Gate G4 — F05 estoque e desperdício** | SITE PRO FÍSICO HOMOLOGADO; Floot/Android PENDENTE
- [ ] Reutilizar integração física F05 sem novo caminho de estoque.
- [ ] Compras, preparo, devoluções, perdas por deterioração, queda, higiene, cancelamento, inadimplência; motivo e evidência.
- [ ] g/kg, ml/L, unidades, bebidas, embalagens e adicionais; nunca saldo negativo.
- [ ] Baixa exatamente uma vez; estoque retorna apenas quando decisão de estorno permite, sem repor ingredientes já utilizados.
- [ ] No Floot, teste positivo e erro do Worker em duas contas/duas sessões.
- **Saída:** equivalência de saldo, movimentação, perda, custo e relatórios entre mobile e site.

**Gate G5 — F20 PDV, caixa e pagamentos** | Worker/QA: PARCIAL; Floot: PENDENTE
- [ ] Abrir/fechar caixa pelo servidor; migração de sessões antigas não destrutiva.
- [ ] Registrar dinheiro, Pix, cartão e entrega com status correto; pagamento declarado pelo operador ≠ confirmação bancária.
- [ ] Vendas concluídas entram no PDV automaticamente, sem segundo botão de confirmação.
- [ ] Sangria, suprimento, perdas financeiras, recebimentos, despesas e diferença de fechamento; indicadores e gráficos Pix/cartão/dinheiro.
- [ ] Testar pedido simultâneo, reenvio de terminal offline, cancelamento/refundo, comprovante não fiscal, comanda e impressão.
- [ ] #P0000001 sequencial por empresa durante sua vida, sem números duplicados nem retrocesso ao cancelar.
- **Saída:** balanço verificável e fluxo completo venda → caixa → relatórios.

**Gate G6 — F10 identidade, planos e franquias** | Worker/Rules: PARCIAL; Floot: PENDENTE
- [ ] Free, 7 dias de teste, Pro, ADM, franquias; bloqueios e limites definidos no Log Mestre.
- [ ] Restringir pelo servidor, não pelo botão oculto. Trial/serial, limitações (inclusive receitas, ingredientes, fornecedores quando aprovadas), com verificação de transição de plano.
- [ ] Isolamento completo multiusuário, multiempresa, multiuniverse; histórico e estoque zerados na conta nova (simulação só em área dedicada).
- [ ] Franquia e permissões: comissão, planos, marca, catálogo e relatórios isolados conforme regras aprovadas.
- [ ] Auditoria de expiração, renovação, revogação, bloqueio e mudança de e-mail.
- **Saída:** contas de teste reais em provedores QA, com cenários positivos/negativos.

**Gate G7 — integração comercial, UX e recursos premium** | PARCIAL / A AUDITAR
- [ ] Hub delivery, MaisDelivery SOMENTE sandbox até credenciais e aprovação, motoboy, fornecedores/Geoapify, alertas e sino, grupos de mensagem/WhatsApp.
- [ ] Chef IA/criativos com cotas, exportação real PNG/JPG, vídeos/imagens quando exigidos, armazenamento com custo controlado.
- [ ] Relatórios dia/semana/mês, CMV, despesas, lucro vs sobras, margem, perdas, ponto de equilíbrio, franquias.
- [ ] Perfil/logo/nome editáveis, menus fixos, animações limpas, gráfico do caixa, responsividade, modo escuro e legibilidade.
- [ ] Backups/exportações; central de conta; restauração testada em ambiente sintético.
- [ ] F32 galeria cloud paga permanece ADIADA até aprovação de custo.
- **Saída:** matriz completa de telas aprovada, com captura responsiva e navegação de ponta a ponta.

**Gate G8 — qualidade e segurança transversal** | PARCIAL
- [ ] Node/Jasmine, Worker HTTP, Firestore Emulator (Rules/concorrência), integração do frontend escolhido, Cypress/Playwright/Chrome mobile se disponível.
- [ ] Autenticação real QA, conta nova, troca de UID, licença vencida, sessão expirada, replay e origem externa.
- [ ] Android real: login, toque, teclado, camera, upload, share sheet, WhatsApp, print e impressora; rotação/orientação.
- [ ] Rede intermitente, refresh, duas instâncias, bloqueio de saldo negativo, rollback de pedido e sincronização de UI após transação.
- [ ] Observabilidade sem dados sensíveis; sem erro crítico conhecido; reexecutar suite completa em cada release.
- **Saída:** relatório PASS/FAIL referindo SHA/ambiente/provas. FALHA crítica significa NÃO HOMOLOGADO.

**Gate G9 — prévia Floot, APK e publicação** | BLOQUEADO POR G1–G8 E AUTORIZAÇÃO
- [ ] Usar Floot preview/branch de homologação sem alterar principal/comercial.
- [ ] Publicar preview somente após testes e sem dados reais; conferir diferença entre código Floot salvo e publicado.
- [ ] Usar uma das builds nativas limitadas SOMENTE para candidato de release com login testável; preservar a outra para correção de última hora.
- [ ] Homologação em Android real e duas contas. Não presumir Play Store, assinatura, permissões ou links automáticos.
- [ ] Solicitar aprovação explícita para publicação Floot, domínio, Google Play/produção e quaisquer custos.
- [ ] Pós-deploy: smoke de login, pedidos, F05, F20, F10, relatório, notificações e rollback pronto.
- **Saída:** release final com hash, versão, URL, evidência e plano de suporte.

## 6. Matriz de risco e economia

| Risco | Gravidade | Contenção | Custo |
|---|---|---|---|
| Google Firebase Auth falha em iframe/WebView | Crítica | Gate G1; alternativa React + sessão correta; não prometer APK | 0 antes de compilar |
| Dupla baixa de estoque: Floot + GitHub | Crítica | Worker como único escritor nas fases autoritativas; idempotência | Infra atual |
| Licença Floot diverge da licença Firebase | Alta | Server-side como fonte de autorização, teste negativo | Infra atual |
| Estado V2 antigo sobrescrito por importação | Crítica | Backup, diff, migração por UID, dry-run e reversão | Infra atual |
| Branch QA antiga substitui correções da main | Crítica | Comparar SHAs; cherry-pick seletivo; smoke | GitHub atual |
| Liberação de pagamentos declarados como bancários | Alta | Campo/source/status de conciliação separado | Sem gateway pago |
| Limite Floot gratuito / 2 builds móveis | Média | Provar funcionalidade no navegador antes da build | 0 até autorização |
| Hospedagem Floot vira dependência desnecessária | Média | Priorizar o site oficial encapsulado se tecnicamente viável | 0 adicional |
| Divergência de recursos entre React e iframe | Alta | Não misturar telas parcialmente; migração em gates | Mais esforço de QA |
| Acessos/segredos expostos nos logs | Crítica | Nunca guardar tokens, JSON privado, IDs sensíveis | Sem custo |

## 7. Contrato de documentação obrigatória (append-only)

**Todo lote** precisa terminar com novo checkpoint no final deste LOG FLOOT. Nunca substituir o checkpoint anterior; corrigir por novo registro referenciado. Atualizar o Log Mestre só com link/resumo curto, evitando duas listas de pendências incoerentes.

Template obrigatório para cada execução:

### CHECKPOINT FLOOT — [data/hora America/Sao_Paulo] — [gate/identificador]
- **Tarefa e motivo:** objetivo, requisitos do Log Mestre e bloqueador anterior;
- **Antes:** branch, HEAD Git SHA, versão Floot, backup, ambiente QA, status de publicação;
- **Decisão/ADR:** por que abordagem adotada, alternativa rejeitada, risco e custo;
- **Executado:** arquivos/pontos alterados EXCLUSIVAMENTE via GitHub, commits e alterações de dependências; distinguir configuração Floot/transporte de código da autoria;
- **Testes:** comandos, dispositivo, cenários, contagem PASS/FAIL, logs sem segredos; código de saída e SHA;
- **Evidências:** screenshots/referências, outputs, endpoints QA e URLs que não contenham credenciais;
- **Falhas e correções:** erro, causa raiz, commit corretivo e novo teste;
- **Estado do gate:** NÃO INICIADO / EM EXECUÇÃO / BLOQUEADO / HOMOLOGAÇÃO PARCIAL / HOMOLOGADO;
- **Não executado:** riscos, ferramentas indisponíveis, custos, release/produção explicitamente NÃO alterados;
- **PRÓXIMA AÇÃO EXECUTÁVEL:** arquivo, chamada, teste e critério exato, sem exigir nova conversa;
- **Bloqueio humano real:** somente se obrigatório, com ação única solicitada ao proprietário.

Regra de status: testes do Worker já aprovados não qualificam automaticamente toda a UI Floot; cada linha deve mencionar o contexto.

## 8. Registro de execução deste próprio pedido

### CHECKPOINT FLOOT — 20/11/2026 — G0 planejamento e inventário
- **Pedido:** criar plano de engenharia completo e LOG FLOOT único que documente todas as ações planejadas, executadas e pendentes.
- **Fontes diretamente verificadas:** Log Mestre na branch f35 (182 mil caracteres aproximadamente); Floot static/__dev/floot-git-paridade.md; lista de arquivos Floot e componentes relevantes; get_publish_status; list_branches. Dados confirmados do Floot: ID do projeto, iframe inicial, módulos React, plano free, 2 compilações disponíveis, não publicado, sem branch separada.
- **Decisão:** este arquivo no GitHub f35 é fonte canônica; sem edição de código no Floot nesta execução. Vincular ao Log Mestre e à automação já existente, caso a ação de atualização esteja disponível, mantendo a autorização de publicação.
- **Executado:** criação deste plano mestre e backlog com estados, critérios, riscos, custo e próximo gate.
- **Não executado:** edição de telas Floot, publicação, criação de branch Floot, build APK, dados reais, mudança de main, contratação.
- **Status:** G0 parcial; engenharia planejada, inspeções G1 ainda pendentes.
- **PRÓXIMA AÇÃO EXECUTÁVEL:** iniciar G1 no projeto Floot ID acima, registrar screenshot_preview e run_code_in_browser do iframe/login em ambiente preview com conta QA; se ferramenta de preview exigir sessão aberta, registrar a limitação precisa e seguir para testes HTTP/CSP/origin no navegador controlado; classificar A/B. Nenhuma edição de Floot necessária para essa medição.
- **Custo autorizado:** R$ 0 em novos serviços.

## 9. Regra de retomada entre chats e automações

Quando o usuário disser "consulte Log Floot", "continue Floot" ou pedir evolução do APK:
1. Buscar **ESTE** LOG_FLOOT.md no GitHub branch f35 e ler o último checkpoint.
2. Ler o Log Mestre e conferir os commits recentes em main/f35.
3. Consultar estado real Floot (arquivo principal, publish_status, branches, versão, recursos), e PC QA se necessário.
4. Continuar o **primeiro gate executável não homologado**, sem começar do zero.
5. Executar correções/testes; registrar a nova evidência neste log ANTES de terminar.
6. Se houver progressos relevantes em F02/F05/F20/F10, referenciá-los no Log Mestre; nunca rebaixar F05 comercial já aprovada.
7. Publicação comercial, novo custo, mudança destrutiva ou edição de main/Floot precisam obedecer à aprovação explícita registrada.

**Último gate aberto:** G1 — validar iframe/login/origin/Android antes de escolher arquitetura definitiva e antes de gastar builds.


### CHECKPOINT FLOOT — 20/11/2026 — G0 persistência e automação vinculadas
- **Planejado:** manter Log Floot canônico para toda atividade Floot/Android, com histórico append-only e retomada automática da primeira etapa executável.
- **Executado com evidência:** LOG_FLOOT.md criado via GitHub commit 64e0af3dec9226eee315a8976b2a40f64cc14671; o Log Mestre foi atualizado para apontar a este arquivo no commit ee2851b55a4b46b8c0c66101df4bbe2ab1df19c2.
- **Automação existente:** Desenvolvimento Potê Batata, id Automation_05d302fb0ec08191a8676da8b87d37e8. Sua instrução foi atualizada com sucesso para ler obrigatoriamente o Log Mestre e o Log Floot e anexar checkpoints verificáveis a ambos conforme o domínio, preservando branch, limites de produção, custos e F05 homologada. Tarefa permanece habilitada no cron HOURLY original; nenhuma tarefa duplicada foi criada. **Não se presume que execução futura tenha ocorrido ou que tenha passado.**
- **Testes/verificação documental:** arquivo criado e lido via GitHub; links e hashes identificados. Inspeção Floot de leitura sem alterações: app não publicado e com entrada iframe para site oficial.
- **Não executado:** edição de código Floot, GitHub main, migração, publicação, build Android, ativação de serviços pagos, alteração de dados reais.
- **Estado:** G0 DOCUMENTAÇÃO CONCLUÍDA; G0 baseline operacional ainda parcial; G1 pendente.
- **Próxima ação executável:** G1 — obter captura do preview Floot e dados de DOM/erro do iframe, verificar login no contexto móvel de QA e registrar a decisão Trilha A/B; manter duas builds nativas disponíveis até decisão.

### CHECKPOINT FLOOT — 20/11/2026 — Agendamento diário às 09h
- **Pedido:** sincronizar o aplicativo Floot diariamente com atualizações já homologadas e publicadas no site oficial.
- **Executado:** automação separada `Sincronizar Potê no Floot`, ID `Automation_f9e6bb0639288191830d3d50cac5fc28`, ativa, agendada para todos os dias às 09:00 America/Sao_Paulo; próxima ocorrência confirmada para 21/11/2026 às 09:00 (-03:00).
- **Automação horária anterior:** `Desenvolvimento Potê Batata` mantida; não foi substituída.
- **Instrução permanente:** antes de executar, ler LOG_FLOOT.md e Log Mestre; comparar GitHub main/deploy do site oficial e projeto Floot; somente sincronizar alterações já aprovadas, pelo caminho GitHub → testes → Floot preview. Como a página principal do Floot é iframe do site oficial, não duplicar código nem tratar o simples iframe atualizado como prova de homologação mobile.
- **Contenção:** sem novos gastos, sem novos APKs/builds nativas, sem publicação Floot ou mutação de dados reais, sem mudança na produção Firebase/Worker/main. Se conector Floot indisponível, registrar precisamente o impedimento em vez de afirmar que atualizou.
- **Estado:** AGENDAMENTO CONFIRMADO, execução futura ainda NÃO realizada. Cada execução deve gerar checkpoint append-only com data, SHAs/versionamento, diferenças, ação, testes PASS/FAIL e próxima etapa.
- **Próxima ação:** auditoria e sincronização condicionada no primeiro agendamento, 21/11/2026 às 09:00 BRT.


### CHECKPOINT FLOOT — 20/11/2026 14h BRT — G1 leitura e dependência F02
- **Antes:** Floot `0ac73184-2ba0-41f8-9a16-fd1d03017e6d`, Free, não publicado, sem branches, 2 builds nativas restantes; main GitHub comercial divergente da f35 (f35 371 ahead/81 behind); PC `DESKTOP-9481JM1` online.
- **Executado G1:** `get_publish_status`, `list_branches`, `run_code_in_browser` e `screenshot_preview` mobile iPhone 393x852, sem mutações no Floot. DOM confirmou iframe `https://pdv.livresom.com/` sem atributo sandbox, dimensões 1280x800 na prévia desktop; parent não acessa `contentDocument` do iframe por cross-origin, comportamento normal. Screenshot mobile concluída. HEAD do site oficial HTTP 200, sem X-Frame-Options/CSP nos headers observados. Isto **não valida OAuth Google em iframe**, sessão persistente nem WebView Android.
- **Avanço GitHub que interessa ao Floot:** F02 numeração `#P` vitalícia no Worker, `order_create.mjs` `1b658fed`, bridge `87abd635`, teste REST `test_f02_order_sequence_emulator.mjs` `4e0c4258` (correções `e86ae1c5`, `68def75e`, reforço `225cbb8`). Resultado real no Emulator: 121/122 simultâneos após 120 histórico, cancelamento e replay sem duplicar, próximo 123, PASS exit 0. Worker 92/92 PASS, checkout bridge, app routes 21 áreas, combos e estoque PASS no PC. Log Mestre checkpoint commit `bdc52044`.
- **ADR:** não copiar código f35 para Floot nem trocar iframe por React sem G1 OAuth; manter duas builds e nenhuma despesa. Site oficial e Floot comercial intactos; não confundir atualização automática do iframe com sincronização de código homologada.
- **Gate:** G1 **HOMOLOGAÇÃO PARCIAL** (preview/iframe inspecionados; OAuth/Android pendentes). G3/F02 parcial, G5/F20 parcial, G6/F10 parcial; F05 comercial concluída no site, não inferir homologação Android.
- **Próxima ação executável:** inspecionar fluxo OAuth em ambiente QA sem credenciais pessoais, testar login Google e retorno do redirect no iframe/Chrome mobile; se bloqueado por third-party cookie/frame, escolher React/native shell com autenticação no top-level. Paralelamente implementar migração segura de `v2OrderSequence__<universe>` e checkout extras/combos no Worker; repetir regressão completa. Não gastar build APK antes de G1.
- **Não executado:** edição Floot, publicação, APK, migração de contas, alteração de main, Firebase comercial, Cloudflare comercial ou dados reais. Custo adicional R$ 0.


### CHECKPOINT FLOOT — 20/11/2026 14h BRT — G8 regressão integral do site LAB
- **Ambiente/HEAD:** PC `DESKTOP-9481JM1`, f35 `721103e1146987560c5327014c84e3de8106f05e`; Floot preview continua iframe do site oficial, sem edição nem publicação.
- **Teste completo:** `qa/mobile/run_everything.ps1 -SkipBuild` **PASS FULL_QA_EXIT=0, 96s**, `QA_LABORATORY_COMPLETED`. Chrome mobile, PDV, finanças, backups, sincronização, Worker 92/92, Firestore Rules referência e candidato 10/10 cada, Worker HTTP F02/F05/F20/F10 e nova sequência #P no Emulator PASS. Não se trata de teste de APK Android nativo nem de login Google real no iframe.
- **Estado:** G8 regressão WEB LAB aprovada, G1 OAuth/Android e G9 release pendentes. Não consumir builds nem ativar deploy. Próximo teste: autenticação real QA no top-level e no iframe, política de cookies/redirect; se incompatível, escolher shell React/native sem duplicar backend.


### CHECKPOINT FLOOT — 20/11/2026 — dependência do site F02/F20 para futura sincronização
- Tipo de execução: backend/website, NÃO atualização do projeto Floot. Código somente no GitHub f35; nenhuma mudança Floot, APK, produção, dados reais ou plano pago.
- F02: Worker de criação de pedido agora gera orderNumber sequencial atômico; a mesma transação sincroniza o metadado V2 orderSequenceLast e notifica o cliente. Teste emulado concorrência #P0000121/#P0000122, cancelamento e #P0000123 PASS, com replay idempotente. Projeto comercial sem marcador migrado recebe 409: contagem antiga NÃO pode ser zerada.
- F20: uma venda em dinheiro/Pix/cartão registra recebimento DECLARADO no pedido, sem segundo clique; na entrega fica pendente, e bankReconciled permanece falso. Testes unitários + Firestore Emulator PASS; backend Worker 93/93.
- Implicação para Floot: o React OrderComposerV5/helper orderSequenceV6 e a interface por iframe NÃO devem gerar um segundo número nem saldo depois que o Worker virar autoridade. Exigir propagação de orderNumber da resposta do servidor, recarregamento V2, mesmo campo de declaração de pagamento e sem ledger paralelo. A sincronização diária às 9h NÃO deve transportar alterações ainda não homologadas/publicadas no site oficial.
- Status: G3 (F02) e G5 (F20) ainda HOMOLOGAÇÃO PARCIAL no site; no Floot não transferido/homologado. G1 (iframe Google/Android) continua pendente.
- Evidência: commit master e7ddd561a3b1a8b2a781cabf164b393718fcc100; código F02 1b658fed/04f615eb, F20 dbd5069b, teste 15505915. Próxima ação executável no site: auditoria read-only da migração do contador histórico e fluxo de combos/caixa; no Floot, preservar só versões comerciais aprovadas.


### CHECKPOINT FLOOT — 20/11/2026 — auditoria de contador histórico F02 no site
- Criada no GitHub f35 a função read-only order_sequence_audit.mjs e sete testes para prova de numeração por empresa/universo. Reprova: listagem incompleta, números duplicados, ID repetido, pedidos antigos sem numeração e metadado/controle inconsistentes; só informa baseline sugerido sem escrever no Firestore.
- Commits: b40d787a e 722efbd7; Worker 100/100 PASS, incluindo 7/7 auditoria. O site/comercial e Floot não foram editados nem publicados nesta ação.
- Consequência para APK: após cutover F02, o Floot deve tratar a sequência #P e receipt declarada como resultado do servidor e não criar contador paralelo na UI.
- Próxima ação para transferência: apenas após a migração QA de pedidos/caixa e o G1 login Android; sincronização diária restrita às versões já homologadas em produção. Mantida a política sem gasto ou build APK.


### CHECKPOINT FLOOT — 20/11/2026 — dependências do site F02 (scanner/contador/canais/WhatsApp)
- **Antes:** entrada principal Floot continua iframe do site oficial publicado; F05 comercial permanece homologada, F02/F20 parcialmente homologados em QA, nenhuma atualização do Floot autorizada nesta etapa. GitHub main e f35 divergentes; PC QA online.
- **Executado apenas no GitHub f35:** scanner histórico paginado de Firestore (`order_sequence_scan.mjs`) prova completude das páginas e estabilidade V2/guard/pulse/controle, bloqueia duplicatas, erros e alterações concorrentes; QA bootstrap `order_sequence_bootstrap_qa.mjs` escreve exclusivamente no Firestore Emulator local loopback com gate projeto demo (não serve para contas comerciais). F02 frontend recebe `#P` do Worker, e a Vitrine local agora compartilha contador com Pedido/recibo. Carrinho em Worker mode bloqueia gravação local até haver contrato transacional server-side completo. Mensagens WhatsApp backportadas pontualmente da `main`, com `N° *#P0000001*`, quebras de linha e total formatado.
- **Evidência:** Log Mestre checkpoint commit `ae03ee8d07e9d99712edd5b1e626f40ea3d7f973`; GitHub f35 UI `250d8eb`, teste `0ca014b`, scanner `5105db9`, bootstrap local `1cb9911`. Execução integral `qa/mobile/run_everything.ps1 -SkipBuild` finalizou `FULL_QA_EXIT=0`, Worker 107/107, regras Firebase referência/candidato 10/10 cada, REST/SDK F02/F05/F20/F10 PASS; teste de UI específico posterior `test_app_routes.js` passou com mensagem WhatsApp e `#P`.
- **Floot:** NÃO editado, NÃO publicado, NÃO compilado APK, zero builds consumidas; nenhuma alteração de dados comerciais, main, Worker/Firebase produção, serviços pagos ou hospedagem. Por regra de economia, a automação diária das 09h só sincroniza versões efetivamente homologadas e publicadas no site oficial; estes commits f35 NÃO estão prontos para transporte automático.
- **Status:** G3/F02 QA parcial, G5/F20 QA parcial; G1 OAuth real em iframe/Android ainda pendente, G9 APK pendente. F05 comercial preservada.
- **Próxima ação executável:** implementar e homologar contrato único de carrinho server-only multi-item/combo/addon/bebida, sem preço/estoque informado pelo navegador; ensaiar conta QA multiusuário e migração do contador histórico/cash control, comparar release main para cherry-pick sem regressões; depois validar OAuth top-level e WebView antes de consumir qualquer build.
