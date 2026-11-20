# Homologação V5 — emulação autenticada completa

**Data:** 20/11/2026  
**Versão oficial:** `c58a16bb7624cef4930fba07e9185b55d2dd673d`  
**Pull request:** https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/pull/5  
**Site:** https://pdv.livresom.com/  
**Projeto de emulação:** `demo-pote-hardening` (sem acesso ao Firestore oficial).

## Ambiente e testes executados

- Firebase Firestore Emulator com quatro usuários fictícios (duas empresas PRO independentes, uma conta FREE e uma empresa inédita usada para teste de corrida).
- **15 sessões autenticadas simuladas pelo SDK Firebase**, com atributos de conta Google verificada; não foi feito login OAuth real nem usado o perfil Google do proprietário.
- **44 verificações E2E aprovadas**: abertura de conta, separação de usuários, abertura e fechamento de caixa, compras, primeira venda com número vitalício #P0000001, duas sessões concorrentes tentando a mesma numeração, consumo de 500 g e lançamento de movimento de estoque, Pix confirmado sem duplicar recebimento, cancelamento com perda sem estorno indevido, criação de caixa seguinte, bloqueio do PDV para FREE, conexão temporariamente indisponível com recuperação e reconsulta independente sem duplicações.
- Teste adicional: **cinco sessões abrindo simultaneamente a mesma empresa V5 inédita**; todas conseguiram carregar a mesma base, sem histórico cruzado.
- O job GitHub Actions `44812802392` aprovou a suíte de Firestore Emulator usando as regras principais e as regras endurecidas, incluindo `test_firestore_v5_emulator.cjs`, `test_firestore_v5_multistock.cjs` e `test_firestore_v5_e2e.cjs`.
- **102/102 testes locais Node da pipeline** passaram sem regressões.
- Testes de navegador Chrome (cinco resoluções) da auditoria anterior passaram antes desta alteração. O código alterado agora estava restrito à inicialização concorrente do armazenamento.

## Defeito reproduzido e correção aplicada

Na primeira abertura concorrente de uma conta V5 ainda inexistente, duas sessões podiam iniciar a transação de criação de `appState/v5`, `v5InventoryGuard` e `v5Pulse`. Se uma sessão criasse os documentos antes da outra confirmar, a segunda podia receber `PERMISSION_DENIED` por tentar criar uma guarda que já passou a existir.

O método `firstLoad()` em `v5_storage.mjs` agora, **apenas em erros reconhecidos de disputa**, relê o documento da conta. Aceita a inicialização criada por outra sessão somente quando ela realmente existir e declarar `schemaVersion: 5`. Caso não exista ou seja incompatível, a falha original é preservada. As regras do Firestore **não foram enfraquecidas**.

## Publicação e não alteração das contas

- PR #5 mesclado em `main` após GitHub Actions aprovado.
- Firebase Hosting da V5 publicado sem mudança de regras, permissões, licenças, caixas, pedidos, custos ou estoque oficiais.
- Verificação HTTPS após o deploy comprovou que `https://pdv.livresom.com/v5_storage.mjs` contém a correção de primeira abertura simultânea, retorno `V5_PARALLEL_FIRST_LOGIN_PRODUCTION_OK`.
- Nenhum plano ou serviço pago foi ativado.

## Limite de cobertura

A emulação usa o mesmo SDK Firestore e as regras reais compiladas no ambiente demo com identidades fictícias. Ela valida transações autenticadas e sincronização do armazenamento, mas **não substitui um login Google OAuth real nem uma venda física em um celular**. Para isso seria necessário operar contas e recebimentos reais, o que não foi feito.
