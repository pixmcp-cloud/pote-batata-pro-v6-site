# F02 — Integridade de pedidos, estoque e concorrência | 18/11/2026

## Contexto
Aplicação Potê Batata Pro, `https://pdv.livresom.com`, código fonte GitHub `pixmcp-cloud/pote-batata-pro-v6-site`, Firebase `potobatata-b71f3`. Base de reversão: `ac47ae3`. Trabalho implementado exclusivamente pelo GitHub (worktree `fix/f02-inventory-invariants-20261118`), sem alterações diretas em Floot, serviços novos pagos ou migração destrutiva.

## Diagnóstico reproduzido
- O V2 já protegia uma venda legítima com `runTransaction` e `v2InventoryGuard`, mas uma gravação direta do SDK no registro de estoque não precisava seguir esse protocolo.
- Uma mudança direta no status do pedido podia ser feita sem uma notificação completa para as outras sessões.
- O cliente podia iniciar uma sincronização V2 com queda física de estoque sem criar uma movimentação equivalente (a validação de mudanças era apenas de formato e tamanho).
- A rota legada Firestore de Pro permanecia gravável mesmo depois da ativação do V2, criando uma superfície paralela sem controle transacional.

## Correções técnicas (sem backend pago)
1. `firestore.rules` e `firestore.hardened.rules`: para alterações de saldo físico, transições de pedidos, exclusões de inventário e criação/alteração de pedidos, compras, perdas e movimentos, exigem **na mesma transação** aumento exatamente unitário da revisão, evento novo no documento `appState/v2Pulse`, `updatedAt=request.time`, `sensitive=true` e inclusão da chave alterada em `changedKeys`.
2. Movimentos de estoque existentes não podem ter o conteúdo econômico alterado (somente a posição de ordenação permanece editável sob o protocolo).
3. Usuário Pro em conta exclusivamente V1 pode continuar escrevendo nas coleções legadas. Quando `appState/v2` existe, as rotas V1 deixam de aceitar novas escritas pelo proprietário. O administrador verificado mantém direitos de manutenção.
4. `inventory_integrity.mjs` é executado pelo `v2_storage.mjs` **antes** do `runTransaction`. Se o estoque físico de ingrediente/bebida cair, é obrigatório haver novos movimentos negativos da mesma filial e item na alteração, com soma igual ao delta físico (tolerância de arredondamento de 0,00002) e saldos internos coerentes. Caso contrário, a operação inteira falha, sem gravar pedido ou estoque na nuvem.
5. O build e importação do módulo estão versionados para evitar cache desatualizado no Android; testes permanentes adicionados ao CI.

## Evidências
- `test_inventory_integrity.mjs`: exige movimentação equivalente, testa inconsistência da soma, saldo do movimento, bebida, múltiplos lançamentos, separação entre universos e preservação de entradas demonstrativas.
- `test_firestore_f02_atomic_guard.cjs`: bloqueia tentativa de gravar diretamente via SDK, pulso ausente, chave divergente, alteração de pedido sem protocolo e escrita Pro legada após ativação V2.
- `test_firestore_f02_multistock.cjs`: 20 ingredientes, 4 bebidas, 24 movimentos e um pedido na mesma transação. Duas sessões concorrentes tentam consumir o mesmo estoque; somente uma é confirmada.
- `test_firestore_v2_live_concurrency.cjs`: duas sessões disputam 8 unidades de um saldo de 10, com uma única baixa confirmada.
- `test_firestore_stock_nonnegative.cjs`: saldo negativo ou texto rejeitado no servidor; edição válida somente com guarda/pulso.
- `test_firestore_free_client.cjs`, `test_v2_storage.mjs`, `test_hardening_concurrent_clients.mjs` atualizados para gerar movimentos de baixa consistentes.

## Compatibilidade e economia
- Sem coleções novas, migrações, funções pagas, filas, alterações de plano, reinicialização de estoque ou gravação de testes em produção.
- A verificação local ocorre em memória; não consome operações da nuvem.
- As regras consultam guarda/pulso do Firestore via `get()/getAfter()`: podem acrescentar acesso a documentos e consumo de leitura, embora os mesmos caminhos sejam reutilizados na transação. Monitorar métricas do Firebase após publicar.
- Para histórico V1, a leitura/exportação continua permitida; a restrição de escrita é apenas para contas já V2. Testar recuperação de contas antigas e autenticação real antes de liberar SaaS.

## Limite de confiança — F02 ainda não é antifraude completa
Um navegador adulterado e autenticado pode fabricar uma transação que atualize guarda, pulso e estoque simultaneamente e enviar dados falsos da produção. A regra não consegue calcular de forma independente fichas personalizadas arbitrárias nem verificar recibos físicos. **Isso exige backend confiável**, com autorização, operações idempotentes, validação de composição de receitas e ledger por pedido/ingrediente, antes de afirmar F02 completamente resolvida contra agentes maliciosos. Cloud Functions/Run com faturamento não foram ativados nem autorizados. F02 é **parcial, mas endurecida no servidor e no cliente**, até essa segunda arquitetura.

## Plano de publicação e reversão
- Backup Git bundle verificado: `C:\Users\LIVRESOM\Documents\GitHub\_POTE_BACKUPS\pote-pre-f02-20261118.bundle`.
- Conferir por API as regras efetivamente ativas, guardar conteúdo e hash antes de deploy.
- CI Node + testes Emulator nas duas configurações. Só publicar após aprovação, preservando a branch de recuperação `rollback-pre-f02-20261118`.
- Publicar primeiro o cliente compatível pelo Firebase Hosting, depois `firebase deploy --only firestore:rules` para o mesmo projeto.
- Reler regras por API para confirmar hash; verificar ativos reais no domínio oficial via HTTPS, sem gerar vendas de teste em contas reais.
- Caso detectado bloqueio indevido, restaurar regras anteriores usando arquivo de backup autenticado, e cliente anterior pela release/tag; não excluir documentos.

## Implantação comprovada em produção
- Commit do código e dos testes: `f6f7643` (branch `main`), rollback `rollback-pre-f02-20261118`.
- CI geral aprovado: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/actions/runs/44242638871
- CI de regras aprovado: https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/actions/runs/44242638870
- Regressão local: 90/90 comandos de testes Node; 7/7 testes Emulator de referência; 11/11 testes Emulator candidato.
- Deploy oficial: `firebase.cmd deploy --only hosting --project potobatata-b71f3` e depois `firebase.cmd deploy --only firestore:rules --project potobatata-b71f3`; ambos relataram `Deploy complete`.
- Verificação HTTPS no domínio `https://pdv.livresom.com`: HTTP 200 nos arquivos `index.html`, `firebase_integration.js`, `v2_storage.mjs` e `inventory_integrity.mjs`, com conteúdo compatível com a nova versão.
- Ruleset ativo consultado via API autenticada após a implantação: `projects/potobatata-b71f3/rulesets/13a5307f-907f-4efa-9d3a-5562fde39f61`.
- SHA-256 das regras ativas igual ao `firestore.rules` validado: `710e497aadcc7e365b106fc929964bfcfbd2b6e1f0659f523f4f39eaff6e97f0`.
- Backup de regras imediatamente anterior: `C:\Users\LIVRESOM\Documents\GitHub\_POTE_BACKUPS\firestore-live-pre-f02-20261118.rules` SHA-256 `691cfb3f41e93ab358a23de4eaff51e1a207b0247adf8835b195161a6e331e32`.
- Backup das novas regras: `C:\Users\LIVRESOM\Documents\GitHub\_POTE_BACKUPS\firestore-live-post-f02-20261118.rules`.
- Nenhuma operação de escrita nos pedidos ou saldos reais ocorreu durante a auditoria; testes executados apenas em projeto demo do Emulator.
- **F02 permanece PARCIAL contra fraude de cliente adulterado e aguardando backend confiável**; não foi iniciado serviço pago. Monitorar leituras de regras do Firestore e autenticação real no Android.
