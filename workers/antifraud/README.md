# Cloudflare Workers — Potê Batata Pro

**Estado em 20/11/2026: STAGING V5 / ESCRITAS DESATIVADAS.** O sistema público continua no Firebase V5. A migração do Worker foi implementada e testada, mas não foi ativada para contas reais. Exige conta Cloudflare autorizada, credenciais secretas, canário em banco de testes e bloqueio atômico das escritas diretas de operações críticas antes da ativação.

## O que foi implementado
- GET /health: responde estado sem dados de clientes.
- POST /v1/orders/produce: inicia produção, verifica receita registrada, insumos e bebidas existentes, estoque suficiente, e grava pedido/estoque/movimentos em uma única transação de Firestore.
- POST /v1/orders/cancel: cancela pedido, devolvendo ingredientes e bebidas ou registrando a perda material, sem duplo estorno.
- Firebase ID token assinado (RS256, projeto, assinatura, emissor, expiração, provedor Google e email_verified); UID obtido exclusivamente do token, nunca do corpo enviado pelo celular.
- Licença Pro/franquia verificada no servidor. Clientes Free e unidades bloqueadas não podem usar esta API.
- Chave de idempotência por operação e histórico privado no Firestore para evitar cobranças/consumos duplicados. Dois clientes concorrentes não devem conseguir consumir o mesmo saldo.
- A operação produz um pulso **V5** e avança a revisão de estoque, como o aplicativo V5 exige para sincronizar dois dispositivos.
- POST /v1/inventory/adjust: perda de insumo ou bebida por unidade-base; servidor lê cadastro, preço de compra e saldo, grava a perda, o movimento e a baixa em uma única transação, com UUID idempotente.

## Configuração
A configuração wrangler.toml inicia com ENABLE_WRITES = "false". Portanto, mesmo publicada, a rota de escrita devolve HTTP 423 e não altera dados. As credenciais da conta de serviço Google precisam ficar em Secrets da Cloudflare (GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY), e nunca em arquivos no GitHub ou no JavaScript do site. O arquivo .dev.vars está ignorado pelo Git.

O Worker não confirma pagamento bancário Pix. Para pedidos, o cliente só envia universo, ID do pedido e UUID de operação; nunca informa quantidade, valor, dados de outros clientes ou UID. Na perda, a quantidade negativa em unidade-base é permitida apenas para as rotas de estoque; o servidor lê e verifica a versão atual do saldo. Para cancelamento, acrescentar decision=return ou decision=loss.

## Repetir testes no PC
Abra a pasta workers/antifraud e execute:
1. npm ci --ignore-scripts --no-audit
2. npm run check
3. npm test
4. npx wrangler dev --local --port 8788
5. npx wrangler deploy --dry-run --outdir .wrangler/dry-run

O runtime local responde HTTP 200 em /health e HTTP 423 nas operações enquanto desativado. Os testes cobrem JWT assinado, tenant isolado, geração de movimentos, estoque negativo, reembolso físico, perdas, corrida entre dois clientes, idempotência e transações REST.

## Conclusão da ativação — exige a conta do proprietário
1. Conectar Cloudflare Free no PC com npx wrangler login (ação explícita no navegador).
2. Criar conta de serviço Google de menor privilégio possível para Firestore e registrar GCP_CLIENT_EMAIL / GCP_PRIVATE_KEY via wrangler secret put, nunca em conversa nem arquivo versionado.
3. Publicar ainda com ENABLE_WRITES=false; conferir URL e quotas.
4. Fazer homologação em conta sintética com acesso a Firestore de testes; em seguida testar um canário Pro real com autorização expressa.
5. Alterar o app para chamar a API com getIdToken() e UUID estável, sem aplicar uma segunda baixa local. Manter a confirmação e a sincronização via V5.
6. Só após homologação completa, passar ENABLE_WRITES=true e fechar nas Firestore Rules a escrita direta dos campos críticos (pedidos, estoque e movimentos). Manter rollback dos dois lados.

**Limitação importante:** enquanto o navegador ainda pode escrever diretamente por Firebase SDK, este Worker não é uma barreira antifraude obrigatória. Não ativar regras de bloqueio antes da migração do cliente. O Google service account tem acesso elevado e exige segredo seguro e rotação. O plano gratuito Workers tem limites; transações Firestore continuam consumindo cotas Firebase. Nenhum serviço pago foi ativado aqui.

## Primeira implantação na conta Cloudflare — 18/11/2026

O painel antigo `/workers/onboarding` devolve 404. O caminho correto é **Workers & Pages**: `https://dash.cloudflare.com/?to=/:account/workers/workers-and-pages`. O Wrangler confirmou que a conta estava autenticada. Como a conta ainda não tem um subdomínio `workers.dev`, foi criada a configuração `wrangler.private.toml` com `workers_dev = false` e `ENABLE_WRITES = "false"` para enviar a primeira versão **sem publicar qualquer rota**.

Comando aplicado: `wrangler deploy --config wrangler.private.toml`.

Resultado confirmado pelo Wrangler: Worker `pote-batata-guard-staging` carregado na Cloudflare, versão `beed9a8a-1858-4a74-bdde-cb73a0416c6c`, com `No targets deployed`. `wrangler deployments list --config wrangler.private.toml` confirmou a versão. **Não existe URL pública, não há fluxo do aplicativo apontando para esse Worker, não há segredos de conta de serviço Google configurados, e nenhuma transação real foi executada.**

Depois que o proprietário criar o subdomínio gratuitamente no painel, será possível testar o deploy com o `wrangler.toml` padrão (mantendo `ENABLE_WRITES=false`), acessar `/health`, configurar credenciais apenas por secrets e homologar em Firebase de testes antes de qualquer ativação transacional. Não ativar `ENABLE_WRITES=true` sem integração e bloqueio das regras de cliente concluídos.

## Endereço `workers.dev` publicado em homologação

Em 18/11/2026, a API oficial Cloudflare confirmou que esta conta **já possuía** o subdomínio global `pixmcp.workers.dev`; portanto não se alterou o subdomínio de outros aplicativos. Foi publicado `pote-batata-guard-staging.pixmcp.workers.dev` via Wrangler, versão `3acc47f3-b676-4e3b-81a8-990e16223bb6`, com `ENABLE_WRITES=false` e `preview_urls=false`.

Validação externa na URL: `GET /health` retornou **HTTP 200** com `writesEnabled:false` e `POST /v1/orders/produce` retornou **HTTP 423** sem executar gravação. O aplicativo PDV oficial continua sem integração com este endpoint. Nenhuma credencial Google Service Account foi instalada e nenhuma regra do Firestore de produção foi alterada nesta etapa. Criar o subdomínio `livresom` não foi necessário nem desejável, pois mudar o subdomínio global poderia afetar outros Workers existentes na conta.

## Ponte de integração pronta (ainda desativada)
O frontend possui `worker_bridge.mjs` com autenticação Firebase, sincronização prévia, UUID persistido em retries, falha fechada e reload V2 após confirmação de produção/cancelamento. Em `firebase_integration.js`, `CLOUD_WORKER_ACTIVE=false` impede sua execução em contas reais. `test_worker_bridge.mjs` validou as respostas, timeouts e duplicidades. O Firestore Emulator passou os testes transacionais de estoque e concorrência em duas regras distintas. **O teste REST de transações na versão Java do Emulator não é confiável** por falha de interpretação de BYTE_STRING; REST é validado em unitários simulados, e Firestore SDK valida transações reais do emulator. Para ligar produção ainda são necessárias credenciais de servidor, testes REST reais em ambiente isolado e regras Firestore que proíbam bypass do cliente. Ver `CLOUDFLARE_BRIDGE_STAGING_20261118.md`.

## Atualização de arquitetura V5 — 20/11/2026

O Worker agora opera **somente** com `users/{uid}/recordsV5/{recordId}`, `appState/v5`, `v5InventoryGuard` e `v5Pulse`. A consulta e a escrita usam o identificador codificado exatamente como `recordId()` do frontend V5. Não há qualquer rota de fallback para o V2.

**F05 — registro de perdas:** `POST /v1/inventory/adjust` aceita `{universe,group,itemId,delta,reason:"loss",lossReason,note,operationId}`. Os únicos grupos aceitos são `ingredients` e `beverages`; embalagens cadastradas como ingredientes preservam a unidade física do cadastro. Bebidas são sempre unidades inteiras. O servidor calcula custos apenas de dados cadastrados, grava a perda e o movimento de estoque, muda o estoque e incrementa a guarda com um único commit de Firestore. A repetição com o mesmo UUID não duplica o débito e UUID reaproveitado com dados diferentes recebe HTTP 409.

**Segurança:** a licença Google PRO/franquia é verificada no backend, o UID nunca vem do navegador, as origens são limitadas, o endpoint não aceita preço enviado pelo cliente, e `ENABLE_WRITES=false` permanece em ambos os arquivos Wrangler. A ponte do navegador continua com `CLOUD_WORKER_ACTIVE=false` e `F05_INVENTORY_WORKER_ACTIVE=false`; o site permanece na operação V5 existente, sem habilitar chamadas para o Worker.

**Limite de ativação:** para tornar o Worker uma barreira antifraude de fato é necessário que os navegadores deixem de poder atualizar diretamente as operações críticas no Firestore. Essa mudança de regras **não** foi feita porque interromperia o PDV atual. É proibido passar `ENABLE_WRITES=true` antes de autenticação em ambiente isolado, secrets de servidor, canário autorizado, migração de todas as chamadas relevantes e corte coordenado de regras.

Testes: `npm ci --ignore-scripts`, `npm run check`, `npm test`, `node ../../test_f05_worker_staging_contract.cjs` executados a partir desta pasta (último teste executado na raiz). A pipeline de CI testa também concorrência V5 e regras principais/endurecidas do Firestore Emulator.

## Segurança adicional: liberação canário obrigatória (20/11/2026)

Mesmo que `ENABLE_WRITES=true`, nenhuma rota de escrita poderá operar se a variável/secret `CANARY_UIDS` estiver ausente, vazia, inválida ou não contiver exatamente o UID de um usuário canário. Isso vale para produção, cancelamento e descarte, com resposta HTTP 423 antes de abrir transações Firestore. O UID **nunca** é aceito no corpo da requisição: sempre vem do Firebase ID token assinado.

Na Cloudflare, `CANARY_UIDS` deve ser cadastrado somente como Secret pela pessoa que administra a liberação (não em arquivo versionado). Não são permitidos `*`, padrões ou mais de 20 entradas. O valor precisa ser o UID de uma conta sintética criada especificamente para homologação, nunca o email mestre ou de um cliente. A conta também precisa ter licença apropriada e token Google válido.

**Não configurar canário de produção nem habilitar o Worker antes de completar as credenciais servidor, validar em Firestore isolado e coordenar o corte de regras.** Todas as configurações versionadas continuam com `ENABLE_WRITES=false`, independentemente da lista.

## REST integrado e concorrência (20/11/2026)

A consulta REST `GET documents/{id}?transaction=<bytes>` foi substituída por `POST documents:batchGet` com transação no corpo JSON, forma suportada pelo Firestore e que evita o erro conhecido `Unmapped JavaType: BYTE_STRING` do Firebase Emulator. O adaptador usa transações `beginTransaction`/`commit` com precondições `updateTime` e `exists:false`.

Quando o Firestore responde `ABORTED`/HTTP 409 ou HTTP 412, o Worker repete até três vezes, sempre em **nova transação**, com atraso variável, revalidação de dados e o mesmo UUID de operação. Não repete falhas de identidade, autorização, falta de saldo ou respostas indefinidas.

O teste integrado `test_firestore_worker_v5_rest_e2e.cjs` exercita as rotas HTTP reais, o adaptador REST e o Firestore Emulator: perde 100 g, produz 400 g, devolve 400 g, consulta a mesma operação idempotente e força corrida entre duas baixas de 1.500 g. Apenas uma pode finalizar; saldo final previsto 400 g e revisão 4. Tudo em `demo-pote-hardening`, sem credenciais produtivas.
