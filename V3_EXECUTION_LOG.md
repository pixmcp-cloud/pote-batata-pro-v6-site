# Potê Batata Pro V3 — execução controlada das 37 melhorias

Data de início: 16/11/2026  
Base pública: commit `abdc516102515de4eb200ed77fd8a6b7dae0b668`  
Ramificação exclusiva de trabalho: `v3-audit-37-20261116`  
Regra de liberação: **nunca publicar em main sem testes e homologação da versão candidata**.

## Etapa 0 — Backup e diagnóstico (concluída)

- Tag de recuperação enviada ao GitHub: `before-v3-20261116` (aponta para `abdc516`).
- Bundle de código local: `C:\Users\LIVRESOM\Documents\GitHub\pote-batata-before-v3-20261116.bundle`. `git bundle verify` aprovado. SHA256: `452F980411F5E4B02701026C53EDA8613675F5A657A037E91FA8B9DA13B6A81A`.
- Backup lógico e **somente leitura** do Firestore: `C:\Users\LIVRESOM\Documents\PoteBatataBackups\firestore-v3-before-migration-2026-11-16T16-20-08-150Z.json`. 25 documentos de 4 coleções-raiz (`users`, `licenseAudit`, `franchiseAudit`, `franchiseCatalog`) e subcoleções. Verificação JSON/IDs únicos aprovada. SHA256: `4cff23bed1da3109dc73a74d101f94c327a8af886d6007b654081807ff13e82c`.
- Exportação Firebase Authentication (somente leitura): `C:\Users\LIVRESOM\Documents\PoteBatataBackups\firebase-auth-v3-before-migration-20261116.json`. 3 contas. JSON validado. SHA256: `8FE1BC6A3F39E8D08F285A3F23F16728DF5EB66BF121D3AC9F265F2381CB0709`.
- Testes da versão original `abdc516`: 48/48 aprovados. `node --check` dos componentes críticos aprovado.
- Firestore: nenhum backup gerenciado localizado; o export lógico **não** equivale a snapshot transacional e pode conter estados lidos em momentos diferentes.
- Não foram exportados conteúdos locais de IndexedDB/galeria que estejam exclusivamente em aparelhos. Não foram feitos testes de restauração em projeto Firebase secundário.
- Não foi modificado nenhum documento de produção, conjunto de regras, usuário ou licença. Nenhum plano pago ativado.

## Etapas V3 — Progresso por número de aprovação

| Número | Diagnóstico aprovado | Situação |
|---|---|---|
| 01 | Permissões FREE/PRO/FRANQUIA no servidor | Pendente; requer testes de regras |
| 02 | Histórico financeiro imutável | Pendente; bloqueio de alterações tardias do turno é mitigação parcial |
| 03 | Isolamento de caixa entre universos | Implementado na ramificação, teste de regressão V2 → V3 aprovado |
| 04 | Conciliação de turno encerrado | Mitigação implementada: resumo congelado e confirmação tardia rejeitada; fluxo de ajuste conciliatório ainda pendente |
| 05 | Recuperação de operações offline | Pendente |
| 06 | Cancelamentos pagos na apuração | Implementado no núcleo: venda cancelada fora do total de vendas, valor recebido destacado |
| 07 | Reembolso entre turnos | Implementado no núcleo: referencia turno de origem e protege duplicidade |
| 08–15 | Demais mudanças de integridade e banco | Pendentes |
| 16 | Referência obsoleta 60% | Código atualizado para mostrar a porcentagem da receita e identificar simulações de 40% |
| 17–37 | Demais melhorias | Pendentes |

### Arquivos modificados ou adicionados nesta ramificação

- `universe_core.js`: inclui `cashSessions`, `cashMovements` e `garimpoOffers` no isolamento entre negócios; versão de universo incrementada para 3.
- `pdv_cash_core.mjs`: bloqueia alteração do fechamento por confirmações tardias, preserva resumo encerrado, separa recebimento de venda cancelada e vincula reembolso ao turno original, mesmo quando pago em turno posterior.
- `pricing_explainer.js`: aviso de custo simulado deriva da porcentagem por receita; aceita marcações anteriores e atuais na validação de custos.
- `make_beta.py`: atualiza identificador de cache do módulo de precificação.
- Testes novos `test_v3_universe_financial_isolation.js` e `test_v3_cash_reconciliation.mjs`, mais regressão em `test_pricing_explainer.js`.

## Restrições e critérios de aprovação técnica

1. As correções acima são candidatas para homologação; **não** foram implantadas no site público.
2. O bloqueio de pagamento tardio evita alteração silenciosa de turno fechado, porém precisa de um fluxo específico de recebimento posterior por evento compensatório. Esse fluxo não será considerado concluído enquanto não existir e passar nos testes.
3. O cálculo de caixa distingue *venda efetiva* de *dinheiro recebido por pedido cancelado*. A restituição eletrônica ainda é externa e manual.
4. Nenhuma mudança de regra de segurança do Firebase será implantada sem teste de autorização no emulador ou homologação equivalente.
5. O plano de migração V3 exigirá ensaio de restauração, dupla verificação de contagem/valores e autorização explícita antes de qualquer exclusão ou transformação destrutiva.
6. Não usar os arquivos de backup como exemplos públicos: contêm registros comerciais e informações de autenticação; conservar fora do GitHub.

## Próximos marcos

- Etapa de segurança: regras comerciais por licença, registros financeiros append-only e testes no Firebase Emulator (Java não está instalado no PC autorizado; preparar ambiente isolado/CI).
- Etapa financeira: ajustes conciliatórios de recebimentos posteriores, pagamentos eletrônicos cancelados e custo histórico de estoque/pedidos.
- Etapa de banco: sincronização offline durável, ordenação persistente e redução de leituras integrais.
- Publicação somente após homologação, sem despesas pagas não autorizadas.

## Validação incremental da ramificação V3
- Suíte completa após primeiras correções: **50/50 testes locais aprovados**.
- `test_v3_universe_financial_isolation.js` comprova isolamento de caixa/movimentos/ofertas e compatibilidade de leitura com universo V2.
- `test_v3_cash_reconciliation.mjs` comprova snapshot de fechamento, bloqueio de confirmação tardia, vendas canceladas separadas e reembolso em turno posterior.
- `test_pricing_explainer.js` verifica alerta dinâmico de 40% sem voltar à mensagem antiga de 60%.
- `.github/workflows/v3-security-qa.yml` e `test_v3_rules_emulator.cjs`: testes do Firestore em **projeto demo isolado**, sem implantação; execução em CI a validar. O PC não dispõe de Java; CI provisiona temporariamente Java 21. Esses testes confirmam regras atuais de isolamento, não substituem a futura revisão da autorização comercial no servidor.
- Todos os comandos realizados nesta ramificação são de desenvolvimento/testes ou exportação somente leitura do Firebase. A versão `main` e as regras reais permanecem intactas.
