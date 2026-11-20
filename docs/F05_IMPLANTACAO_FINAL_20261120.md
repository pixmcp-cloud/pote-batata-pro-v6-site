# F05 — Implantação comercial final — 20/11/2026

## Escopo executado
- Release derivada da branch `main` mais recente, preservando as melhorias de sincronização V2 e sequenciamento já publicadas.
- Integração da interface de perdas físicas com o Worker exclusivo `pote-batata-f05-live` para todas as contas Pro licenciadas, sem depender do e-mail administrador.
- Fail-closed na interface: se o Worker estiver indisponível, a perda Pro não altera o estoque local nem tenta gravar via SDK.
- Regras Firestore específicas da F05: bloquear criação/alteração/exclusão via SDK de perdas físicas `losses / type=stock` e movimentações identificadas como perda para contas Pro. Permanecem disponíveis: registros de não pagamento/pedido, outras transações V2 de compra, produção e ajustes atualmente suportados, além do fluxo Free.
- Não foi habilitado o Worker geral F02/F20; escopo da publicação exclusivamente F05.

## Homologação
- Firestore Emulator: `test_f05_rules_emulator.cjs` PASS; `test_firestore_rules_emulator.cjs` PASS.
- Emulador HTTP multigrupo, executado previamente: ingredientes, bebidas, embalagens, adicionais, journal, idempotência e saldo insuficiente PASS.
- Worker unitário: 92/92 PASS.
- Interface: `test_losses.js`, `test_f05_worker_loss_bridge.mjs`, `test_auth_v2_integration.js`, `test_v2_storage.mjs`, `test_v2_batch_planner.mjs`, `test_sync_guard.mjs`, `test_dashboard_charts.js`, manifest de release PASS.
- Observação independente: `test_app_routes.js` detectou falha no fluxo de combo após reposição de refrigerante, sem relação direta com os arquivos F05 alterados. Não mascarar esse teste; tratar no trabalho de pedidos/combos.

## Publicação e rollback
- Backup da versão anterior de Hosting confirmado por `firebase hosting:clone potobatata-b71f3:live potobatata-b71f3:f05-rollback-20261120`. URL: https://potobatata-b71f3--f05-rollback-20261120-4ek4x0l0.web.app.
- Prévia `f05-preflight-20261120`, versão `10f621486e5ffa3c`. URL: https://potobatata-b71f3--f05-preflight-20261120-9qz9l81v.web.app. Validado: login presente, F05 universal, sem fallback local e sem retroceder correções recentes V2.
- Release: clone da prévia para o canal Hosting `live` confirmado. Leitura HTTP do domínio oficial `https://pdv.livresom.com/` confirmou scripts F05.
- Regras: `firebase deploy --only firestore:rules --project potobatata-b71f3` compilou e publicou com sucesso.
- Backend dedicado: `https://pote-batata-f05-live.pixmcp.workers.dev/health`, `writesEnabled:true`, `mode:f05-inventory-only` no teste.
- Dados existentes não foram migrados, apagados ou regravados. Não foram ativados serviços pagos.
- Se necessário reverter Hosting: clonar o canal `f05-rollback-20261120` para `live`. Regras devem ser revertidas separadamente usando o commit anterior, nunca supondo que rollback de Hosting altera o Firestore.

## Limite de responsabilidade F05
Homologada e publicada a operação de **registro de perdas físicas em contas Pro**. A transformação de toda compra, produção e cancelamento em operações exclusivamente por Worker é parte de F02/F20 e requer migração própria. Não confundir com a F05.
