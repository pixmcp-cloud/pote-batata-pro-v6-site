# Potê Batata Pro — Auditoria de segurança | 18/11/2026

## Escopo e limites
Execução na worktree isolada `audit/f18-f19-f02-20261118`, derivada de `main` no commit `a7796e4921aa9a2d951bd5afbd80dd832ed731bf`. Projeto de produção: `potobatata-b71f3`, domínio oficial `https://pdv.livresom.com`. Nenhum dado foi apagado, migrado ou alterado no Firestore real nesta fase. Nenhum serviço pago foi ativado. Os testes de gravação foram executados **exclusivamente** no projeto demo `demo-pote-hardening` do Firebase Emulator.

## Ponto de recuperação
- Git bundle criado e verificado: `C:\Users\LIVRESOM\Documents\GitHub\_POTE_BACKUPS\pote-pre-security-20261118.bundle`.
- Regras efetivamente implantadas consultadas por API autenticada em modo leitura em 18/11/2026: ruleset `projects/potobatata-b71f3/rulesets/0e5d219e-8052-4eb9-9e61-66e0eabf9e20`.
- Hash SHA-256 das regras implantadas antes da nova correção: `35bdcf296a11528fe298420e0f56373fe36bb6ee948e9f6eef57eb6f7520224b`.
- Cópia em `C:\Users\LIVRESOM\Documents\GitHub\_POTE_BACKUPS\firestore-live-audit-20261118.rules`; conteúdo idêntico ao `firestore.rules` em `main` antes deste trabalho.
- Backup privado de dados de teste mais antigo: `firebase-pre-f19-20261117`; inventário de 293 documentos (não é backup recente de produção). Não carregar/commitar seus dados no GitHub.

## F18 / F19 / F29: evidências
As regras **efetivamente implantadas** no projeto principal já contêm bloqueios de escrita legada para Free, chaves de cota `free~base~<grupo>`/`free~extra~<grupo>`, IDs permitidos dos templates, isolamento por UID e proteção de perfis/finanças. Confirmado por igualdade SHA-256 entre regras implantadas e arquivo `main`, não por inferência do workflow.

Emulador:
- Referência: 3/3 testes aprovados (verificação de identidade, isolamento, concorrência 8/10, restauração).
- Candidata: 7/7 testes aprovados (escrita Free negada no legado; segunda receita/ingrediente/bebida fora da cota recusada; Pro autorizado; compatibilidade com V1 e V2).
- A aprovação **não substitui** smoke test autenticado no Android nem a avaliação de todas as tentativas possíveis de adulteração de registros Free/Pro. Não declarar segurança comercial 100%.

## F02/F20: vulnerabilidade reproduzida e mudança candidata
**Antes:** gravar `record.item.stock = -100` por chamada direta do SDK para ingrediente era permitido pelas regras de produção espelhadas no emulador. Teste negativo criado em `test_firestore_stock_nonnegative.cjs` falhou como esperado: `Expected request to fail, but it succeeded`.

**Correção:** `firestore.rules` e `firestore.hardened.rules` passam a impedir gravações de `stock` negativo, não numérico ou excessivamente grande nos registros de `ingredients` e `beverages`. A verificação usa apenas os dados da solicitação, sem novos `get()` ou leituras cobradas pelas regras. A preservação da revisão transacional do V2 permanece inalterada.

**Depois:** a suíte de quatro testes do Firebase Emulator passou (4/4), incluindo as três tentativas de saldo negativo e uma de estoque como texto; valores zero/positivos e atualização do nome continuaram permitidos. Os conjuntos anteriores F18/F19 também devem permanecer verdes no CI da branch.

**Compatibilidade com snapshot anterior de testes:** 22 saldos de bebidas e 137 saldos de ingredientes verificados no backup do dia anterior, todos como tipos numéricos (inteiros ou decimais). Snapshot é histórico e não comprova o estado atual de todas as contas.

**Limitação importante:** impedir saldo negativo não equivale a validação server-side de cada receita, quantidade consumida, reserva ou pagamento. Transações fraudulentas podem continuar possíveis por cliente adulterado. F02 e F20 permanecem **PARCIAIS**; não comercializar como estoque/financeiro inviolável.

## Requisitos de publicação
1. Executar testes no emulador com as duas configurações e suíte local de regressão.
2. Confirmar novamente que a versão ativa do ruleset corresponde à base de rollback.
3. Só promover `firestore.rules` com mudança mínima aprovada e evidência; nunca publicar `firestore.hardened.rules` por engano.
4. Após deploy, reler a release pelo API para comparar hash e testar operações normais; NÃO executar vendas gravando dados de teste no banco real.
5. Para qualquer rollback, usar explicitamente o backup de regras implantadas antes da atualização; não tocar contas, credenciais, Storage ou Floot.

## Próximas prioridades
- F02/F05: criar protocolo de checagem autoritativa de estoque/pedido para impedir oversell e reembolso duplicado por SDK; avaliar transações e custos, sem Cloud Functions paga sem autorização.
- F19/F20/F24: modelar alterações permitidas em templates, validar identidades/claims e trilha de eventos compensatórios.
- Problema da venda no cartão: reproduzir na conta afetada com backup local verificado e duas sessões; não assumir que a correção de aparência resolve conflito real.
- F06/F12/F15/F17: chunking >290 mudanças, build determinístico, contratos de módulos, performance e acessibilidade Android.
