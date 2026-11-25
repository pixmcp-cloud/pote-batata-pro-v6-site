# Potê Batata Pro | Candidata para homologação

Base de referência histórica `2ff10f3` (17/11/2026), atualizada nesta auditoria pela branch derivada de `main` em `a7796e4` (18/11/2026). O pacote usa `firestore.hardened.rules` para os testes de cotas. A configuração de produção `firebase.json` continua apontando para `firestore.rules`.

A página pública respondeu por HTTPS com o cliente `v4-pulse-20261117`. O acesso de leitura ao inventário privado de contas e metadados foi bloqueado pela revisão automática. Os resultados de compatibilidade abaixo usam contas sintéticas no emulador. As regras realmente implantadas foram verificadas por API autenticada em modo leitura em 18/11: SHA-256 `35bdcf296a11528fe298420e0f56373fe36bb6ee948e9f6eef57eb6f7520224b`, idênticas ao `firestore.rules` de `main` antes da correção F02. As contas atuais não foram inspecionadas nem modificadas.

Na rodada final, a suíte local da beta passou 81/81. O Firestore Emulator registrou 3 testes aprovados com as regras de referência e 7 com a candidata, incluindo os subcasos de contas antigas. A coleta de preços ao vivo ficou fora da suíte local.

## Itens da auditoria

| ID | Estado | Evidência ou pendência de aceite |
| --- | --- | --- |
| F01 | Implementado | Cálculos e reconciliação de pagamentos cobertos pela suíte Node da beta. |
| F02 | Reforçada, backend confiável ainda pendente | Cada pedido que entra em produção exige baixa equivalente ao consumo de ingredientes/bebidas. Mantidas regras Firestore de revisão/pulso atômicos e bloqueio de estoque negativo. Testes Node e Emulator aprovados. Falta proteção autoritativa contra clientes modificados. |
| F03 | Parcial | Compras e ajustes preservam saldos pt-BR. O PDV rejeita valores inválidos sem gravar. Faltam os demais formulários. |
| F04 | Implementado | A suíte preserva markup personalizado e cobre cálculo para receitas novas. |
| F05 | Estorno auditado, dispositivo físico pendente | Conferência de cada ingrediente/bebida devolvido, quantidade e saldo recomposto; cancelamento por perda exige evento de prejuízo. Testes unitários aprovados. Falta teste real entre aparelhos e execução autoritativa. |
| F06 | Parcial — importações não financeiras grandes implementadas | Gravação progressiva segura de receitas, clientes e fornecedores em lotes de até 150 documentos/1,5 MB. Testes com 650 cadastros, falha após 150 e retomada idempotente; 360 cadastros em 3 transações no Firestore Emulator. Pedidos, estoque, financeiro, exclusões e mudanças de configuração acima de 290 seguem bloqueados para preservar atomicidade. Ver `F06_SAFE_BATCHES_20261118.md`. |
| F07 | Implementado | A suíte verifica a disponibilidade dos módulos essenciais. |
| F08 | Pendente | O gerador legado ainda serve de fallback. A remoção depende de validar a página-base e a galeria no fluxo normal. |
| F09 | Parcial | O PDV usa o parser financeiro compartilhado. Restam cálculos e conversões duplicados em outros módulos. |
| F10 | Migração segura implementada, aplicação em contas reais pendente | Backup V1 baixado/reaberto e conferido, todos os 19 grupos preservados inclusive FREE legado, cópia em lotes retomáveis, V2 parcial bloqueado e ativação só após conferência. Falha/retomada testada no Emulator; original V1 nunca apagado. |
| F11 | Parcial | A substituição de um cadastro sujeito a cota verifica o ramo de origem e o de destino. Falta consolidar o contrato de autorização para todos os serviços. |
| F12 | Parcial | Ativos têm pontos únicos de inserção e a inicialização offline está demarcada. Antes das mudanças funcionais, o HTML gerado ficou idêntico byte a byte. Outras substituições do monólito continuam no build. |
| F13 | Implementado | A sincronização incremental reconhece as novas chaves e a suíte verifica o retorno à leitura integral quando se perde um pulso. |
| F14 | Implementado | A suíte cobre renderizações sem emissão de mudança quando os dados ficam iguais. |
| F15 | Pendente | Falta versionar e limitar as dependências entre módulos globais. |
| F16 | Testado | A inserção em uma lacuna saturada com 311 receitas faz duas escritas. A lista inteira volta na ordem esperada e mudanças acima do limite são recusadas. |
| F17 | Parcial — 8 perfis Chrome Android emulados | 320, 360, 375, 390, 430 px, paisagem, tablet e desktop aprovados; 5 vendas PDV simuladas, zero vazamento pré-login ou overflow. Android OS nativo não homologado (AVD ausente e virtualização desabilitada). |
| F18 | Publicado nas regras; testado no Emulator | Inspeção autenticada das regras de produção mostrou proteção de coleções legadas para Free, idêntica à main em `a7796e4`; ataque SDK falhou no Emulator. Homologação em conta real ainda pendente. |
| F19 | Regras publicadas; testes de SDK no Emulator | Quotas por chaves canônicas já estão nas regras ativas. Testes Emulator rejeitam segunda receita Free e permitem Pro; validar fluxos reais, catálogo e tentativas alternativas antes de certificação comercial. |
| F20 | Proteções operacionais reforçadas, conciliação bancária pendente | A conclusão de venda de turno já encerrado agora aceita pagamento tardio e confirmação do pedido na mesma transação, sem duplicar recebimento. Repetições e pagamento previamente confirmado continuam negados. Mantidas validação de valores, turno, pedido, reembolsos e regras Firestore. Regressão completa e Emulator aprovados. Ver `F20_LATE_PAYMENT_SAFETY_20261118.md`. |
| F21 | Pendente | Falta inventariar ativos publicados e decidir a hospedagem do SaaS comercial. |
| F22 | Implementado | Engenharia de cardápio coberta pelos testes da beta. |
| F23 | Emulação de arquivo comprovada, físico pendente | Arquivo de backup JSON da conta correta aceito e arquivo de UID diferente recusado em Chrome headless com input de arquivo real. Backup/restauração de IndexedDB e dispositivo Android físico ainda pendentes. |
| F24 | Implementado com claim; homologação de dispositivo pendente | Conta ADM Google verificada recebeu `potebatataAdmin:true` no Firebase Auth; servidor e módulos de administração agora exigem claim assinada junto ao e-mail e provedor Google. Emulator rejeita mesmo e-mail sem claim ou claim em outra identidade. Backup e rollback preparados. Falta smoke test da central ADM no Android físico. Ver `F24_ADMIN_AUTH_20261118.md`. |
| F25 | Implementado | A suíte cobre apresentação de integrações e estados indisponíveis. |
| F26 | Implementado | Política local de galeria por 42 horas coberta pela suíte. |
| F27 | Parcial — latência/3G e offline emulados | Chrome DevTools simulou rede móvel lenta e perda de conexão, com layout preservado. Falta perfil de CPU/memória e medições de leituras reais no Firestore. |
| F28 | Testado localmente | Antes do login, pedidos e caixa começam zerados. O teste Chrome confere o estado real renderizado. O painel de simulação usa dados próprios. |
| F29 | Publicado/verificado, parcial | Workflow de regras `44224427191` aprovado no GitHub Actions; leitura autenticada do ruleset de produção e hash realizados. Nova proteção de saldo físico publicada em produção com release verificada por API e snapshot de rollback. |
| F30 | Implementado | Casos de isolamento e limpeza do Delivery cobertos pela suíte. |
| F31 | Parcial | Contrato do MaisDelivery tem testes locais. Falta homologar a integração com credenciais sandbox. |
| F32 | Adiado | Galeria continua local. |
| F33 | Parcial — concorrência/isolamento emulados | Duas sessões no Firebase Emulator concorrem por estoque; apenas uma gravação confirma. 8 perfis de Chrome touch testados. Falta homologar aparelhos reais e sincronização entre ramos. |
| F34 | Testado localmente | Fornecedores e Radar usam cache temporário, limite por aba, timeout e alternativas manuais. GPS exige ação explícita. Os testes usam respostas simuladas do Photon. |
| F35 | Parcial — fallback navegador testado | 8 perfis abriram com acessos externos bloqueados, sem erros JS reportados no fluxo simulado; Puppeteer Core versionado no CI. Login Google real e contingência completa de CDN ainda pendentes. |

## Aceite para implantação

1. Inventariar contas exclusivamente V1, documentos V2 antigos e contas acima da cota. Validar exportação e restauração num ambiente isolado antes de migrar dados. A proteção do V2 bloqueia a criação de uma conta vazia sobre dados existentes.
2. Validar o leitor das duas famílias de chaves e a sequência de ativação. O cliente publicado precisa reconhecer as chaves novas antes da primeira gravação canônica e as regras candidatas precisam estar ativas quando o cliente começar a substituir registros de cota.
3. Fazer login Google com perfis de teste Free, Pro, Pro vencido e administrador. Conferir estoque, cotas, sincronização, backup e recuperação usando a mesma versão de cliente e regras em homologação.
4. Guardar a versão do site, o conteúdo das regras em produção e o ponto de recuperação dos dados. Após homologar, verificar o deploy e repetir os testes essenciais no ambiente publicado.

Para evidências de auditoria F18/F19/F02/F20/F29, hashes efetivos, bateria de testes e rollback, consulte `SECURITY_AUDIT_20261118.md` (atualizado após o deploy de regras).

## Atualização complementar — 18/11/2026
Relatório financeiro das franquias: botão Relatório somente em conta de franquia Potê Batata ativa na Central ADM; gráficos de vendas/recebimentos/despesas semanais e mensais, métodos de pagamento, estornos, despesas e resultado estimado. Dados consultados por unidade, sem compartilhamento entre franquias. Documento técnico: F02_F05_F10_F20_FRANCHISE_20261118.md.

## Laboratório contínuo de QA mobile — 18/11/2026
Regressão de navegadores e Firebase Emulator automatizada para cada novo push no GitHub, com bloqueio antes da publicação GitHub Pages caso os testes mobile falhem. Resultado local: oito perfis Chrome com touch, cinco vendas automáticas e oito cenários do painel de franquia; 10/10 testes de referência e 10/10 de regras candidatas.
Correções financeiras adicionais: calendário de Brasília nos gráficos diários e proteção contra contagem dupla de recebimento tardio. Detalhes em MOBILE_QA_20261118.md. Esta emulação não substitui Android OS nem backend antifraude.
## Cloudflare Workers — prova de conceito operacional, sem ativação (18/11/2026)

Foi preparado em workers/antifraud um Worker para validar login Firebase e calcular baixa de estoque no servidor, executando produção/cancelamento com transações Firestore idempotentes (estoque, pedido, movimentos, guarda/pulso, auditoria). A versão não muda a interface do sistema oficial nem as regras Firestore vigentes. O interruptor ENABLE_WRITES permanece FALSE.

Validação local: código compilado por Wrangler, endpoint /health HTTP 200 e operações de escrita bloqueadas HTTP 423; 19 testes Node de JWT com assinaturas RSA, concorrência entre clientes, falta de estoque, cancelamento, idempotência e Firestore REST passaram. Fluxo de produção real e conta Cloudflare não foram ativados porque o Wrangler ainda não está autenticado nesta máquina e a conta de serviço do Google não foi configurada como Secret.

O Worker também permanece limitado para o caso de planos Free e exige contas Pro/franquia legítimas; o fluxo de clientes Free não foi afetado. Ainda é necessário vincular a conta Cloudflare Free, homologar contra Firestore real em ambiente de teste, integrar chamadas do aplicativo e então bloquear escrita direta do cliente em regras Firestore, com rollback. Não há custo mensal adicional ativado.

## Ponte de integração pronta (ainda desativada)
O frontend possui `worker_bridge.mjs` com autenticação Firebase, sincronização prévia, UUID persistido em retries, falha fechada e reload V2 após confirmação de produção/cancelamento. Em `firebase_integration.js`, `CLOUD_WORKER_ACTIVE=false` impede sua execução em contas reais. `test_worker_bridge.mjs` validou as respostas, timeouts e duplicidades. O Firestore Emulator passou os testes transacionais de estoque e concorrência em duas regras distintas. **O teste REST de transações na versão Java do Emulator não é confiável** por falha de interpretação de BYTE_STRING; REST é validado em unitários simulados, e Firestore SDK valida transações reais do emulator. Para ligar produção ainda são necessárias credenciais de servidor, testes REST reais em ambiente isolado e regras Firestore que proíbam bypass do cliente. Ver `CLOUDFLARE_BRIDGE_STAGING_20261118.md`.

## Log Mestre — V6 / Cardápio Digital — 24–25/11/2026

Repositório canônico: `pixmcp-cloud/pote-batata-pro-v6-site`, branch `main`. Este arquivo conserva o nome histórico EXECUTION_MASTER_V5.md para preservar o histórico; novas alterações pertencem à V6. Não editar Floot nem contratar serviços adicionais sem solicitação. Prévia: https://pixmcp-cloud.github.io/pote-batata-pro-v6-site/cardapio/ .

- Central de Operações: card Cardápio ao lado de Hub Delivery; gestão e publicação por loja autenticada, com slug exclusivo, seleção de produtos e preços. PRs 22–23.
- Oito imagens oficiais de alimentos, incluindo carne/cheddar, cachorro-quente e pizza; WebP local. PRs 23–24. Ficha de ingredientes recolhida em Ver detalhes, publicação opcional somente dos nomes, sem custos/quantidades. PRs 25–26. Combos retirados do cardápio público, preservados no PDV. PR 27.
- Artes locais de refrigerante lata e água mineral, ficha de bebidas com sabores e temperatura em vez de ingredientes de lanches. PRs 28–31. Gelado (padrão) ou Fora do gelo, sem opção redundante. Sabores Cola, Guaraná, Laranja e Soda; Normal/Zero por SKU, opções sem disponibilidade desabilitadas, preço e identificação da variante na sacola.
- Capa 16:9, abertura CARDÁPIO alternada com cada foto do catálogo; arte dourada 3D enviada pelo proprietário, recorte com topo preservado, vapor animado em quatro camadas. Regra por loja: fotos publicadas do próprio catálogo, sem fotos Potê em lojas comuns; imagens locais JPEG/PNG/WebP compactadas e publicadas mediante confirmação. Sem fotos, permanece a abertura. PR 32.
- Refrigerante 600 ml: nova arte azul REFRI local WebP 256x256, grupo em Bebidas, preço de referência normal R$ 9 e zero R$ 10 (catálogo operacional existente), opções por sabor e versão, Gelado/Fora do gelo. Soda normal demonstrativa; Zero Soda bloqueado quando não cadastrado. Não altera estoque nem preço de SKU real, não cria compra ou venda. Foto gerada genérica, sem marca Pepsi.
- Qualidade: deploys anteriores 45535676229 e 45536060284 bloqueados por navegação Chrome após fechar sacola. PR 31 corrigiu barras fixas, toast e teste real de toque. Merge 55f4cb0c572a4b571737decf7720fede77f2b3a1; teste Chrome em cinco larguras aprovado, publicação posteriormente visualizada pelo proprietário. PR 32 reúne refinamentos, multi-loja e bebidas. Testes anteriores da PR 32 até commit 626c47231ded73763df43701bd4953b3c70533ab aprovados em cardapio/session-isolation/firestore-emulator; a revisão com 600 ml requer nova validação e deploy. Não declarar publicada antes de verificar o workflow final e URL.
- Pendências: estoque exibido na loja é o estado da última publicação (booleano por variante, sem divulgar quantidades); sincronização em tempo real e reserva transacional, checkout real, homologação de contas/lojas reais e dispositivo físico permanecem pendentes. Não alterar dados privados ou regras Firestore para esta entrega. Sem custos adicionais planejados.

## Cardápio V6 — confirmação e água (25/11/2026)
Modal aprovado: X fixo cancela os itens ainda não confirmados, Adicionar prepara a seleção e Confirmar grava uma única vez na sacola e fecha; Confirmar direto também inclui seleção válida. Cabeçalho/rodapé fixos fora da rolagem. Água mineral agrupada por volume com seletor Sem gás/Com gás; SKU e preço próprios (demonstração R$4/R$5 por 500 ml), bloqueio de variante sem estoque publicado. Sem pedidos reais, cobrança ou alteração do estoque. Correção em PR independente da arquitetura de planos.

## Cardápio V6 — remoção visível na sacola (25/11/2026)
Diagnóstico: lista flexível de produtos e formulário com rolagens independentes comprimiam as linhas em telas móveis, escondendo Remover. Correção: uma única rolagem abaixo do cabeçalho, itens sem compressão, botão vermelho Remover por linha, atualização imediata dos totais e aviso. Teste Chrome inclui hit-test real e remoção de duas águas com gás, preservando os outros itens. PR separada; publicação somente após testes.

## Cardápio V6 — engrenagem e gestão da vitrine (25/11/2026)
Engrenagem ao lado de Compartilhar abre menu do lojista: link, visibilidade de produtos, publicação/detalhes, marca. Encaminha ao painel autenticado do próprio PDV, inclusive a partir de loja pública; valida proprietário do slug. Alteração de link por transação Firestore, novo endereço livre e desativação do anterior atômicos, sem apagar dados privados. Busca, seleção em massa, ocultar por desmarcação e republicação, aviso de ingredientes, atualização e retirada do ar. Não há alterações de regras nesta etapa. Ocultar todos exige retirar do ar, porque publicação vazia não é aceita. Testes Chrome e revisão de acesso; não confundir com checkout real ou publicação já confirmada.

## V6 — Oferta de conversão FREE (25/11/2026)
Oferta interna premium após carregamento de sessão Google FREE: 30 segundos de regressiva, X liberado ao final; pode sair da conta a qualquer momento. Exibição única por sessão no navegador, sem repetir em navegação/refresh, novo login após logout reexibe. PRO, teste ativo, vitalício, franquia e ADM isentos. CTA WhatsApp oficial, sem cobrança automática nem preço inventado. Benefícios apresentados sem prometer recursos ainda em homologação. Sem anúncios externos, dados adicionais ou créditos IA. Teste de regressiva, troca de sessão e ativação PRO incluído. Implementação candidata separada da mudança estrutural FREE/PRO.

Revisão aprovada da oferta FREE: substitui os 30s por 15s no primeiro acesso identificado neste navegador, 10s nos logins seguintes e 5s a cada 50 cliques válidos de interação. Campanhas rotativas; cliques sintéticos, propaganda, controles desabilitados e digitação não contam. Oferta recorrente fica pendente até a Home sem modal ou bloqueio de sincronização, nunca interrompe pedidos/caixa. Contador local por sessão/conta; sem rastreamento externo, sem cobrança. PRO, franquia, ADM e licenças ativas isentos. Primeiro acesso não é sincronizado entre dispositivos.

## V6 — publicação e APK (25/11/2026)
PR 37 aprovada e integrada em 8b34afd; QA sessão, cardápio e Firestore passaram. Deploy Pages 45547528344 falhou no contrato de bootstrap por marcador de cache do login: o teste da oferta 15/10/5s passou, mas o novo sufixo havia removido a referência à moderação por UID. Corrigido marcador preservando moderation-20261121 e acrescentando free-offer-2; sem redução de testes. Firebase Hosting oficial pdv.livresom.com ainda não atualizado: Desktop Commander atingiu cota mensal, ferramenta instruiu não repetir/reconectar. Floot Potê Batata Pro 0ac73184-2ba0-41f8-9a16-fd1d03017e6d publicado em batata.floot.app desde 21/11; OfficialPdvFrame carrega exclusivamente pdv.livresom.com. APK instalado via WebAPK/PWA é contêiner do mesmo domínio, não uma cópia dos módulos. Floot informa 2/2 builds nativos gratuitos restantes até 01/12; não gastar uma compilação de versão funcionalmente antiga nem mudar origem de autenticação. Prioridade: confirmar deploy GitHub, publicar Firebase Hosting a partir do commit homologado e validar login FREE/PRO, cardápio e atualização no APK existente; se necessário, build Android após paridade. Nenhum serviço pago, mudança de banco ou regra de segurança.

## V6 comercial: segmento único — 25/11/2026
Candidata anterior PR33 atualizada sobre main b1b65f3. FREE escolhe um segmento entre Batataria, Pizzaria, Hamburgueria/sanduíches, Hot Dog, Pastelaria; Lancheria somente PRO. Escolha persistida uma vez no perfil; ADM pode corrigir. PRO acessa os seis; na expiração dados preservados. Novas contas FREE usam estoque separado. Catálogo público e propaganda existentes preservados. Regras Firestore candidatas devem ser implantadas e validadas antes de ativar cliente; cotas propostas e timbres ainda pendentes. Não migrar/destruir dados.
