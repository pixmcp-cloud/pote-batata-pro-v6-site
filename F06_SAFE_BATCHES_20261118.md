# F06 — Importações V2 grandes com segurança | 18/11/2026

Implementação somente no repositório GitHub `pixmcp-cloud/pote-batata-pro-v6-site`, sem serviços pagos ou migração de dados.

## Falha corrigida
O V2 rejeitava qualquer alteração superior a 290 registros. Isso impedia importar catálogos grandes de receitas, clientes e fornecedores, mesmo quando as mudanças eram independentes e não afetavam vendas ou estoque.

## Solução implantável
- `v2_batch_planner.mjs` divide apenas registros não financeiros, não sensíveis e não destrutivos (grupos autorizados: recipes, clients, suppliers, recipeVersions, recipeTrash, checklist, garimpoOffers).
- Cada lote tem no máximo 150 registros e ~1,5 MB estimados; alterações até 290 registros conservam a transação única anterior.
- Itens de estoque, pedidos, pagamentos, despesas, exclusões e alterações de configurações em massa **não** são fracionados. Essas operações continuam bloqueadas acima do limite, para manter integridade.
- Cada lote é confirmado pelo Firestore antes de começar o seguinte. Se ocorrer falha intermediária, a memória de sincronização registra os documentos efetivamente confirmados. Ao tentar novamente, só envia os documentos pendentes.
- A página mostra quantos cadastros foram confirmados e orienta preservar backup local em falha parcial.
- Não existem novos serviços pagos, leitura de produção para testes, migração destrutiva, Cloud Functions, Storage ou alterações no Floot.

## Testes
- `test_v2_batch_planner.mjs`: 650 registros em lotes, limite de tamanho, proibição de excluir ou fracionar financeiro/estoque/pedidos.
- `test_v2_large_batch.mjs`: 650 registros confirmados, falha após 150 registros, 230 pendentes, recuperação sem duplicidade e bloqueio de 330 pedidos.
- `test_firestore_f06_bulk.cjs`: Firebase Emulator com 360 clientes Pro e 3 transações; 360 registros disponíveis em outra sessão autenticada.
- Testes de concorrência F02 e demais regressões mantidos. CI do GitHub executa os novos testes.

## Critérios que ainda exigem trabalho
F06 permanece **parcial** para importações financeiras e estoque acima de 290 registros. Essas precisam de uma operação de backend confiável e idempotente, sem fracionamento de pedidos sensíveis. Em caso de falha após um lote, o usuário deve preservar backup e continuar na mesma sessão; não recarregar antes de garantir sincronização. O mecanismo atual exige conexão até confirmar todos os lotes.

## Custos e reversão
A nova estratégia não introduz serviços pagos; operações normais de escrita/leitura do Firestore continuam sujeitas às cotas e tarifação do plano existente. Antes de publicar em produção, manter tag de rollback e backup Git, build completo, suíte de testes e Emulator aprovados.
