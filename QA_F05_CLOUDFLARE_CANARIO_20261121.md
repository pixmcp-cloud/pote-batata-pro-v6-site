# F05 — Cloudflare runtime real e simulação de corte canário
Data: 21/11/2026 · Projeto Potê Batata Pro V5

## Escopo
Finalizar a homologação técnica da autenticação Google dentro da Cloudflare e executar, sem risco ao negócio, o ciclo de ativação canário → bloqueio de escrita direta → operação autoritativa → rollback.

**Produção:** https://pdv.livresom.com/  
**Worker de produção em homologação:** `pote-batata-guard-staging`, projeto `potobatata-b71f3`, `ENABLE_WRITES=false`.  
**Worker exclusivo do laboratório:** `pote-batata-guard-qa`, projeto `pote-batata-qa-worker`, `ENABLE_WRITES=false`.

## 1. Validação real executada no runtime Cloudflare
- Foi publicada uma segunda aplicação Worker sem rotas de vendas e sem endpoint de escrita, localizada em `workers/antifraud/src/qa_probe.mjs`.
- Configuração separada em `workers/antifraud/wrangler.qa.toml` impõe explicitamente o projeto Google de QA e mantém escritas desligadas. O código também recusa execução se o `FIREBASE_PROJECT_ID` não for QA **ou** `ENABLE_WRITES` não for `false`, mesmo com publicação equivocada.
- O endpoint de prova exige o Secret `F05_QA_PROBE_TOKEN` gerado com 48 bytes aleatórios criptográficos. Sem o token, retorna 403 antes de qualquer autenticação Google. As respostas não incluem email, token, documentos, chave ou detalhes IAM.
- **Teste efetivo realizado pelo runtime Cloudflare:** `POST /v1/qa/oauth-probe` com token secreto → HTTP **200**, `oauth=true`, `firestoreQaRead=true`, `writesEnabled=false`. O Worker obteve o token Google com seus próprios Cloudflare Secrets e consultou apenas os IDs de coleções do Firestore QA.
- Rotas públicas do PDV não apontam para este Worker, e nenhuma operação do QA Worker pode alterar dados Firestore.

## 2. Simulação completa da migração e reversão
Script `test_f05_canary_rollout_emulated.cjs` roda **somente** com `FIRESTORE_EMULATOR_HOST` local no projeto fictício `demo-pote-hardening`. Cria uma unidade canário e outra tradicional, com perfis, licenças, pedidos, estoque e guarda V5 **fictícios**.

O teste executou:
1. Antes da flag, cliente canário utiliza V5 direto e Worker nega chamada por falta de aprovação administrativa (403).
2. Administrador ativa `accessPolicy.workerAuthoritative=true` para aquela unidade; Firestore Rules bloqueiam alteração de estoque pelo SDK diretamente.
3. Worker autoriza produção pela identidade canário, atualiza V5, e a repetição com o mesmo UUID não duplica a baixa.
4. Tentativa de forjar outro UID no corpo do pedido é recusada; canário ausente da allowlist secreta recebe 423.
5. Dois dispositivos tentam descontar simultaneamente 1.000 g de um estoque de 1.500 g; **um conclui e outro é negado**, sem estoque negativo.
6. Worker devolve 400 g no cancelamento, sem restituição duplicada.
7. Administrador remove a flag; Worker volta a negar (403) e a operação V5 tradicional é restaurada para a unidade sem apagar dados.
8. Segunda empresa mantém seus saldos isolados durante o processo.

**Resultado:** `F05_SIMULATED_CANARY_ROLLOUT_ROLLBACK_PASS`. Os números são exclusivamente de laboratório e não representam uma transação bancária ou login Google real de usuário final.

## 3. Identidade Google do projeto comercial
A identidade `pote-batata-f05-worker@potobatata-b71f3.iam.gserviceaccount.com` foi confirmada **existente e ativa**, com permissão `roles/datastore.user`, sem aumento de privilégios ou criação de nova conta.

Foi comprovada também a capacidade administrativa de gerenciamento de chaves. A chave previamente instalada em `pote-batata-guard-staging` era de um projeto QA e **não deve ser considerada uma identidade de serviço comercial válida**. A substituição por chave própria da conta oficial fica condicionada à confirmação da execução sensível no painel de segurança; não afirmar sucesso sem confirmação e listagem posterior de Secrets.

## 4. Provas de segurança e regressão
- `workers/antifraud/test/qa_probe.test.mjs`: requisições sem chave não executam OAuth, configuração apontando para projeto comercial é recusada e não existe método de gravação.
- Node Worker + sondagem: **48/48** testes locais aprovados.
- Contratos do site mantêm `CLOUD_WORKER_ACTIVE=false` e `F05_INVENTORY_WORKER_ACTIVE=false`.
- Arquivo `firebase.json` mantém as regras comerciais existentes; `firestore.f05-cutover.qa.rules` segue isolado em configuração do Emulator.
- O teste canário completo foi incorporado à pipeline GitHub Actions para impedir regressões futuras.

## 5. Limites restantes da produção
É tecnicamente incorreto chamar o F05 de antifraude **comercial ativo** só porque o ciclo fictício passou. Para operação real obrigatória faltam, conforme o estado atual de homologação:
- Segredo da identidade oficial instalado e verificado no Worker que aponta ao projeto comercial.
- Autenticação de conta real canário por Google/Firebase, com autorização do titular, inclusive Android.
- Cobertura/homologação final de todos os fluxos de mutação de estoque e publicação coordenada das Firestore Rules com rollback testado.
- Habilitação progressiva de `ENABLE_WRITES` e das flags do frontend **apenas** após proteção contra bypass no Firestore. Não mudar essas condições automaticamente.

Não ativar serviços pagos; preservar estabilidade do PDV oficial e não modificar Floot.
