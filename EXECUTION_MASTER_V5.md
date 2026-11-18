# Potê Batata Pro | Candidata para homologação

Base de referência histórica `2ff10f3` (17/11/2026), atualizada nesta auditoria pela branch derivada de `main` em `a7796e4` (18/11/2026). O pacote usa `firestore.hardened.rules` para os testes de cotas. A configuração de produção `firebase.json` continua apontando para `firestore.rules`.

A página pública respondeu por HTTPS com o cliente `v4-pulse-20261117`. O acesso de leitura ao inventário privado de contas e metadados foi bloqueado pela revisão automática. Os resultados de compatibilidade abaixo usam contas sintéticas no emulador. As regras realmente implantadas foram verificadas por API autenticada em modo leitura em 18/11: SHA-256 `35bdcf296a11528fe298420e0f56373fe36bb6ee948e9f6eef57eb6f7520224b`, idênticas ao `firestore.rules` de `main` antes da correção F02. As contas atuais não foram inspecionadas nem modificadas.

Na rodada final, a suíte local da beta passou 81/81. O Firestore Emulator registrou 3 testes aprovados com as regras de referência e 7 com a candidata, incluindo os subcasos de contas antigas. A coleta de preços ao vivo ficou fora da suíte local.

## Itens da auditoria

| ID | Estado | Evidência ou pendência de aceite |
| --- | --- | --- |
| F01 | Implementado | Cálculos e reconciliação de pagamentos cobertos pela suíte Node da beta. |
| F02 | Parcial — proteção F02 implantada, falta backend confiável | Regras de produção verificadas por API exigem revisão e pulso atômicos e encerram escrita V1 após V2; cliente recusa baixas sem movimentação equivalente; 20 ingredientes + 4 bebidas testados com dois operadores. Publicação e CI aprovados no commit `f6f7643`, hash das regras `710e497a…`. Ainda não há validação autoritativa contra navegador adulterado. Ver `F02_INVENTORY_HARDENING_20261118.md`. |
| F03 | Parcial | Compras e ajustes preservam saldos pt-BR. O PDV rejeita valores inválidos sem gravar. Faltam os demais formulários. |
| F04 | Implementado | A suíte preserva markup personalizado e cobre cálculo para receitas novas. |
| F05 | Parcial; proteção adicional testada | O cancelamento agora confere também o histórico de movimentos positivos de estorno para impedir devolver estoque duas vezes quando `stockRestored` estiver ausente/incoerente; o teste cobre movimento já registrado e movimento que surge depois de abrir a janela. Falta enforcement autoritativo server-side, multiusuário e reembolso sob falha. |
| F06 | Pendente | O limite de transação mantém a operação íntegra. Falta protocolo para importações acima de 290 alterações. |
| F07 | Implementado | A suíte verifica a disponibilidade dos módulos essenciais. |
| F08 | Pendente | O gerador legado ainda serve de fallback. A remoção depende de validar a página-base e a galeria no fluxo normal. |
| F09 | Parcial | O PDV usa o parser financeiro compartilhado. Restam cálculos e conversões duplicados em outros módulos. |
| F10 | Parcial | Uma conta com `appState/main` e sem V2 deixa de abrir uma conta vazia. Faltam inventário, exportação e migração das contas exclusivamente V1. |
| F11 | Parcial | A substituição de um cadastro sujeito a cota verifica o ramo de origem e o de destino. Falta consolidar o contrato de autorização para todos os serviços. |
| F12 | Parcial | Ativos têm pontos únicos de inserção e a inicialização offline está demarcada. Antes das mudanças funcionais, o HTML gerado ficou idêntico byte a byte. Outras substituições do monólito continuam no build. |
| F13 | Implementado | A sincronização incremental reconhece as novas chaves e a suíte verifica o retorno à leitura integral quando se perde um pulso. |
| F14 | Implementado | A suíte cobre renderizações sem emissão de mudança quando os dados ficam iguais. |
| F15 | Pendente | Falta versionar e limitar as dependências entre módulos globais. |
| F16 | Testado | A inserção em uma lacuna saturada com 311 receitas faz duas escritas. A lista inteira volta na ordem esperada e mudanças acima do limite são recusadas. |
| F17 | Parcial | O login passou em Chrome emulado de 320 a 768 px. Faltam perfil de performance, acessibilidade e teste em Android físico. |
| F18 | Publicado nas regras; testado no Emulator | Inspeção autenticada das regras de produção mostrou proteção de coleções legadas para Free, idêntica à main em `a7796e4`; ataque SDK falhou no Emulator. Homologação em conta real ainda pendente. |
| F19 | Regras publicadas; testes de SDK no Emulator | Quotas por chaves canônicas já estão nas regras ativas. Testes Emulator rejeitam segunda receita Free e permitem Pro; validar fluxos reais, catálogo e tentativas alternativas antes de certificação comercial. |
| F20 | Parcial; proteção estrutural publicada | Além da imutabilidade existente, regras novas publicadas exigem pedido/turno de origem e conferência adequada em reembolso e pagamento tardio; verificação pós-deploy por API e SHA-256. Faltam validação server-side da existência do pedido, valor efetivo, antifraude e eventos atômicos. Detalhes em `SECURITY_F20_20261118.md`. |
| F21 | Pendente | Falta inventariar ativos publicados e decidir a hospedagem do SaaS comercial. |
| F22 | Implementado | Engenharia de cardápio coberta pelos testes da beta. |
| F23 | Testado em emulador | Exportação JSON, substituição dos dados e restauração em segunda sessão. Importação é cancelada se a conta ou o estado muda durante a leitura. Faltam backup e restauração de IndexedDB e teste físico. |
| F24 | Pendente | O acesso de administração ainda depende do contrato atual de autenticação. Falta migrar para UID ou claims com recuperação testada. |
| F25 | Implementado | A suíte cobre apresentação de integrações e estados indisponíveis. |
| F26 | Implementado | Política local de galeria por 42 horas coberta pela suíte. |
| F27 | Parcial | Ajustes para abas ocultas presentes na base. Falta medir CPU e leituras. |
| F28 | Testado localmente | Antes do login, pedidos e caixa começam zerados. O teste Chrome confere o estado real renderizado. O painel de simulação usa dados próprios. |
| F29 | Publicado/verificado, parcial | Workflow de regras `44224427191` aprovado no GitHub Actions; leitura autenticada do ruleset de produção e hash realizados. Nova proteção de saldo físico publicada em produção com release verificada por API e snapshot de rollback. |
| F30 | Implementado | Casos de isolamento e limpeza do Delivery cobertos pela suíte. |
| F31 | Parcial | Contrato do MaisDelivery tem testes locais. Falta homologar a integração com credenciais sandbox. |
| F32 | Adiado | Galeria continua local. |
| F33 | Parcial | Concorrência básica testada no Firebase Emulator. Falta validar dois dispositivos e estoque compartilhado entre ramos. |
| F34 | Testado localmente | Fornecedores e Radar usam cache temporário, limite por aba, timeout e alternativas manuais. GPS exige ação explícita. Os testes usam respostas simuladas do Photon. |
| F35 | Parcial | Dependências e versões do ambiente de QA estão fixadas. Falta testar contingência do CDN e autenticação em homologação. |

## Aceite para implantação

1. Inventariar contas exclusivamente V1, documentos V2 antigos e contas acima da cota. Validar exportação e restauração num ambiente isolado antes de migrar dados. A proteção do V2 bloqueia a criação de uma conta vazia sobre dados existentes.
2. Validar o leitor das duas famílias de chaves e a sequência de ativação. O cliente publicado precisa reconhecer as chaves novas antes da primeira gravação canônica e as regras candidatas precisam estar ativas quando o cliente começar a substituir registros de cota.
3. Fazer login Google com perfis de teste Free, Pro, Pro vencido e administrador. Conferir estoque, cotas, sincronização, backup e recuperação usando a mesma versão de cliente e regras em homologação.
4. Guardar a versão do site, o conteúdo das regras em produção e o ponto de recuperação dos dados. Após homologar, verificar o deploy e repetir os testes essenciais no ambiente publicado.

Para evidências de auditoria F18/F19/F02/F20/F29, hashes efetivos, bateria de testes e rollback, consulte `SECURITY_AUDIT_20261118.md` (atualizado após o deploy de regras).
