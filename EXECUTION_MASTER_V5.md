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
