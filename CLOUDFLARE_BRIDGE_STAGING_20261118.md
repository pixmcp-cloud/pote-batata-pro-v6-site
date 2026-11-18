# Cloudflare Worker — integração segura em homologação
Data: 18/11/2026

## Estado objetivo

- Worker publicado em `https://pote-batata-guard-staging.pixmcp.workers.dev`.
- `GET /health`: HTTP 200, `writesEnabled:false`.
- `POST /v1/orders/produce` e `POST /v1/orders/cancel`: HTTP 423 com `ENABLE_WRITES=false`. Não foram ativadas gravações reais.
- GitHub: branch `feat/cloudflare-worker-inventory-20261118`, sem exigir plano pago.
- Firebase Hosting: comportamento atual preservado; o cliente foi preparado para usar o Worker, mas o código contém `CLOUD_WORKER_ACTIVE=false` **fixo**, não uma preferência editável em localStorage.
- Nenhuma regra Firestore de produção, pedido, caixa, cliente, licença ou estoque real foi alterada nesta etapa.

## Ponte implementada no frontend

`worker_bridge.mjs` faz autenticação Firebase ID token, sincroniza pendências V2 *antes* de enviar pedido, gera um UUID estável por ação e pedido, chama `/v1/orders/produce` ou `/v1/orders/cancel`, e só atualiza o estado local após recarregar V2 do Firestore.

Falhas de conexão, HTTP 423, conflitos e respostas inesperadas **não provocam fallback de escrita direta**, evitando baixa dupla ou perda de recibos. A chave de idempotência persiste na sessão em caso de timeout e a mesma operação pode ser consultada novamente. O aplicativo não envia UID, custo, receita ou saldo de estoque no corpo da requisição.

As telas `source/pote_app_base.html` e `cancel_order_flow.js` dispõem de ramo condicional para a ponte autoritativa, mas continuam usando o comportamento anterior enquanto o sinalizador estiver desativado. Não foi introduzido segundo clique para o operador.

## Ensaios reproduzidos

- 19 testes unitários do Worker (JWT assinado, perfil, estoque, perdas, dupla execução, transações Firestore REST com transporte simulado).
- Testes da ponte do navegador: desligado por padrão, sincronia obrigatória, UUID e retries, HTTP 423 fail-closed, cancelamento remoto.
- Firestore Emulator com regras normais **e** reforçadas: produção, baixa exata de ingredientes/bebidas, recuperação física no cancelamento e concorrência de dois pedidos disputando 1.000 g (apenas um desconta 800 g).
- Regressão integrada em Chrome mobile, desktop, PDV, backup e relatórios do laboratório `qa/mobile/run_everything.ps1`: aprovada.
- O Firestore Emulator Java apresentou incompatibilidade na desserialização REST de tokens de transação binários (`Unmapped JavaType: BYTE_STRING`). Para não declarar cobertura inexistente, as transações de verdade foram testadas por adaptador **SDK** no emulador, e a serialização REST separadamente com respostas HTTP simuladas. A integração REST com Google Cloud real ainda requer homologação com credenciais de servidor e em projeto de teste.
- A interface REST agora usa timeout de 10 segundos; operações que não respondem falham sem qualquer gravação presumida no cliente.

## Próximo corte de ativação

1. Provisionar identidade de serviço Google específica, de privilégio mínimo para Firestore, e registrar credenciais como *Cloudflare secrets*, nunca em GitHub ou no navegador.
2. Homologar o Worker com `ENABLE_WRITES=true` **somente em projeto Firebase de testes** e conta sintética; exercitar produção, cancelamento, concorrência, licenças, perdas e idempotência pela API REST de produção.
3. Aplicar fluxo gradual ao aplicativo: habilitação apenas para contas sintéticas, bloqueio das escritas diretas em regras Firestore **no mesmo corte** e rollback testado.
4. Validar fechamento de caixa, gráficos, relatório de franquia e contabilização de custos após a migração de cada operação.
5. Somente então usar o Worker para contas reais. Nunca marcar a proteção como antifraude integral antes do bloqueio das escritas diretas.

**Custos:** Workers tem franquia gratuita de até 100 mil requisições/dia (sujeita às cotas), e o Firestore continua consumindo cotas de leituras/gravações. Nenhum plano pago foi ativado.

**Conclusão:** ponte funcional e testada em homologação; integração de produção e segredo de servidor **pendentes por segurança**, sem impacto no funcionamento atual.
