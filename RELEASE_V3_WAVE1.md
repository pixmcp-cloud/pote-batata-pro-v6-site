# Potê Batata Pro — V3: atualização gradual 1 (16/11/2026)

Esta publicação contém somente correções com regressão automatizada aprovada. Não é a conclusão de todas as 37 melhorias.

## Correções publicadas

- Dados financeiros de caixa, movimentações e ofertas separados por universo comercial (batataria, pizzaria etc.). Sem migração destrutiva.
- Caixa: resumo de turnos encerrados congelado, vendas canceladas fora das vendas ativas, reembolso de pedido antigo no turno atual, recebimentos posteriores por eventos de conciliação sem duplicar venda e confirmação manual de Pix/cartão.
- Produção: snapshot do custo histórico de ingredientes e bebidas no momento da baixa. Perdas posteriores usam o custo registrado e não o preço atualizado de compra.
- Cancelamento com perda bloqueado e revertido localmente se o módulo de registro de prejuízo falhar; não avançar silenciosamente.
- Estoque demonstrativo de franquia não entra como compra comprovada na média ponderada; exige conferência física quando apropriado.
- Ordenação de receitas preservada na persistência V2, inclusive em listagens com centenas de pedidos.
- Precificação: mensagem de porcentagem simulada passa a refletir a configuração vigente, sem a referência fixa antiga a 60%.
- Cache busting dos arquivos alterados para atualizar os módulos no navegador mobile.

## Homologação

- 52 de 52 testes de regressão na candidata, com compilação do HTML final.
- Smoke test headless Chrome: abertura e fechamento de caixa, pagamento Pix, pedido, produção, baixa e estorno de estoque, perdas, não pagamento, lista de compras e teclado numérico. 26 sabores × 5 pedidos e 11 bebidas × 10 unidades simulados sem saldos negativos.
- A candidata V3 integral (incluindo sincronização offline experimental) tem testes em ramo separado. A atualização publicada **não** altera o protocolo atual de sincronização remota, exceto a atualização das URLs de importação do módulo que inclui correção de ordenação.

## Limites e pendências

- A atualização não ativa as regras de Firestore V3 ainda em homologação, não remove o documento legado V1, não muda as licenças cadastradas, não ativa serviços pagos e não faz migrações destrutivas.
- As melhorias restantes abrangem autenticação/licença no servidor, diário financeiro íntegro, fila offline de grande porte, otimização de leituras, modularização, testes reais simultâneos e eventual emissão fiscal e pagamentos integrados.
- O PDV emite recibos não fiscais. Não confirme pagamentos eletrônicos sem conferência externa.

## Reversão

Ponto de partida: tag `before-v3-20261116` / commit `abdc516`. Reverter código pelo GitHub não reverte operações comerciais realizadas posteriormente. Não apagar registros para desfazer uma publicação.
