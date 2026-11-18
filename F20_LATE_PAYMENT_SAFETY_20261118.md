# F20 — Prevenir cobrança duplicada sem dificultar a venda

**Data:** 18/11/2026  
**Projeto:** Potê Batata Pro  
**Prioridade comercial:** pequenos empresários operando o próprio caixa; segurança proporcional, sem exigir mais cliques nem serviços pagos.

## Defeito operacional reproduzido

Na situação de um pedido de um turno **já encerrado**, a rotina de conclusão de venda registra `late_payment` no caixa atual e marca o pedido como pago na mesma alteração do Firestore. A validação `validateCashJournalDiff` lia apenas o estado final do pedido e rejeitava indevidamente o lançamento por encontrar `paymentConfirmed(order) === true`. O teste de regressão foi executado contra a regra anterior e demonstrou a exceção `integrity/rejected`.

## Correção

A validação agora diferencia:
1. **Primeiro pagamento legítimo:** pedido não pago no estado anterior + confirmação e movimento compensatório na mesma alteração — **permitido**.
2. **Pagamento já confirmado antes da operação:** novo evento `late_payment` — **negado**.
3. **Evento sem confirmação efetiva no diff:** se o estado final está pago mas não ocorreu a transição de não pago para pago nessa operação — **negado**.

Conservam-se as verificações existentes de pedido real, valor integral, turno original, referência do comprovante, forma de recebimento permitida e unicidade do evento. Nenhum lançamento é criado em nome do cliente pelo mecanismo de teste. Turnos fechados continuam imutáveis.

## Testes

- Regressão "red-green": **falhou antes, passou após** o ajuste com `confirmPaymentOnSaleCompletion` e `validateCashJournalDiff`.
- Repetição de `Concluir`: não cria outro movimento de caixa nem outra sessão.
- Pagamento previamente confirmado: permanece bloqueado.
- Build do Firebase Hosting OK.
- Laboratório completo `qa/mobile/run_everything.ps1 -SkipBuild`: fluxos de vendas/PDV, Pix, cartão e dinheiro, cancelamentos, relatórios e emulação mobile.
- Firebase Emulator: **10/10 referência e 10/10 candidata**. Nenhum teste em banco de produção.

## Segurança, economia e limites

Esta correção busca **confiabilidade para pequenos comerciantes**, não um sistema bancário antifraude. Não introduz Cloud Functions, Cloud Run, faturamento Blaze, novas tarifas ou confirmação adicional depois de concluir a venda. O aplicativo continua usando as regras e transações Firestore já contratadas.

O risco de clientes intencionalmente modificados produzirem transações falsas ainda requer backend autoritativo. O usuário priorizou evitar custos e fricção para negócios onde o próprio proprietário opera o caixa; essa arquitetura adicional não foi ativada. Não se deve confundir testes automatizados com comprovante bancário.

A publicação só ocorre após aprovação de CI e revalidação HTTPS. Arquivos versionados no GitHub com rollback recuperável.
