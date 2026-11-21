# F05 V5 — Homologação Google OAuth e Firestore QA
**Data local:** 20/11/2026 (Santa Catarina, Brasil)
**Projeto comercial (não alterado):** `potobatata-b71f3`
**Projeto exclusivo de testes:** `pote-batata-qa-worker`
**Worker Cloudflare:** `pote-batata-guard-staging`

## Resultado da autorização e credenciais
O proprietário autorizou explicitamente a instalação e a realização de testes da credencial privada Google no Cloudflare. O Wrangler confirmou presença dos Secrets `GCP_CLIENT_EMAIL` e `GCP_PRIVATE_KEY`. Seus **valores nunca foram incluídos no GitHub, chat ou logs**. A chave local corresponde a uma identidade de serviço Google destinada exclusivamente ao projeto QA, e não a uma identidade do projeto comercial.

## Teste real sem mutações comerciais
- `test_f05_google_service_qa_readonly.mjs` utiliza `serviceAccessToken()` **da mesma implementação de produção** para obter um token OAuth via Google, sem exibi-lo.
- `GOOGLE_QA_SERVICE_OAUTH=PASS`.
- `GOOGLE_QA_DATABASE_METADATA_HTTP=200`.
- `GOOGLE_QA_ROOT_COLLECTIONS_HTTP=200`; nenhuma coleção/documento foi impresso.
- O projeto QA está ativo e a base `(default)` existe em `southamerica-east1`, edição STANDARD e `freeTier=true` (consulta administrativa).
- `test_f05_google_service_qa_transaction.mjs` realiza a **única gravação de teste efetiva** em uma coleção efêmera isolada `f05_qa_smoke`, com ID aleatório. Usa `createFirestoreRepository()` da aplicação, transação Firestore real e precondição `exists:false`. Verifica o marcador em nova transação e apaga o documento por REST autenticado.
- Resultado do ensaio transacional: `F05_QA_FIRESTORE_TRANSACTION_CREATE=PASS`, `READBACK=PASS`, `CLEANUP=PASS`, `F05_QA_GOOGLE_REAL_DB_E2E_PASS`. A versão aperfeiçoada do teste também realiza uma consulta após exclusão para confirmar ausência (não considerar esta etapa extra validada até executar a revisão).
- Nenhuma operação solicitou documentos do cliente, o banco comercial ou efetivação bancária. Nenhuma regra Firestore de produção foi modificada.

## Testes emuladores e navegador
- Firebase Emulator com regras de corte canário e Worker REST: **2/2 suítes aprovadas**, incluindo bloqueio de escrita direta por conta canário, contas antigas sem regressão, rollback ADM, compras, perdas, produção, cancelamento, conferência física e idempotência.
- Regressão Node: **103/103** aprovadas.
- Worker isolado: **43/43** testes aprovados, incluindo Firebase JWT, contas FREE, separação de tenants, concorrência e dupla baixa.
- Chrome mobile: **8 perfis de tela** aprovados (320, 360, 375, 390, 430, 768, 844 e 1366px), com autenticação obrigatória antes dos dados de contas, simulações de PDV e ausência de erros.
- Financeiro franquia: 7 e 30 dias em 320/375/430/768px aprovado.
- PDV: venda simulada automática para dinheiro (R$ 10,00), PIX (R$ 20,90), cartão (R$ 60,00), total R$ 90,90; pagamento na entrega continuou pendente. **Nenhum PIX real foi liquidado**.

## Limites críticos
1. **A chave instalada na Cloudflare é da conta QA.** O Worker staging permanece configurado com `FIREBASE_PROJECT_ID=potobatata-b71f3`. Isso **não autoriza assumir** que esta conta consegue acessar o Firestore comercial. Não conceder acesso produtivo por conveniência e não ativar escrita até haver credencial produtiva de menor privilégio e homologação completa.
2. `ENABLE_WRITES=false`; `CANARY_UIDS` não é liberado e flags do PDV `CLOUD_WORKER_ACTIVE=false`, `F05_INVENTORY_WORKER_ACTIVE=false`. **Cloudflare Secret armazenado não implica autenticação já executada pelo runtime Worker**. O teste OAuth real foi feito no PC com a mesma chave-fonte, usando a implementação de autenticação da aplicação.
3. Não houve login Google OAuth com a conta humana real do proprietário nem teste bancário de liquidação PIX/cartão. Identidades e estoque das emulações foram sintéticos.
4. Os testes não devem ser executados em CI sem credencial privada autorizada; os scripts falham se `POTE_F05_QA_CREDENTIAL_FILE` não for fornecido. O caminho e a chave privada não são salvos no repositório.
5. O único write real foi no **banco QA** e foi excluído com sucesso. Manter isolamento, cotas gratuitas e política de backup.

## Próxima fase de produção
Configurar identidade de serviço de escopo mínimo para o ambiente comercial **ou** instância QA separada corretamente apontada para o Firestore QA; confirmar runtime Cloudflare obtendo OAuth sem habilitar operações; executar canário autenticado real com contas artificiais; testar rollback e permissões de regras com todos os caminhos físicos antes de ativar o corte de escrita direta para uma empresa.
