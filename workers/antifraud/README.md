# Cloudflare Workers — Potê Batata Pro

**Estado: STAGING / DESATIVADO.** O sistema público continua no Firebase. O Worker exige login Cloudflare e credenciais secretas antes de funcionar com dados reais.

## O que foi implementado
- GET /health: responde estado sem dados de clientes.
- POST /v1/orders/produce: inicia produção, verifica receita registrada, insumos e bebidas existentes, estoque suficiente, e grava pedido/estoque/movimentos em uma única transação de Firestore.
- POST /v1/orders/receipt: registro idempotente de recebimento DECLARADO pelo operador (não comprovação bancária). Exige pedido entregue e já produzido, método Dinheiro/Pix/Cartão e turno de caixa aberto, calcula total a partir do pedido no Firestore, atualiza somente o pedido, guarda e pulso V2, e grava workerEvent. NÃO gera um cashMovement duplicado; referencia opcional. Não é conciliação de Pix ou cartão. Rota ainda desativada no aplicativo comercial.- POST /v1/inventory/adjust: entrada física por compra, perda ou conferência, com idempotência, saldo validado no servidor, movimentação e evento de perda, guarda e pulso V2 atômicos. Parâmetros: universe, operationId, group (ingredients ou beverages), itemId, delta numérico em unidade-base, reason (purchase, loss ou correction), note opcional (obrigatória em correction). Compra física NÃO confirma pagamento, nota fiscal nem custo unitário novo; perdas usam custo conhecido do servidor ou custo desconhecido. A rota permanece bloqueada enquanto o Worker não for ativado.- POST /v1/orders/cancel: cancela pedido, devolvendo ingredientes e bebidas ou registrando a perda material, sem duplo estorno.
- Firebase ID token assinado (RS256, projeto, assinatura, emissor, expiração, provedor Google e email_verified); UID obtido exclusivamente do token, nunca do corpo enviado pelo celular.
- Licença Pro/franquia verificada no servidor. Clientes Free e unidades bloqueadas não podem usar esta API.
- Chave de idempotência por operação e histórico privado no Firestore para evitar cobranças/consumos duplicados. Dois clientes concorrentes não devem conseguir consumir o mesmo saldo.
- A operação produz um pulso V2 e avança revisão de estoque, como o aplicativo existente espera para se sincronizar.

## Dupla trava de ativação (18/11/2026)
Gravações reais exigem **ambas** as variáveis ENABLE_WRITES=true e
PRODUCTION_CUTOVER_APPROVED=true. Para projetos demo-* de Emulator, apenas
ENABLE_WRITES=true e necessário. O wrangler.toml versionado mantém as duas
chaves FALSE. Isto impede ativar dados reais mudando apenas um interruptor;
não substitui credenciais seguras, validação das Rules e corte do cliente.

## Configuração
A configuração wrangler.toml inicia com ENABLE_WRITES = "false". Portanto, mesmo publicada, a rota de escrita devolve HTTP 423 e não altera dados. As credenciais da conta de serviço Google precisam ficar em Secrets da Cloudflare (GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY), e nunca em arquivos no GitHub ou no JavaScript do site. O arquivo .dev.vars está ignorado pelo Git.

O Worker não confirma pagamento bancário Pix. O cliente só deve enviar universo, ID do pedido e UUID de operação; nunca enviar quantidade, valor, dados de outros clientes ou UID. Para cancelamento, acrescentar decision=return ou decision=loss.

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
5. Alterar o app para chamar a API com getIdToken() e UUID estável, sem aplicar uma segunda baixa local. Manter a confirmação e a sincronização via V2.
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
