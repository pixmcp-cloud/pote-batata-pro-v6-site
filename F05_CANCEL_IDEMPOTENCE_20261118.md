# F05 — Evitar devolução de estoque duplicada no cancelamento

Em 18/11/2026, foi constatado que o cancelamento usava `stockRestored` e `stockReturnDeclined` como principais marcadores. Se o pedido ficasse sem o marcador, apesar de já existir uma movimentação positiva de estorno vinculada a ele, a interface poderia tentar devolver novamente.

## Correção
No `cancel_order_flow.js`, o guard `hasStockReturnMovement` busca movimentações positivas de estorno com `referenceId` igual ao pedido e razão conhecida (`Estorno de estoque por cancelamento` ou `Estorno bebida por cancelamento`). O cancelamento consultará essa trilha **antes de abrir a recuperação e novamente antes de alterar estoque**, impedindo devolução duplicada causada por marcador desatualizado.

O teste `test_cancel_order_audit.js` cobre um pedido antigo sem marcador de estorno e a chegada de um movimento após abertura do diálogo. Mantém os casos de cancelamento antes/depois da produção, perdas, ingredientes/bebidas, item inexistente e preservação do PDV. `make_beta.py` muda a versão do asset para que navegadores Android não utilizem cache antigo.

**Limitação:** somente o cliente honesto é protegido por esta validação. Segurança completa requer transações e eventos imutáveis no backend que validem pedido e restituição entre dispositivos. Portanto F05 permanece PARCIAL; não confundir prevenção de duplicidade visual com prova financeira.

Sem custo adicional, migração de dados ou acesso ao Floot.
